import { describe, expect, it } from 'vitest';
import { SmoothnessGate } from './SmoothnessGate';

/** Feed evenly spaced ticks; returns the number of ticks it took to open (or -1). */
function ticksToOpen(gate: SmoothnessGate, start: number, gapMs: number, max = 100): number {
  for (let i = 0; i < max; i++) {
    if (gate.tick(start + i * gapMs)) return i + 1;
  }
  return -1;
}

describe('SmoothnessGate', () => {
  it('opens after exactly N consecutive fast gaps, once per arm', () => {
    const gate = new SmoothnessGate({ runLength: 6, thresholdMs: 50 });
    gate.arm(0);
    // tick 1 seeds; gaps accumulate from tick 2 → opens on tick 7 (6 fast gaps).
    expect(ticksToOpen(gate, 0, 16)).toBe(7);
    expect(gate.tick(1000)).toBe(false); // closed until re-armed
  });

  it('a stall resets the smooth run — the reveal cannot fire into a freeze', () => {
    const gate = new SmoothnessGate({ runLength: 3, thresholdMs: 50, ceilingMs: 60_000 });
    gate.arm(0);
    gate.tick(0); // seed
    gate.tick(16); // run 1
    gate.tick(32); // run 2
    expect(gate.tick(2032)).toBe(false); // a 2s stall (the measured freeze) → run resets
    gate.tick(2048); // run 1
    gate.tick(2064); // run 2
    expect(gate.tick(2080)).toBe(true); // run 3 → opens only after genuinely smooth frames
  });

  it("admits a weak phone's legitimate 30–40ms cadence", () => {
    const gate = new SmoothnessGate({ runLength: 6, thresholdMs: 50 });
    gate.arm(0);
    expect(ticksToOpen(gate, 0, 38)).toBe(7); // 38ms gaps < 50 → still opens promptly
  });

  it('one dropped 60Hz vsync (33ms) does not reset the run', () => {
    const gate = new SmoothnessGate({ runLength: 3, thresholdMs: 50 });
    gate.arm(0);
    gate.tick(0);
    gate.tick(16);
    gate.tick(49); // a 33ms gap — a single dropped frame, still under threshold
    expect(gate.tick(65)).toBe(true);
  });

  it('a device that cannot go fast opens via the ceiling instead of stranding the splash', () => {
    const gate = new SmoothnessGate({ runLength: 6, thresholdMs: 50, ceilingMs: 4000 });
    gate.arm(0);
    let opened = -1;
    for (let i = 0; i < 100; i++) {
      if (gate.tick(i * 70)) {
        opened = i * 70; // 70ms gaps never build a run…
        break;
      }
    }
    expect(opened).toBeGreaterThanOrEqual(4000); // …but the ceiling opens it
    expect(opened).toBeLessThan(4200);
  });

  it('re-arm resets the seed — a gap spanning the arm (the Replay melt) is never counted', () => {
    const gate = new SmoothnessGate({ runLength: 2, thresholdMs: 50 });
    gate.arm(0);
    gate.tick(0);
    gate.tick(16);
    gate.tick(32); // opens (run 2)…
    gate.arm(10_000); // …Replay re-arms much later
    expect(gate.tick(10_001)).toBe(false); // seeds fresh — the 9,969ms span isn't a "gap"
    gate.tick(10_017);
    expect(gate.tick(10_033)).toBe(true);
  });

  it('per-arm threshold widens for a cinematic frame cap (and never narrows below 50)', () => {
    const gate = new SmoothnessGate({ runLength: 3 });
    gate.arm(0, 1000 / 24 + 15); // ~56.7ms — a 24fps cap paces at ~50ms on 60Hz
    gate.tick(0);
    gate.tick(50);
    gate.tick(100);
    expect(gate.tick(150)).toBe(true); // 50ms gaps pass under the widened threshold
    gate.arm(0, 10); // absurdly low request → clamped to 50, not narrowed
    gate.tick(0);
    gate.tick(40);
    gate.tick(80);
    expect(gate.tick(120)).toBe(true);
  });

  it('is a no-op before arm', () => {
    const gate = new SmoothnessGate({ runLength: 1 });
    expect(gate.tick(0)).toBe(false);
    expect(gate.tick(16)).toBe(false);
  });
});
