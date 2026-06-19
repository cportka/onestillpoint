// The orbit rate at ×1, matching the prior default (one wide orbit in ~seconds).
const ORBIT_BASE = 80;
// The dust animation never plays faster than this × real-time — beyond it the
// fine turbulence would alias/strobe, so instead it crossfades to a smooth,
// time-averaged disk (see `timeBlur`).
const ANIM_CAP = 8;
// Orbits can accelerate further than the turbulence before they read as a blur.
const ORBIT_CAP = 40;

export interface TimeStep {
  /** Effective frame seconds for the physics (0 when paused, fixed when stepping). */
  fd: number;
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
  private stepPending = false;

  /** Advance a single frame while paused. */
  step(): void {
    this.stepPending = true;
  }

  tick(frameDelta: number): TimeStep {
    let fd = frameDelta;
    if (this.paused) {
      if (this.stepPending) {
        fd = 1 / 60; // one deterministic frame
        this.stepPending = false;
      } else {
        fd = 0;
      }
    }
    return {
      fd,
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
