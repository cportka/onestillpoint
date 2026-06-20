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
  /** Mass used for weak-field light deflection. 0 for bodies too light to lens
   *  measurably (stars/planets), so the shader can skip them; = mass for a
   *  secondary black hole. */
  lensMass: number;
  fixed: boolean;
  position: Vector3;
  velocity: Vector3;
  radius: number;
  color: Vector3; // HDR emissive colour
  /** Absorption animation progress, 0 → 1, set once a companion reaches the
   *  central merge radius: rather than vanishing at once it is held in place and
   *  the shader shrinks + redshifts + fades it over a brief window, then it is
   *  freed. Undefined for a live, orbiting body. */
  absorbing?: number;
  /** Position captured when absorption began, used to hold the body still during
   *  the fade so it doesn't drift on either integrator. */
  absorbAnchor?: Vector3;
  /** User-removal animation progress, 0 → 1: when the − stepper removes a body it
   *  is sent plunging into the centre over ~1.5 s (accelerating inward, then
   *  absorbed) rather than deleted instantly. Undefined unless being removed. */
  plunging?: number;
  /** Position captured when the plunge began — the start of the inward path. */
  plungeFrom?: Vector3;
}
