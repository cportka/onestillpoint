/**
 * Adaptive resolution. The raymarch + volume march cost scales with the number
 * of fragments, so when the frame rate drops we render the drawing buffer below
 * native resolution (the canvas CSS upscales it) and push it back up when there
 * is headroom. This is what keeps a heavy shader interactive across very
 * different GPUs without the user touching anything.
 *
 * **Converge, then freeze.** Each scale change is *not* cheap — `applySize()`
 * resizes the drawing buffer *and* rebuilds the post-pipeline targets (the bloom
 * chain + FXAA), a real GPU hitch on a phone. So a scaler that hunts up/down
 * around the target produces a **stutter on a regular cadence**. This one converges
 * to a stable scale in a few steps and then **stops resizing**: once it has held a
 * scale for a moment it *widens* its acceptable frame-time band (so only a large,
 * sustained deviation pays another resize), and it excludes the frame(s) right
 * after a resize from its average (the rebuild hitch must not read as "too slow"
 * and trigger another resize — a feedback loop).
 *
 * `scale` is the linear fraction of native resolution to render at; main.ts
 * turns it into the drawing-buffer size.
 */
export class ResolutionScaler {
  enabled = true;
  scale = 1;
  minScale = 0.5;
  /** Ceiling the auto-scaler may climb to (native). */
  maxScale = 1;
  /** Frame rate the auto-scaler aims to hold (adjustable in Quality). */
  targetFps = 50;

  private smoothed = 1 / 50; // EMA of frame time (s)
  private cooldown = 0; // seconds until the next adjustment is allowed
  private steady = 0; // seconds the scale has held without wanting to move → "settled"
  private settleSkip = 0; // frames to exclude from the EMA right after a resize (the rebuild hitch)

  // Acceptable frame-time band, in seconds. **Settled** widens it a lot: once converged, only a
  // clearly-sustained drop (or a big surplus of headroom) is worth another pipeline rebuild.
  private slowLimit(settled: boolean): number {
    return 1 / Math.max(this.targetFps - (settled ? 8 : 3), 5);
  }
  private fastLimit(settled: boolean): number {
    return 1 / (this.targetFps + (settled ? 18 : 10));
  }

  /** Forget recent frame-time history (and clear the cooldown / convergence). Call when the workload
   *  changes abruptly — e.g. the intro reveal drops to a cheaper scale — so a backlog of heavy
   *  full-resolution frames doesn't drag the scale further down, and the climb-back starts clean. */
  resetSmoothing(): void {
    this.smoothed = 1 / this.targetFps;
    this.cooldown = 0;
    this.steady = 0;
    this.settleSkip = 0;
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

    // The frame(s) right after a resize carry the pipeline-rebuild hitch — exclude them from the EMA,
    // or that hitch reads as "too slow" and triggers another resize (a resize→hitch→resize loop).
    if (this.settleSkip > 0) {
      this.settleSkip -= 1;
      this.cooldown -= frameDelta;
      return false;
    }

    const dt = Math.min(Math.max(frameDelta, 1 / 240), 0.2); // ignore hitches/stalls
    this.smoothed += (dt - this.smoothed) * 0.1;

    this.cooldown -= dt;
    if (this.cooldown > 0) return false;

    const settled = this.steady > 2.5; // converged a while ago → resist resizing
    let next = this.scale;
    if (this.smoothed > this.slowLimit(settled)) next = Math.max(this.minScale, this.scale - 0.12);
    else if (this.smoothed < this.fastLimit(settled)) next = Math.min(this.maxScale, this.scale + 0.1);

    if (Math.abs(next - this.scale) > 0.001) {
      this.scale = next;
      this.cooldown = 0.8; // a longer settle window than before — far fewer resizes
      this.steady = 0;
      this.settleSkip = 2; // discount the rebuild-hitch frames so they don't bounce the scale
      return true;
    }
    this.steady += dt; // holding this scale → converge toward "settled" (then it freezes)
    return false;
  }
}
