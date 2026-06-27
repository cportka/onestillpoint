import { isCoarsePointer } from './device';

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  /** Initial drawing-buffer scale (auto-resolution still adapts from here). */
  scale: number;
  /** Floor the auto-resolution may drop to under steady-state load. */
  minScale: number;
  /** Drawing-buffer scale the **intro reveal** starts at — deliberately *below* `minScale`
   *  (the engine takeover is the heaviest the app ever is), masked by the warm-fuzzy haze.
   *  The scaler's floor follows the reveal down to here, then is restored to `minScale` as it
   *  climbs back (see `main.ts`). The single biggest lever on the splash→engine hitch. */
  introScale: number;
  /** Dust march step inside the disk slab (larger = cheaper, coarser). */
  volumeStep: number;
  /** Device-pixel-ratio cap — the biggest lever on a high-DPR phone. */
  dprCap: number;
}

/** Three cost tiers. Higher = sharper and finer, but heavier per pixel. The DPR
 *  cap is deliberately ≤ 1.5: rendering this shader at full retina (×2) is the
 *  main reason a fullscreen laptop crawls, and the soft disk + bloom hide it. */
export const QUALITY_TIERS: Record<QualityTier, QualitySettings> = {
  low: { scale: 0.55, minScale: 0.3, introScale: 0.24, volumeStep: 0.42, dprCap: 1.3 },
  medium: { scale: 0.7, minScale: 0.36, introScale: 0.27, volumeStep: 0.32, dprCap: 1.4 },
  high: { scale: 0.85, minScale: 0.4, introScale: 0.3, volumeStep: 0.28, dprCap: 1.5 },
};

/**
 * Auto-pick a starting tier from device signals. The per-pixel raymarch + HDR
 * bloom targets are the constraint, so phones (coarse pointer, high DPR) default
 * to **low** — only a roomy-looking handset steps up to medium — while a
 * mouse-driven desktop gets **high**. The user can override in the Quality panel.
 */
export function detectQualityTier(): QualityTier {
  if (!isCoarsePointer()) return 'high'; // mouse / desktop
  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;
  return mem >= 6 && cores >= 8 ? 'medium' : 'low';
}

/**
 * The drawing-buffer scale the intro reveal should start at for a tier. The heaviest the engine
 * ever is, is the first ~2 s it's on screen — the camera dolly + disk ignition at full formation,
 * right as the splash lifts — and the first-load shader compile + cold GPU caches pile on top, so
 * rendering that at the full tier scale is what stutters the splash→engine handoff. We start the
 * adaptive resolution **well below steady-state** — `introScale`, deliberately *under* the tier's
 * own `minScale` floor — and let the warm-fuzzy reveal filter (`uniforms.fuzz` → PostPipeline) mask
 * the softness, *making it intentional*, fading out as the `ResolutionScaler` climbs back. The
 * scaler's floor is temporarily lowered to here and restored to `minScale` once it has climbed back
 * (see `main.ts`), so the deep cut applies *only* to the reveal, not steady state. Pure (no
 * globals) → unit-tested. **Tuning levers** (the ramp's "steps" + rate): `introScale` here (how
 * deep the cut), `ResolutionScaler`'s `+0.07 / 0.4 s` climb (how fast it sharpens), and
 * `FUZZ_FADE_S` in `main.ts` (how long the haze lingers over it).
 */
export function introResolutionScale(q: QualitySettings): number {
  return q.introScale;
}
