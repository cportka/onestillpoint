import { abs, asin, atan, clamp, float, fract, If, max, mix, pow, smoothstep, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { starfield } from './starfield';
import { fbm } from './turbulence';

const TWO_PI = 6.2831853;
const PI = 3.14159265;

/** Thin bright lines wherever `coord × count` lands on an integer. */
function gridLines(coord: Node<'float'>, count: number) {
  const f = abs(fract(coord.mul(count).add(0.5)).sub(0.5));
  return smoothstep(float(0.035), float(0), f);
}

/**
 * Mode 1 — a high-contrast emission nebula. A single brightness field drives a
 * colour ramp: the DARKS are dim blue-green, the LIGHTS are saturated orange (so
 * colour tracks luminance — orange where it's bright, blue-green in the shadow).
 * Most of the field is dark; bright orange cores are rare and bloom.
 */
function nebula(dir: Node<'vec3'>) {
  const a = fbm(dir.mul(1.7)).mul(0.5).add(0.5);
  const b = fbm(dir.mul(3.8).add(vec3(19, 7, 13))).mul(0.5).add(0.5);
  const dust = fbm(dir.mul(2.6).add(vec3(40, 5, 30))).mul(0.5).add(0.5);

  const g = pow(smoothstep(float(0.52), float(0.9), a.mul(0.6).add(b.mul(0.5))), float(1.8));
  const darkBlueGreen = vec3(0.02, 0.08, 0.07); // the darkness has colour, dim
  const orange = vec3(1.5, 0.5, 0.04); // the light is saturated orange
  const color = mix(darkBlueGreen, orange, g);

  const dustMask = smoothstep(float(0.46), float(0.72), dust);
  const carved = mix(color, darkBlueGreen.mul(0.3), dustMask); // pillars → deeper dark
  const tips = vec3(1.6, 0.95, 0.5).mul(pow(b, float(10)).mul(2.5)); // hot orange-white knots
  return carved.add(tips).add(starfield(dir, float(0.35)));
}

/**
 * Mode 2 — Filaments: a high-contrast cosmic web. Ridged noise (1 − |noise|)
 * makes sharp threads over big dark gaps, with brighter knots at the
 * intersections. Tinted cool blue-silver so it always reads as *background*
 * against the warm-white central disk rather than washing into it.
 */
function filaments(dir: Node<'vec3'>) {
  const r1 = float(1).sub(abs(fbm(dir.mul(2.2))));
  const r2 = float(1).sub(abs(fbm(dir.mul(5.0).add(vec3(13, 9, 21)))));
  const web = max(float(0), r1.mul(0.55).add(r2.mul(0.55)).sub(0.52)); // high threshold → dark gaps
  const webGlow = pow(web, float(3)).mul(6);
  const nodes = pow(max(float(0), r1.mul(r2)), float(10)).mul(4); // bright cluster knots
  const intensity = clamp(webGlow.add(nodes), float(0), float(2.6)); // lower cap → less blowout
  return vec3(0.5, 0.68, 1.0).mul(intensity).add(starfield(dir, float(0.22)));
}

/**
 * Mode 3 — a glowing spacetime lattice; lat/long lines bend through the lensing.
 * Major lines plus fainter minor lines four to a cell for a finer grid.
 */
function lattice(dir: Node<'vec3'>) {
  const lon = atan(dir.z, dir.x).div(TWO_PI).add(0.5);
  const lat = asin(clamp(dir.y, float(-0.999), float(0.999))).div(PI).add(0.5);
  const major = max(gridLines(lon, 24), gridLines(lat, 12));
  const minor = max(gridLines(lon, 96), gridLines(lat, 48)).mul(0.3); // in-between lines
  return vec3(0.35, 0.72, 0.78).mul(max(major, minor)).add(starfield(dir, float(0.35)));
}

/**
 * The background sky, selected by a mode uniform and sampled along each photon's
 * bent escape direction — so every option lenses around the holes. Mode 0 is the
 * original star field (the default); 1–3 are stylised alternatives. Each mode is
 * gated, so only the selected one runs.
 */
export function background(dir: Node<'vec3'>, mode: Node<'float'>) {
  const col = vec3(0).toVar();
  If(mode.lessThan(0.5), () => col.assign(starfield(dir, float(1.2))));
  If(mode.greaterThan(0.5).and(mode.lessThan(1.5)), () => col.assign(nebula(dir)));
  If(mode.greaterThan(1.5).and(mode.lessThan(2.5)), () => col.assign(filaments(dir)));
  If(mode.greaterThan(2.5), () => col.assign(lattice(dir)));
  return col;
}
