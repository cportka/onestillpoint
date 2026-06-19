import {
  abs,
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
  max,
  min,
  mix,
  normalize,
  screenUV,
  select,
  vec2,
  vec3,
} from 'three/tsl';
import type { BlackHole } from '../../scene/BlackHole';
import type { Uniforms } from '../uniforms';
import { mediumDensity, mediumSource } from './medium';
import { photonAccel, staticObserverRay } from './schwarzschild';
import { starfield } from './starfield';

// Hard cap on integration steps per pixel. Far from the disk rays take big
// steps and escape quickly; inside the disk slab the step shrinks to resolve
// the volume, and high optical depth terminates the march early.
const MAX_STEPS = 512;

/**
 * The black-hole shader. Per-pixel Schwarzschild photon geodesics by RK4
 * integration of a(x) = -3M·h²·x/r⁵ (schwarzschild.ts). Within a bounded slab
 * around the equatorial plane the ray marches the volumetric accretion dust
 * (medium.ts) — emission, single-scatter and Beer–Lambert extinction — so the
 * disk lenses correctly (including its far side wrapped over and under the
 * shadow) because we integrate along the bent ray. Captured rays end black;
 * escaping rays sample the lensed star field through the remaining transmittance.
 */
export function createBlackHoleNode(u: Uniforms, bh: BlackHole) {
  return Fn(() => {
    const M = bh.mass;
    const rIn = bh.diskInner;
    const rOut = bh.diskOuter;
    const yMax = bh.diskThickness.mul(3.5); // vertical half-extent of the slab

    // --- camera-local pinhole ray ---
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
    const radiance = vec3(0).toVar(); // accumulated emitted/scattered light
    const transmittance = float(1).toVar(); // remaining light fraction (Beer–Lambert)
    const volSamples = float(0).toVar(); // bounds cost on disk-grazing rays

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

      // Step finely near the disk; the slab is thin, so a coarse step must not
      // be allowed to jump over it. Within the disk's radial range we cap the
      // step by the distance to the plane (shrinking to volumeStep at y=0).
      const cylR = length(vec2(pos.x, pos.z));
      const distY = abs(pos.y);
      const inRadial = cylR.greaterThan(rIn.sub(2)).and(cylR.lessThan(rOut.add(2)));
      const inSlab = inRadial.and(distY.lessThan(yMax));

      const coarse = clamp(r.sub(M.mul(1.5)).mul(0.06), float(0.02), float(3));
      const diskStep = min(coarse, max(distY.mul(0.4), bh.volumeStep));
      const dl = select(inRadial, diskStep, coarse);
      const half = dl.mul(0.5);

      // RK4 for dx/dλ = v, dv/dλ = a(x).
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

      // Volume sample at the segment midpoint (front-to-back compositing).
      If(inSlab, () => {
        volSamples.assign(volSamples.add(1));
        const midPos = mix(pos, newPos, 0.5);
        const density = mediumDensity(midPos, u.time, bh);
        If(density.greaterThan(0.001), () => {
          const source = mediumSource(midPos, vel, density, bh);
          radiance.assign(radiance.add(transmittance.mul(source).mul(dl)));
          transmittance.assign(transmittance.mul(exp(density.mul(bh.extinction).mul(dl).mul(-1))));
        });
      });

      // Stop once the dust has absorbed what's behind it, or a grazing ray has
      // taken enough volume samples (bounds worst-case cost).
      If(transmittance.lessThan(0.02).or(volSamples.greaterThan(64)), () => {
        Break();
      });

      pos.assign(newPos);
      vel.assign(newVel);
    });

    // Background behind the dust: lensed star field if the ray escaped, else the
    // black horizon. Composite by the surviving transmittance.
    const bg = select(escaped.greaterThan(0.5), starfield(normalize(vel), float(1.2)), vec3(0));
    return radiance.add(transmittance.mul(bg));
  })();
}
