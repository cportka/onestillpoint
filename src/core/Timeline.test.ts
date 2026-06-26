import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Body } from '../scene/Body';
import { History } from './History';
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

/** A history with `a.x = 0..n-1` recorded over a fixed primary + one mover, all one generation. */
function recorded(n: number): { history: History; bodies: Body[]; a: Body } {
  const history = new History(16);
  const a = body(1, 0);
  const bodies = [body(0, 0, true), a];
  for (let i = 0; i < n; i++) {
    a.position.x = i;
    history.record(bodies);
  }
  return { history, bodies, a };
}

describe('Timeline', () => {
  it('starts at the live edge (offset 0 → currentPos 1, live)', () => {
    const { history, bodies } = recorded(5);
    const t = new Timeline(history, () => bodies);
    expect(t.live).toBe(true);
    expect(t.currentPos).toBe(1);
  });

  it('scrubs to a 0..1 position and restores that frame onto the bodies', () => {
    const { history, bodies, a } = recorded(5); // a.x = 0..4 recorded
    const t = new Timeline(history, () => bodies);
    a.position.x = 99; // drift away…
    expect(t.scrubTo(0)).toBe(0); // …scrub to the oldest
    expect(a.position.x).toBe(0); // restored to the oldest frame
    expect(t.live).toBe(false);
    t.scrubTo(0.5);
    expect(a.position.x).toBe(2); // middle of the 5-frame window
    expect(t.currentPos).toBeCloseTo(0.5, 6);
  });

  it('clamps scrub + stepBack to the rewind limit (the start marker)', () => {
    const { history, bodies, a } = recorded(5); // maxOffset = 4
    const t = new Timeline(history, () => bodies);
    for (let i = 0; i < 10; i++) t.stepBack(); // way past the oldest
    expect(a.position.x).toBe(0); // stuck at the oldest restorable frame
    expect(t.currentPos).toBe(0);
    expect(t.scrubTo(-5)).toBe(0); // a position below 0 still clamps to the oldest
    expect(a.position.x).toBe(0);
  });

  it('the start marker tracks the generation boundary (can not rewind across a body change)', () => {
    const history = new History(16);
    const a = body(1, 0);
    const b = body(2, 0);
    const bodies = [body(0, 0, true), a];
    for (let i = 0; i < 3; i++) {
      a.position.x = i;
      history.record(bodies); // gen 1: 3 frames
    }
    bodies.push(b); // a body was added → new generation
    for (let i = 3; i < 5; i++) {
      a.position.x = i;
      history.record(bodies); // gen 2: 2 frames (length now 5)
    }
    const t = new Timeline(history, () => bodies);
    // restorableLength = 2 → maxOffset = 1; the window spans 5 frames → startPos = 1 - 1/4 = 0.75
    expect(t.startPos).toBeCloseTo(0.75, 6);
    t.scrubTo(0); // try to rewind all the way back
    expect(t.currentPos).toBeCloseTo(0.75, 6); // clamped at the start marker, not 0
    expect(a.position.x).toBe(3); // the oldest frame of the *current* layout, not gen-1's
  });

  it('replays forward: advance() walks the marker back to the live edge', () => {
    const { history, bodies, a } = recorded(5);
    const t = new Timeline(history, () => bodies);
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
    const { history, bodies } = recorded(5);
    const t = new Timeline(history, () => bodies);
    t.scrubTo(0); // offset 4
    expect(t.stepForward(2)).toBe(0); // 2 within range → offset 2
    expect(t.currentPos).toBeCloseTo(0.5, 6);
    expect(t.stepForward(5)).toBe(3); // only 2 left to the edge → 3 overflow
    expect(t.live).toBe(true);
  });

  it('reset() snaps back to the live edge', () => {
    const { history, bodies } = recorded(5);
    const t = new Timeline(history, () => bodies);
    t.scrubTo(0);
    expect(t.live).toBe(false);
    t.reset();
    expect(t.live).toBe(true);
    expect(t.currentPos).toBe(1);
  });
});
