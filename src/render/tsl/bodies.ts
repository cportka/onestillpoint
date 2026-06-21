import { clamp, dot, float, length, max, vec3 } from 'three/tsl';
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

/**
 * Whether the segment hits a prolate **ellipsoid** centred at `center`: a sphere
 * of `radius` stretched by `stretch` along the unit `axis` and squashed by
 * `squash` across it — the tidal "spaghettification" of a body falling in (the
 * axis points along the line to the hole). Warping each point into the frame
 * where the ellipsoid is a unit sphere reduces it to the sphere test above; the
 * warp is linear, so mapping the two endpoints is exact for the closest-approach.
 */
export function segmentHitsStretched(
  a: Node<'vec3'>,
  b: Node<'vec3'>,
  center: Node<'vec3'>,
  radius: Node<'float'>,
  axis: Node<'vec3'>,
  stretch: Node<'float'>,
  squash: Node<'float'>,
) {
  const warp = (p: Node<'vec3'>): Node<'vec3'> => {
    const rel = p.sub(center);
    const along = axis.mul(dot(rel, axis));
    const perp = rel.sub(along);
    return along.div(stretch).add(perp.div(squash));
  };
  return segmentHitsSphere(warp(a), warp(b), vec3(0), radius);
}
