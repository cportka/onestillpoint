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

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  await renderer.init();

  const isWebGPU =
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;

  return { renderer, backend: isWebGPU ? 'webgpu' : 'webgl2' };
}
