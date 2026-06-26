import { describe, expect, it } from 'vitest';
import { Scene } from '../scene/Scene';
import { appearFor, createBodyUniforms, updateBodyUniforms } from './bodyUniforms';

/** The slot-0 `tidal` value for a single companion of `type` parked at radius `r`. */
function tidalAt(r: number, type: 'star' | 'hole' = 'star'): number {
  const scene = new Scene();
  scene.clearCompanions();
  const b = type === 'hole' ? scene.addBlackHole() : scene.addStar();
  b.position.set(r, 0, 0); // override the random orbit placement
  const bu = createBodyUniforms();
  updateBodyUniforms(bu, scene, 1);
  return bu.slots[0]!.tidal.value;
}

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

describe('tidal disruption factor (spaghettification onset)', () => {
  it('is 0 outside the Roche radius and ramps to 1 at the merge', () => {
    expect(tidalAt(30)).toBe(0); // far out on its orbit — whole
    expect(tidalAt(3)).toBeCloseTo(1, 5); // at the merge radius — fully torn
    const mid = tidalAt(8);
    expect(mid).toBeGreaterThan(0); // mid-fall — partly spaghettified
    expect(mid).toBeLessThan(1);
    expect(tidalAt(6)).toBeGreaterThan(tidalAt(11)); // tears further the closer it falls
  });

  it('never tears a black hole (it is compact)', () => {
    expect(tidalAt(5, 'hole')).toBe(0);
  });
});
