import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Body } from '../scene/Body';
import { computeAccelerations, PRECESSION_K, SOFTENING2, velocityVerletStep } from './integrators';

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

  // Roadmap #7: the position-only r⁻³ precession term, on a companion↔primary pull only.
  it('adds the inward r⁻³ precession term to a companion↔primary pull', () => {
    const M = 1;
    const r = 10;
    const primary = body(new Vector3(0, 0, 0), { mass: M, fixed: true });
    const planet = body(new Vector3(r, 0, 0), { mass: 1e-3 });
    const acc = [new Vector3(), new Vector3()];
    computeAccelerations([primary, planet], acc);

    const r2 = r * r + SOFTENING2;
    const invR3 = 1 / (Math.sqrt(r2) * r2);
    const newtonOnly = invR3 * r * M; // |a| from Newton alone (inward)
    const expectedX = -invR3 * r * (M + PRECESSION_K / Math.sqrt(r2)); // Newton + k/r³, inward (−x)
    expect(acc[1]!.x).toBeCloseTo(expectedX, 9);
    expect(acc[1]!.y).toBe(0);
    expect(acc[1]!.z).toBe(0);
    expect(Math.abs(acc[1]!.x)).toBeGreaterThan(newtonOnly); // the term strengthens the inward pull
  });

  it('does not precess a companion↔companion pair (no fixed primary in the pair)', () => {
    const r = 4;
    const a = body(new Vector3(-r, 0, 0), { mass: 1 }); // both movable → gate is false
    const b = body(new Vector3(r, 0, 0), { mass: 1 });
    const acc = [new Vector3(), new Vector3()];
    computeAccelerations([a, b], acc);

    const sep2 = (2 * r) ** 2 + SOFTENING2;
    const invR3 = 1 / (Math.sqrt(sep2) * sep2);
    expect(acc[0]!.x).toBeCloseTo(invR3 * (2 * r), 9); // pure Newtonian only — no k term
  });
});

describe('velocityVerletStep', () => {
  it('keeps a circular orbit bounded and conserves energy', () => {
    const M = 1;
    const r = 30;
    const primary = body(new Vector3(0, 0, 0), { mass: M, fixed: true });
    const planet = body(new Vector3(r, 0, 0), {
      // Circular speed for the *combined* field f(r) = M/r² + k/r³ (v² = r·f), so the orbit stays
      // truly circular with the precession term active. The true conserved energy includes the
      // precession potential U = −k/(2r²).
      mass: 1e-3,
      velocity: new Vector3(0, 0, Math.sqrt(M / r + PRECESSION_K / (r * r))),
    });
    const bodies = [primary, planet];
    const acc = [new Vector3(), new Vector3()];
    computeAccelerations(bodies, acc);

    const energy = () => {
      const rr = planet.position.length();
      return 0.5 * planet.velocity.lengthSq() - M / rr - PRECESSION_K / (2 * rr * rr);
    };
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

  // Underpins "Step back": the integrator is time-reversible, so stepping the
  // orbits backward (negative dt) retraces them. The accelerations left in `acc`
  // by a forward step are exactly what the reverse half-kick consumes. This also
  // guards roadmap #7: the precession term is always on here, so a bit-exact
  // return proves it stayed position-only (a velocity term would break this).
  it('is time-reversible: N steps forward then N back returns to the start', () => {
    const M = 1;
    const primary = body(new Vector3(0, 0, 0), { mass: M, fixed: true });
    const planet = body(new Vector3(18, 0, 0), {
      mass: 1e-3,
      velocity: new Vector3(0, 0.04, Math.sqrt(M / 18) * 0.8), // an eccentric, non-trivial orbit
    });
    const bodies = [primary, planet];
    const acc = [new Vector3(), new Vector3()];
    computeAccelerations(bodies, acc);

    const p0 = planet.position.clone();
    const v0 = planet.velocity.clone();

    const N = 300;
    const dt = 0.05;
    for (let i = 0; i < N; i++) velocityVerletStep(bodies, acc, dt);
    expect(planet.position.distanceTo(p0)).toBeGreaterThan(1); // actually went somewhere
    for (let i = 0; i < N; i++) velocityVerletStep(bodies, acc, -dt);

    expect(planet.position.distanceTo(p0)).toBeLessThan(1e-6); // …and came back
    expect(planet.velocity.distanceTo(v0)).toBeLessThan(1e-6);
  });
});
