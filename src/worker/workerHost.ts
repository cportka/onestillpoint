/**
 * Main-thread side of the OffscreenCanvas render path (step 2). Spawns the render worker, hands it
 * control of the canvas (`transferControlToOffscreen`), kicks off `init`, and relays the worker's
 * `ready`/`error`/`status` back to callbacks. Off by default — only reached when
 * `canUseOffscreenRendering()` says so (see `docs/offscreen-canvas.md`). Lazy-imported, so neither it
 * nor the worker bundle touches the default main-thread load.
 */
import {
  WORKER_PROTOCOL_VERSION,
  isWorkerToMain,
  type MainToWorker,
  type QualityChoice,
  type StatusMessage,
} from './protocol';

export interface WorkerHostCallbacks {
  onReady?: (backend: 'webgpu' | 'webgl') => void;
  onError?: (message: string) => void;
  onStatus?: (status: StatusMessage) => void;
}

export interface WorkerHost {
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

export interface WorkerHostInit {
  width: number;
  height: number;
  dpr: number;
  quality: QualityChoice;
}

export function startWorkerHost(
  canvas: HTMLCanvasElement,
  init: WorkerHostInit,
  cb: WorkerHostCallbacks = {},
): WorkerHost {
  const worker = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' });
  const send = (message: MainToWorker, transfer: Transferable[] = []): void => worker.postMessage(message, transfer);

  worker.addEventListener('message', (ev: MessageEvent) => {
    const m = ev.data;
    if (!isWorkerToMain(m)) return;
    if (m.type === 'ready') cb.onReady?.(m.backend);
    else if (m.type === 'error') cb.onError?.(m.message);
    else if (m.type === 'status') cb.onStatus?.(m);
  });

  // Transferring control means the worker now owns this canvas's drawing buffer; the main thread can
  // no longer get a 2D/WebGPU context from it. It must be passed in the transfer list.
  const offscreen = canvas.transferControlToOffscreen();
  send(
    { type: 'init', protocol: WORKER_PROTOCOL_VERSION, canvas: offscreen, width: init.width, height: init.height, dpr: init.dpr, quality: init.quality },
    [offscreen],
  );

  return {
    resize: (width, height, dpr) => send({ type: 'resize', width, height, dpr }),
    dispose: () => {
      send({ type: 'dispose' });
      worker.terminate();
    },
  };
}
