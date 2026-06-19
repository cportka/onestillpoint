import { Vector3, Vector4 } from 'three';
import { uniform } from 'three/tsl';
import type { Scene } from '../scene/Scene';

/** Fixed render slots for orbiting bodies (the raymarch unrolls these). */
export const MAX_BODIES = 4;

export function createBodyUniforms() {
  return {
    slots: Array.from({ length: MAX_BODIES }, () => ({
      posRadius: uniform(new Vector4(0, 0, 0, 0)), // xyz = position, w = radius (0 = inactive)
      color: uniform(new Vector3(0, 0, 0)), // HDR emissive colour
    })),
    // How far the geodesic must integrate to reach the outermost body. 0 when
    // there are no companions, so rays escape at the camera radius (cheaper).
    sceneRadius: uniform(0),
  };
}

export type BodyUniforms = ReturnType<typeof createBodyUniforms>;

export function updateBodyUniforms(bodyUniforms: BodyUniforms, scene: Scene): void {
  const companions = scene.companions;
  let maxR = 0;

  for (let i = 0; i < MAX_BODIES; i++) {
    const slot = bodyUniforms.slots[i]!;
    const body = companions[i];
    if (body) {
      const p = body.position;
      slot.posRadius.value.set(p.x, p.y, p.z, body.radius);
      slot.color.value.copy(body.color);
      maxR = Math.max(maxR, p.length() + body.radius);
    } else {
      slot.posRadius.value.set(0, 0, 0, 0);
    }
  }

  bodyUniforms.sceneRadius.value = companions.length > 0 ? maxR + 6 : 0;
}
