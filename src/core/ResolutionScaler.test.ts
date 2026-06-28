import { describe, expect, it } from 'vitest';
import { ResolutionScaler } from './ResolutionScaler';

const feed = (s: ResolutionScaler, frameDelta: number, frames = 300): void => {
  for (let i = 0; i < frames; i++) s.update(frameDelta);
};

describe('ResolutionScaler', () => {
  it('drops resolution when frames run slower than the target', () => {
    const s = new ResolutionScaler();
    s.targetFps = 50;
    feed(s, 1 / 30); // a steady 30fps — well under target
    expect(s.scale).toBeLessThan(1);
    expect(s.scale).toBeGreaterThanOrEqual(s.minScale);
  });

  it('raises resolution back up when there is headroom', () => {
    const s = new ResolutionScaler();
    s.targetFps = 50;
    s.scale = 0.5;
    feed(s, 1 / 120); // plenty of headroom
    expect(s.scale).toBeGreaterThan(0.5);
  });

  it('respects the target: lenient at a low target, strict at a high one', () => {
    const lenient = new ResolutionScaler();
    lenient.targetFps = 40;
    feed(lenient, 1 / 45); // 45fps clears a 40 target
    expect(lenient.scale).toBe(1);

    const strict = new ResolutionScaler();
    strict.targetFps = 50;
    feed(strict, 1 / 45); // 45fps misses a 50 target
    expect(strict.scale).toBeLessThan(1);
  });

  it('renders at full resolution when auto-scaling is disabled', () => {
    const s = new ResolutionScaler();
    s.enabled = false;
    s.scale = 0.5;
    s.update(1 / 10); // even a terrible frame shouldn't lower it
    expect(s.scale).toBe(s.maxScale);
  });

  it('converges and then stops resizing at steady state (no thrash)', () => {
    const s = new ResolutionScaler();
    s.targetFps = 50;
    s.scale = 0.7;
    feed(s, 1 / 50, 400); // ~8 s right at the target → it should settle and hold 0.7

    // Now jitter around the target. A hunting scaler would resize every cooldown forever; a
    // converged one tolerates the jitter and barely moves (each move is an expensive GPU rebuild).
    let changes = 0;
    let prev = s.scale;
    for (let i = 0; i < 600; i++) {
      s.update(i % 2 === 0 ? 1 / 44 : 1 / 56); // ~50 fps with ±6 fps jitter
      if (s.scale !== prev) {
        changes += 1;
        prev = s.scale;
      }
    }
    expect(changes).toBeLessThanOrEqual(1); // settled → no continuous up/down resizing
  });

  it('resetSmoothing forgets a heavy backlog so a fresh cheap scale climbs back, not down', () => {
    const s = new ResolutionScaler();
    s.targetFps = 50;
    feed(s, 1 / 20, 40); // slow 20fps frames build a heavy EMA and push the scale down
    expect(s.scale).toBeLessThan(1); // sanity: the backlog really did drag it down
    // The intro reveal drops to a cheaper scale; with the backlog forgotten, the now-light
    // (fast) frames climb the scale back up instead of the stale history dragging it lower.
    s.scale = 0.45;
    s.resetSmoothing();
    feed(s, 1 / 120, 300);
    expect(s.scale).toBeGreaterThan(0.45);
  });
});
