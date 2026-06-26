import { CameraRig } from './core/CameraRig';
import { prefersReducedMotion } from './core/device';
import { FormationSequence } from './core/FormationSequence';
import { History } from './core/History';
import { Timeline } from './core/Timeline';
import { Loop } from './core/Loop';
import { meltInward } from './intro/melt';
import { INTRO_DIALS, MELT_MS, SPLASH_COVERS_AT_MS } from './intro/introTimeline';
import { createRenderer } from './core/Renderer';
import { detectQualityTier, introResolutionScale, QUALITY_TIERS, type QualityTier } from './core/quality';
import { ResolutionScaler } from './core/ResolutionScaler';
import { TimeController } from './core/TimeController';
import { PhysicsController } from './physics/PhysicsController';
import { createBodyUniforms, updateBodyUniforms } from './render/bodyUniforms';
import { createPostPipeline } from './render/PostPipeline';
import { RaymarchPass } from './render/RaymarchPass';
import { createBlackHoleNode } from './render/tsl/raymarch';
import { createUniforms } from './render/uniforms';
import { Scene } from './scene/Scene';
import { createHud, showFatalError } from './ui/hud';
import { createClipRecorder } from './ui/clipRecorder';
import { createHistoryBar, EventLog } from './ui/historyBar';

declare global {
  interface Window {
    /** Builds (and on later calls, rebuilds) the load splash; defined inline in
     *  index.html so it paints before this bundle loads. */
    __ospSplash?: () => void;
    /** Plays the whole intro from the top: a black hold, a single-frame test pattern,
     *  the "moment of creation" burst, then the splash overlapping. The initial-load
     *  entry point and what the melt-then-replay path re-runs. */
    __ospIntro?: () => void;
    /** Timestamp (performance.now) of the splash's first *painted* frame, set by the
     *  inline script and reset to undefined at the start of each __ospIntro. The
     *  crossfade waits MIN_SPLASH_MS past this so the merger is always seen — even
     *  when a heavy mobile load defers the first paint, or on replay. */
    __ospSplashStart?: number;
  }
}

/**
 * Bootstrap. The shape here is the spine of every phase:
 *
 *   uniforms ── written by ── CameraRig (camera) + Loop (time) + resize (size)
 *      └── read by ── RaymarchPass colour node ── drawn each frame by ── Loop
 *
 * Phase 4 adds the lil-gui panel and dynamic resolution: the drawing-buffer size
 * is driven directly each frame (ResolutionScaler) and the canvas CSS upscales,
 * so the heavy volume march stays interactive across GPUs.
 */
