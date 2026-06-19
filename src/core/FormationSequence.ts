const DURATION = 6.5; // seconds of intro
const FAR_FACTOR = 2.6; // how far back the dolly starts, in units of the home distance

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const smootherstep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/** Disk "ignition" curve: a slow build (smootherstep) with a gentle late bloom,
 *  landing exactly at 1 so the formed state matches the user's settings. */
function formationCurve(t: number): number {
  const bump = 0.16 * Math.sin(Math.PI * t) * t; // 0 at both ends, peaks late
  return Math.min(smootherstep(t) + bump, 1.25);
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
 * being). It is skippable (tap), replayable, and honours `prefers-reduced-motion`
 * by completing instantly. The easing is pure so it can be tested headless.
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
    this.duration = opts.reducedMotion ? 0 : (opts.duration ?? DURATION);
    this.far = driver.homeDistance * FAR_FACTOR;
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

  /** Jump straight to the formed state (tap-to-skip). */
  skip(): void {
    if (!this.done) this.finish();
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
