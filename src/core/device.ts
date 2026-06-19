/**
 * Small environment probes. Guarded against non-browser (unit-test) contexts so
 * importing them never throws where `matchMedia` is undefined.
 */

/** Touch / coarse pointer — used to widen the default framing and to enable the
 *  long-press tooltips (native `title` hovers never appear on touch). */
export function isCoarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** Honour the OS "reduce motion" setting by skipping the formation intro. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
