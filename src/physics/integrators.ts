import { Vector3 } from 'three';
import type { Body } from '../scene/Body';

const G = 1; // geometric units
/** Softened gravity to avoid singular accelerations. Exported so a freshly added
 *  body can be given the matching circular-orbit speed (see Scene.addBody). */
export const SOFTENING2 = 0.25;

/**
 * Roadmap #7 — relativistic-*looking* perihelion precession, the safe way. A companion's pull from
 * the primary gets one extra **position-only** inverse-cube term, so the total central force is
 * `f(r) = M/r² + k/r³`. That force precesses the ellipse *analytically* — the apsidal angle is
 * `Φ = π·√(1 + k/r)`, i.e. the orbit advances `Δφ = 2π(√(1 + k/r) − 1)` per turn (validated in
 * `scripts/validate-orbit.mjs`), reproducing the GR perihelion advance's `~1/r` falloff with a single
 * constant. Crucially it is a pure function of position (a gradient of `U = −kM/(2r²)`), so
 * velocity-Verlet stays symplectic and **bit-exact time-reversible** (`integrators.test.ts`) — unlike
 * a true velocity-dependent 1PN term, which would break Step-back / the DVR timeline.
 *
 * It is a **look** dial, not a geodesic: the literal weak-field GR match is `k = 6M`, which at these
 * radii is a fast rosette; `0.3` is a slow, on-theme apsidal drift (a few degrees per orbit, most
 * visible once an orbit is eccentric — e.g. after a body is scattered). `0` disables it with zero
 * branch cost. The induced eccentricity for a body seeded at the *Newtonian* circular speed is only
 * `~k/(Mr) ≈ 1%`, so the existing seed speed (`Scene.addBody`) is left as-is at this value.
 */
export const PRECESSION_K: number = 0.3;

const diff = new Vector3();

/** Newtonian pairwise gravitational accelerations into `acc` (one per body), plus the position-only
 *  r⁻³ precession term (`PRECESSION_K`) on each companion↔primary pull. */
export function computeAccelerations(bodies: Body[], acc: Vector3[]): void {
  for (let i = 0; i < bodies.length; i++) acc[i]!.set(0, 0, 0);

  for (let i = 0; i < bodies.length; i++) {
    const bi = bodies[i]!;
    for (let j = i + 1; j < bodies.length; j++) {
      const bj = bodies[j]!;
      diff.subVectors(bj.position, bi.position);
      const r2 = diff.lengthSq() + SOFTENING2;
      const invR3 = 1 / (Math.sqrt(r2) * r2);
      // a_i += G m_j (r_j - r_i) / |r|³, and the equal-and-opposite on j.
      acc[i]!.addScaledVector(diff, G * bj.mass * invR3);
      acc[j]!.addScaledVector(diff, -G * bi.mass * invR3);

      // Precession: an extra attractive k/r³ term, but only on a companion's pull from the fixed
      // primary (exactly one of the pair is fixed) — never companion↔companion, where a 1/r⁴ pull
      // could spike at a softened close pass. `precMag·diff` has magnitude k/r³, directed inward.
      if (PRECESSION_K !== 0 && bi.fixed !== bj.fixed) {
        const precMag = (PRECESSION_K * invR3) / Math.sqrt(r2); // k/r⁴ scalar on `diff` → k/r³ acceleration
        if (!bi.fixed) acc[i]!.addScaledVector(diff, precMag); // i is the companion → pulled toward primary j (+diff)
        else acc[j]!.addScaledVector(diff, -precMag); // j is the companion → pulled toward primary i (−diff)
      }
    }
  }
}

/**
 * One velocity-Verlet (kick–drift–kick) step. Symplectic, so orbits stay stable
 * over long runs (validated in scripts/validate-orbit.mjs). `acc` must hold the
 * accelerations at the current positions on entry; it is left holding the
 * accelerations at the new positions on exit, ready for the next step.
 */
export function velocityVerletStep(bodies: Body[], acc: Vector3[], dt: number): void {
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!;
    if (b.fixed) continue;
    b.velocity.addScaledVector(acc[i]!, dt * 0.5); // half kick
    b.position.addScaledVector(b.velocity, dt); // drift
  }

  computeAccelerations(bodies, acc);

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i]!;
    if (b.fixed) continue;
    b.velocity.addScaledVector(acc[i]!, dt * 0.5); // half kick
  }
}
