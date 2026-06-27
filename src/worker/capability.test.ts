import { describe, expect, it } from 'vitest';
import { canUseOffscreenRendering, probeOffscreenEnv, type OffscreenEnv } from './capability';

const FULL: OffscreenEnv = { offscreenCanvas: true, worker: true, transferControl: true };

describe('probeOffscreenEnv', () => {
  it('reports all-false on a bare global (e.g. Node / SSR)', () => {
    expect(probeOffscreenEnv({} as typeof globalThis)).toEqual({
      offscreenCanvas: false,
      worker: false,
      transferControl: false,
    });
  });

  it('detects each capability when present', () => {
    const g = {
      OffscreenCanvas: function OffscreenCanvas() {},
      Worker: function Worker() {},
      HTMLCanvasElement: { prototype: { transferControlToOffscreen: () => undefined } },
    } as unknown as typeof globalThis;
    expect(probeOffscreenEnv(g)).toEqual(FULL);
  });
});

describe('canUseOffscreenRendering', () => {
  it('is off by default during the scaffolding phase (not enabled)', () => {
    expect(canUseOffscreenRendering(FULL)).toBe(false);
  });

  it('is on only when explicitly enabled AND fully capable', () => {
    expect(canUseOffscreenRendering(FULL, { enabled: true })).toBe(true);
    expect(canUseOffscreenRendering({ ...FULL, offscreenCanvas: false }, { enabled: true })).toBe(false);
    expect(canUseOffscreenRendering({ ...FULL, worker: false }, { enabled: true })).toBe(false);
    expect(canUseOffscreenRendering({ ...FULL, transferControl: false }, { enabled: true })).toBe(false);
  });

  it('forceMain overrides even when enabled + capable', () => {
    expect(canUseOffscreenRendering(FULL, { enabled: true, forceMain: true })).toBe(false);
  });
});
