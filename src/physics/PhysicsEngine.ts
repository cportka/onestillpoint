import { Vector3 } from 'three';
import type { Body } from '../scene/Body';
import { computeAccelerations, velocityVerletStep } from './integrators';

/**
 * The N-body integrator. v1 advances the gravitating bodies on the CPU with
 * velocity-Verlet (a handful of bodies is trivial); the Phase 5 plan's GPU
 * compute kernel is the path to scaling this to many bodies later — the
 * step(dt) interface stays the same.
 *
 * `timeScale` decouples simulation time from wall-clock so orbits are visible in
 * seconds rather than the thousands of geometric time units a wide orbit takes;
 * substeps keep wide-then-close passes accurate.
 */
export class PhysicsEngine {
  timeScale = 80;
  substeps = 4;

  private acc: Vector3[] = [];

  constructor(public bodies: Body[]) {
    this.reset();
  }

  /** Re-prime accelerations after the body set changes. */
  reset(): void {
    this.acc = this.bodies.map(() => new Vector3());
    computeAccelerations(this.bodies, this.acc);
  }

  step(frameDelta: number): void {
    const dt = (frameDelta * this.timeScale) / this.substeps;
    for (let s = 0; s < this.substeps; s++) {
      velocityVerletStep(this.bodies, this.acc, dt);
    }
  }
}
