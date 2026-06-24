/**
 * The intro timeline — one source of truth for *when* each beat happens, shared by
 * the bundle (replay path in `main.ts`) and mirrored by the inline boot script in
 * `index.html` (which can't import, so it hard-codes the same numbers — the
 * `introTimeline.test.ts` "inline sync" guard keeps the two from drifting).
 *
 * The intro is a sequence of beats, each oriented toward **the One Still Point** at
 * the centre of the screen. Every beat targets its own frame rate: the *intro story*
 * (the black hold, the test pattern, the moment of creation, the splash) is a cheap
 * CSS + canvas overlay that runs **uncapped** — we target **200 FPS** (past the
 * limit of human flicker detection, so it's as smooth as the display allows). The
 * *physics model* (the live engine + formation dolly) renders at its own rate and is
 * the one thing the optional cinematic frame-cap may throttle.
 *
 *   A · Black      0.00–0.25s   black hold              200 fps target (nothing drawn)
 *   B · Lines      ~0.25s       1-frame test pattern    200 fps target (one frame)
 *   C · Creation   ~0.28s+      the firework burst      200 fps target (CSS)
 *   D · Splash     ~0.33s+      the binary merger       200 fps target (CSS + canvas)
 *   E · Engine     ~0.6s onward the model settling in   engine/physics rate
 */

/** Frame rate we aim the *intro story* (everything but the live physics model) at —
 *  uncapped, beyond the limit of human flicker detection. Documentation/intent: the
 *  CSS + canvas overlay runs every animation frame, so it's as smooth as the display
 *  permits (a 60/120/240Hz panel simply can't show all 200). */
export const INTRO_STORY_FPS = 200;

/** The named beats and their FPS targets, in order (drives the script doc + tests). */
export const INTRO_BEATS = [
  { id: 'black', label: 'Black hold', fps: INTRO_STORY_FPS },
  { id: 'lines', label: 'Test pattern', fps: INTRO_STORY_FPS },
  { id: 'creation', label: 'Moment of creation', fps: INTRO_STORY_FPS },
  { id: 'splash', label: 'The splash', fps: INTRO_STORY_FPS },
  { id: 'engine', label: 'Engine takeover', fps: 0 /* 0 = the physics model's own rate */ },
] as const;

/**
 * The intro's timing constants (milliseconds). The inline boot script in
 * `index.html` mirrors `blackMs`, `splashPrebuildMs` and `creationHideMs` verbatim —
 * change them here *and there together* (the inline-sync test enforces it).
 */
export const INTRO_TIMING = {
  /** Beat A: how long the screen holds pure black before anything paints. */
  blackMs: 500,
  /** Beat B: the test pattern is a literal single painted frame (held one rAF). */
  flashFrames: 1,
  /** The splash is **prebuilt** this far into the black hold — on an idle thread,
   *  hidden under the opaque creation — so it can play *instantly* at the burst (no
   *  build hitch, no black gap). It then plays on the same frame as the creation burst
   *  (`--go`), crossfading straight out of it. */
  splashPrebuildMs: 300,
  /** Creation fades out this long after its burst begins, straight into the now-playing
   *  splash merger (short, because the splash is already up — no void to bridge). */
  creationHideMs: 180,
  /** Replay: the live view "melts" inward toward the One Still Point for this long
   *  before the intro replays from the black screen. */
  meltMs: 2000,
} as const;

/**
 * When (ms after the intro starts) the splash is reliably *covering* the screen with
 * its opaque backdrop — i.e. the first moment it's safe to un-melt the engine canvas
 * underneath, and to start counting down the splash's minimum on-screen time. The
 * splash plays on the burst's frame (~blackMs + a couple frames), so a generous margin
 * past the black hold covers it.
 */
export const SPLASH_COVERS_AT_MS = INTRO_TIMING.blackMs + 200;
