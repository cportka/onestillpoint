import { describe, expect, it } from 'vitest';
import { detectQualityTier, QUALITY_TIERS } from './quality';

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
