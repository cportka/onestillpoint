import { ACESFilmicToneMapping } from 'three';
import { WebGPURenderer } from 'three/webgpu';

export interface RendererBundle {
  renderer: WebGPURenderer;
  /** Which backend actually initialised — for the HUD and acceptance checks. */
  backend: 'webgpu' | 'webgl2';
}

export interface RendererOptions {
  /** Draw target. Omitted on the main thread (three creates its own canvas, as before); the render
   *  **worker** passes the transferred `OffscreenCanvas` (see `docs/offscreen-canvas.md`). */
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  /** Initial drawing-buffer size. Defaults to the window on the main thread; required in a worker
   *  (no `window`). */
  width?: number;
  height?: number;
  /** Force the WebGL2 fallback (defaults to the `?webgl` URL flag where a `location` exists). */
  forceWebGL?: boolean;
}

/**
 * Create and initialise the renderer.
 *
 * WebGPURenderer targets WebGPU when available and falls back to WebGL2
 * automatically. Append `?webgl` to the URL to force the fallback path — Phase 0
 * acceptance requires confirming *both* that WebGPU is active on a capable
 * browser and that the WebGL2 fallback still renders.
 *
 * Pure DOM-free with explicit `canvas`/`width`/`height` (the worker path); with no options it keeps
 * the original main-thread behaviour (its own canvas, sized to the window).
 */
export async function createRenderer(opts: RendererOptions = {}): Promise<RendererBundle> {
  const forceWebGL =
    opts.forceWebGL ?? (typeof location !== 'undefined' && new URLSearchParams(location.search).has('webgl'));

  const renderer = new WebGPURenderer({
    canvas: opts.canvas, // undefined on main → three creates its own canvas (unchanged)
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
  const width = opts.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1);
  const height = opts.height ?? (typeof window !== 'undefined' ? window.innerHeight : 1);
  renderer.setSize(width, height, false);
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
