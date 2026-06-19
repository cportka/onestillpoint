import type { Vector3 } from 'three';

export type BodyType = 'hole' | 'star' | 'planet';

/**
 * A gravitating body. The primary black hole is body 0 (`fixed`, so it stays at
 * the origin as the reference frame); stars/planets orbit it. `mass` is in
 * geometric units (G = 1) consistent with the hole's length scale M; `radius`
 * and `color` are render properties (companions are drawn as emissive spheres
 * raymarched in the hole's curved spacetime, so they lens and occlude for free).
 */
export interface Body {
  id: number;
  type: BodyType;
  mass: number;
  fixed: boolean;
  position: Vector3;
  velocity: Vector3;
  radius: number;
  color: Vector3; // HDR emissive colour
}
