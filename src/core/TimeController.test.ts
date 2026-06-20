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

  it('advances exactly one frame per step() while paused', () => {
    const tc = new TimeController();
    tc.paused = true;
    tc.step();
    expect(tc.tick(0.016).fd).toBeGreaterThan(0); // the single stepped frame
    expect(tc.tick(0.016).fd).toBe(0); // step consumed → frozen again
  });

  it('jumps forward ~1 second per step() while running', () => {
    const tc = new TimeController();
    tc.step(); // not paused → a one-burst fast-forward
    expect(tc.tick(0.016).fd).toBe(1); // ~1 second (20 frames < 1s at 60fps)
    expect(tc.tick(0.016).fd).toBe(0.016); // burst consumed → normal frame
  });

  it('steps at least 20 frames when running at a low frame rate', () => {
    const tc = new TimeController();
    tc.step();
    expect(tc.tick(0.1).fd).toBeCloseTo(2, 10); // 20 × 0.1s = 2s, beats the 1s floor
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
