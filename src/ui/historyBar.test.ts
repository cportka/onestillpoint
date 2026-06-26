// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { History } from '../core/History';
import { createHistoryBar, EventLog } from './historyBar';

// A minimal History stand-in — the bar only reads length/recorded/restorableLength here.
function stubHistory(): History {
  return { length: 10, recorded: 10, restorableLength: 10, peek: () => null } as unknown as History;
}

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

describe('HistoryBar', () => {
  const opts = () => ({
    history: stubHistory(),
    events: new EventLog(),
    scrubTo: (p: number) => p,
    currentPos: () => 1, // live edge
    startPos: () => 0.25, // rewind limit a quarter in
  });

  it('setVisible is idempotent — a redundant show must not reset a scrubbed marker', () => {
    const bar = createHistoryBar(opts());
    bar.setVisible(true);
    const head = document.querySelector<HTMLElement>('.osp-history__head')!;
    expect(head.style.left).toBe('100%'); // inits at the live edge ("now")

    head.style.left = '40%'; // simulate a scrub having parked the current marker mid-window
    bar.setVisible(true); // a redundant show (panel mount *and* formation.onDone both fire it)
    expect(head.style.left).toBe('40%'); // …must leave the scrubbed position alone

    bar.setVisible(false);
    bar.setVisible(true); // a genuine hide→show (e.g. after a Replay) does re-init
    expect(head.style.left).toBe('100%');
    bar.dispose();
  });

  it('places the start marker at the rewind limit when it fades in', () => {
    const bar = createHistoryBar(opts());
    bar.setVisible(true);
    const start = document.querySelector<HTMLElement>('.osp-history__start')!;
    expect(start.style.left).toBe('25%'); // startPos() = 0.25
    bar.dispose();
  });
});
