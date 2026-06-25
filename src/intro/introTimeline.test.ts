import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INTRO_BEATS, INTRO_DIALS, INTRO_STORY_FPS, MELT_MS, SPLASH_COVERS_AT_MS } from './introTimeline';

describe('intro dials', () => {
  it('orders the beats black → lines → creation → splash → engine', () => {
    expect(INTRO_BEATS.map((b) => b.id)).toEqual(['black', 'lines', 'creation', 'splash', 'engine']);
  });

  it('targets 200fps for the whole intro story, and the engine at its own rate', () => {
    const fps = Object.fromEntries(INTRO_BEATS.map((b) => [b.id, b.fps]));
    expect(INTRO_STORY_FPS).toBe(200);
    for (const id of ['black', 'lines', 'creation', 'splash']) expect(fps[id]).toBe(INTRO_STORY_FPS);
    expect(fps.engine).toBe(0); // 0 = the physics model's own (cappable) rate
  });

  it('holds black for 0.5s, then a split-second of black before the burst', () => {
    expect(INTRO_DIALS.initialBlackMs).toBe(500);
    expect(INTRO_DIALS.splitBlackMs).toBeGreaterThan(16);
    expect(INTRO_DIALS.splitBlackMs).toBeLessThan(160);
  });

  it('plays the creation as its own beat, then overlaps the splash (no black gap)', () => {
    expect(INTRO_DIALS.creationBeatMs).toBeGreaterThan(200); // a real beat-length
    expect(INTRO_DIALS.creationToSplashMs).toBeLessThan(0); // negative = overlap, default −80
  });

  it('keeps creation/splash speeds as positive multipliers (1 = as authored)', () => {
    expect(INTRO_DIALS.creationSpeed).toBeGreaterThan(0);
    expect(INTRO_DIALS.splashSpeed).toBeGreaterThan(0);
  });

  it('melts inward for 2s before replaying', () => {
    expect(MELT_MS).toBe(2000);
  });

  it('only un-melts / dismisses once the screen is covered (past the prelude)', () => {
    expect(SPLASH_COVERS_AT_MS).toBeGreaterThan(INTRO_DIALS.initialBlackMs);
  });
});

// The inline boot script paints before the bundle, so it can't import this module — it
// hard-codes the same dials on window.__ospDials. The overlay now lives in one place
// (src/intro/overlay.html), inlined into index.html + intro-lab.html by the introOverlay()
// plugin in vite.config.ts. These guards keep the mirror in lockstep and the wiring intact.
describe('inline window.__ospDials mirrors INTRO_DIALS', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  const overlay = read('./overlay.html');
  const index = read('../../index.html');
  const lab = read('../../intro-lab.html');

  it('defines window.__ospDials', () => {
    expect(overlay).toContain('window.__ospDials = {');
  });

  for (const [key, value] of Object.entries(INTRO_DIALS)) {
    it(`mirrors ${key} = ${value}`, () => {
      expect(overlay).toMatch(new RegExp(`${key}:\\s*${value}(?![0-9])`));
    });
  }

  it('drives the timing from the dials (not magic numbers)', () => {
    expect(overlay).toContain('var D = window.__ospDials');
    expect(overlay).toMatch(/__ospSplash\(true\)/); // prebuild
    expect(overlay).toContain('window.__ospSplashPlay');
    expect(overlay).toMatch(/D\.creationBeatMs \+ D\.creationToSplashMs/); // the overlap maths
  });

  it('resets __ospSplashStart at the start of every intro', () => {
    expect(overlay).toContain('window.__ospSplashStart = undefined');
  });

  // The overlay is the single source: index.html (shipped) and intro-lab.html (the dev
  // tuning page) both inline it via the marker the vite plugin replaces — so the lab can
  // never drift from the real intro.
  it('inlines the one overlay into index.html and intro-lab.html via the build-time marker', () => {
    expect(index).toContain('<!-- @osp-intro-overlay -->');
    expect(lab).toContain('<!-- @osp-intro-overlay -->');
  });

  // The heavy engine bundle must be deferred behind window.__ospBoot (no eager <script src>),
  // defined in index.html and called from the overlay so its parse runs under the black hold.
  it('defers the engine bundle behind window.__ospBoot (no eager <script src=main>)', () => {
    expect(index).not.toMatch(/<script[^>]*\bsrc=["'][^"']*main\.ts["']/);
    expect(index).toContain('window.__ospBoot');
    expect(overlay).toMatch(/__ospBoot\(\)/);
  });
});
