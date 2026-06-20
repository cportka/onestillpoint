import { isCoarsePointer } from './device';

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  /** Initial drawing-buffer scale (auto-resolution still adapts from here). */
  scale: number;
  /** Floor the auto-resolution may drop to under load. */
  minScale: number;
  /** Dust march step inside the disk slab (larger = cheaper, coarser). */
  volumeStep: number;
  /** Device-pixel-ratio cap — the biggest lever on a high-DPR phone. */
  dprCap: number;
}

/** Three cost tiers. Higher = sharper and finer, but heavier per pixel. The DPR
 *  cap is deliberately ≤ 1.5: rendering this shader at full retina (×2) is the
 *  main reason a fullscreen laptop crawls, and the soft disk + bloom hide it. */
export const QUALITY_TIERS: Record<QualityTier, QualitySettings> = {
  low: { scale: 0.55, minScale: 0.3, volumeStep: 0.42, dprCap: 1.3 },
  medium: { scale: 0.7, minScale: 0.36, volumeStep: 0.32, dprCap: 1.4 },
  high: { scale: 0.85, minScale: 0.4, volumeStep: 0.28, dprCap: 1.5 },
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
