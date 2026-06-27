/**
 * Small scalar maths helpers shared across the CPU side (the GPU/TSL side has its own node
 * versions in `three/tsl`). Kept in one place so the same `smoothstep` / `clamp` don't drift
 * between, say, the plunge curve in `Scene` and the formation `appearFor` in `bodyUniforms`.
 */

/** Clamp `x` to `[min, max]`. */
export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

/** Clamp `x` to `[0, 1]`. */
export function clamp01(x: number): number {
  return clamp(x, 0, 1);
}

/**
 * Hermite smoothstep — 0 at `edge0`, 1 at `edge1`, eased (zero slope) at both ends, clamped
 * outside. Matches the GLSL/TSL `smoothstep(edge0, edge1, x)` so CPU and shader agree. `edge0`
 * may be greater than `edge1` for a descending ramp.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
