import { describe, expect, it } from 'vitest';
import { clamp, clamp01, smoothstep } from './mathUtils';

describe('clamp', () => {
  it('bounds to [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('clamp01', () => {
  it('bounds to [0, 1]', () => {
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
  });
});

describe('smoothstep', () => {
  it('is 0 below edge0, 1 above edge1, and 0.5 at the midpoint', () => {
    expect(smoothstep(0, 1, -0.5)).toBe(0);
    expect(smoothstep(0, 1, 1.5)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 10); // the Hermite curve passes through 0.5 at the midpoint
  });

  it('has zero slope at both ends (eased)', () => {
    expect(smoothstep(0, 1, 0.01)).toBeLessThan(0.01); // flatter than linear near 0
    expect(smoothstep(0, 1, 0.99)).toBeGreaterThan(0.99); // …and near 1
  });

  it('supports a descending ramp (edge0 > edge1)', () => {
    expect(smoothstep(10, 0, 10)).toBe(0);
    expect(smoothstep(10, 0, 0)).toBe(1);
    expect(smoothstep(10, 0, 5)).toBeCloseTo(0.5, 10);
  });
});
