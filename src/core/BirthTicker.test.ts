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
    const ticker = new BirthTicker((t) => fired.push(t));
    ticker.arm(lineup());

    ticker.update(0, lineup); // the intro hasn't really begun — nobody is in yet
    expect(fired).toEqual([]);

    ticker.update(0.1, lineup); // still before the stars' half-in point (~0.115)
    expect(fired).toEqual([]);

    ticker.update(0.2, lineup); // the stars have swooshed in; the planets have not (need ~0.36)
    expect(count(fired, 'star')).toBe(3);
    expect(count(fired, 'planet')).toBe(0);

    ticker.update(0.4, lineup); // now the planets are in too
    expect(count(fired, 'planet')).toBe(3);

    ticker.update(1, lineup); // everyone already born — no double-fire
    expect(fired.length).toBe(6);
  });

  it('never double-fires a body, sweeping the whole intro frame by frame', () => {
    const fired: BodyType[] = [];
    const ticker = new BirthTicker((t) => fired.push(t));
    ticker.arm(lineup());
    for (let p = 0; p <= 1.0001; p += 0.02) ticker.update(p, lineup);
    expect(count(fired, 'star')).toBe(3);
    expect(count(fired, 'planet')).toBe(3);
    expect(fired.length).toBe(6);
  });

  it('re-arms on a formation restart (replay) — the fresh line-up is born again', () => {
    const fired: BodyType[] = [];
    const ticker = new BirthTicker((t) => fired.push(t));
    ticker.arm(lineup());
    ticker.update(1, lineup); // the whole line-up is born
    expect(fired.length).toBe(6);

    // Replay: progress snaps back to the top (a sharp drop) → re-arm with a fresh line-up.
    ticker.update(0.05, lineup); // re-armed, but 0.05 is before anyone's half-in point
    expect(fired.length).toBe(6);
    ticker.update(1, lineup); // …and the fresh line-up is born again
    expect(fired.length).toBe(12);
  });

  it('does not re-arm on the normal forward march of progress', () => {
    const fired: BodyType[] = [];
    const ticker = new BirthTicker((t) => fired.push(t));
    ticker.arm(lineup());
    for (let p = 0; p <= 1.0001; p += 0.1) ticker.update(p, lineup);
    expect(fired.length).toBe(6); // exactly one line-up — no spurious re-arm doubled it
  });
});
