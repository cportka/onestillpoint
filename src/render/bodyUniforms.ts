import { Vector3, Vector4 } from 'three';
import { uniform } from 'three/tsl';
import type { BodyType } from '../scene/Body';
import type { Scene } from '../scene/Scene';

/** Fixed render slots for orbiting bodies (the raymarch unrolls these). The
 *  default scene fills four (2 stars + 2 planets); the rest are headroom for
 *  user-added companions. */
export const MAX_BODIES = 6;

export function createBodyUniforms() {
  return {
    slots: Array.from({ length: MAX_BODIES }, () => ({
      posRadius: uniform(new Vector4(0, 0, 0, 0)), // xyz = position, w = radius (0 = inactive)
      color: uniform(new Vector3(0, 0, 0)), // HDR emissive colour
      lensMass: uniform(0), // weak-field light-deflection mass (0 = no lensing)
      appear: uniform(1), // formation fade-in 0 → 1, staggered by body type
    })),
    // How far the geodesic must integrate to reach the outermost body. 0 when
    // there are no companions, so rays escape at the camera radius (cheaper).
    sceneRadius: uniform(0),
    // 1 when any body lenses, so the (otherwise-skipped) secondary-deflection
    // block in the geodesic does nothing — zero cost — in the default scene.
    lensingActive: uniform(0),
  };
}

export type BodyUniforms = ReturnType<typeof createBodyUniforms>;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Staggered entrance during the formation intro: the outer stars swoosh in
 * first, then the (retrograde) planets and any companion hole — so the two
 * swooshes read as a sequence rather than one simultaneous blur. `progress` is
 * the intro's linear 0→1 (and 1 whenever the intro is done, so bodies added
 * later just appear immediately).
 */
export function appearFor(type: BodyType, progress: number): number {
  return type === 'star' ? smoothstep(0.04, 0.3, progress) : smoothstep(0.42, 0.78, progress);
}

export function updateBodyUniforms(bodyUniforms: BodyUniforms, scene: Scene, progress = 1): void {
  const companions = scene.companions;
  let maxR = 0;
  let lensing = 0;

  for (let i = 0; i < MAX_BODIES; i++) {
    const slot = bodyUniforms.slots[i]!;
    const body = companions[i];
    if (body) {
      const p = body.position;
      slot.posRadius.value.set(p.x, p.y, p.z, body.radius);
      slot.color.value.copy(body.color);
      slot.lensMass.value = body.lensMass;
      slot.appear.value = appearFor(body.type, progress);
      maxR = Math.max(maxR, p.length() + body.radius);
      if (body.lensMass > 0) lensing = 1;
    } else {
      slot.posRadius.value.set(0, 0, 0, 0);
      slot.lensMass.value = 0;
      slot.appear.value = 0;
    }
  }

  bodyUniforms.sceneRadius.value = companions.length > 0 ? maxR + 6 : 0;
  bodyUniforms.lensingActive.value = lensing;
}
