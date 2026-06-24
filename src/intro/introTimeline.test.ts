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

  it('holds black for 0.25s and flashes the test pattern for a single frame', () => {
    expect(INTRO_TIMING.blackMs).toBe(250);
    expect(INTRO_TIMING.flashFrames).toBe(1);
  });

  it('melts inward for 2s before replaying', () => {
    expect(INTRO_TIMING.meltMs).toBe(2000);
  });

  it('only un-melts / dismisses once the splash is covering (past the black hold + offset)', () => {
    expect(SPLASH_COVERS_AT_MS).toBeGreaterThan(INTRO_TIMING.blackMs + INTRO_TIMING.splashOffsetMs);
  });
});

// The inline boot script in index.html paints before the bundle, so it can't import
// this module — it hard-codes the same numbers. This guard keeps the two in lockstep.
describe('inline index.html boot script stays in sync', () => {
  const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

  it('uses blackMs for the black-hold setTimeout', () => {
    expect(html).toMatch(new RegExp(`\\}, ${INTRO_TIMING.blackMs}\\);`));
  });
  it('uses splashOffsetMs for the splash overlap', () => {
    expect(html).toMatch(new RegExp(`__ospSplash\\(\\); \\}, ${INTRO_TIMING.splashOffsetMs}\\)`));
  });
  it('uses creationHideMs for the creation fade-out', () => {
    expect(html).toMatch(new RegExp(`osp-creation--hide'\\); \\}, ${INTRO_TIMING.creationHideMs}\\)`));
  });
  it('resets __ospSplashStart at the start of every intro', () => {
    expect(html).toContain('window.__ospSplashStart = undefined');
  });
});
