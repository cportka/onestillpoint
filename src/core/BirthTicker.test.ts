import { describe, expect, it } from 'vitest';
import { BirthTicker } from './BirthTicker';
import type { BodyType } from '../scene/Body';

/** The default seeded line-up: 3 stars then 3 planets (seed order). */
const lineup = (): { type: BodyType }[] => [
  { type: 'star' },
  { type: 'star' },
  { type: 'star' },
  { type: 'planet' },
  { type: 'planet' },
  { type: 'planet' },
];

const count = (fired: BodyType[], type: BodyType): number => fired.filter((t) => t === type).length;

describe('BirthTicker', () => {
  it('births each seeded body once, stars before planets, as the intro progresses', () => {
    const fired: BodyType[] = [];
    const ticker = new BirthTicker((b) => fired.push(b.type));
    ticker.arm(lineup());

    ticker.update(0, 0.3, lineup); // the intro hasn't really begun — nobody is in yet
    expect(fired).toEqual([]);

    ticker.update(0.1, 0.3, lineup); // still before the stars' half-in point (~0.115)
    expect(fired).toEqual([]);

    // The stars are in (planets need ~0.36). Pump frames past the stagger gap to drain them.
    for (let i = 0; i < 5; i++) ticker.update(0.2, 0.3, lineup);
    expect(count(fired, 'star')).toBe(3);
    expect(count(fired, 'planet')).toBe(0);

    for (let i = 0; i < 5; i++) ticker.update(0.4, 0.3, lineup); // now the planets are in too
    expect(count(fired, 'planet')).toBe(3);
    expect(fired.length).toBe(6); // …and nobody is born twice
  });

  it('staggers the births — at most one per gap, even when several are eligible at once', () => {
    const fired: BodyType[] = [];
    const ticker = new BirthTicker((b) => fired.push(b.type));
    ticker.arm(lineup());

    ticker.update(1, 0.05, lineup); // all six eligible, but it's pre-charged → exactly one is born
    expect(fired.length).toBe(1);
    ticker.update(1, 0.05, lineup); // +0.05 s (< gap) → held
    expect(fired.length).toBe(1);
    ticker.update(1, 0.05, lineup); // +0.05 s (0.10 total, < gap) → still held
    expect(fired.length).toBe(1);
    ticker.update(1, 0.2, lineup); // crosses the gap → one more
    expect(fired.length).toBe(2);
  });

  it('never double-fires, and drains the whole line-up given enough time', () => {
    const fired: BodyType[] = [];
    const ticker = new BirthTicker((b) => fired.push(b.type));
    ticker.arm(lineup());
    for (let i = 0; i < 60; i++) ticker.update(1, 0.1, lineup); // 6 s at full progress
    expect(count(fired, 'star')).toBe(3);
    expect(count(fired, 'planet')).toBe(3);
    expect(fired.length).toBe(6);
  });

  it('re-arms on a formation restart (replay) — the fresh line-up is born again', () => {
    const fired: BodyType[] = [];
    const ticker = new BirthTicker((b) => fired.push(b.type));
    ticker.arm(lineup());
    for (let i = 0; i < 30; i++) ticker.update(1, 0.1, lineup); // the whole line-up is born
    expect(fired.length).toBe(6);

    // Replay: progress snaps back to the top (a sharp drop) → re-arm with a fresh line-up.
    ticker.update(0.05, 0.1, lineup); // re-armed, but 0.05 is before anyone's half-in point
    expect(fired.length).toBe(6);
    for (let i = 0; i < 30; i++) ticker.update(1, 0.1, lineup); // …and the fresh line-up is born again
    expect(fired.length).toBe(12);
  });

  it('does not re-arm on the normal forward march of progress', () => {
    const fired: BodyType[] = [];
    const ticker = new BirthTicker((b) => fired.push(b.type));
    ticker.arm(lineup());
    for (let p = 0; p <= 1.0001; p += 0.02) ticker.update(p, 0.1, lineup); // monotonic, ~5 s
    expect(fired.length).toBe(6); // exactly one line-up — no spurious re-arm doubled it
  });

  it('emits the armed body itself, so the host can mark that real body born', () => {
    const a = { type: 'star' as BodyType };
    const b = { type: 'planet' as BodyType };
    const fired: { type: BodyType }[] = [];
    const ticker = new BirthTicker<{ type: BodyType }>((born) => fired.push(born));
    ticker.arm([a, b]);
    for (let i = 0; i < 5; i++) ticker.update(1, 0.3, () => [a, b]);
    expect(fired).toContain(a); // same references, not copies — markBorn can mutate the live body
    expect(fired).toContain(b);
  });
});
