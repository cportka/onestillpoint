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
 * Mode 1 — a high-contrast emission nebula: dominant saturated-orange gas over
 * deep blue-green darks (so the shadows carry colour, not just black), carved by
 * black dust pillars. Tuned to read even past the disk's washing halo.
 */
function nebula(dir: Node<'vec3'>) {
  const base = fbm(dir.mul(1.8)).mul(0.5).add(0.5); // large-scale structure
  const detail = fbm(dir.mul(4.0).add(vec3(19, 7, 13))).mul(0.5).add(0.5);
  const dust = fbm(dir.mul(2.6).add(vec3(40, 5, 30))).mul(0.5).add(0.5);

  // Orange emission, dominant and saturated, with a hard-contrast mask.
  const orangeMask = pow(smoothstep(float(0.4), float(0.82), base), float(1.6));
  const orange = vec3(1.3, 0.5, 0.06);
  const ember = vec3(0.5, 0.12, 0.02);
  const emission = mix(ember, orange, smoothstep(float(0.45), float(1), orangeMask)).mul(orangeMask);

  // Coloured darks: deep blue-green where the orange isn't, instead of black.
  const coolMask = smoothstep(float(0.3), float(0.8), detail).mul(float(1).sub(orangeMask));
  const darks = mix(vec3(0.02, 0.05, 0.06), vec3(0.03, 0.18, 0.15), coolMask);

  const gas = darks.add(emission);
  const dustMask = smoothstep(float(0.45), float(0.72), dust); // pillars carve down
  const carved = gas.mul(float(1).sub(dustMask.mul(0.85))).mul(1.7);

  const tips = vec3(1.2, 0.9, 0.6).mul(pow(detail, float(9)).mul(2.2)); // bright knots
  return carved.add(tips).add(starfield(dir, float(0.45)));
}

/**
 * Mode 2 — Filaments: a high-contrast monochrome cosmic web. Ridged noise
 * (1 − |noise|) makes sharp silver threads over near-black gaps, with brighter
 * knots at the intersections. The "lots of light" sky, but with real contrast.
 */
function filaments(dir: Node<'vec3'>) {
  const r1 = float(1).sub(abs(fbm(dir.mul(2.2))));
  const r2 = float(1).sub(abs(fbm(dir.mul(5.0).add(vec3(13, 9, 21)))));
  // Higher threshold → more dark space; steeper power → sharper, brighter threads.
  const web = max(float(0), r1.mul(0.55).add(r2.mul(0.55)).sub(0.42));
  const webGlow = pow(web, float(3.5)).mul(7);
  const nodes = pow(max(float(0), r1.mul(r2)), float(9)).mul(5); // bright cluster knots
  const intensity = clamp(webGlow.add(nodes), float(0), float(4));
  return vec3(0.85, 0.88, 1.0).mul(intensity).add(starfield(dir, float(0.3)));
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
