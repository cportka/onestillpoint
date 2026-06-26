import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Body } from '../scene/Body';
import { History, type HistoryFrame } from './History';
import { Timeline } from './Timeline';

function body(id: number, x: number, fixed = false): Body {
  return {
    id,
    type: 'star',
    mass: 1,
    lensMass: 0,
    fixed,
    position: new Vector3(x, 0, 0),
    velocity: new Vector3(),
    radius: 1,
    color: new Vector3(),
  };
}

/** A history with `a.x = 0..n-1` recorded over a fixed primary + one mover (one generation), plus
 *  an `applyFrame` that records each restored frame (a spy) and writes its kinematics. */
function recorded(n: number): {
  history: History;
  bodies: Body[];
  a: Body;
  applied: HistoryFrame[];
  applyFrame: (f: HistoryFrame) => void;
} {
  const history = new History(16);
  const a = body(1, 0);
  const bodies = [body(0, 0, true), a];
  for (let i = 0; i < n; i++) {
    a.position.x = i;
    history.record(bodies);
  }
  const applied: HistoryFrame[] = [];
  const applyFrame = (f: HistoryFrame): void => {
    applied.push(f);
    history.restore(f, bodies); // single-generation here, so the id-matched restore applies
  };
  return { history, bodies, a, applied, applyFrame };
}

describe('Timeline', () => {
  it('starts at the live edge (offset 0 → currentPos 1, live)', () => {
    const { history, applyFrame } = recorded(5);
    const t = new Timeline(history, applyFrame);
    expect(t.live).toBe(true);
    expect(t.currentPos).toBe(1);
  });

  it('scrubs to a 0..1 position and restores that frame onto the bodies', () => {
    const { history, a, applyFrame } = recorded(5); // a.x = 0..4 recorded
    const t = new Timeline(history, applyFrame);
    a.position.x = 99; // drift away…
    expect(t.scrubTo(0)).toBe(0); // …scrub to the oldest
    expect(a.position.x).toBe(0); // restored to the oldest frame
    expect(t.live).toBe(false);
    t.scrubTo(0.5);
    expect(a.position.x).toBe(2); // middle of the 5-frame window
    expect(t.currentPos).toBeCloseTo(0.5, 6);
  });

  it('clamps scrub + stepBack to the rewind limit (the oldest recorded frame)', () => {
    const { history, a, applyFrame } = recorded(5); // maxOffset = 4
    const t = new Timeline(history, applyFrame);
    for (let i = 0; i < 10; i++) t.stepBack(); // way past the oldest
    expect(a.position.x).toBe(0); // stuck at the oldest restorable frame
    expect(t.currentPos).toBe(0);
    expect(t.scrubTo(-5)).toBe(0); // a position below 0 still clamps to the oldest
    expect(a.position.x).toBe(0);
  });

  it('can now rewind across a body-set change — the whole window is restorable (roster restore)', () => {
    const history = new History(16);
    const a = body(1, 0);
    const bodies = [body(0, 0, true), a];
    for (let i = 0; i < 3; i++) {
      a.position.x = i;
      history.record(bodies); // gen 1: 3 frames (a only)
    }
    bodies.push(body(2, 0)); // a body was added → new generation
    for (let i = 3; i < 5; i++) {
      a.position.x = i;
      history.record(bodies); // gen 2: 2 frames (length now 5)
    }
    const applied: HistoryFrame[] = [];
    const t = new Timeline(history, (f) => applied.push(f));
    // The rewind limit is the *whole* window now, not the generation boundary.
    expect(t.startPos).toBe(0);
    t.scrubTo(0); // rewind all the way back, across the add
    expect(t.currentPos).toBe(0);
    const oldest = applied[applied.length - 1]!;
    expect(Array.from(oldest.ids)).toEqual([1]); // the gen-1 roster (a only) — restorable
    expect(oldest.state[0]).toBe(0); // its oldest x
  });

  it('replays forward: advance() walks the marker back to the live edge', () => {
    const { history, a, applyFrame } = recorded(5);
    const t = new Timeline(history, applyFrame);
    t.scrubTo(0); // offset 4, a.x = 0
    t.advance();
    expect(a.position.x).toBe(1);
    t.advance();
    expect(a.position.x).toBe(2);
    t.advance();
    t.advance();
    expect(t.live).toBe(true); // reached the live edge
    expect(a.position.x).toBe(4);
    t.advance(); // no-op at the edge
    expect(t.live).toBe(true);
  });

  it('stepForward returns the overflow past the live edge (the caller extends live)', () => {
    const { history, applyFrame } = recorded(5);
    const t = new Timeline(history, applyFrame);
    t.scrubTo(0); // offset 4
    expect(t.stepForward(2)).toBe(0); // 2 within range → offset 2
    expect(t.currentPos).toBeCloseTo(0.5, 6);
    expect(t.stepForward(5)).toBe(3); // only 2 left to the edge → 3 overflow
    expect(t.live).toBe(true);
  });

  it('reset() snaps back to the live edge', () => {
    const { history, applyFrame } = recorded(5);
    const t = new Timeline(history, applyFrame);
    t.scrubTo(0);
    expect(t.live).toBe(false);
    t.reset();
    expect(t.live).toBe(true);
    expect(t.currentPos).toBe(1);
  });
});
