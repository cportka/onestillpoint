// The orbit rate at ×1, matching the prior default (one wide orbit in ~seconds).
const ORBIT_BASE = 80;
// The dust animation never plays faster than this × real-time — beyond it the
// fine turbulence would alias/strobe, so instead it crossfades to a smooth,
// time-averaged disk (see `timeBlur`).
const ANIM_CAP = 8;
// Orbits can accelerate further than the turbulence before they read as a blur.
const ORBIT_CAP = 40;
// A *running* ←/→ "jump" moves this many frames along the recorded timeline (~1 s, since the loop
// records once per render frame). A *paused* ←/→ moves a single frame.
const STEP_BURST_FRAMES = 60;

export interface TimeStep {
  /** Effective frame seconds for **live** advancement / the dust clock (0 when paused or stepping). */
  fd: number;
  /** Discrete move along the recorded timeline this frame, in frames: + forward, − back, 0 = none.
   *  Nonzero only on a ←/→ step; the loop walks the {@link Timeline} (or extends it live at the
   *  edge) rather than integrating, so Step-back is clamped to the recorded rewind limit. */
  step: number;
  /** Advance for the dust clock (bounded, so it never strobes). */
  animDelta: number;
  /** Multiplier to apply to the body integrator this frame. */
  orbitMul: number;
  /** 0 → resolved turbulence, 1 → smooth averaged disk, as speed climbs. */
  timeBlur: number;
}

/**
 * The "go" control (build plan Phase 6): decouples simulation time from
 * wall-clock. Rather than brute-force integrating sub-second dynamics billions
 * of times at huge time scales (wrong and impossibly slow), it **crossfades the
 * representation**: orbits accelerate, the dust animation saturates at a rate it
 * can resolve, and the turbulence fades into a steady time-averaged disk. Pause
 * and single-step are first-class.
 */
export class TimeController {
  /** Master multiplier; 1 = the baseline real-time view, up to ~1e6. */
  timeScale = 1;
  paused = false;
  private stepFrame = 0; // paused: advance a single frame (+1 forward, −1 back)
  private stepBurst = 0; // running: jump ~1 second (+1 forward, −1 back)

  /** Step forward. Paused → advance one frame at the current Speed; running →
   *  jump forward ~1 second (at least 20 frames) at the current Speed. */
  step(): void {
    if (this.paused) this.stepFrame = 1;
    else this.stepBurst = 1;
  }

  /** Step backward — the mirror of step(). Stepping walks the recorded {@link Timeline} (so it is
   *  clamped to the rewind limit — the scrub bar's start marker), rather than reverse-integrating.
   *  Irreversible events do not un-happen: a body that was absorbed / removed stays gone, and the
   *  one-shot intro doesn't rewind. */
  stepBack(): void {
    if (this.paused) this.stepFrame = -1;
    else this.stepBurst = -1;
  }

  tick(frameDelta: number): TimeStep {
    let fd = 0;
    let step = 0;
    if (this.paused) {
      if (this.stepFrame !== 0) {
        step = this.stepFrame; // one frame along the recorded tape (±)
        this.stepFrame = 0;
      }
      // else frozen: fd = 0, step = 0
    } else if (this.stepBurst !== 0) {
      step = this.stepBurst * STEP_BURST_FRAMES; // jump ~1 s along the tape (forward extends it live)
      this.stepBurst = 0;
    } else {
      fd = frameDelta; // continuous play (drives live physics + the dust clock)
    }
    return {
      fd,
      step,
      animDelta: fd * Math.min(this.timeScale, ANIM_CAP),
      orbitMul: ORBIT_BASE * Math.min(this.timeScale, ORBIT_CAP),
      timeBlur: this.timeBlur,
    };
  }

  /** Smoothly 0 → 1 as the time scale climbs ~2.5 decades past ANIM_CAP. */
  get timeBlur(): number {
    const t = (Math.log10(Math.max(this.timeScale, 1)) - Math.log10(ANIM_CAP)) / 2.5;
    return Math.min(Math.max(t, 0), 1);
  }
}
