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
  pow,
  screenUV,
  select,
  vec2,
  vec3,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BodyUniforms } from '../bodyUniforms';
import type { BlackHole } from '../../scene/BlackHole';
import type { Uniforms } from '../uniforms';
import { segmentHitsSphere } from './bodies';
import { mediumDensity, mediumSource } from './medium';
import { photonAccel, staticObserverRay } from './schwarzschild';
import { starfield } from './starfield';

const MAX_STEPS = 512;

/**
 * The black-hole shader. Per-pixel Schwarzschild photon geodesics by RK4
 * integration of a(x) = -3M·h²·x/r⁵ (schwarzschild.ts). Along each bent ray:
 *   - the volumetric accretion dust is marched (medium.ts);
 *   - orbiting companion bodies are tested as opaque emissive spheres — because
 *     they sit in the hole's curved spacetime, they lens and are occluded by the
 *     shadow for free;
 *   - crossing the 2M horizon is the shadow; escaping samples the lensed stars.
 */
export function createBlackHoleNode(u: Uniforms, bh: BlackHole, bodies: BodyUniforms) {
  return Fn(() => {
    const M = bh.mass;
    const rIn = bh.diskInner;
    const rOut = bh.diskOuter;
    const yMax = bh.diskThickness.mul(3.5);

    // --- camera-local pinhole ray ---
    const ndc = screenUV.sub(0.5).mul(2);
    const px = ndc.x.mul(u.tanHalfFov).mul(u.aspect);
    // Flip vertical: the post-pipeline pass renders to an offscreen target whose
    // y is inverted vs the canvas, so without this a camera above the disk plane
    // renders as if seen from below. (Camera basis itself is unaffected.)
    const py = ndc.y.mul(u.tanHalfFov).mul(-1);
    const localDir = normalize(u.camForward.add(u.camRight.mul(px)).add(u.camUp.mul(py)));

    // --- initial geodesic state ---
    const ro = u.camPos;
    const rd = staticObserverRay(localDir, ro, M);
    const pos = ro.toVar();
    const vel = rd.toVar();

    const r0 = length(ro);
    // Integrate out far enough to reach the outermost companion (or just to the
    // camera radius when there are none).
    const escapeR = max(r0, bodies.sceneRadius);
    const h2 = dot(cross(pos, vel), cross(pos, vel)).toVar();
    const rHorizon = M.mul(2);

    // Photon acceleration = exact Schwarzschild (primary) + weak-field deflection
    // from any massive companion (linear superposition, a = -2·m·d/|d|³, validated
    // in scripts/validate-lensing.mjs). The whole secondary block is gated on
    // `lensingActive`, so with no lensing body it is one skipped uniform branch —
    // the default scene's geodesic is unchanged and costs nothing extra.
    const totalAccel = (p: Node<'vec3'>) => {
      const a = photonAccel(p, h2, M).toVar();
      If(bodies.lensingActive.greaterThan(0.5), () => {
        bodies.slots.forEach((slot) => {
          const d = p.sub(slot.posRadius.xyz);
          const invR3 = pow(dot(d, d).add(0.04), float(-1.5));
          a.assign(a.add(d.mul(slot.lensMass.mul(-2).mul(invR3))));
        });
      });
      return a;
    };

    const captured = float(0).toVar();
    const escaped = float(0).toVar();
    const radiance = vec3(0).toVar();
    const transmittance = float(1).toVar();
    const volSamples = float(0).toVar();
    const bodyHit = float(0).toVar();
    const bodyColor = vec3(0).toVar();

    Loop(MAX_STEPS, () => {
      const r = length(pos);

      If(r.lessThan(rHorizon), () => {
        captured.assign(1);
        Break();
      });
      If(r.greaterThan(escapeR).and(dot(pos, vel).greaterThan(0)), () => {
        escaped.assign(1);
        Break();
      });

      // Fine steps near the disk plane so a coarse step can't skip the thin slab.
      const cylR = length(vec2(pos.x, pos.z));
      const distY = abs(pos.y);
      const inRadial = cylR.greaterThan(rIn.sub(2)).and(cylR.lessThan(rOut.add(2)));
      const inSlab = inRadial.and(distY.lessThan(yMax));

      const coarse = clamp(r.sub(M.mul(1.5)).mul(0.06), float(0.02), float(3));
      const dl = select(inRadial, min(coarse, max(distY.mul(0.4), bh.volumeStep)), coarse);
      const half = dl.mul(0.5);

      // RK4 for dx/dλ = v, dv/dλ = a(x).
      const k1x = vel;
      const k1v = totalAccel(pos);
      const k2x = vel.add(k1v.mul(half));
      const k2v = totalAccel(pos.add(k1x.mul(half)));
      const k3x = vel.add(k2v.mul(half));
      const k3v = totalAccel(pos.add(k2x.mul(half)));
      const k4x = vel.add(k3v.mul(dl));
      const k4v = totalAccel(pos.add(k3x.mul(dl)));

      const sixth = dl.div(6);
      const newPos = pos.add(k1x.add(k2x.mul(2)).add(k3x.mul(2)).add(k4x).mul(sixth));
      const newVel = vel.add(k1v.add(k2v.mul(2)).add(k3v.mul(2)).add(k4v).mul(sixth));

      // Volume sample at the segment midpoint (front-to-back compositing).
      If(inSlab, () => {
        volSamples.assign(volSamples.add(1));
        const midPos = mix(pos, newPos, 0.5);
        const density = mediumDensity(midPos, u.time, u.timeBlur, bh).mul(u.formation);
        If(density.greaterThan(0.001), () => {
          const source = mediumSource(midPos, vel, density, bh);
          radiance.assign(radiance.add(transmittance.mul(source).mul(dl)));
          transmittance.assign(transmittance.mul(exp(density.mul(bh.extinction).mul(dl).mul(-1))));
        });
      });

      // Opaque companion spheres (lensed + occluded by the curved-space march).
      bodies.slots.forEach((slot) => {
        const center = slot.posRadius.xyz;
        const radius = slot.posRadius.w;
        If(radius.greaterThan(0).and(segmentHitsSphere(pos, newPos, center, radius)), () => {
          bodyColor.assign(slot.color);
          bodyHit.assign(1);
        });

        // A secondary black hole (lensMass > 0) gets a luminous lensed photon-ring
        // halo so it reads as a black hole, not an unlit sphere. The glow is
        // integrated ∝ dl (step-size independent) and gated, so ordinary
        // stars/planets — and the default scene — cost nothing here.
        If(slot.lensMass.greaterThan(0), () => {
          const dC = length(mix(pos, newPos, 0.5).sub(center));
          const shell = dC.sub(radius.mul(1.25)).div(radius.mul(0.5));
          const glow = exp(shell.mul(shell).mul(-1)).mul(dl).mul(u.formation);
          radiance.assign(radiance.add(transmittance.mul(vec3(1.0, 0.7, 0.45)).mul(glow.mul(3))));
        });
      });

      If(transmittance.lessThan(0.02).or(volSamples.greaterThan(64)).or(bodyHit.greaterThan(0.5)), () => {
        Break();
      });

      pos.assign(newPos);
      vel.assign(newVel);
    });

    // Background behind the dust: a hit body, else the lensed star field (escaped)
    // or the black horizon. Composite by the surviving transmittance.
    const stars = starfield(normalize(vel), float(1.2)).mul(escaped);
    const background = select(bodyHit.greaterThan(0.5), bodyColor.mul(u.formation), stars);
    return radiance.add(transmittance.mul(background));
  })();
}
