import { describe, expect, it } from 'vitest';
import { EventLog } from './historyBar';

describe('EventLog', () => {
  it('positions events 0..1 across the window and drops those outside it', () => {
    const log = new EventLog();
    log.add('star', 10); // at the window start
    log.add('absorb', 15); // mid
    log.add('escape', 20); // at the window end
    log.add('hole', 4); // before the window → dropped
    const ev = log.inWindow(10, 20);
    expect(ev.map((e) => e.type)).toEqual(['star', 'absorb', 'escape']);
    expect(ev[0]!.pos).toBeCloseTo(0, 6);
    expect(ev[1]!.pos).toBeCloseTo(0.5, 6);
    expect(ev[2]!.pos).toBeCloseTo(1, 6);
  });

  it('is bounded — the oldest events are dropped past the cap', () => {
    const log = new EventLog(3);
    for (let i = 0; i < 5; i++) log.add('absorb', i); // at = 0..4
    const ev = log.inWindow(0, 4);
    expect(ev.length).toBe(3); // only the last 3 kept (at = 2, 3, 4)
    expect(ev.map((e) => Math.round(e.pos * 4))).toEqual([2, 3, 4]);
  });

  it('clear() empties it', () => {
    const log = new EventLog();
    log.add('star', 1);
    log.clear();
    expect(log.inWindow(0, 10)).toEqual([]);
  });
});
