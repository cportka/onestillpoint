import { cos, float, length, normalize, sin, sqrt, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlackHole } from '../../scene/BlackHole';

/** Keplerian angular velocity Ω(r) = √(M/r³) — inner orbits faster than outer. */
export function keplerOmega(r: Node<'float'>, mass: Node<'float'>) {
  return sqrt(mass.div(r.mul(r).mul(r)));
}

/**
 * The advected sample coordinate for the turbulence field. The dust is carried
 * by the flow, so we look up a *static* noise field at a coordinate that moves
 * with the gas — the field never reseeds, which is what keeps animated
 * volumetrics from boiling. Three motions compose:
 *
 *   - **differential rotation**: rotate into a frame co-rotating at Ω(r). Since
 *     Ω depends on radius, inner gas winds ahead of outer → the field shears
 *     into trailing spiral arms (the accretion-disk look);
 *   - **infall**: a slow radial drift so features spiral inward;
 *   - **churn**: a smooth drift through the noise so turbulence evolves rather
 *     than rigidly rotating (the role 4D noise would play).
 */
export function advectedCoord(p: Node<'vec3'>, time: Node<'float'>, bh: BlackHole) {
  const r = length(vec2(p.x, p.z)); // cylindrical radius
  const ang = keplerOmega(r, bh.mass).mul(time).mul(bh.rotationSpeed);
  const ca = cos(ang);
  const sa = sin(ang);

  // Rotate p by -ang about the y axis (into the co-rotating frame).
  const pr = vec3(p.x.mul(ca).sub(p.z.mul(sa)), p.y, p.x.mul(sa).add(p.z.mul(ca)));

  const radial = normalize(vec3(p.x, float(0), p.z));
  const infall = radial.mul(bh.infallRate.mul(time)); // sample outward over time → inward flow
  const churn = vec3(float(0), bh.churnRate.mul(time), float(0));

  return pr.mul(bh.turbScale).add(infall).add(churn);
}
