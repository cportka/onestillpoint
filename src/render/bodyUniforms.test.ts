import { describe, expect, it } from 'vitest';
import { appearFor } from './bodyUniforms';

describe('appearFor (staggered formation entrance)', () => {
  it('is 0 before the intro and 1 once it is done', () => {
    expect(appearFor('star', 0)).toBe(0);
    expect(appearFor('planet', 0)).toBe(0);
    expect(appearFor('star', 1)).toBe(1);
    expect(appearFor('planet', 1)).toBe(1);
  });

  it('brings the stars in before the planets', () => {
    // Partway through, the stars have swooshed in but the planets have not yet.
    expect(appearFor('star', 0.3)).toBeGreaterThan(appearFor('planet', 0.3));
    expect(appearFor('star', 0.25)).toBeCloseTo(1, 5); // stars fully in early
    expect(appearFor('planet', 0.15)).toBe(0); // planets still off-stage early on
  });

  it('is monotonic in progress', () => {
    for (const type of ['star', 'planet'] as const) {
      let prev = -1;
      for (let p = 0; p <= 1.0001; p += 0.05) {
        const a = appearFor(type, p);
        expect(a).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = a;
      }
    }
  });
});
