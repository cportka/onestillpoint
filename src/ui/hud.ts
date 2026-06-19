import type { RendererBundle } from '../core/Renderer';

export interface Hud {
  /** Call once per frame with the real frame delta (seconds). */
  update(frameDelta: number): void;
  /** Show/hide the readout (the panel's "Display FPS" toggle). */
  setVisible(on: boolean): void;
}

/**
 * A minimal corner readout: active GPU backend · live frame rate · current
 * render-resolution scale (the "% res" — auto-resolution lowers it under load).
 * Hidden by default; revealed by the panel's "Display FPS" toggle.
 */
export function createHud(
  backend: RendererBundle['backend'],
  getScale?: () => number,
): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.style.display = 'none'; // shown only when "Display FPS" is on
  document.body.appendChild(el);

  const label = backend === 'webgpu' ? 'WebGPU' : 'WebGL2';
  let frames = 0;
  let acc = 0;
  let fps = 0;

  const render = () => {
    const res = getScale ? ` · ${Math.round(getScale() * 100)}% res` : '';
    el.textContent = `${label} · ${fps} fps${res}`;
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
    setVisible(on: boolean): void {
      el.style.display = on ? '' : 'none';
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
