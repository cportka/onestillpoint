// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MELT_CLASS, meltInward } from './melt';

afterEach(() => vi.useRealTimers());

describe('meltInward', () => {
  it('adds the melt class immediately and schedules onMelted at durationMs', () => {
    const el = document.createElement('canvas');
    const onMelted = vi.fn();
    const schedule = vi.fn();
    meltInward(el, onMelted, { durationMs: 2000 }, schedule);
    expect(el.classList.contains(MELT_CLASS)).toBe(true);
    expect(onMelted).not.toHaveBeenCalled(); // fires only when the schedule does
    expect(schedule).toHaveBeenCalledWith(onMelted, 2000);
  });

  it('restore() removes the melt class and is idempotent', () => {
    const el = document.createElement('canvas');
    const handle = meltInward(el, () => {}, { durationMs: 10 }, () => {});
    expect(el.classList.contains(MELT_CLASS)).toBe(true);
    handle.restore();
    expect(el.classList.contains(MELT_CLASS)).toBe(false);
    handle.restore(); // no throw, still cleared
    expect(el.classList.contains(MELT_CLASS)).toBe(false);
  });

  it('invokes onMelted via the default setTimeout scheduler after the duration', () => {
    vi.useFakeTimers();
    const el = document.createElement('canvas');
    const onMelted = vi.fn();
    meltInward(el, onMelted, { durationMs: 2000 });
    expect(onMelted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1999);
    expect(onMelted).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onMelted).toHaveBeenCalledOnce();
  });
});
