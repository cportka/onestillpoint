/**
 * Capability detection + the master gate for the OffscreenCanvas render worker. The worker path
 * needs `OffscreenCanvas`, a (module) `Worker`, and `HTMLCanvasElement.transferControlToOffscreen`
 * — none universal (older Safari). See `docs/offscreen-canvas.md`.
 */

export interface OffscreenEnv {
  /** The `OffscreenCanvas` constructor is present. */
  offscreenCanvas: boolean;
  /** The `Worker` constructor is present. */
  worker: boolean;
  /** `HTMLCanvasElement.prototype.transferControlToOffscreen` is present. */
  transferControl: boolean;
}

/** Probe the given global (defaults to the real one) for the three capabilities. Pure + injectable
 *  so it's unit-testable on Node, where none of them exist. */
export function probeOffscreenEnv(g: typeof globalThis = globalThis): OffscreenEnv {
  const win = g as {
    OffscreenCanvas?: unknown;
    Worker?: unknown;
    HTMLCanvasElement?: { prototype?: object };
  };
  const canvasProto = win.HTMLCanvasElement?.prototype;
  return {
    offscreenCanvas: typeof win.OffscreenCanvas === 'function',
    worker: typeof win.Worker === 'function',
    transferControl: !!canvasProto && 'transferControlToOffscreen' in canvasProto,
  };
}

export interface OffscreenOptions {
  /** Master switch. The worker render path is **off by default** until it reaches parity with the
   *  main-thread path (see `docs/offscreen-canvas.md`); flip this when the migration is done. */
  enabled?: boolean;
  /** Force the main-thread path regardless of capability (e.g. a `?worker=0` override, or a device
   *  the worker path is known to misbehave on). */
  forceMain?: boolean;
}

/**
 * Whether to use the OffscreenCanvas worker render path. Returns `false` unless it is both
 * **explicitly enabled** *and* fully supported (and not force-disabled) — so during the scaffolding
 * phase (`enabled` unset) the answer is always `false` and the app keeps the main-thread renderer.
 */
export function canUseOffscreenRendering(env: OffscreenEnv, opts: OffscreenOptions = {}): boolean {
  if (!opts.enabled || opts.forceMain) return false;
  return env.offscreenCanvas && env.worker && env.transferControl;
}
