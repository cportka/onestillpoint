import { uniform } from 'three/tsl';

/**
 * A Schwarzschild black hole's parameters, exposed as GPU uniforms. This is the
 * seed of the Phase 5 scene/body model — for now there is exactly one hole at
 * the origin, but the shader reads its parameters as uniforms so the data
 * already flows the way a multi-body scene will.
 *
 * `mass` (M) is the length scale in geometric units (G = c = 1): the horizon is
 * at 2M, the photon sphere at 3M, the ISCO at 6M. Disk radii are in units of M.
 *
 * The disk values are live-tunable from the console before the Phase 4 GUI
 * exists, e.g. `osp.blackHole.diskBrightness.value = 80`.
 */
export function createBlackHole() {
  return {
    mass: uniform(1),

    // Accretion disk (Phase 2, static)
    diskInner: uniform(6), // inner edge = ISCO = 6M
    diskOuter: uniform(20), // outer edge (M)
    diskTemp: uniform(15000), // peak temperature scale (K)
    diskBrightness: uniform(120), // HDR radiance scale (tone-mapped on output)
    doppler: uniform(1), // relativistic beaming toggle (0 or 1)
    redshift: uniform(1), // gravitational redshift toggle (0 or 1)
  };
}

export type BlackHole = ReturnType<typeof createBlackHole>;
