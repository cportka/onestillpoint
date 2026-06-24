/**
 * The "melt inward" — Replay's opening gesture. Before the intro replays from the
 * black screen, the live view collapses toward **the One Still Point** at the centre
 * of the screen: the engine canvas scales/spins down to a point, blurring and fading
 * to black (CSS keyframes on `canvas.osp-melting`, see `style.css`). The whole
 * universe falls back into the singularity, then is reborn from black.
 *
 * The animation is pure CSS; this helper only manages the class + the completion
 * timing, so it's trivially testable (inject a fake `schedule`).
 */
export const MELT_CLASS = 'osp-melting';

export interface MeltHandle {
  /** Remove the melt class, restoring the element to its normal transform. Call this
   *  once something else (the splash) is covering the screen, so the snap-back is
   *  invisible. Idempotent. */
  restore(): void;
}

/**
 * Melt `el` inward, then invoke `onMelted` after `durationMs`. Returns a handle whose
 * `restore()` clears the effect. `schedule` defaults to `setTimeout` but is injectable
 * for tests.
 */
export function meltInward(
  el: HTMLElement,
  onMelted: () => void,
  opts: { durationMs: number },
  schedule: (cb: () => void, ms: number) => void = (cb, ms) => void setTimeout(cb, ms),
): MeltHandle {
  el.classList.add(MELT_CLASS);
  schedule(onMelted, opts.durationMs);
  return {
    restore(): void {
      el.classList.remove(MELT_CLASS);
    },
  };
}
