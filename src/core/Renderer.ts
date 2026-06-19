import { ACESFilmicToneMapping } from 'three';
import { WebGPURenderer } from 'three/webgpu';

export interface RendererBundle {
  renderer: WebGPURenderer;
  /** Which backend actually initialised — for the HUD and acceptance checks. */
  backend: 'webgpu' | 'webgl2';
}

/**
 * Create and initialise the renderer.
 *
 * WebGPURenderer targets WebGPU when available and falls back to WebGL2
 * automatically. Append `?webgl` to the URL to force the fallback path — Phase 0
 * acceptance requires confirming *both* that WebGPU is active on a capable
 * browser and that the WebGL2 fallback still renders.
 */
export async function createRenderer(): Promise<RendererBundle> {
  const forceWebGL = new URLSearchParams(location.search).has('webgl');

  const renderer = new WebGPURenderer({
    // The image is shader-generated, so there are no polygon edges to MSAA —
    // disabling antialias saves memory (matters on iOS Safari).
    antialias: false,
    forceWebGL,
    powerPreference: 'high-performance',
  });

  // Pixel ratio is folded into the drawing-buffer size we set each frame (see
  // ResolutionScaler), so keep the renderer's own ratio at 1 to avoid double
  // scaling.
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 1);

  // The accretion disk is HDR (relativistic beaming spans a huge dynamic
  // range), so tone-map to a viewable range. Bloom + a look/exposure UI follow
  // in Phase 4; this is the minimum needed to evaluate Phase 2 honestly.
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  await renderer.init();

  const isWebGPU =
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;

  return { renderer, backend: isWebGPU ? 'webgpu' : 'webgl2' };
}
