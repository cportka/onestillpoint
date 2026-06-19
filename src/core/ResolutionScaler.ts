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
  readonly maxScale = 1;

  private smoothed = 1 / 60; // EMA of frame time (s)
  private cooldown = 0; // seconds until the next adjustment is allowed

  // Frame-time thresholds: slower than `slow` → scale down; faster than `fast`
  // (with room to spare) → scale up.
  private readonly slow = 1 / 48;
  private readonly fast = 1 / 58;

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
