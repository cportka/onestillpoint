/**
 * Adaptive resolution. The raymarch + volume march cost scales with the number
 * of fragments, so when the frame rate drops we render the drawing buffer below
 * native resolution (the canvas CSS upscales it) and push it back up when there
 * is headroom. This is what keeps a heavy shader interactive across very
 * different GPUs without the user touching anything.
 *
 * `scale` is the linear fraction of native resolution to render at; main.ts
 * turns it into the drawing-buffer size.
 */
export class ResolutionScaler {
  enabled = true;
  scale = 1;
  minScale = 0.5;
  /** Ceiling the auto-scaler may climb to. Normally 1 (native); the intro reveal ramps it up from a
   *  deep cut over the takeover window (see `main.ts`) so the resolution *sharpens gradually* under
   *  the haze rather than snapping to full the moment frames have headroom. */
  maxScale = 1;
  /** Frame rate the auto-scaler aims to hold (adjustable in Quality). */
  targetFps = 50;

  private smoothed = 1 / 60; // EMA of frame time (s)
  private cooldown = 0; // seconds until the next adjustment is allowed

  // Frame-time thresholds derived from the target: slower than (target − 2) fps →
  // scale down; faster than (target + 8) fps (headroom) → scale up. The gap keeps
  // it from oscillating around the target.
  private get slow(): number {
    return 1 / Math.max(this.targetFps - 2, 5);
  }
  private get fast(): number {
    return 1 / (this.targetFps + 8);
  }

  /** Forget recent frame-time history (and clear the cooldown). Call when the workload
   *  changes abruptly — e.g. the intro reveal drops to a cheaper scale — so a backlog of
   *  heavy full-resolution frames doesn't drag the scale further down before the new,
   *  cheaper frames register, and the climb-back starts clean. */
  resetSmoothing(): void {
    this.smoothed = 1 / this.targetFps;
    this.cooldown = 0;
  }

  /** Feed the real frame delta; returns true when `scale` changed (re-apply size). */
  update(frameDelta: number): boolean {
    if (!this.enabled) {
      if (this.scale !== this.maxScale) {
        this.scale = this.maxScale;
        return true;
      }
      return false;
    }

    const dt = Math.min(Math.max(frameDelta, 1 / 240), 0.2); // ignore hitches/stalls
    this.smoothed += (dt - this.smoothed) * 0.1;

    this.cooldown -= dt;
    if (this.cooldown > 0) return false;

    let next = this.scale;
    if (this.smoothed > this.slow) next = Math.max(this.minScale, this.scale - 0.1);
    else if (this.smoothed < this.fast) next = Math.min(this.maxScale, this.scale + 0.07);

    if (Math.abs(next - this.scale) > 0.001) {
      this.scale = next;
      this.cooldown = 0.4; // let it settle before adjusting again
      return true;
    }
    return false;
  }
}
