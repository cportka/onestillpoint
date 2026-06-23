import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Body } from '../scene/Body';
import { History } from './History';

function body(id: number, pos: Vector3, vel: Vector3, fixed = false): Body {
  return { id, type: 'star', mass: 1, lensMass: 0, fixed, position: pos, velocity: vel, radius: 1, color: new Vector3() };
}

describe('History', () => {
  it('records the movable bodies (the fixed primary is excluded)', () => {
    const h = new History(8);
    h.record([body(0, new Vector3(), new Vector3(), true), body(1, new Vector3(3, 0, 0), new Vector3(0, 1, 0))]);
    expect(h.length).toBe(1);
    const f = h.peek(0)!;
    expect(Array.from(f.ids)).toEqual([1]);
    expect(f.state[0]).toBe(3); // x
    expect(f.state[4]).toBe(1); // vy
  });

  it('restores a past frame (Float32-exact — snapshots are compact)', () => {
    const h = new History(8);
    const p = body(1, new Vector3(5, 0, 0), new Vector3(0, 0.2, 0));
    const bodies = [body(0, new Vector3(), new Vector3(), true), p];
    h.record(bodies);
    const past = h.peek(0)!;
    p.position.set(99, 99, 99); // drift away…
    p.velocity.set(1, 1, 1);
    expect(h.restore(past, bodies)).toBe(true); // …then scrub back
    expect(p.position.x).toBe(5);
    expect(p.velocity.y).toBeCloseTo(0.2, 6); // Float32 storage → ~1e-7
  });

  it('is a ring buffer: keeps only the last `capacity` frames', () => {
    const h = new History(4);
    const p = body(1, new Vector3(0, 0, 0), new Vector3());
    const bodies = [body(0, new Vector3(), new Vector3(), true), p];
    for (let i = 0; i < 10; i++) {
      p.position.x = i;
      h.record(bodies);
    }
    expect(h.length).toBe(4);
    expect(h.peek(0)!.state[0]).toBe(9); // most recent
    expect(h.peek(3)!.state[0]).toBe(6); // oldest still kept
    expect(h.peek(4)).toBeNull(); // evicted / out of range
  });

  it('bumps the generation when the body set changes, and restore refuses across it', () => {
    const h = new History();
    const primary = body(0, new Vector3(), new Vector3(), true);
    const a = body(1, new Vector3(1, 0, 0), new Vector3());
    const b = body(2, new Vector3(2, 0, 0), new Vector3());
    h.record([primary, a]);
    const g1 = h.currentGeneration;
    h.record([primary, a]); // same set → same generation
    expect(h.currentGeneration).toBe(g1);
    h.record([primary, a, b]); // a body was added
    expect(h.currentGeneration).toBe(g1 + 1);
    // the 2-body frame must not be restored onto the 1-body set
    expect(h.restore(h.peek(0)!, [primary, a])).toBe(false);
  });

  it('clear() drops everything', () => {
    const h = new History(8);
    h.record([body(0, new Vector3(), new Vector3(), true), body(1, new Vector3(1, 0, 0), new Vector3())]);
    h.clear();
    expect(h.length).toBe(0);
    expect(h.peek(0)).toBeNull();
  });
});
