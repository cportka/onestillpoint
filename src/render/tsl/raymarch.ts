import {
  Break,
  clamp,
  cross,
  dot,
  exp,
  float,
  Fn,
  If,
  length,
  Loop,
  min,
  normalize,
  pow,
  screenUV,
  vec3,
} from 'three/tsl';
import type { BlackHole } from '../../scene/BlackHole';
import type { Uniforms } from '../uniforms';
import { photonAccel, staticObserverRay } from './schwarzschild';
import { starfield } from './starfield';

// Hard cap on integration steps per pixel. Most rays escape in well under 30
// steps; only near-critical rays winding the photon sphere approach this. The
// CPU validator confirms this budget resolves the shadow edge exactly.
const MAX_STEPS = 512;

/**
 * The Phase 1 black-hole shader: per-pixel Schwarzschild photon geodesics by RK4
 * integration of a(x) = -3M·h²·x/r⁵ (see schwarzschild.ts). Rays that cross the
 * horizon are the shadow (black); rays that escape sample the lensed star field;
 * rays grazing the photon sphere brighten into the photon ring.
 */
export function createBlackHoleNode(u: Uniforms, bh: BlackHole) {
  return Fn(() => {
    const M = bh.mass;

    // --- camera-local pinhole ray (same setup the dust march will inherit) ---
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
    const minR = r0.toVar(); // closest approach (periapsis) → photon-ring test

    Loop(MAX_STEPS, () => {
      const r = length(pos);
      minR.assign(min(minR, r));

      // Crossed the horizon → captured (shadow).
      If(r.lessThan(rHorizon), () => {
        captured.assign(1);
        Break();
      });
      // Climbed back out past the start radius, heading outward → escaped.
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
      pos.assign(pos.add(k1x.add(k2x.mul(2)).add(k3x.mul(2)).add(k4x).mul(sixth)));
      vel.assign(vel.add(k1v.add(k2v.mul(2)).add(k3v.mul(2)).add(k4v).mul(sixth)));
    });

    const notCaptured = float(1).sub(captured);

    // Lensed star field along the escape direction (escaped rays only).
    const bg = starfield(normalize(vel), float(1)).mul(escaped);

    // Photon ring: photons whose periapsis grazes the photon sphere (3M) are
    // strongly magnified, forming a thin bright ring just outside the shadow.
    // A Gaussian in closest-approach is a stand-in for that magnification; the
    // true ring of lensed *disk* light arrives with the accretion disk (Phase 2).
    const ringT = minR.sub(M.mul(3)).div(M.mul(0.6));
    const ring = exp(pow(ringT, 2).mul(-1)).mul(notCaptured);
    const ringColor = vec3(0.75, 0.82, 1.0).mul(ring).mul(0.5);

    return bg.add(ringColor);
  })();
}
