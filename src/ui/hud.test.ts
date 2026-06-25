// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createHud } from './hud';

// createHud appends its readout to <body>; clear it between cases.
afterEach(() => document.querySelectorAll('.hud').forEach((el) => el.remove()));

describe('createHud detail line', () => {
  it('renders the S/P/B breakdown + a CPU/GPU token, not the backend name', () => {
    const hud = createHud();
    // A long frame delta flushes the 0.5s detail cadence on the first update.
    hud.update(0.6, { stars: 3, planets: 2, holes: 1, gpu: false, timeScale: 1, resScale: 1 });

    const detail = document.querySelector('.hud__detail')!;
    expect(detail.textContent).toContain('3/2/1 bodies');
    expect(detail.textContent).toContain('CPU');
    // The static backend label (WebGPU/WebGL2) is gone from the readout.
    expect(detail.textContent).not.toContain('WebGPU');
    expect(detail.textContent).not.toContain('WebGL2');
    // The compute path is the colour-coded span (CPU = the cool-slate class).
    expect(detail.querySelector('.hud__compute--cpu')?.textContent).toBe('CPU');
  });

  it('marks the GPU path with its own class for the at-a-glance colour', () => {
    const hud = createHud();
    hud.update(0.6, { stars: 0, planets: 0, holes: 0, gpu: true, timeScale: 1, resScale: 1 });

    const detail = document.querySelector('.hud__detail')!;
    expect(detail.querySelector('.hud__compute--gpu')?.textContent).toBe('GPU');
    expect(detail.querySelector('.hud__compute--cpu')).toBeNull();
    expect(detail.textContent).toContain('0/0/0 bodies');
  });
});
