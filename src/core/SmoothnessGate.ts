/**
 * Smoothness gate — holds the splash→engine reveal until the render loop has *proven* it can run
 * smoothly, instead of counting raw frames.
 *
 * Why: the reveal used to fire after 5 warm frames + the splash-hold countdown — but on a cold
 * pipeline the loop's first frames can stall for seconds (a GPU-process shader compile freezes
 * every rAF on the page), during which the wall-clock countdown expires; the reveal then fired the
 * instant the stall lifted, an abrupt hard cut (measured on both Chrome and Firefox: one giant
 * inter-tick gap ≈ `loopToReveal` − 5 frames). This gate replaces the raw count with **N
 * consecutive fast inter-tick gaps**: any stall resets the run, so the crossfade only plays into a
 * loop that is actually flowing. A hard **ceiling** guarantees a device that simply can't produce
 * fast frames is never stranded under the splash.
 *
 * Pure — the caller passes `performance.now()` (never the loop's clamped `frameDelta`, which hides
 * exactly the stalls this exists to catch), so it unit-tests with fabricated timestamps.
 */
export class SmoothnessGate {
  /** Consecutive fast gaps required to open. */
  readonly runLength: number;
  /** Ceiling (ms since `arm`) after which the gate opens regardless — never strand the splash. */
  readonly ceilingMs: number;

  private thresholdMs: number;
  private armed = false;
  private armedAtMs = 0;
  private lastTickMs = -1;
  private run = 0;

  constructor(opts: { runLength?: number; thresholdMs?: number; ceilingMs?: number } = {}) {
    // 50ms admits a weak phone's legitimate 30–40ms cadence and one dropped 60Hz vsync, while
    // rejecting the ≥100ms stalls the gate exists to hold out. 4s keeps the worst-case extra
    // splash time bounded (the splash holds a calm designed pose; a few extra beats read fine).
    this.runLength = opts.runLength ?? 6;
    this.thresholdMs = opts.thresholdMs ?? 50;
    this.ceilingMs = opts.ceilingMs ?? 4000;
  }

  /**
   * Arm (or re-arm, for Replay) at time `nowMs`. Resets the run and the tick seed — a gap that
   * spans the arm (e.g. the melt) is never counted. `thresholdMs` may be widened per-arm: with a
   * cinematic frame cap active, legitimate gaps pace at the cap (e.g. a 24fps cap ⇒ ~50ms), so the
   * caller passes `max(50, capIntervalMs + 15)`.
   */
  arm(nowMs: number, thresholdMs?: number): void {
    this.armed = true;
    this.armedAtMs = nowMs;
    this.lastTickMs = -1;
    this.run = 0;
    if (thresholdMs !== undefined) this.thresholdMs = Math.max(thresholdMs, 50);
  }

  /**
   * Feed a loop tick at absolute time `nowMs`. Returns **true exactly once per arm** — on the tick
   * that completes the smooth run (or crosses the ceiling); the gate then closes until re-armed.
   */
  tick(nowMs: number): boolean {
    if (!this.armed) return false;
    if (this.lastTickMs >= 0) {
      if (nowMs - this.lastTickMs < this.thresholdMs) {
        this.run += 1;
      } else {
        this.run = 0; // a stall — start the streak over
      }
    }
    this.lastTickMs = nowMs;
    if (this.run >= this.runLength || nowMs - this.armedAtMs >= this.ceilingMs) {
      this.armed = false; // open exactly once
      return true;
    }
    return false;
  }
}
