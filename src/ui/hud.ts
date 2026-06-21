export interface Hud {
  /** Call once per frame with the real frame delta (seconds). */
  update(frameDelta: number): void;
  /** Show/hide the readout (the panel's "Display FPS" toggle). */
  setVisible(on: boolean): void;
}

/**
 * A minimal corner readout: just the live frame rate. Hidden by default; revealed
 * by the panel's "Display FPS" toggle. (The backend and the render-resolution
 * scale used to show here too, but they're noise next to the FPS.)
 */
export function createHud(): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.style.display = 'none'; // shown only when "Display FPS" is on
  document.body.appendChild(el);

  let frames = 0;
  let acc = 0;
  let fps = 0;

  const render = () => {
    el.textContent = `${fps} fps`;
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
