import { clamp01 } from './mathUtils';
import type { History, HistoryFrame } from './History';

/**
 * The **timeline playhead** over the {@link History} ring — a DVR position, decoupled from Pause.
 *
 * `offset` is how many recorded frames we are **behind the live edge** (0 = "now", live physics +
 * recording). Scrubbing or stepping back moves it into the past — clamped to the **rewind limit**
 * (the oldest frame in the buffer; the scrub bar's *start marker*). Each move calls `applyFrame`,
 * which restores **both the roster and the kinematics** of that frame — so you can rewind clean
 * *across* an absorption/add (a body that fell in comes back). While the sim plays *behind* the
 * edge it **replays** the recorded frames one per tick (`advance()`), walking the *current marker*
 * back toward the live edge, where new history resumes. None of this touches `time.paused`: paused
 * holds the marker, playing moves it.
 *
 * `reset()` snaps back to the live edge — used when fresh live input (a manual add) means we should
 * stop replaying and resume recording from "now".
 */
export class Timeline {
  /** Frames behind the live edge: 0 = live, >0 = scrubbed / replaying back. */
  private offset = 0;

  constructor(
    private readonly history: History,
    /** Restore a recorded frame onto the scene — roster (revive/drop bodies) **and** kinematics. */
    private readonly applyFrame: (frame: HistoryFrame) => void,
  ) {}

  /** At "now" — the loop should run live physics + record this frame. */
  get live(): boolean {
    return this.offset === 0;
  }

  /** The rewind limit: the oldest frame still in the buffer. Every frame is restorable now (the
   *  roster is rebuilt from the registry), so the whole recorded window can be rewound into. */
  private get maxOffset(): number {
    return Math.max(0, this.history.length - 1);
  }

  /** Current ("playback") marker position 0..1 across the visible window — 1 = live edge. */
  get currentPos(): number {
    const span = Math.max(1, this.history.length - 1);
    return 1 - Math.min(this.offset, span) / span;
  }

  /** Start-marker position 0..1 — how far back a rewind can reach. */
  get startPos(): number {
    const span = Math.max(1, this.history.length - 1);
    return 1 - Math.min(this.maxOffset, span) / span;
  }

  /** Jump to a 0..1 bar position (0 = oldest, 1 = now), clamped to the rewind limit, and restore
   *  that frame. Returns the clamped marker position so the caller can place the marker. */
  scrubTo(pos01: number): number {
    const span = Math.max(1, this.history.length - 1);
    const want = Math.round((1 - clamp01(pos01)) * span);
    this.offset = Math.min(Math.max(0, want), this.maxOffset);
    this.restore();
    return this.currentPos;
  }

  /** Step `n` recorded frames toward the past, clamped at the start marker. */
  stepBack(n = 1): void {
    this.offset = Math.min(this.offset + n, this.maxOffset);
    this.restore();
  }

  /** Step `n` recorded frames toward the live edge. Returns the frames that overflow *past* the
   *  live edge — the caller advances the sim live by that much (a forward step at "now" extends
   *  the recording rather than replaying). */
  stepForward(n = 1): number {
    const move = Math.min(n, this.offset);
    this.offset -= move;
    this.restore();
    return n - move;
  }

  /** One replay tick: advance a single recorded frame toward the live edge. */
  advance(): void {
    if (this.offset > 0) {
      this.offset -= 1;
      this.restore();
    }
  }

  /** Re-pin to the live edge — e.g. when the body set changes (the recorded future is a different
   *  generation and can't be replayed across the boundary). */
  reset(): void {
    this.offset = 0;
  }

  /** Commit a live edit made *while scrubbed*: make the current (scrubbed) moment the new live edge —
   *  discard the recorded future, then snap to live. Returns whether anything was discarded (so the
   *  caller can drop the now-orphaned future events). A no-op returning `false` when already live. */
  commit(): boolean {
    if (this.offset === 0) return false;
    this.history.truncate(this.offset); // discard the recorded future past the marker…
    this.reset(); // …then snap to the live edge (now the marker frame)
    return true;
  }

  private restore(): void {
    const frame = this.history.peek(this.offset);
    if (frame) this.applyFrame(frame);
  }
}
