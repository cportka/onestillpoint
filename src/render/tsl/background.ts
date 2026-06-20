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
 * Mode 1 — a high-contrast emission nebula: orange-dominant glowing gas with
 * dark ember shadows and rare cool-blue pockets, carved hard by black dust
 * pillars. Tuned for punch (deep voids, bright cores), not a wash.
 */
function nebula(dir: Node<'vec3'>) {
  const base = fbm(dir.mul(1.8)).mul(0.5).add(0.5); // large-scale structure
  const detail = fbm(dir.mul(4.0).add(vec3(19, 7, 13))).mul(0.5).add(0.5);
  const dust = fbm(dir.mul(2.6).add(vec3(40, 5, 30))).mul(0.5).add(0.5);

  // Narrow, powered masks → dark voids and bright cores (the missing contrast).
  const orangeMask = pow(smoothstep(float(0.45), float(0.85), base), float(1.5)); // dominant
  const blueMask = pow(smoothstep(float(0.62), float(0.92), detail), float(2)).mul(0.6); // accent

  const orange = vec3(1.0, 0.42, 0.06);
  const ember = vec3(0.6, 0.12, 0.02); // dark rust mid-shadow
  const blue = vec3(0.1, 0.45, 0.7);

  const warm = mix(ember, orange, orangeMask).mul(orangeMask);
  const gas = warm.add(blue.mul(blueMask));

  const dustMask = smoothstep(float(0.45), float(0.7), dust); // pillars carve to black
  const carved = gas.mul(float(1).sub(dustMask)).mul(1.8);

  const tips = vec3(1.0, 0.85, 0.6).mul(pow(detail, float(10)).mul(2)); // bright knots
  return carved.add(tips).add(starfield(dir, float(0.5)));
}

/**
 * Mode 2 — Filaments: a monochrome cosmic web. Ridged noise (1 − |noise|) makes
 * sharp silver threads with brighter knots at the intersections — the
 * large-scale structure of the universe, lensing around the holes. Not colour-led.
 */
function filaments(dir: Node<'vec3'>) {
  const r1 = float(1).sub(abs(fbm(dir.mul(2.2))));
  const r2 = float(1).sub(abs(fbm(dir.mul(5.0).add(vec3(13, 9, 21)))));
  const web = max(float(0), r1.mul(0.6).add(r2.mul(0.5)).sub(0.2));
  const webGlow = pow(web, float(3)).mul(4);
  const nodes = pow(max(float(0), r1.mul(r2)), float(6)).mul(3); // bright cluster knots
  const intensity = clamp(webGlow.add(nodes), float(0), float(3));
  return vec3(0.8, 0.85, 1.0).mul(intensity).add(starfield(dir, float(0.4)));
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
  return vec3(0.2, 0.7, 0.95).mul(max(major, minor)).add(starfield(dir, float(0.35)));
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
