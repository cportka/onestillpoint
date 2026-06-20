import { abs, asin, atan, clamp, float, fract, If, max, mix, smoothstep, vec3 } from 'three/tsl';
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

/** Mode 1 — colourful gas clouds (FBM), layered with stars. */
function nebula(dir: Node<'vec3'>) {
  const n = fbm(dir.mul(2.2)).mul(0.5).add(0.5);
  const n2 = fbm(dir.mul(5.5).add(vec3(8, 3, 5))).mul(0.5).add(0.5);
  const density = smoothstep(float(0.35), float(1), n.mul(0.6).add(n2.mul(0.5)));
  const cool = vec3(0.12, 0.06, 0.32);
  const warm = vec3(0.55, 0.08, 0.36);
  const teal = vec3(0.04, 0.22, 0.32);
  const clouds = mix(cool, warm, n2).add(teal.mul(n.mul(0.6))).mul(density.mul(1.6));
  return clouds.add(starfield(dir, float(0.9)));
}

/** Mode 2 — flowing aurora-like colour bands over a dark, star-flecked sky. */
function aurora(dir: Node<'vec3'>) {
  const h = dir.y.mul(0.5).add(0.5); // 0 = down, 1 = up
  const flow = fbm(vec3(dir.x.mul(2.5), dir.y.mul(6), dir.z.mul(2.5)));
  const curtain = smoothstep(float(0.1), float(0.8), h.add(flow.mul(0.35)));
  const c = mix(vec3(0.05, 0.5, 0.32), vec3(0.32, 0.1, 0.5), smoothstep(float(0.2), float(0.95), h));
  return c.mul(curtain).mul(0.7).add(starfield(dir, float(0.6)));
}

/** Mode 3 — a glowing spacetime lattice; its lat/long lines bend through the lensing. */
function lattice(dir: Node<'vec3'>) {
  const lon = atan(dir.z, dir.x).div(TWO_PI).add(0.5);
  const lat = asin(clamp(dir.y, float(-0.999), float(0.999))).div(PI).add(0.5);
  const lines = max(gridLines(lon, 24), gridLines(lat, 12));
  return vec3(0.2, 0.7, 0.95).mul(lines).add(starfield(dir, float(0.35)));
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
  If(mode.greaterThan(1.5).and(mode.lessThan(2.5)), () => col.assign(aurora(dir)));
  If(mode.greaterThan(2.5), () => col.assign(lattice(dir)));
  return col;
}
