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
});
