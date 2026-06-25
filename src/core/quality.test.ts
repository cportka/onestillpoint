import { describe, expect, it } from 'vitest';
import { detectQualityTier, introResolutionScale, INTRO_SCALE_DROP, QUALITY_TIERS, type QualityTier } from './quality';

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

  it('starts the reveal below the tier scale, but never below its floor', () => {
    for (const tier of tiers) {
      const q = QUALITY_TIERS[tier];
      const start = introResolutionScale(q);
      expect(start).toBeLessThan(q.scale); // cheaper than steady-state → the reveal is smooth
      expect(start).toBeGreaterThanOrEqual(q.minScale); // never mushier than the device's own floor
    }
  });

  it('drops by INTRO_SCALE_DROP unless that would cross the floor', () => {
    for (const tier of tiers) {
      const q = QUALITY_TIERS[tier];
      expect(introResolutionScale(q)).toBe(Math.max(q.minScale, q.scale - INTRO_SCALE_DROP));
    }
  });
});
