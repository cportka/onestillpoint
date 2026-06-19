import { cross, dot, float, length, max, mix, normalize, pow, sqrt, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlackHole } from '../../scene/BlackHole';

/**
 * Shared accretion-disk physics (Shakura–Sunyaev / Novikov–Thorne), reused by
 * the volumetric medium. All radii are cylindrical (the gas orbits in the
 * equatorial plane). Validated in scripts/validate-disk.mjs.
 */

/** Dimensionless flux (∝ T⁴), zero at the ISCO inner edge, peaking near 8M. */
export function diskFlux(r: Node<'float'>, rIn: Node<'float'>) {
  return max(float(1).sub(sqrt(rIn.div(r))).div(pow(r.div(rIn), float(3))), float(0));
}

/** Local blackbody temperature (K) at cylindrical radius r. */
export function diskTemperature(r: Node<'float'>, bh: BlackHole) {
  return bh.diskTemp.mul(pow(diskFlux(r, bh.diskInner), float(0.25)));
}

/**
 * Combined relativistic shift g = δ_doppler · √(1−2M/r) at a disk point, for a
 * photon travelling along `photonVel` in our backward trace (so the
 * emitter→observer direction is −vel). The Keplerian gas has local speed
 * β = √(M/(r−2M)); the approaching side gets g > 1 (brighter, bluer). The 0/1
 * toggles fall back to 1 (no shift) for honest A/B.
 */
export function relativisticShift(p: Node<'vec3'>, photonVel: Node<'vec3'>, bh: BlackHole) {
  const M = bh.mass;
  const r = length(vec2(p.x, p.z));
  const radial = normalize(vec3(p.x, float(0), p.z));
  const tangential = normalize(cross(vec3(0, 1, 0), radial));
  const beta = sqrt(M.div(max(r.sub(M.mul(2)), float(0.001))));
  const betaVec = tangential.mul(beta);
  const gamma = float(1).div(sqrt(max(float(1).sub(beta.mul(beta)), float(0.0001))));
  const nHat = normalize(photonVel.mul(-1));
  const doppler = float(1).div(gamma.mul(float(1).sub(dot(betaVec, nHat))));
  const grav = sqrt(max(float(1).sub(M.mul(2).div(r)), float(0.0001)));
  const dEff = mix(float(1), doppler, bh.doppler);
  const gEff = mix(float(1), grav, bh.redshift);
  return dEff.mul(gEff);
}
