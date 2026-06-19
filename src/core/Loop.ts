import type { WebGPURenderer } from 'three/webgpu';

/**
 * The frame driver. Each animation frame it measures the real elapsed time
 * (clamped against background-tab stalls) and hands it to the tick callback,
 * which advances time (see TimeController), updates the camera, and renders.
 */
export class Loop {
  /** Real wall-clock seconds since the previous frame. */
  frameDelta = 0;

  onTick: (frameDelta: number) => void = () => {};

  private last = 0;
  private running = false;

  constructor(private readonly renderer: WebGPURenderer) {}

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
    this.frameDelta = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.onTick(this.frameDelta);
  };
}
