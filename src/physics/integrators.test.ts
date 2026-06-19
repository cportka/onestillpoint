import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Body } from '../scene/Body';
import { computeAccelerations, velocityVerletStep } from './integrators';

function body(position: Vector3, overrides: Partial<Body> = {}): Body {
  return {
    id: 0,
    type: 'star',
    mass: 1,
    fixed: false,
    position,
    velocity: new Vector3(),
    radius: 1,
    color: new Vector3(),
    ...overrides,
  };
}

describe('computeAccelerations', () => {
  it("obeys Newton's third law (equal and opposite)", () => {
    const a = body(new Vector3(-2, 0, 0));
    const b = body(new Vector3(2, 0, 0));
    const acc = [new Vector3(), new Vector3()];

    computeAccelerations([a, b], acc);

    expect(acc[0]!.x).toBeGreaterThan(0); // pulled toward +x (toward b)
    expect(acc[1]!.x).toBeLessThan(0); // pulled toward -x (toward a)
    expect(acc[0]!.x).toBeCloseTo(-acc[1]!.x, 10); // equal magnitude (equal masses)
  });

  it('leaves an isolated body unaccelerated', () => {
    const acc = [new Vector3()];
    computeAccelerations([body(new Vector3(5, 0, 0))], acc);
    expect(acc[0]!.length()).toBe(0);
  });
});

describe('velocityVerletStep', () => {
  it('keeps a circular orbit bounded and conserves energy', () => {
    const M = 1;
    const r = 30;
    const primary = body(new Vector3(0, 0, 0), { mass: M, fixed: true });
    const planet = body(new Vector3(r, 0, 0), {
      mass: 1e-3,
      velocity: new Vector3(0, 0, Math.sqrt(M / r)), // circular speed
    });
    const bodies = [primary, planet];
    const acc = [new Vector3(), new Vector3()];
    computeAccelerations(bodies, acc);

    const energy = () => 0.5 * planet.velocity.lengthSq() - M / planet.position.length();
    const e0 = energy();
    let rmin = Infinity;
    let rmax = 0;

    for (let i = 0; i < 20000; i++) {
      velocityVerletStep(bodies, acc, 0.05);
      const rr = planet.position.length();
      rmin = Math.min(rmin, rr);
      rmax = Math.max(rmax, rr);
    }

    expect(rmax - rmin).toBeLessThan(0.05 * r); // stays ~circular
    expect(Math.abs((energy() - e0) / e0)).toBeLessThan(1e-3); // symplectic → bounded
    expect(primary.position.length()).toBe(0); // fixed body never moves
  });
});
