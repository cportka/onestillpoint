import { clamp, dot, float, length, max } from 'three/tsl';
import type { Node } from 'three/webgpu';

/**
 * Whether the segment [a, b] passes within `radius` of `center` — a robust
 * sphere test (closest point on the segment) that catches the body even when a
 * coarse geodesic step would jump over it. Returns a bool node.
 */
export function segmentHitsSphere(
  a: Node<'vec3'>,
  b: Node<'vec3'>,
  center: Node<'vec3'>,
  radius: Node<'float'>,
) {
  const d = b.sub(a);
  const m = a.sub(center);
  const t = clamp(dot(m, d).mul(-1).div(max(dot(d, d), float(0.0001))), float(0), float(1));
  const closest = a.add(d.mul(t));
  return length(closest.sub(center)).lessThan(radius);
}
