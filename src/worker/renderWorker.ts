/**
 * Worker render **entry** (OffscreenCanvas path, step 2). Thin: it wires the real WebGPU engine
 * (`createWorkerEngine`, browser-only) to the pure message {@link handleMessage} router (unit-tested
 * separately, in `router.ts`). Still **off by default** — only spawned when `canUseOffscreenRendering`
 * says so. See `docs/offscreen-canvas.md`.
 *
 * Scope today: the worker renders a **static formed view** off the main thread (the proof that the
 * heavy raymarch compiles + presents in a worker). Dynamics, input, Controls and Share move in later
 * steps.
 */
import { isMainToWorker, type WorkerToMain } from './protocol';
import { handleMessage, type Post } from './router';
import { createWorkerEngine } from './workerEngine';

// In a dedicated worker `globalThis` *is* the scope; cast to the slice we use so we don't need the
// "WebWorker" tsconfig lib (it collides with "DOM"). Guarded so importing the module outside a worker
// (defensive) is a no-op.
const scope = globalThis as unknown as {
  postMessage?: (message: WorkerToMain) => void;
  addEventListener?: (type: 'message', listener: (ev: { data: unknown }) => void) => void;
  WorkerGlobalScope?: unknown;
};

if (typeof scope.WorkerGlobalScope !== 'undefined' && scope.addEventListener && scope.postMessage) {
  const post: Post = (message) => scope.postMessage!(message);
  const engine = createWorkerEngine();
  scope.addEventListener('message', (ev) => {
    if (isMainToWorker(ev.data)) handleMessage(ev.data, post, engine);
  });
}
