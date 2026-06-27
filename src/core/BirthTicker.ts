import { appearFor } from '../render/bodyUniforms';
import type { BodyType } from '../scene/Body';

/** The minimum a body needs to be born onto the timeline — just its type. */
type Bornable = { readonly type: BodyType };

/** Minimum spacing between successive births, in seconds. The default line-up's three stars share
 *  one appear window (and the three planets another), so without this they'd be "born" on the same
 *  frame and stack into a single mark; spacing them out lands each as its own cleanly separate tick
 *  on the history timeline. Slight by design. */
const BIRTH_GAP_S = 0.22;

/**
 * Drops a **creation tick** on the history scrub bar for each *seeded* body as it swooshes in
 * during the formation intro.
 *
 * The default line-up (3 stars + 3 planets) is seeded **silently** — `Scene.seed` suppresses
 * `onEvent`, since a bulk reseed isn't a user action — so without this the very first stars and
 * planets would never mark the timeline, even though they're "created" right there in the intro.
 * This watches the formation `progress` and, as each body crosses the half-in point of its
 * `appearFor` window (stars first, then planets), emits its type exactly as a user-driven **+**
 * add would. Bodies of a type share a window, so they're born together — a gold cluster as the
 * stars arrive, a blue one as the planets do.
 *
 * It **re-arms on replay**: when `progress` drops sharply (the formation restarting from the top
 * with a fresh line-up), it re-pulls the seed and starts over.
 */
export class BirthTicker {
  private pending: Bornable[] = [];
  private lastProgress = 0;
  private sinceLast = BIRTH_GAP_S; // pre-charged so the first eligible body is born immediately

  /** @param emit fire a creation event for `type` (wire to `scene.onEvent`). */
  constructor(private readonly emit: (type: BodyType) => void) {}

  /** Arm (or re-arm) with the line-up to watch — the seed bodies, in seed order. */
  arm(seed: readonly Bornable[]): void {
    this.pending = seed.slice();
    this.sinceLast = BIRTH_GAP_S;
  }

  /**
   * Call once per frame with the live formation `progress` (0→1), the wall-clock `dt` (seconds), and
   * a `reseed` thunk returning the *current* seed line-up (used only to re-arm on a formation
   * restart). Emits a creation event for the first pending body whose `appear` curve has crossed the
   * half-in point — **at most one per `BIRTH_GAP_S`**, so the otherwise-simultaneous arrivals land as
   * separate, cleanly-spaced ticks on the timeline (stars before planets, in seed order).
   */
  update(progress: number, dt: number, reseed: () => readonly Bornable[]): void {
    // A sharp drop in progress = the formation restarted (replay) — re-arm with the fresh line-up.
    if (progress < this.lastProgress - 0.4) this.arm(reseed());
    this.lastProgress = progress;
    this.sinceLast += dt;
    if (this.sinceLast < BIRTH_GAP_S) return; // hold the stagger gap between births
    for (let i = 0; i < this.pending.length; i++) {
      if (appearFor(this.pending[i]!.type, progress) >= 0.5) {
        this.emit(this.pending[i]!.type);
        this.pending.splice(i, 1);
        this.sinceLast = 0;
        return; // one birth per gap
      }
    }
  }
}
