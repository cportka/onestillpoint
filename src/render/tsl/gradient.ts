import {
  abs,
  atan,
  clamp,
  float,
  Fn,
  fract,
  max,
  mix,
  normalize,
  screenUV,
  sin,
  smoothstep,
  vec3,
} from 'three/tsl';
import type { Uniforms } from '../uniforms';

const TWO_PI = Math.PI * 2;

/**
 * Phase 0 test pattern — a procedural "celestial grid" painted by the camera
 * ray direction and breathing with the time uniform.
 *
 * It is deliberately a placeholder, but it exercises the exact pipeline the
 * physics will lean on:
 *   - a per-pixel world-space view ray reconstructed from the camera uniforms
 *     (orbit the camera and the whole grid sweeps — proving CameraRig → shader),
 *   - the Loop's time uniform (a meridian glow rotates and the field pulses —
 *     proving Loop → shader).
 *
 * Phase 1 swaps this for the geodesic raymarch in `raymarch.ts`; the ray-setup
 * block at the top carries over almost verbatim.
 */
export function createGradientNode(u: Uniforms) {
  return Fn(() => {
    // --- Reconstruct a world-space view ray through this pixel (pinhole) ---
    const ndc = screenUV.sub(0.5).mul(2); // [-1, 1], y up
    const px = ndc.x.mul(u.tanHalfFov).mul(u.aspect);
    const py = ndc.y.mul(u.tanHalfFov);
    const dir = normalize(u.camForward.add(u.camRight.mul(px)).add(u.camUp.mul(py)));

    // --- Spherical coordinates of the ray, for a lon/lat grid ---
    const lon = atan(dir.z, dir.x); // azimuth, [-pi, pi]
    const lat = dir.y; // sine of elevation, [-1, 1]

    // Deep-space backdrop: a touch brighter toward the equator.
    const horizon = float(1).sub(abs(lat));
    const base = mix(vec3(0.01, 0.02, 0.05), vec3(0.04, 0.06, 0.12), horizon);

    // Grid: 12 meridians + 12 parallels. A line sits where the wrapped
    // coordinate crosses a band edge.
    const meridian = abs(fract(lon.mul(12 / TWO_PI).add(0.5)).sub(0.5));
    const parallel = abs(fract(lat.mul(6).add(0.5)).sub(0.5));
    const grid = max(
      smoothstep(0.04, 0, meridian),
      smoothstep(0.04, 0, parallel),
    );
    const gridColor = vec3(0.2, 0.45, 0.7).mul(grid).mul(0.6);

    // Time proof: a warm meridian that sweeps around as time advances.
    const sweepPhase = abs(
      fract(lon.div(TWO_PI).sub(u.time.mul(0.05)).add(0.5)).sub(0.5),
    );
    const sweep = smoothstep(0.15, 0, sweepPhase);
    const sweepColor = vec3(0.9, 0.55, 0.2).mul(sweep).mul(0.5);

    // Gentle global breathing so motion is obvious even when the camera is still.
    const breathe = float(0.85).add(sin(u.time).mul(0.15));

    const color = base.add(gridColor).add(sweepColor).mul(breathe);
    return clamp(color, 0, 1);
  })();
}
