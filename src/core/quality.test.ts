import { describe, expect, it } from 'vitest';
import {
  detectQualityTier,
  introResolutionScale,
  QUALITY_TIERS,
  REVEAL_VOLUME_STEP_BOOST,
  revealVolumeStep,
  type QualityTier,
} from './quality';

describe('quality tiers', () => {
  it('orders cost from low to high', () => {
    expect(QUALITY_TIERS.low.scale).toBeLessThan(QUALITY_TIERS.high.scale);
    expect(QUALITY_TIERS.low.dprCap).toBeLessThanOrEqual(QUALITY_TIERS.high.dprCap);
    // a higher tier samples the dust more finely (a smaller step).
    expect(QUALITY_TIERS.high.volumeStep).toBeLessThan(QUALITY_TIERS.low.volumeStep);
    expect(QUALITY_TIERS.medium.scale).toBeGreaterThan(QUALITY_TIERS.low.scale);
    expect(QUALITY_TIERS.medium.scale).toBeLessThan(QUALITY_TIERS.high.scale);
  });

  it('detects a tier that exists in the table', () => {
    expect(QUALITY_TIERS).toHaveProperty(detectQualityTier());
  });
});

describe('intro resolution ramp', () => {
  const tiers = Object.keys(QUALITY_TIERS) as QualityTier[];

  it('starts the reveal below the steady-state floor (a deep cut, masked by the haze)', () => {
    for (const tier of tiers) {
      const q = QUALITY_TIERS[tier];
      const start = introResolutionScale(q);
      expect(start).toBe(q.introScale); // the per-tier reveal scale
      expect(start).toBeLessThan(q.scale); // much cheaper than steady-state → the reveal is smooth
      expect(start).toBeLessThanOrEqual(q.minScale); // deliberately at/under the floor (only for the reveal)
      expect(start).toBeGreaterThan(0.15); // …but not so low it can't be made intentional by the haze
    }
  });

  it('cuts deeper the heavier the tier needs it (ordered with the tiers)', () => {
    expect(QUALITY_TIERS.low.introScale).toBeLessThan(QUALITY_TIERS.high.introScale);
    expect(QUALITY_TIERS.medium.introScale).toBeLessThan(QUALITY_TIERS.high.introScale);
  });
});

describe('reveal volume-step ramp', () => {
  const tiers = Object.keys(QUALITY_TIERS) as QualityTier[];

  it('lands exactly on the tier step once settled (fuzz 0) — steady state untouched', () => {
    for (const tier of tiers) {
      const q = QUALITY_TIERS[tier];
      expect(revealVolumeStep(q, 0)).toBe(q.volumeStep);
    }
  });

  it('coarsens the dust march at the reveal peak (fuzz 1) by the boost fraction', () => {
    for (const tier of tiers) {
      const q = QUALITY_TIERS[tier];
      const peak = revealVolumeStep(q, 1);
      expect(peak).toBeCloseTo(q.volumeStep * (1 + REVEAL_VOLUME_STEP_BOOST));
      expect(peak).toBeGreaterThan(q.volumeStep); // coarser = cheaper during the heavy reveal
    }
  });

  it('eases monotonically from the peak back to the tier step as the haze lifts', () => {
    const q = QUALITY_TIERS.high;
    const full = revealVolumeStep(q, 1);
    const half = revealVolumeStep(q, 0.5);
    const none = revealVolumeStep(q, 0);
    expect(full).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(none);
    expect(half).toBeCloseTo(q.volumeStep * (1 + REVEAL_VOLUME_STEP_BOOST * 0.5));
  });

  it('never goes below the tier step for a stray negative fuzz', () => {
    const q = QUALITY_TIERS.medium;
    expect(revealVolumeStep(q, -0.2)).toBe(q.volumeStep);
  });
});
