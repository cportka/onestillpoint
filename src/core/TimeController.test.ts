import { describe, expect, it } from 'vitest';
import { TimeController } from './TimeController';

describe('TimeController', () => {
  it('runs at real-time by default', () => {
    const tc = new TimeController();
    const t = tc.tick(0.016);
    expect(t.fd).toBe(0.016);
    expect(t.animDelta).toBeCloseTo(0.016, 10); // ×1 → unscaled dust clock
    expect(t.orbitMul).toBe(80); // ORBIT_BASE
    expect(t.timeBlur).toBe(0); // fully resolved turbulence
  });

  it('freezes time when paused', () => {
    const tc = new TimeController();
    tc.paused = true;
    const t = tc.tick(0.016);
    expect(t.fd).toBe(0);
    expect(t.animDelta).toBe(0);
  });

  it('steps exactly one recorded frame forward per step() while paused', () => {
    const tc = new TimeController();
    tc.paused = true;
    tc.step();
    const t = tc.tick(0.016);
    expect(t.step).toBe(1); // one frame forward along the recorded tape
    expect(t.fd).toBe(0); // stepping walks the timeline, it doesn't drive live physics
    expect(tc.tick(0.016).step).toBe(0); // step consumed → frozen again
  });

  it('jumps ~1 second (a fixed frame burst) forward per step() while running', () => {
    const tc = new TimeController();
    tc.step(); // not paused → a one-burst fast-forward along the tape
    const t = tc.tick(0.016);
    expect(t.step).toBe(60); // STEP_BURST_FRAMES forward
    expect(t.fd).toBe(0); // the burst is a timeline jump, not a live frame
    expect(tc.tick(0.016).fd).toBe(0.016); // burst consumed → normal forward play
  });

  it('the running step burst is a fixed frame count, independent of frame rate', () => {
    const tc = new TimeController();
    tc.step();
    expect(tc.tick(0.1).step).toBe(60); // same 60 recorded frames whether the display is fast or slow
  });

  it('steps exactly one recorded frame back per stepBack() while paused', () => {
    const tc = new TimeController();
    tc.paused = true;
    tc.stepBack();
    const t = tc.tick(0.016);
    expect(t.step).toBe(-1); // one frame backward along the tape
    expect(t.fd).toBe(0);
    expect(tc.tick(0.016).step).toBe(0); // step consumed → frozen again
  });

  it('jumps back ~1 second per stepBack() while running, then resumes forward', () => {
    const tc = new TimeController();
    tc.stepBack(); // not paused → a one-burst rewind along the tape
    expect(tc.tick(0.016).step).toBe(-60); // ~1 second backward
    expect(tc.tick(0.016).fd).toBe(0.016); // burst consumed → normal forward frame
  });

  it('caps the dust clock so fast scales never strobe', () => {
    const tc = new TimeController();
    tc.timeScale = 1e6;
    // animDelta saturates at ANIM_CAP (×8) × frameDelta, never 1e6 ×.
    expect(tc.tick(0.016).animDelta).toBeCloseTo(0.016 * 8, 10);
  });

  it('caps the orbit multiplier', () => {
    const tc = new TimeController();
    tc.timeScale = 1e6;
    expect(tc.tick(0.016).orbitMul).toBe(80 * 40); // ORBIT_BASE × ORBIT_CAP
  });

  it('crossfades to the time-averaged disk as the scale climbs', () => {
    const tc = new TimeController();
    tc.timeScale = 1;
    expect(tc.timeBlur).toBe(0); // resolved turbulence at real-time
    tc.timeScale = 100;
    expect(tc.timeBlur).toBeGreaterThan(0); // mid crossfade
    expect(tc.timeBlur).toBeLessThan(1);
    tc.timeScale = 1e6;
    expect(tc.timeBlur).toBe(1); // fully averaged at extreme scales
  });

  it('never produces a negative or unbounded blur', () => {
    const tc = new TimeController();
    for (const s of [0.001, 0.5, 1, 8, 1000, 1e9]) {
      tc.timeScale = s;
      expect(tc.timeBlur).toBeGreaterThanOrEqual(0);
      expect(tc.timeBlur).toBeLessThanOrEqual(1);
    }
  });
});
