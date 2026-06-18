import type { WebGPURenderer } from 'three/webgpu';
import type { Uniforms } from '../render/uniforms';

/**
 * The animation clock and frame driver.
 *
 * Simulation time is tracked independently of wall-clock so it can be paused
 * and (Phase 6) scaled, while `frameDelta` always reflects real elapsed time for
 * adaptive-resolution decisions. Each frame: advance time, publish it to the
 * uniform bus, then invoke the tick callback (which updates the camera and
 * renders).
 */
export class Loop {
  /** Real wall-clock seconds since the previous frame (unscaled, clamped). */
  frameDelta = 0;
  /** Accumulated simulation seconds (scaled, pausable) — what the shaders see. */
  elapsed = 0;
  timeScale = 1;
  paused = false;

  onTick: (frameDelta: number) => void = () => {};

  private last = 0;
  private running = false;

  constructor(
    private readonly renderer: WebGPURenderer,
    private readonly uniforms: Uniforms,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    void this.renderer.setAnimationLoop(this.tick);
  }

  stop(): void {
    this.running = false;
    void this.renderer.setAnimationLoop(null);
  }

  private readonly tick = (): void => {
    const now = performance.now();
    // Clamp to avoid a huge jump after a background-tab stall.
    this.frameDelta = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    if (!this.paused) this.elapsed += this.frameDelta * this.timeScale;
    this.uniforms.time.value = this.elapsed;

    this.onTick(this.frameDelta);
  };
}
