import { dot, float, length, max, normalize, pow, sqrt } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Schwarzschild photon-geodesic helpers, in geometric units (G = c = 1) where
 * the mass M is the length scale: horizon 2M, photon sphere 3M, ISCO 6M, and
 * critical impact parameter (shadow) 3√3·M.
 *
 * The math here is validated on the CPU in scripts/validate-geodesic.mjs, which
 * recovers b_crit = 3√3·M and the textbook apparent shadow radius to machine
 * precision. These are plain functions (not TSL `Fn`s): they inline into the
 * node graph, so photonAccel's per-step calls live in the one emitted loop body.
 */

/**
 * Photon "acceleration" for the Cartesian central-force form of the null
 * geodesic:  a(x) = -3·M·h²·x / r⁵.
 *
 * Equivalent to the Schwarzschild equatorial orbit equation
 *   d²u/dφ² + u = 3M·u²    (u = 1/r),
 * the 3M·u² term being the GR light-bending correction Newtonian gravity lacks.
 * h² = |x×v|² is the (conserved) angular momentum, computed once per ray.
 */
export function photonAccel(pos: Node<'vec3'>, h2: Node<'float'>, mass: Node<'float'>) {
  const r2 = dot(pos, pos);
  const invR5 = pow(r2, float(-2.5)); // (r²)^(-5/2) = r⁻⁵
  return pos.mul(float(-3).mul(mass).mul(h2).mul(invR5));
}

/**
 * Convert a camera-local view ray into a Schwarzschild *coordinate* velocity for
 * a static observer at `camPos`, by scaling the radial component by √(1−2M/r)
 * (the static-observer tetrad). Without this the apparent shadow is a few %
 * too large at finite distance and grows wrong as the camera approaches the
 * hole; with it the angular radius is exact at every distance.
 */
export function staticObserverRay(
  dir: Node<'vec3'>,
  camPos: Node<'vec3'>,
  mass: Node<'float'>,
) {
  const r = length(camPos);
  const er = camPos.div(r); // outward radial unit vector
  const radial = dot(dir, er); // signed radial component of the ray
  const tangential = dir.sub(er.mul(radial));
  const sr = sqrt(max(float(1).sub(mass.mul(2).div(r)), float(0.0001)));
  return normalize(tangential.add(er.mul(radial.mul(sr))));
}
