import { Vector3 } from 'three';
import type { Body } from '../scene/Body';

const G = 1; // geometric units
/** Softened gravity to avoid singular accelerations. Exported so a freshly added
 *  body can be given the matching circular-orbit speed (see Scene.addBody). */
export const SOFTENING2 = 0.25;

const diff = new Vector3();

/** Newtonian pairwise gravitational accelerations into `acc` (one per body). */
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
