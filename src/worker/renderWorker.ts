/**
 * Worker render host — **stub** (scaffolding, v0.36.0). The OffscreenCanvas render path is being
 * built incrementally (see `docs/offscreen-canvas.md`): this entry currently just completes the
 * `init` → `ready` handshake and the `dispose`, so the message plumbing + worker bundling can be
 * wired and exercised before the engine is moved in. In a later step the renderer (Renderer, Scene,
 * PhysicsController, RaymarchPass, PostPipeline, Loop, …) is constructed here on the transferred
 * canvas and driven entirely by the protocol messages.
 *
 * It is intentionally not yet referenced by `main.ts` — the live app still renders on the main
 * thread. The handler is exported so it can be unit-tested without a real worker.
 */
import { WORKER_PROTOCOL_VERSION, isMainToWorker, type MainToWorker, type WorkerToMain } from './protocol';

/** Where worker → main messages go. In a real worker this is `self.postMessage`; injectable for tests. */
export type Post = (message: WorkerToMain) => void;

/**
 * Handle one main → worker message. Pure aside from `post` — returns nothing, posts replies. The
 * non-`init`/`dispose` cases are deliberate no-ops until the engine lives here.
 */
export function handleMessage(msg: MainToWorker, post: Post): void {
  switch (msg.type) {
    case 'init':
      if (msg.protocol !== WORKER_PROTOCOL_VERSION) {
        post({ type: 'error', message: `protocol mismatch: main ${msg.protocol} vs worker ${WORKER_PROTOCOL_VERSION}` });
        return;
      }
      // TODO(offscreen, step 2): build the renderer on `msg.canvas` + the engine, then post 'ready'
      // once `compileAsync` resolves. For now, complete the handshake so the plumbing can be tested.
      post({ type: 'ready', protocol: WORKER_PROTOCOL_VERSION, backend: 'webgpu' });
      return;
    case 'dispose':
      // TODO(offscreen): tear down the renderer + loop.
      return;
    default:
      // resize / pointer / wheel / control / command — serviced once the engine is moved in here.
      return;
  }
}

// Wire to the real worker scope when this module is run as a worker. In a dedicated worker
// `globalThis` *is* the scope; we cast to the slice we use so we don't need the "WebWorker" tsconfig
// lib (which collides with "DOM"). Guarded so importing the module in a test (no worker scope) is a
// no-op.
const scope = globalThis as unknown as {
  postMessage?: (message: WorkerToMain) => void;
  addEventListener?: (type: 'message', listener: (ev: { data: unknown }) => void) => void;
  WorkerGlobalScope?: unknown;
};

if (typeof scope.WorkerGlobalScope !== 'undefined' && scope.addEventListener && scope.postMessage) {
  const post: Post = (message) => scope.postMessage!(message);
  scope.addEventListener('message', (ev) => {
    if (isMainToWorker(ev.data)) handleMessage(ev.data, post);
  });
}