async function main(): Promise<void> {
  const uniforms = createUniforms();
  const scene = new Scene();
  const blackHole = scene.blackHole;
  const bodyUniforms = createBodyUniforms();

  const { renderer, backend } = await createRenderer();
  document.body.appendChild(renderer.domElement);

  const rig = new CameraRig(uniforms, renderer.domElement);
  const pass = new RaymarchPass(createBlackHoleNode(uniforms, blackHole, bodyUniforms));
  const post = createPostPipeline(renderer, pass.scene, pass.camera, uniforms.fuzz);
  const loop = new Loop(renderer);
  const time = new TimeController();
  const physics = new PhysicsController(scene, renderer);
  // The CPU/GPU integrator choice is now automatic (PhysicsController.autoSelect).
  // The CPU path is exact and trivially cheap for this app's body counts (≤14) and
  // avoids the GPU path's per-frame position+velocity read-back (a CPU↔GPU sync
  // that stalls the pipeline), so the selector stays on CPU for every count the app
  // can reach today — flipping to GPU only if a future swarm raises the cap into the
  // hundreds. Tell it whether the WebGPU compute path is even available.
  physics.gpuAvailable = backend === 'webgpu';
  const scaler = new ResolutionScaler();
  const hud = createHud();

  // The art-directed intro: dolly in from far while the disk ignites.
  const formation = new FormationSequence(rig, uniforms.formation, {
    reducedMotion: prefersReducedMotion(),
  });
  // Tap / click anywhere on the scene to skip straight to the formed view.
  renderer.domElement.addEventListener('pointerdown', () => formation.skip(), { once: true });

  // Drawing-buffer size = CSS size × capped DPR × adaptive scale. The canvas is
  // forced to fill the viewport in CSS, so a smaller buffer simply upscales. The
  // DPR cap is the biggest single lever on a high-DPR phone, so the quality tier
  // sets it (below) alongside the starting resolution and the dust step.
  let dprCap = Math.min(window.devicePixelRatio, 2);
  const applySize = (): void => {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const w = Math.max(1, Math.floor(cssW * dprCap * scaler.scale));
    const h = Math.max(1, Math.floor(cssH * dprCap * scaler.scale));
    renderer.setSize(w, h, false);
    post.resize();
    rig.setAspect(cssW / cssH);
    uniforms.resolution.value.set(w, h);
  };
  window.addEventListener('resize', applySize);

  // Auto-detect a quality tier for this device and apply it (resolution, dust
  // step, DPR cap). Re-appliable from the Quality panel (Auto / Low / Med / High).
  const autoTier = detectQualityTier();
  const applyQuality = (tier: QualityTier): void => {
    const q = QUALITY_TIERS[tier];
    scaler.scale = q.scale;
    scaler.minScale = q.minScale;
    blackHole.volumeStep.value = q.volumeStep;
    dprCap = Math.min(window.devicePixelRatio, q.dprCap);
    applySize();
  };
  applyQuality(autoTier);

  // ── Intro resolution ramp — smooth the splash→engine handoff ────────────────
  // The first ~2s the engine is on screen (the dolly + disk ignition as the splash
  // lifts) is the heaviest it ever is. Starting at the device's steady-state scale makes
  // the GPU render too-sharp frames it can't hold — the multi-hundred-ms hitch + choppy
  // 20–30 fps recovery seen in screen recordings. So we render the pre-warm, the covered
  // frames *and* the reveal at a lower scale, then let the adaptive ResolutionScaler
  // climb back to full quality as the scene calms (no permanent quality cut; the scaler
  // still drops further if a device genuinely can't keep up). Masked by the crossfade.
  const introScale = introResolutionScale(QUALITY_TIERS[autoTier]);
  const armIntroScale = (): void => {
    if (scaler.scale > introScale) {
      scaler.scale = introScale;
      scaler.resetSmoothing(); // don't let the prior full-res frame times drag it down further
      applySize();
    }
  };

  // The load splash (built by the inline window.__ospSplash in index.html). We
  // *hide* rather than remove it, so "Replay intro" can rebuild + replay it; the
  // canvas dust self-stops when the `--hide` class appears, freeing the GPU for
  // the crossfade.
  const splash = document.getElementById('osp-splash');
  const dismissSplash = (): void => {
    splash?.classList.add('osp-splash--hide');
    armIntroScale(); // the reveal + settle is the heaviest the engine gets — start cheap, then climb
    uniforms.fuzz.value = 1; // …and reveal it "warm and out of focus", easing to reality in the loop
  };
  // Crossfade out only once the merger has had its minimum time on screen,
  // measured from the splash's first *painted* frame (window.__ospSplashStart) —
  // so it always plays in full, even when a heavy mobile load defers that paint.
  // The reveal is intentionally a touch earlier than the merger's full end + a
  // longer fade (see style.css), so the live disk + background overlap the
  // expanding splash rings/dust rather than cutting to a black void.
  const MIN_SPLASH_MS = INTRO_DIALS.splashHoldMs;
  // Play the splash out once the merger has had its minimum time on screen, measured
  // from its first *painted* frame (window.__ospSplashStart). That frame is now ~0.3s
  // into the intro (after the black hold + test pattern), and __ospIntro resets the
  // marker to undefined at the start of every run — so wait for the *fresh* value
  // before counting down, else a replay would read a stale start and cut the merger
  // short. The reveal is a touch earlier than the merger's full end + a longer fade
  // (see style.css) so the live disk/background overlap the splash rather than cutting.
  const dismissAfterPlayed = (): void => {
    const started = window.__ospSplashStart;
    if (started === undefined) {
      requestAnimationFrame(dismissAfterPlayed); // splash hasn't painted yet — re-check next frame
      return;
    }
    window.setTimeout(dismissSplash, Math.max(0, started + MIN_SPLASH_MS - performance.now()));
  };
  // The history scrub bar (shown with the control panel — always on, hidden during Replay).
  // The loop records each running frame into `history` (a bounded ~2-min ring → "old is lost");
  // `events` logs the colour-coded transient moments (adds / absorptions / escapes), each
  // tagged with the frame counter so it holds its position as the window scrolls.
  const history = new History();
  const events = new EventLog();
  // The timeline playhead over the recorded history — a DVR position decoupled from Pause. Scrub /
  // step / replay move it (clamped to the rewind limit); live physics runs only at the live edge.
  // A body added/removed makes the recorded "future" a different layout, so any transient event
  // snaps it back to live.
  const timeline = new Timeline(history, () => scene.bodies);
  scene.onEvent = (type) => {
    events.add(type, history.recorded);
    timeline.reset();
  };
  // While the user drags the bar we freeze the sim (no stepping / recording / replay-advance, in
  // the loop) so the physics doesn't walk the bodies off the restored frame mid-scrub. A transient
  // freeze for the grab only — it never touches `time.paused` (scrubbing must not change Pause).
  let scrubbing = false;
  const historyBar = createHistoryBar({
    history,
    events,
    scrubTo: (pos01) => timeline.scrubTo(pos01),
    currentPos: () => timeline.currentPos,
    startPos: () => timeline.startPos,
    onScrub: (active) => {
      scrubbing = active;
    },
  });

  // "Replay intro": melt the live view inward toward the One Still Point (~2s), then
  // replay the whole intro from the black screen. onReplay (re-seed + restart the
  // formation) runs *after* the melt, hidden under the black/splash; the canvas is
  // un-melted once the splash covers it, just before the crossfade plays it out.
  const replaySplash = (onReplay?: () => void): void => {
    const canvas = renderer.domElement;
    const melt = meltInward(
      canvas,
      () => {
        history.clear(); // a replayed run starts with a fresh, empty timeline
        events.clear();
        onReplay?.();
        armIntroScale(); // render the replayed reveal + settle cheap too, then climb back
        window.__ospIntro?.(); // black hold → test pattern → creation → splash
        window.setTimeout(() => {
          melt.restore(); // un-melt under the now-covering splash (the snap-back is invisible)
          dismissAfterPlayed(); // the fresh splash start is set by now; play it out
        }, SPLASH_COVERS_AT_MS);
      },
      { durationMs: MELT_MS },
    );
  };

  // The Share button shares the **previous ~5 seconds** as a short, square, looping clip.
  // A rolling recorder continuously buffers the live view (started after the intro, below;
  // fed once per frame in the loop) so "the last few seconds" is always ready. It returns
  // null where the platform can't record canvas video — then we fall back to a still PNG.
  const clip = createClipRecorder(renderer.domElement);
  const captureFrame = async (): Promise<Blob | null> => {
    post.render(); // a fresh frame, presented, then read back
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const canvas = renderer.domElement as HTMLCanvasElement;
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
  };
  const captureShare = async (): Promise<File | null> => {
    if (clip?.ready) {
      const file = await clip.takeClip();
      if (file) return file; // the rolling mp4 clip
      console.warn('[onestillpoint] Share: clip was ready but takeClip() produced no mp4 — sending a still.', clip.status);
    } else if (clip) {
      // The desktop "still a PNG" case: say *why* (no encoder / not buffered yet / no avcC) so
      // it's diagnosable from the console instead of a silent fallback.
      console.warn('[onestillpoint] Share: no mp4 clip available yet — sending a still.', clip.status);
    }
    const blob = await captureFrame(); // fallback: a still PNG of the current frame
    return blob ? new File([blob], 'onestillpoint.png', { type: 'image/png' }) : null;
  };

  // Build the control panel *lazily, off the critical path*. lil-gui + the panel
  // are a heavy, synchronous DOM build that isn't needed during the intro — doing
  // it under the splash was janking the fresh-load animation. Code-split it (a
  // dynamic import → its own chunk, out of the initial bundle) and mount it when
  // the main thread is next idle, after the merger has played.
  const mountControls = async (): Promise<void> => {
    clip?.start(); // begin buffering now (post-intro) — clear of the heavy reveal frames
    const { createControls } = await import('./ui/Controls');
    createControls({
      blackHole, scene, physics, time, formation, renderer, scaler,
      bloom: post.bloom, hud, autoTier, applyQuality, background: uniforms.background,
      bgLook: { brightness: uniforms.bgBrightness, saturation: uniforms.bgSaturation, tint: uniforms.bgTint },
      replaySplash, captureShare, historyBar,
      setMaxFps: (fps: number) => {
        loop.maxFps = fps;
      },
    });
  };
  const scheduleControls = (): void => {
    if (window.requestIdleCallback) window.requestIdleCallback(() => void mountControls(), { timeout: 2500 });
    else window.setTimeout(() => void mountControls(), 400);
  };

  // (`history` + the scrub bar are set up above, before replaySplash; the loop records
  // each running frame into `history` — cheap, zero-allocation, exactly replayable.)

  // Hold the splash until a few frames have rendered — the WebGPU pipeline
  // finishes compiling over the first frames, which is the fresh-load hitch, so
  // we let it happen *under* the splash — and until the merger has played
  // (dismissAfterPlayed). Into the formation playing underneath.
  let warmFrames = 0;
  const WARM_FRAMES = 5;
  // How long the warm-fuzzy reveal veil takes to ease from full (at the reveal) to
  // nothing — roughly the window the ResolutionScaler needs to climb back from the
  // low intro scale to steady-state, so the warmth fades as the image sharpens.
  const FUZZ_FADE_S = 2.0;

  loop.onTick = (frameDelta) => {
    if (scaler.update(frameDelta)) applySize();
    // Ease the warm-fuzzy reveal veil out as the scene settles into focus (PostPipeline).
    if (uniforms.fuzz.value > 0) {
      uniforms.fuzz.value = Math.max(0, uniforms.fuzz.value - frameDelta / FUZZ_FADE_S);
    }

    const t = time.tick(frameDelta);
    uniforms.time.value += t.animDelta; // bounded dust clock
    uniforms.timeBlur.value = t.timeBlur;
    physics.timeScale = t.orbitMul;
    // Drive the DVR timeline over the recorded history. A drag freezes everything; otherwise a ←/→
    // step walks the recorded tape (extending it live past the edge), and continuous play either
    // replays recorded frames (when scrubbed back, the current marker walking toward "now") or runs
    // live physics + records (at the live edge). None of this reads `time.paused` for the body
    // position — Pause just gates whether the timeline advances.
    if (!scrubbing) {
      if (t.step < 0) {
        timeline.stepBack(-t.step); // clamped at the rewind limit (the start marker)
      } else if (t.step > 0) {
        const overflow = timeline.stepForward(t.step); // toward "now"; overflow past the edge…
        if (overflow > 0) {
          physics.step(overflow / 60); // …extends the recording live (~1 frame = 1/60 s)
          history.record(scene.bodies);
        }
      } else if (!time.paused) {
        if (timeline.live) {
          if (t.fd > 0) {
            physics.step(t.fd);
            history.record(scene.bodies); // build the timeline on forward progress
          }
        } else {
          timeline.advance(); // replay one recorded frame toward the live edge
        }
      }
    }

    updateBodyUniforms(bodyUniforms, scene, formation.progress);
    // The intro drives the camera (controls disabled) until it settles home.
    if (formation.done) rig.update();
    else formation.update(frameDelta);
    post.render();
    clip?.update(); // blit this frame into the rolling share buffer (cheap; throttled internally)
    // Companion breakdown for the HUD's S/P/B readout — one pass, no allocation
    // (skips the always-present central primary, mirroring the Bodies panel).
    let stars = 0;
    let planets = 0;
    let holes = 0;
    for (const b of scene.bodies) {
      if (b.fixed) continue;
      if (b.type === 'star') stars += 1;
      else if (b.type === 'planet') planets += 1;
      else holes += 1;
    }
    hud.update(frameDelta, {
      resScale: scaler.scale,
      stars,
      planets,
      holes,
      timeScale: time.timeScale,
      gpu: physics.useGPU,
    });
    historyBar.tick(); // keep the bottom scrub bar live (events scroll, playhead rides "now")

    if (warmFrames < WARM_FRAMES) {
      warmFrames += 1;
      // Once the pipeline is warm, schedule the crossfade for when the merger
      // has finished playing (from its first painted frame).
      if (warmFrames === WARM_FRAMES) dismissAfterPlayed();
    }
  };

  // Pre-warm the render pipeline while the splash still covers the screen, so the
  // fresh-load compile hitch is paid here, not on the first live frame (the intro
  // "choppiness"):
  //   1. compileAsync builds the heavy raymarch WGSL up front (awaited → ready);
  //   2. a couple of post renders (a frame apart) compile + prime the bloom chain
  //      and warm the GPU caches, so the disk is already lit under the splash.
  armIntroScale(); // render the pre-warm + covered frames + reveal cheap (climbs back after)
  await renderer.compileAsync(pass.scene, pass.camera);
  post.render();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  post.render();
  loop.start();
  scheduleControls(); // mount the panel once the main thread is idle (after the splash)

  // Expose handles for console poking during development.
  Object.assign(globalThis, {
    osp: { renderer, rig, pass, post, loop, time, formation, uniforms, blackHole, scene, physics, bodyUniforms, scaler, history, timeline },
  });
}

main().catch((error) => {
  console.error('[One Still Point] fatal:', error);
  document.getElementById('osp-splash')?.remove(); // don't hide the error behind the splash
  showFatalError(error);
});
