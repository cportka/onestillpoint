import { float, mx_fractal_noise_float } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Fractal (FBM) value noise in [-1, 1]-ish, from MaterialX's built-in fractal
 * noise. Two octaves keeps the per-sample cost of the volume march down while
 * still giving wispy filaments. The result is a bare `Node`, so we wrap it.
 */
export function fbm(p: Node<'vec3'>) {
  return float(mx_fractal_noise_float(p, 2, 2.0, 0.5));
}
