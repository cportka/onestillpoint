import { describe, expect, it } from 'vitest';
import { FormationSequence, type IntroDriver } from './FormationSequence';

class StubDriver implements IntroDriver {
  readonly homeDistance = 20;
  began = 0;
  finished = 0;
  lastDistance = Number.NaN;
  beginIntro(): void {
    this.began += 1;
  }
  placeOnHomeRay(distance: number): void {
    this.lastDistance = distance;
  }
  finishIntro(): void {
    this.finished += 1;
  }
}

const runToEnd = (seq: FormationSequence): void => {
  for (let i = 0; i < 1000 && !seq.done; i++) seq.update(0.016);
};

describe('FormationSequence', () => {
  it('starts wide and unformed, then settles home and fully formed', () => {
    const driver = new StubDriver();
    const formation = { value: 1 };
    const seq = new FormationSequence(driver, formation, { duration: 6 });

    expect(driver.began).toBe(1);
    expect(seq.done).toBe(false);
    expect(formation.value).toBeCloseTo(0, 5); // disk not yet ignited
    expect(driver.lastDistance).toBeGreaterThan(driver.homeDistance); // pulled back

    runToEnd(seq);

    expect(seq.done).toBe(true);
    expect(driver.finished).toBe(1);
    expect(formation.value).toBeCloseTo(1, 5); // fully formed → matches user settings
    expect(driver.lastDistance).toBeCloseTo(driver.homeDistance, 4); // arrived home
  });

  it('dollies inward (distance never increases)', () => {
    const driver = new StubDriver();
    const seq = new FormationSequence(driver, { value: 1 }, { duration: 6 });
    let prev = driver.lastDistance;
    for (let i = 0; i < 60; i++) {
      seq.update(0.05);
      expect(driver.lastDistance).toBeLessThanOrEqual(prev + 1e-6);
      prev = driver.lastDistance;
    }
  });

  it('completes instantly when reduced motion is preferred', () => {
    const driver = new StubDriver();
    const formation = { value: 0.5 };
    const seq = new FormationSequence(driver, formation, { reducedMotion: true });

    expect(seq.done).toBe(true);
    expect(driver.began).toBe(0); // no dolly
    expect(driver.finished).toBe(1);
    expect(formation.value).toBe(1);
  });

  it('skips to the formed state on demand', () => {
    const driver = new StubDriver();
    const formation = { value: 1 };
    const seq = new FormationSequence(driver, formation, { duration: 6 });
    seq.skip();
    expect(seq.done).toBe(true);
    expect(driver.finished).toBe(1);
    expect(formation.value).toBe(1);
  });

  it('replays from the top after finishing', () => {
    const driver = new StubDriver();
    const seq = new FormationSequence(driver, { value: 1 }, { duration: 6 });
    runToEnd(seq);
    expect(seq.done).toBe(true);

    seq.restart();
    expect(seq.done).toBe(false);
    expect(driver.began).toBe(2);
  });
});
