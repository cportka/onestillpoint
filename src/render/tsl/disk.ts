import { cross, dot, float, length, max, mix, normalize, pow, sqrt, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlackHole } from '../../scene/BlackHole';
import { blackbody } from './blackbody';

/**
 * Observed radiance of the static, geometrically thin Shakura–Sunyaev /
 * Novikov–Thorne accretion disk where a photon geodesic crosses the equatorial
 * plane. Returns linear HDR RGB. (Phase 2: still — motion arrives in Phase 3.)
 *
 *  - Temperature profile T(r) ∝ [(1 − √(r_in/r)) / r³]^¼ → blackbody colour.
 *  - The gas rides a Keplerian circular orbit, β = √(M/(r−2M)) (0.5 c at the
 *    ISCO). We apply the special-relativistic Doppler factor δ and the
 *    gravitational redshift √(1−2M/r); their product g shifts the observed
 *    temperature (colour) while brightness scales as g⁴. The approaching side
 *    therefore beams brighter and bluer — the headline accuracy cue.
 *
 * `photonVel` is the geodesic's direction at the crossing (pointing away from
 * the camera in our backward trace), so the emitter→observer direction is −vel.
 */
export function sampleDisk(
  crossPos: Node<'vec3'>,
  photonVel: Node<'vec3'>,
  bh: BlackHole,
) {
  const M = bh.mass;
  const rIn = bh.diskInner;
  const r = length(crossPos);

  // Novikov–Thorne dimensionless flux (∝ T⁴), zero at the inner edge.
  const flux = max(float(1).sub(sqrt(rIn.div(r))).div(pow(r.div(rIn), float(3))), float(0));
  const tEmit = bh.diskTemp.mul(pow(flux, float(0.25)));

  // Keplerian orbital velocity (local frame), tangential, CCW seen from +y.
  const radial = normalize(crossPos);
  const tangential = normalize(cross(vec3(0, 1, 0), radial));
  const beta = sqrt(M.div(r.sub(M.mul(2))));
  const betaVec = tangential.mul(beta);
  const gamma = float(1).div(sqrt(float(1).sub(beta.mul(beta))));

  const nHat = normalize(photonVel.mul(-1)); // emitter → observer
  const doppler = float(1).div(gamma.mul(float(1).sub(dot(betaVec, nHat))));
  const grav = sqrt(max(float(1).sub(M.mul(2).div(r)), float(0.0001)));

  // 0/1 toggles → fall back to 1 (no shift) when disabled, for honest A/B.
  const dEff = mix(float(1), doppler, bh.doppler);
  const gEff = mix(float(1), grav, bh.redshift);
  const g = dEff.mul(gEff);

  const tObs = g.mul(tEmit);
  return blackbody(tObs).mul(flux).mul(pow(g, float(4))).mul(bh.diskBrightness);
}
