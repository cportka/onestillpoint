import { Vector3, Vector4 } from 'three';
import { uniform } from 'three/tsl';
import type { BodyType } from '../scene/Body';
import type { Scene } from '../scene/Scene';

/** Fixed render slots for orbiting bodies (the raymarch unrolls these). Sized
 *  for the body caps (up to 4 holes, or 1 hole + 5 stars + 5 planets); empty
 *  slots short-circuit in the shader, so the headroom is cheap when unused. */
export const MAX_BODIES = 14;

// Tidal disruption (spaghettification) onset, roadmap #8. A star/planet that falls within the
// **Roche radius** is torn into a radial stream long *before* it reaches the merge; `tidal` ramps
// 0→1 across [ROCHE, MERGE] and drives the stretch in the raymarch. (Toy values — tune to taste;
// MERGE matches Scene's MERGE_RADIUS so tidal is full just as absorption begins.)
const TIDAL_ROCHE = 14;
const TIDAL_MERGE = 3;

export function createBodyUniforms() {
  return {
    slots: Array.from({ length: MAX_BODIES }, () => ({
      posRadius: uniform(new Vector4(0, 0, 0, 0)), // xyz = position, w = radius (0 = inactive)
      color: uniform(new Vector3(0, 0, 0)), // HDR emissive colour
      lensMass: uniform(0), // weak-field light-deflection mass (0 = no lensing)
      appear: uniform(1), // formation fade-in 0 → 1, staggered by body type
      absorb: uniform(0), // 0 = live, → 1 as it is absorbed at the centre (shrink + redshift fade)
      tidal: uniform(0), // 0 = whole, → 1 as it is spaghettified falling within the Roche radius
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
// ⟳ Intro look: these windows time the bodies' swoosh-in during the intro.
// Changing them substantially → update docs/intro-script.md (the master beats + tuning log).
export function appearFor(type: BodyType, progress: number): number {
  return type === 'star' ? smoothstep(0.03, 0.2, progress) : smoothstep(0.2, 0.52, progress);
}

const clearSlot = (slot: BodyUniforms['slots'][number]): void => {
  slot.posRadius.value.set(0, 0, 0, 0);
  slot.lensMass.value = 0;
  slot.appear.value = 0;
  slot.absorb.value = 0;
  slot.tidal.value = 0;
};

export function updateBodyUniforms(bodyUniforms: BodyUniforms, scene: Scene, progress = 1): void {
  // Iterate the body list directly and skip the fixed primary, rather than
  // `scene.companions` — that getter allocates a filtered array, and this runs
  // every frame. Non-fixed bodies fill the slots in order, exactly as before.
  const bodies = scene.bodies;
  let maxR = 0;
  let lensing = 0;
  let n = 0; // active companion slots filled

  for (let i = 0; i < bodies.length && n < MAX_BODIES; i++) {
    const body = bodies[i]!;
    if (body.fixed) continue; // the primary isn't a render slot
    const slot = bodyUniforms.slots[n]!;
    const p = body.position;
    // Guard against a non-finite body (a rare close-encounter blow-up): a NaN/Inf
    // position would poison every ray's geodesic (via the shared secondary-
    // deflection term) and black out the whole render — so treat it as an empty
    // slot this frame (it is pruned next frame).
    if (Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) && Number.isFinite(body.radius)) {
      slot.posRadius.value.set(p.x, p.y, p.z, body.radius);
      slot.color.value.copy(body.color);
      slot.lensMass.value = body.lensMass;
      slot.appear.value = appearFor(body.type, progress);
      slot.absorb.value = body.absorbing ?? 0;
      // Spaghettify on approach: a star/planet within the Roche radius is torn into a radial
      // stream (holes are compact, so never). Ramps 0→1 across [ROCHE, MERGE].
      const r = p.length();
      slot.tidal.value = body.type === 'hole' ? 0 : smoothstep(TIDAL_ROCHE, TIDAL_MERGE, r);
      maxR = Math.max(maxR, r + body.radius);
      if (body.lensMass > 0) lensing = 1;
    } else {
      clearSlot(slot);
    }
    n++;
  }

  for (let i = n; i < MAX_BODIES; i++) clearSlot(bodyUniforms.slots[i]!); // bodies removed since last frame

  bodyUniforms.sceneRadius.value = n > 0 ? maxR + 6 : 0;
  bodyUniforms.lensingActive.value = lensing;
}
