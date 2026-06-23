/** Per-frame state the HUD can show (passed from the render loop). */
export interface HudInfo {
  /** Drawing-buffer scale 0..1 (auto-resolution). */
  resScale?: number;
  /** Orbiting-companion count. */
  bodies?: number;
  /** Simulation speed multiplier. */
  timeScale?: number;
  /** N-body sim running on the GPU? */
  gpu?: boolean;
}

/** Which optional rows the HUD shows (driven by Advanced-settings toggles). */
export interface HudOptions {
  graph: boolean; // the frame-time sparkline
  resolution: boolean; // res % + draw size
  detail: boolean; // bodies · speed · CPU/GPU
}

export interface Hud {
  /** Call once per frame with the real frame delta (seconds) + optional state. */
  update(frameDelta: number, info?: HudInfo): void;
  /** Show/hide the readout (the panel's "Display FPS" toggle). */
  setVisible(on: boolean): void;
  /** Toggle which rich rows appear (the Advanced "HUD" options). */
  setOptions(opts: Partial<HudOptions>): void;
}

const GRAPH_W = 124;
const GRAPH_H = 26;
const SAMPLES = GRAPH_W; // one column per recent frame
// Frame-time → colour: green ≤ ~16ms (60fps), amber ~33ms, red beyond.
const TARGET_MS = 1000 / 60;

/**
 * A small, beautiful debug HUD pinned to the **lower-left**. Always shows the live
 * frame rate + backend; optionally a **frame-time sparkline**, the current
 * **resolution scale**, and a **detail** line (bodies · speed · CPU/GPU) — each
 * toggled from Advanced settings. Hidden by default; revealed (with a fade + pop)
 * by "Display FPS". Augments the old single-number readout.
 */
export function createHud(backend: 'webgpu' | 'webgl2'): Hud {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML =
    `<div class="hud__top"><span class="hud__fps">— fps</span><span class="hud__be">${backend === 'webgpu' ? 'WebGPU' : 'WebGL2'}</span></div>` +
    `<canvas class="hud__graph" width="${GRAPH_W}" height="${GRAPH_H}"></canvas>` +
    `<div class="hud__ft">—</div><div class="hud__res">—</div><div class="hud__detail">—</div>`;
  document.body.appendChild(el);

  const fpsEl = el.querySelector<HTMLElement>('.hud__fps')!;
  const ftEl = el.querySelector<HTMLElement>('.hud__ft')!;
  const resEl = el.querySelector<HTMLElement>('.hud__res')!;
  const detailEl = el.querySelector<HTMLElement>('.hud__detail')!;
  const canvas = el.querySelector<HTMLCanvasElement>('.hud__graph')!;
  const g = canvas.getContext('2d');

  const opts: HudOptions = { graph: true, resolution: true, detail: false };
  const times = new Float32Array(SAMPLES); // ring of recent frame times (ms)
  let head = 0;
  let frames = 0;
  let acc = 0;
  let fps = 0;
  let lastMs = TARGET_MS;

  const applyOptions = (): void => {
    canvas.style.display = opts.graph ? '' : 'none';
    ftEl.style.display = opts.graph ? '' : 'none';
    resEl.style.display = opts.resolution ? '' : 'none';
    detailEl.style.display = opts.detail ? '' : 'none';
  };
  applyOptions();

  const drawGraph = (): void => {
    if (!g || !opts.graph) return;
    g.clearRect(0, 0, GRAPH_W, GRAPH_H);
    for (let i = 0; i < SAMPLES; i++) {
      const ms = times[(head + i) % SAMPLES]!;
      if (ms <= 0) continue;
      const h = Math.min(GRAPH_H, (ms / (TARGET_MS * 2)) * GRAPH_H); // full height ≈ 2× target
      const over = ms / TARGET_MS;
      g.fillStyle = over < 1.15 ? '#7CFFB0' : over < 2 ? '#ffd24a' : '#ff6a6a';
      g.fillRect(i, GRAPH_H - h, 1, h);
    }
  };

  return {
    update(frameDelta: number, info?: HudInfo): void {
      lastMs = frameDelta * 1000;
      times[head] = lastMs;
      head = (head + 1) % SAMPLES;
      frames += 1;
      acc += frameDelta;
      if (acc >= 0.5) {
        fps = Math.round(frames / acc);
        frames = 0;
        acc = 0;
        fpsEl.textContent = `${fps} fps`;
        if (opts.graph) ftEl.textContent = `${lastMs.toFixed(1)} ms`;
        if (opts.resolution && info?.resScale !== undefined) {
          resEl.textContent = `res ${Math.round(info.resScale * 100)}%`;
        }
        if (opts.detail && info) {
          const speed = info.timeScale ?? 1;
          const speedStr = speed >= 1 ? `×${Math.round(speed)}` : `×1/${Math.round(1 / speed)}`;
          detailEl.textContent = `${info.bodies ?? 0} bodies · ${speedStr} · ${info.gpu ? 'GPU' : 'CPU'}`;
        }
      }
      if (opts.graph) drawGraph();
    },
    setVisible(on: boolean): void {
      // The class fades + pops it in/out (CSS), so it's easy to spot.
      el.classList.toggle('hud--on', on);
    },
    setOptions(next: Partial<HudOptions>): void {
      Object.assign(opts, next);
      applyOptions();
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
