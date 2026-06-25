import type { WebGPURenderer } from 'three/webgpu';
import type { Scene } from '../scene/Scene';
import type { GPUPhysicsEngine } from './GPUPhysicsEngine';

/** Bodies at/above which the GPU compute path finally beats the CPU integrator's
 *  O(N²) (which is ~free for small N). This sits far above the app's current
 *  `MAX_BODIES` (14), so the auto-selector resolves to CPU for every count the app
 *  can reach today — it's the hook for a future "swarm/galaxy" mode. */
const GPU_AUTO_BODIES = 256;

/**
 * Chooses between the CPU and GPU N-body integrators behind one `step(dt)`, and —
 * now — picks between them **automatically** by body count (`autoSelect`, run each
 * step). The CPU engine is the default (exact, no overhead for a handful of
 * bodies); the GPU engine is the scaling path. Whoever changes the body set must
 * call `syncBodies()` so the GPU engine rebuilds its storage buffers.
 *
 * Why the count threshold? Investigated for v0.15.1: GPU is **not worth it at any
 * count this app can currently reach.** The N-body force is O(N²) on both paths,
 * but the GPU pays a fixed per-frame cost (compute dispatches + a position/velocity
 * buffer read-back, which forces a CPU↔GPU sync), while the CPU's N² is ~free for
 * small N. The CPU step only starts costing ~1–2 ms around **N ≈ 150–300 bodies**,
 * which is where the GPU finally wins — hence `GPU_AUTO_BODIES`. With `MAX_BODIES`
 * at 14 the selector always lands on CPU; the HUD's CPU/GPU readout simply shows
 * which path it chose. See docs/archive.md (perf audit).
 */
export class PhysicsController {
  useGPU = false;
  /** Whether the WebGPU compute path exists at all (set by the bootstrap from the
   *  active backend). On the WebGL2 fallback the selector can only ever pick CPU. */
  gpuAvailable = false;
  /** Created lazily on the first switch to GPU — its compute kernels (and their
   *  Three TSL deps) are then code-split out of the initial bundle. */
  private gpu: GPUPhysicsEngine | null = null;
  private gpuTimeScale = 80;

  constructor(
    private readonly scene: Scene,
    private readonly renderer: WebGPURenderer,
  ) {}

  /** Automatically pick CPU vs GPU for the current body count. Cheap (a single
   *  comparison; a no-op unless the choice actually flips), so it can run every
   *  step. Switching to GPU lazily loads its compute engine — but that only
   *  happens past `GPU_AUTO_BODIES`, which the app can't reach yet. */
  autoSelect(): void {
    const want = this.gpuAvailable && this.scene.bodies.length >= GPU_AUTO_BODIES;
    if (want !== this.useGPU) void this.setGPU(want);
  }

  step(frameDelta: number): void {
    this.autoSelect(); // keep the CPU/GPU choice matched to the live body count
    if (this.useGPU && this.gpu) this.gpu.step(frameDelta);
    else this.scene.step(frameDelta); // CPU until the GPU engine has finished loading
    // Advance absorption fades and free any companion that escaped or finished
    // merging into the centre; rebuild the GPU buffers for the smaller set. These
    // are one-way wall-clock animations, so they always advance forward — even
    // when the orbits are being stepped *back* (|frameDelta|), which scrubs the
    // reversible gravity, not these irreversible destruction events.
    if (this.scene.prune(Math.abs(frameDelta))) this.syncBodies();
  }

  async setGPU(on: boolean): Promise<void> {
    this.useGPU = on;
    if (!on) return;
    if (!this.gpu) {
      // Lazy import: keeps the WebGPU compute kernels out of the initial bundle
      // (the CPU integrator is the default and wins for the body counts here).
      const { GPUPhysicsEngine } = await import('./GPUPhysicsEngine');
      this.gpu = new GPUPhysicsEngine(this.renderer);
      this.gpu.timeScale = this.gpuTimeScale;
    }
    this.gpu.setBodies(this.scene.bodies);
  }

  /** Rebuild GPU buffers after a body was added/removed (no-op on CPU). */
  syncBodies(): void {
    if (this.useGPU && this.gpu) this.gpu.setBodies(this.scene.bodies);
  }

  get timeScale(): number {
    return this.scene.physics.timeScale;
  }

  set timeScale(value: number) {
    this.scene.physics.timeScale = value;
    this.gpuTimeScale = value;
    if (this.gpu) this.gpu.timeScale = value;
  }
}
