import {
  abs,
  dot,
  float,
  floor,
  fract,
  length,
  mix,
  sin,
  smoothstep,
  step,
  vec3,
} from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Procedural background star field, sampled by the (bent) escape direction of a
 * photon so it lenses correctly. Because the look-up is purely directional, a
 * bright source passing behind the hole wraps into an Einstein ring — the
 * Phase 1 acceptance signature.
 *
 * Phase 1 placeholder; an optional HDRI/cubemap sampler can replace it later.
 */

/** Hash a grid-cell id to a vec3 in [0,1). */
function hash33(p: Node<'vec3'>) {
  const a = fract(sin(dot(p, vec3(127.1, 311.7, 74.7))).mul(43758.5453));
  const b = fract(sin(dot(p, vec3(269.5, 183.3, 246.1))).mul(43758.5453));
  const c = fract(sin(dot(p, vec3(113.5, 271.9, 124.6))).mul(43758.5453));
  return vec3(a, b, c);
}

/** One layer of stars: a jittered point per occupied cell on the direction sphere. */
function starOctave(
  dir: Node<'vec3'>,
  scale: Node<'float'>,
  density: Node<'float'>,
  radius: Node<'float'>,
) {
  const p = dir.mul(scale);
  const cell = floor(p);
  const h = hash33(cell);
  const present = step(h.x, density); // 1 where h.x ≤ density (sparse)
  const center = cell.add(hash33(cell.add(vec3(1.7))));
  const d = length(p.sub(center));
  const core = smoothstep(radius, float(0), d);
  // Mostly dim, with a rare very bright star (these make clean Einstein rings).
  const bright = mix(float(0.25), float(1), h.y).add(step(float(0.985), h.y).mul(2.5));
  const color = mix(vec3(1.0, 0.82, 0.6), vec3(0.7, 0.82, 1.0), h.z); // warm → cool
  return color.mul(core).mul(present).mul(bright);
}

export function starfield(dir: Node<'vec3'>, brightness: Node<'float'>) {
  const stars = starOctave(dir, float(60), float(0.06), float(0.5))
    .add(starOctave(dir, float(140), float(0.05), float(0.55)))
    .add(starOctave(dir, float(290), float(0.04), float(0.6)));

  // Faint galactic band for a large-scale feature that lenses nicely.
  const bandDist = abs(dot(dir, vec3(0.195, 0.976, 0.098)));
  const band = smoothstep(float(0.45), float(0), bandDist).mul(0.025);
  const bandColor = vec3(0.5, 0.6, 0.9).mul(band);

  return stars.add(bandColor).mul(brightness);
}
