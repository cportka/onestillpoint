import { clamp, float, log, max, pow, select, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Blackbody radiator colour for a temperature in Kelvin, returned as LINEAR RGB.
 *
 * Tanner Helland's piecewise approximation of the Planckian locus (valid roughly
 * 1000–40000 K), converted from sRGB to linear. This is chromaticity only —
 * overall brightness (∝ T⁴, Stefan–Boltzmann) is applied by the caller.
 *
 * Each `select` evaluates both branches, so the discarded branch must stay
 * finite: the `max(..., 0.001)` guards keep `pow`/`log` away from non-positive
 * arguments even where their result is unused.
 */
export function blackbody(kelvin: Node<'float'>) {
  const t = clamp(kelvin, float(1000), float(40000)).div(100);

  const red = select(
    t.lessThanEqual(66),
    float(1),
    pow(max(t.sub(60), float(0.001)), float(-0.1332047)).mul(1.29893),
  );

  const greenLow = log(t).mul(0.3900816).sub(0.6318414);
  const greenHigh = pow(max(t.sub(60), float(0.001)), float(-0.0755148)).mul(1.1298909);
  const green = select(t.lessThanEqual(66), greenLow, greenHigh);

  const blueMid = log(max(t.sub(10), float(0.001))).mul(0.5432068).sub(1.1962541);
  const blue = select(
    t.greaterThanEqual(66),
    float(1),
    select(t.lessThanEqual(19), float(0), blueMid),
  );

  const srgb = clamp(vec3(red, green, blue), float(0), float(1));
  return srgb.mul(srgb); // sRGB → linear (γ≈2 approximation; component-wise)
}
