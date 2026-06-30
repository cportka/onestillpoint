/**
 * Roadmap #6 — a merger rings harder than a speck. Maps an absorbed body's mass to the spacetime
 * ripple's amplitude (`uniforms.rippleStrength`, multiplied into the envelope in
 * `render/tsl/background.ts`'s `rippleWarp`), so a black-hole coalescence distorts + flashes the sky
 * more than a star/planet plunge.
 *
 * Gravitational-wave strain scales with the merging mass, so this is linear-in-mass — but clamped, a
 * *look* cue rather than a literal strain: a star (~1e-3) maps to ~1× (the unchanged baseline, so the
 * common star/planet plunge is no different than before), a secondary hole (~0.2) to ~2.6×, and it
 * never exceeds the cap. Pure → unit-tested; set CPU-side on the `absorb` event (see `main.ts`).
 */
export const RIPPLE_MASS_GAIN = 8;
export const RIPPLE_STRENGTH_MAX = 3;

export function rippleStrengthForMass(mass: number): number {
  return Math.min(RIPPLE_STRENGTH_MAX, 1 + RIPPLE_MASS_GAIN * Math.max(0, mass));
}
