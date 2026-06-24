// ⟳ Intro look: the duration, pull-back, and easing below shape the load intro.
// Changing them substantially → update docs/intro-script.md (the master beats + tuning log).
const DURATION = 6.5; // seconds of intro
const FAR_FACTOR = 2.6; // how far back the dolly starts, in units of the home distance

// Reduced motion: a gentler, shorter zoom rather than skipping it outright. iOS
// Low Power Mode reports `prefers-reduced-motion: reduce`, so an old phone on low
// battery would otherwise see no intro at all — we still want *some* arrival.
const REDUCED_DURATION = 2.6;
const REDUCED_FAR_FACTOR = 1.5;

// Ignore tap-to-skip for the first instant: a stray touch as the page loads
// (common on mobile) must not cancel the intro before it has visibly begun.
const SKIP_GUARD = 0.5;

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const smootherstep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** Disk "ignition" curve. It now ignites *fast* — the hole reads as formed by
 *  ~0.6 s (the first ~10% of the intro), right as the load splash crossfades out
 *  — then holds with a gentle late bloom while the camera dolly settles, landing
 *  exactly at 1 so the formed state matches the user's settings.
 *  ⟳ Intro look: changing this → refresh docs/intro-script.md (note the version). */
function formationCurve(t: number): number {
  const ignite = smootherstep(Math.min(t / 0.1, 1)); // lit by ~0.6s, masked by the splash
  const bump = 0.14 * Math.sin(Math.PI * t) * t; // 0 at both ends, gentle late swell
  return Math.min(ignite + bump, 1.22);
}

/** What the formation drives on the camera. CameraRig implements this; tests
 *  pass a stub, so the easing stays unit-testable without a DOM. */
export interface IntroDriver {
  readonly homeDistance: number;
  beginIntro(): void;
  placeOnHomeRay(distance: number): void;
  finishIntro(): void;
}

/**
 * Phase 7 — the art-directed formation sequence. On load the camera dollies in
 * from far while the accretion disk **ignites** (a `formation` factor 0 → 1 that
 * the shader multiplies into the dust, so the disk condenses and brightens into
 * being). It is skippable (tap, after a brief guard) and replayable; under
 * `prefers-reduced-motion` it plays a gentler, shorter zoom. The easing is pure
 * so it can be tested headless.
 */
export class FormationSequence {
  done = false;
  private elapsed = 0;
  private readonly duration: number;
  private readonly far: number;

  constructor(
    private readonly driver: IntroDriver,
    private readonly formation: { value: number },
    opts: { reducedMotion?: boolean; duration?: number } = {},
  ) {
    const reduced = opts.reducedMotion ?? false;
    this.duration = opts.duration ?? (reduced ? REDUCED_DURATION : DURATION);
    this.far = driver.homeDistance * (reduced ? REDUCED_FAR_FACTOR : FAR_FACTOR);
    this.begin();
  }

  /** Linear intro progress 0→1 (and 1 once done) — drives the staggered body
   *  entrance. Distinct from the eased `formation` ignition curve. */
  get progress(): number {
    if (this.done) return 1;
    return this.duration > 0 ? Math.min(this.elapsed / this.duration, 1) : 1;
  }

  /** Advance the intro; call once per frame with the real frame delta. */
  update(frameDelta: number): void {
    if (this.done) return;
    this.elapsed += frameDelta;
    const t = this.duration > 0 ? Math.min(this.elapsed / this.duration, 1) : 1;
    this.apply(t);
    if (t >= 1) this.finish();
  }

  /** Jump straight to the formed state (tap-to-skip), once past the load guard. */
  skip(): void {
    if (!this.done && this.elapsed >= SKIP_GUARD) this.finish();
  }

  /** Play it again from the top (the panel's "Replay intro"). */
  restart(): void {
    this.elapsed = 0;
    this.begin();
  }

  private begin(): void {
    if (this.duration <= 0) {
      this.finish();
      return;
    }
    this.done = false;
    this.driver.beginIntro();
    this.apply(0);
  }

  private apply(t: number): void {
    this.formation.value = formationCurve(t);
    this.driver.placeOnHomeRay(this.far + (this.driver.homeDistance - this.far) * easeOutCubic(t));
  }

  private finish(): void {
    this.formation.value = 1;
    this.driver.finishIntro();
    this.done = true;
  }
}
