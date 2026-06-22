import type { Scene } from '../scene/Scene';
import type { GPUPhysicsEngine } from './GPUPhysicsEngine';

/**
 * Chooses between the CPU and GPU N-body integrators behind one `step(dt)`.
 * The CPU engine is the default (exact, no overhead for a handful of bodies);
 * the GPU engine is the opt-in scaling path. Whoever changes the body set must
 * call `syncBodies()` so the GPU engine rebuilds its storage buffers.
 *
 * Auto-switch to GPU? Investigated for v0.15.1: **not worth it at any count this
 * app can reach.** The N-body force is O(N²) on both paths, but the GPU pays a
 * fixed per-frame cost (compute dispatches + a position/velocity buffer
 * read-back, which forces a CPU↔GPU sync), while the CPU's N² is ~free for small
 * N. Back-of-envelope, the CPU step only starts costing ~1–2 ms around **N ≈
 * 150–300 bodies**, which is where the GPU's parallelism would finally win — and
 * `MAX_BODIES` is 14. So there is no count ≤ the current cap where flipping it on
 * helps; it's left a manual toggle. *If* a future "swarm/galaxy" mode raises the
 * cap into the hundreds, auto-enable above ~256 (and add a `manual` flag so the
 * auto-selector doesn't fight the user's toggle). See docs/perf-audit-v0.15.md.
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
    // merging into the centre; rebuild the GPU buffers for the smaller set. These
    // are one-way wall-clock animations, so they always advance forward — even
    // when the orbits are being stepped *back* (|frameDelta|), which scrubs the
    // reversible gravity, not these irreversible destruction events.
    if (this.scene.prune(Math.abs(frameDelta))) this.syncBodies();
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
