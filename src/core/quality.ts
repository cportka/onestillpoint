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
  low: { scale: 0.55, minScale: 0.3, introScale: 0.18, volumeStep: 0.42, dprCap: 1.3 },
  medium: { scale: 0.7, minScale: 0.36, introScale: 0.2, volumeStep: 0.32, dprCap: 1.4 },
  high: { scale: 0.85, minScale: 0.4, introScale: 0.22, volumeStep: 0.28, dprCap: 1.5 },
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
 * globals) → unit-tested. **Tuning levers:** `introScale` here (how deep the cut), the
 * `ResolutionScaler`'s converge-and-freeze climb-back (how fast it sharpens — `−0.12`/`+0.1` steps,
 * `0.8 s` cooldown, then it freezes), and `FUZZ_FADE_S` in `main.ts` (how long the haze lingers).
 */
export function introResolutionScale(q: QualitySettings): number {
  return q.introScale;
}

/** How much coarser the dust march runs at the *peak* of the reveal (`fuzz = 1`), as a fraction
 *  above the tier's steady-state `volumeStep`. After the geodesic, the dominant per-step cost is the
 *  in-slab volume sampling; a coarser step through the disk slab means fewer samples **and** fewer
 *  geodesic steps to cross it — cheaper exactly when the reveal is heaviest. Modest on purpose: the
 *  warm haze must keep the coarser dust from ever reading sharp. */
export const REVEAL_VOLUME_STEP_BOOST = 0.6;

/**
 * The dust-march step during the haze-masked reveal. It is the tier's steady-state `volumeStep`,
 * coarsened in proportion to the reveal veil `fuzz` (1 at the reveal → 0 once settled): at `fuzz = 1`
 * it is `volumeStep × (1 + REVEAL_VOLUME_STEP_BOOST)`, and at `fuzz = 0` it lands **exactly** on
 * `volumeStep`, so steady state is untouched. This is the march-space companion to
 * `introResolutionScale` (the screen-space cut) — together with the haze fade, three levers
 * converging on one clock to smooth the splash→engine takeover. Pure (no globals) → unit-tested.
 */
export function revealVolumeStep(q: QualitySettings, fuzz: number): number {
  return q.volumeStep * (1 + REVEAL_VOLUME_STEP_BOOST * Math.max(0, fuzz));
}
