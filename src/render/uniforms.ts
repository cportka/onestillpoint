import { Vector2, Vector3 } from 'three';
import { uniform } from 'three/tsl';

/**
 * The uniform "bus" — the single set of GPU uniforms shared between the core
 * systems that *produce* state (CameraRig, Loop, the resize handler) and the
 * raymarch shader that *consumes* it.
 *
 * Keeping these in one object, injected where needed, means:
 *   - CameraRig / Loop stay pure producers (no shader knowledge),
 *   - the shader stays a pure consumer (no engine knowledge),
 *   - and Phase 5's `Scene` has exactly one thing to pack each frame.
 *
 * All spatial values are in geometric units where the black hole mass M is the
 * length scale (G = c = 1); see the build plan §5.
 */
export function createUniforms() {
  return {
    /** Simulation time in seconds. Advanced by Loop; honours pause + time scale. */
    time: uniform(0),

    /** Orbit-camera world position — the ray origin for every pixel. */
    camPos: uniform(new Vector3(0, 6, 22)),
    /** Orthonormal camera basis in world space (right / up / forward). */
    camRight: uniform(new Vector3(1, 0, 0)),
    camUp: uniform(new Vector3(0, 1, 0)),
    camForward: uniform(new Vector3(0, 0, -1)),
    /** Pinhole projection params: tan(fov/2) and width/height. */
    tanHalfFov: uniform(Math.tan((60 * Math.PI) / 360)),
    aspect: uniform(1),

    /** Drawing-buffer size in physical pixels (for AA / dithering / dynamic res). */
    resolution: uniform(new Vector2(1, 1)),
  };
}

export type Uniforms = ReturnType<typeof createUniforms>;
