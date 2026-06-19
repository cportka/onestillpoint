import { uniform } from 'three/tsl';

/**
 * A Schwarzschild black hole's parameters, exposed as GPU uniforms. This is the
 * seed of the Phase 5 scene/body model — for now there is exactly one hole at
 * the origin, but the shader reads its mass as a uniform so the data already
 * flows the way a multi-body scene will.
 *
 * `mass` (M) is the length scale in geometric units (G = c = 1): the horizon is
 * at 2M, the photon sphere at 3M, the ISCO at 6M. Phases 2+ add disk parameters
 * here (inner/outer radius, temperature, inclination, …).
 */
export function createBlackHole() {
  return {
    mass: uniform(1),
  };
}

export type BlackHole = ReturnType<typeof createBlackHole>;
