import type { RendererBundle } from '../core/Renderer';

export interface Hud {
  /** Call once per frame with the real frame delta (seconds). */
  update(frameDelta: number): void;
}

/**
 * A minimal corner readout: active GPU backend + live frame rate. It exists to
 * satisfy the Phase 0 acceptance check (confirm WebGPU is active, and that the
 * forced WebGL2 fallback renders) and to keep an eye on perf. It folds into the
 * lil-gui panel in Phase 4.
 */
export function createHud(backend: RendererBundle['backend']): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  document.body.appendChild(el);

  const label = backend === 'webgpu' ? 'WebGPU' : 'WebGL2';
  let frames = 0;
  let acc = 0;
  let fps = 0;

  const render = () => {
    el.textContent = `One Still Point · ${label} · ${fps} fps`;
  };
  render();

  return {
    update(frameDelta: number): void {
      frames += 1;
      acc += frameDelta;
      if (acc >= 0.5) {
        fps = Math.round(frames / acc);
        frames = 0;
        acc = 0;
        render();
      }
    },
  };
}

/** Replace the whole view with a fatal-error message (no WebGPU *and* no WebGL2,
 *  or an init failure). */
export function showFatalError(error: unknown): void {
  const el = document.createElement('div');
  el.className = 'fatal';
  const detail = error instanceof Error ? error.message : String(error);
  el.innerHTML =
    `<div><strong>One Still Point couldn't start.</strong><br><br>` +
    `This visualizer needs a browser with WebGPU or WebGL2.<br>` +
    `<br><small>${detail}</small></div>`;
  document.body.appendChild(el);
}
