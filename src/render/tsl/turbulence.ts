import { float, mx_fractal_noise_float } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Fractal (FBM) value noise in [-1, 1]-ish, from MaterialX's built-in fractal
 * noise. Three octaves balances wispy detail against the per-sample cost of the
 * volume march. The result is a bare `Node`, so we wrap it as a float.
 */
export function fbm(p: Node<'vec3'>) {
  return float(mx_fractal_noise_float(p, 3, 2.0, 0.5));
}
