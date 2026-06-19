import { exp, float, length, max, pow, smoothstep, vec2, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { BlackHole } from '../../scene/BlackHole';
import { blackbody } from './blackbody';
import { diskTemperature, relativisticShift } from './disk';
import { advectedCoord } from './flow';
import { fbm } from './turbulence';

/**
 * Dust density at a world point and time: a radial envelope (smooth from the
 * ISCO to the outer edge) × a vertical Gaussian (thin disk) × advected
 * turbulence that carves wispy filaments and gaps.
 */
export function mediumDensity(p: Node<'vec3'>, time: Node<'float'>, bh: BlackHole) {
  const r = length(vec2(p.x, p.z));

  const inner = smoothstep(bh.diskInner, bh.diskInner.add(2), r);
  const outer = smoothstep(bh.diskOuter, bh.diskOuter.sub(5), r);
  const radial = inner.mul(outer);

  const yh = p.y.div(bh.diskThickness);
  const vertical = exp(yh.mul(yh).mul(-1)); // Gaussian in height

  const turb = fbm(advectedCoord(p, time, bh));
  const filaments = max(float(0), float(1).add(turb.mul(bh.turbAmount)));

  return radial.mul(vertical).mul(filaments).mul(bh.diskDensity);
}

/**
 * Source radiance per unit length at a sample (already multiplied by density):
 *   - emission from heat, blackbody(g·T) relativistically beamed by g⁴;
 *   - a cheap single-scatter term — the dust catching the hot inner light,
 *     brightest near the inner edge (∝ 1/r²), no shadow rays.
 */
export function mediumSource(
  p: Node<'vec3'>,
  photonVel: Node<'vec3'>,
  density: Node<'float'>,
  bh: BlackHole,
) {
  const r = length(vec2(p.x, p.z));
  const g = relativisticShift(p, photonVel, bh);

  const emission = blackbody(g.mul(diskTemperature(r, bh)))
    .mul(pow(g, float(4)))
    .mul(bh.emissiveStrength);

  const illum = bh.diskInner.div(r);
  const scatter = vec3(0.7, 0.8, 1.0).mul(illum.mul(illum)).mul(bh.scatterStrength);

  return emission.add(scatter).mul(density);
}
