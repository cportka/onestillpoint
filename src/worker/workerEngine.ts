/**
 * The render engine running **inside the worker** (OffscreenCanvas path, step 2). Browser-only (it
 * creates a `WebGPURenderer`), so it is not unit-tested — it's verified by the forced-flag Chromium
 * smoke test and injected behind a small interface so the message routing in `renderWorker.ts` stays
 * testable. See `docs/offscreen-canvas.md`.
 *
 * Scope (step 2): construct the renderer + the **real raymarch** + the post pipeline on the
 * transferred canvas, compile, and render a **static** formed view in a self-driven loop — proving
 * the heavy shader compiles and presents off the main thread. The dynamics (Scene, physics, input,
 * Controls, the resolution scaler) move in later steps; for now the uniforms keep their formed-view
 * defaults.
 */
import { createRenderer } from '../core/Renderer';
import { createBlackHole } from '../scene/BlackHole';
import { createBodyUniforms } from '../render/bodyUniforms';
import { createPostPipeline, type PostPipeline } from '../render/PostPipeline';
import { RaymarchPass } from '../render/RaymarchPass';
import { createBlackHoleNode } from '../render/tsl/raymarch';
import { createUniforms } from '../render/uniforms';
import type { InitMessage } from './protocol';

/** The slice of the worker engine the message router drives. */
export interface WorkerEngine {
  init(msg: InitMessage): Promise<{ backend: 'webgpu' | 'webgl' }>;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

// setTimeout/clearTimeout live on the worker global; rAF does not exist in a worker, so the proof
// self-drives at ~60 Hz. (Step 3 will have the main thread post vsync ticks for a smooth loop.)
const scope = globalThis as unknown as {
  setTimeout(cb: () => void, ms: number): number;
  clearTimeout(id: number): void;
};

export function createWorkerEngine(): WorkerEngine {
  let post: PostPipeline | null = null;
  let pass: RaymarchPass | null = null;
  let renderer: Awaited<ReturnType<typeof createRenderer>>['renderer'] | null = null;
  const uniforms = createUniforms();
  let raf = 0;
  let disposed = false;

  return {
    async init(msg) {
      const bundle = await createRenderer({ canvas: msg.canvas, width: msg.width, height: msg.height });
      if (disposed) {
        bundle.renderer.dispose();
        return { backend: 'webgpu' };
      }
      renderer = bundle.renderer;
      const blackHole = createBlackHole();
      const bodyUniforms = createBodyUniforms();
      uniforms.aspect.value = msg.width / Math.max(1, msg.height);
      uniforms.resolution.value.set(msg.width, msg.height);
      pass = new RaymarchPass(createBlackHoleNode(uniforms, blackHole, bodyUniforms));
      post = createPostPipeline(renderer, pass.scene, pass.camera, uniforms.fuzz);
      await renderer.compileAsync(pass.scene, pass.camera); // pay the shader compile here, in the worker
      const loop = (): void => {
        if (disposed || !post) return;
        post.render();
        raf = scope.setTimeout(loop, 16);
      };
      loop();
      return { backend: bundle.backend === 'webgpu' ? 'webgpu' : 'webgl' };
    },
    resize(width, height, _dpr) {
      if (!renderer || !post) return;
      renderer.setSize(width, height, false);
      post.resize();
      uniforms.aspect.value = width / Math.max(1, height);
      uniforms.resolution.value.set(width, height);
    },
    dispose() {
      disposed = true;
      scope.clearTimeout(raf);
      pass?.dispose();
      renderer?.dispose();
      post = null;
      pass = null;
      renderer = null;
    },
  };
}
