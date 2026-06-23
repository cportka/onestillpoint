import type { WebGPURenderer } from 'three/webgpu';

/**
 * The frame driver. Each animation frame it measures the real elapsed time
 * (clamped against background-tab stalls) and hands it to the tick callback,
 * which advances time (see TimeController), updates the camera, and renders.
 */
export class Loop {
  /** Real wall-clock seconds since the previous *rendered* frame. */
  frameDelta = 0;

  onTick: (frameDelta: number) => void = () => {};

  /** Cap the render rate to at most this many fps (0 = uncapped / display rate).
   *  Frames that arrive too soon are skipped, so the achieved rate locks to the
   *  nearest divisor of the display refresh — 24 → exactly 24 on a 120 Hz panel,
   *  ~20 (every 3rd frame) on 60 Hz — which keeps the pacing even (no telecine
   *  judder). The extra per-frame budget lets the GPU hold full resolution. */
  maxFps = 0;

  private last = 0; // timestamp of the last rendered frame
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
    const elapsed = (now - this.last) / 1000;
    // Frame cap: skip this animation frame if not enough time has passed (a 2 ms
    // slack so it locks cleanly to the nearest refresh divisor).
    if (this.maxFps > 0 && elapsed < 1 / this.maxFps - 0.002) return;
    this.frameDelta = Math.min(elapsed, 0.1); // clamp background-tab / cap stalls
    this.last = now;
    this.onTick(this.frameDelta);
  };
}
