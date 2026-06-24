import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INTRO_BEATS, INTRO_STORY_FPS, INTRO_TIMING, SPLASH_COVERS_AT_MS } from './introTimeline';

describe('intro timeline', () => {
  it('orders the beats black → lines → creation → splash → engine', () => {
    expect(INTRO_BEATS.map((b) => b.id)).toEqual(['black', 'lines', 'creation', 'splash', 'engine']);
  });

  it('targets 200fps for the whole intro story, and the engine at its own rate', () => {
    const fps = Object.fromEntries(INTRO_BEATS.map((b) => [b.id, b.fps]));
    expect(INTRO_STORY_FPS).toBe(200);
    for (const id of ['black', 'lines', 'creation', 'splash']) expect(fps[id]).toBe(INTRO_STORY_FPS);
    expect(fps.engine).toBe(0); // 0 = the physics model's own (cappable) rate
  });

  it('holds black for 0.5s and the test pattern briefly over the ramping burst', () => {
    expect(INTRO_TIMING.blackMs).toBe(500);
    // Held long enough to cover the burst's fade-in, but still a quick flash.
    expect(INTRO_TIMING.patternHoldMs).toBeGreaterThan(16);
    expect(INTRO_TIMING.patternHoldMs).toBeLessThan(100);
  });

  it('prebuilds the splash during the black hold (before the burst)', () => {
    expect(INTRO_TIMING.splashPrebuildMs).toBeLessThan(INTRO_TIMING.blackMs);
  });

  it('melts inward for 2s before replaying', () => {
    expect(INTRO_TIMING.meltMs).toBe(2000);
  });

  it('only un-melts / dismisses once the splash is covering (past the black hold)', () => {
    expect(SPLASH_COVERS_AT_MS).toBeGreaterThan(INTRO_TIMING.blackMs);
  });
});

// The inline boot script in index.html paints before the bundle, so it can't import
// this module — it hard-codes the same numbers. This guard keeps the two in lockstep.
describe('inline index.html boot script stays in sync', () => {
  const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

  it('uses blackMs for the black-hold setTimeout', () => {
    expect(html).toMatch(new RegExp(`\\}, ${INTRO_TIMING.blackMs}\\);`));
  });
  it('prebuilds the splash during the black hold, then plays it at the burst', () => {
    expect(html).toMatch(new RegExp(`__ospSplash\\(true\\); \\}, ${INTRO_TIMING.splashPrebuildMs}\\)`));
    expect(html).toContain('window.__ospSplashPlay()'); // played on the creation-burst frame
  });
  it('lifts the test pattern after patternHoldMs (so the burst is lit, no black gap)', () => {
    expect(html).toMatch(new RegExp(`osp-lines--on'\\); \\}, ${INTRO_TIMING.patternHoldMs}\\)`));
  });
  it('uses creationHideMs for the creation fade-out', () => {
    expect(html).toMatch(new RegExp(`osp-creation--hide'\\); \\}, ${INTRO_TIMING.creationHideMs}\\)`));
  });
  it('resets __ospSplashStart at the start of every intro', () => {
    expect(html).toContain('window.__ospSplashStart = undefined');
  });
  // The heavy engine bundle must be *deferred* (loaded by the splash via __ospBoot),
  // not a static eager <script src> — an eager bundle parses during the prelude and
  // starves its timers / the splash's first paint, reordering the beats and opening a
  // black gap before the merger. Guard the deferral.
  it('defers the engine bundle behind window.__ospBoot (no eager <script src=main>)', () => {
    expect(html).not.toMatch(/<script[^>]*\bsrc=["'][^"']*main\.ts["']/);
    expect(html).toContain('window.__ospBoot');
    expect(html).toMatch(/__ospBoot\(\)/); // the splash actually calls it
  });
});
