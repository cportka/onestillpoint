import {
  Break,
  clamp,
  cross,
  dot,
  float,
  Fn,
  If,
  length,
  Loop,
  mix,
  normalize,
  screenUV,
  vec3,
} from 'three/tsl';
import type { BlackHole } from '../../scene/BlackHole';
import type { Uniforms } from '../uniforms';
import { sampleDisk } from './disk';
import { photonAccel, staticObserverRay } from './schwarzschild';
import { starfield } from './starfield';

// Hard cap on integration steps per pixel. Most rays escape in well under 30
// steps; only near-critical rays winding the photon sphere approach this. The
// CPU validator confirms this budget resolves the shadow edge exactly.
const MAX_STEPS = 512;

/**
 * The black-hole shader. Per-pixel Schwarzschild photon geodesics by RK4
 * integration of a(x) = -3M·h²·x/r⁵ (see schwarzschild.ts). Along each ray:
 *   - crossing the equatorial plane within [r_in, r_out] hits the opaque thin
 *     accretion disk (Phase 2) — this also lenses the disk's far side into arcs
 *     above and below the shadow;
 *   - crossing the 2M horizon is the shadow (black);
 *   - escaping samples the gravitationally lensed star field.
 */
export function createBlackHoleNode(u: Uniforms, bh: BlackHole) {
  return Fn(() => {
    const M = bh.mass;
    const rIn = bh.diskInner;
    const rOut = bh.diskOuter;

    // --- camera-local pinhole ray (the dust march will inherit this setup) ---
    const ndc = screenUV.sub(0.5).mul(2);
    const px = ndc.x.mul(u.tanHalfFov).mul(u.aspect);
    const py = ndc.y.mul(u.tanHalfFov);
    const localDir = normalize(u.camForward.add(u.camRight.mul(px)).add(u.camUp.mul(py)));

    // --- initial geodesic state, in Schwarzschild coordinates ---
    const ro = u.camPos;
    const rd = staticObserverRay(localDir, ro, M);
    const pos = ro.toVar();
    const vel = rd.toVar();

    const r0 = length(ro);
    const h2 = dot(cross(pos, vel), cross(pos, vel)).toVar(); // |x×v|², conserved
    const rHorizon = M.mul(2);

    const captured = float(0).toVar();
    const escaped = float(0).toVar();
    const diskHit = float(0).toVar();
    const diskColor = vec3(0).toVar();

    Loop(MAX_STEPS, () => {
      const r = length(pos);

      If(r.lessThan(rHorizon), () => {
        captured.assign(1);
        Break();
      });
      If(r.greaterThan(r0).and(dot(pos, vel).greaterThan(0)), () => {
        escaped.assign(1);
        Break();
      });

      // Adaptive affine step: fine near the hole, coarse far out.
      const dl = clamp(r.sub(M.mul(1.5)).mul(0.06), float(0.02), float(4));
      const half = dl.mul(0.5);

      // RK4 for dx/dλ = v, dv/dλ = a(x) (a depends only on x given conserved h²).
      const k1x = vel;
      const k1v = photonAccel(pos, h2, M);
      const k2x = vel.add(k1v.mul(half));
      const k2v = photonAccel(pos.add(k1x.mul(half)), h2, M);
      const k3x = vel.add(k2v.mul(half));
      const k3v = photonAccel(pos.add(k2x.mul(half)), h2, M);
      const k4x = vel.add(k3v.mul(dl));
      const k4v = photonAccel(pos.add(k3x.mul(dl)), h2, M);

      const sixth = dl.div(6);
      const newPos = pos.add(k1x.add(k2x.mul(2)).add(k3x.mul(2)).add(k4x).mul(sixth));
      const newVel = vel.add(k1v.add(k2v.mul(2)).add(k3v.mul(2)).add(k4v).mul(sixth));

      // Equatorial-plane crossing (y changes sign) → opaque thin disk.
      If(pos.y.mul(newPos.y).lessThan(0), () => {
        const t = pos.y.div(pos.y.sub(newPos.y)); // fraction of step to the plane
        const cp = mix(pos, newPos, t);
        const cr = length(cp);
        If(cr.greaterThan(rIn).and(cr.lessThan(rOut)), () => {
          diskColor.assign(sampleDisk(cp, vel, bh));
          diskHit.assign(1);
          Break();
        });
      });

      pos.assign(newPos);
      vel.assign(newVel);
    });

    // Compose: disk over (lensed star field for escaped rays; black otherwise).
    const bg = starfield(normalize(vel), float(1.2)).mul(escaped);
    return mix(bg, diskColor, diskHit);
  })();
}
