import type { Scene } from '../scene/Scene';
import type { GPUPhysicsEngine } from './GPUPhysicsEngine';

/**
 * Chooses between the CPU and GPU N-body integrators behind one `step(dt)`.
 * The CPU engine is the default (exact, no overhead for a handful of bodies);
 * the GPU engine is the opt-in scaling path. Whoever changes the body set must
 * call `syncBodies()` so the GPU engine rebuilds its storage buffers.
 */
export class PhysicsController {
  useGPU = false;

  constructor(
    private readonly scene: Scene,
    private readonly gpu: GPUPhysicsEngine,
  ) {}

  step(frameDelta: number): void {
    if (this.useGPU) this.gpu.step(frameDelta);
    else this.scene.step(frameDelta);
    // Advance absorption fades and free any companion that escaped or finished
    // merging into the centre; rebuild the GPU buffers for the smaller set. The
    // wall-clock `frameDelta` keeps the fade a steady ~0.6s at any Speed.
    if (this.scene.prune(frameDelta)) this.syncBodies();
  }

  setGPU(on: boolean): void {
    this.useGPU = on;
    if (on) this.gpu.setBodies(this.scene.bodies);
  }

  /** Rebuild GPU buffers after a body was added/removed (no-op on CPU). */
  syncBodies(): void {
    if (this.useGPU) this.gpu.setBodies(this.scene.bodies);
  }

  get timeScale(): number {
    return this.scene.physics.timeScale;
  }

  set timeScale(value: number) {
    this.scene.physics.timeScale = value;
    this.gpu.timeScale = value;
  }
}
