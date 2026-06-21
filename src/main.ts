import { CameraRig } from './core/CameraRig';
import { prefersReducedMotion } from './core/device';
import { FormationSequence } from './core/FormationSequence';
import { Loop } from './core/Loop';
import { createRenderer } from './core/Renderer';
import { detectQualityTier, QUALITY_TIERS, type QualityTier } from './core/quality';
import { ResolutionScaler } from './core/ResolutionScaler';
import { TimeController } from './core/TimeController';
import { GPUPhysicsEngine } from './physics/GPUPhysicsEngine';
import { PhysicsController } from './physics/PhysicsController';
import { createBodyUniforms, updateBodyUniforms } from './render/bodyUniforms';
import { createPostPipeline } from './render/PostPipeline';
import { RaymarchPass } from './render/RaymarchPass';
import { createBlackHoleNode } from './render/tsl/raymarch';
import { createUniforms } from './render/uniforms';
import { Scene } from './scene/Scene';
import { createControls } from './ui/Controls';
import { createHud, showFatalError } from './ui/hud';

declare global {
  interface Window {
    /** Builds (and on later calls, rebuilds) the load splash; defined inline in
     *  index.html so it paints before this bundle loads. */
    __ospSplash?: () => void;
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
  const post = createPostPipeline(renderer, pass.scene, pass.camera);
  const loop = new Loop(renderer);
  const time = new TimeController();
  const physics = new PhysicsController(scene, new GPUPhysicsEngine(renderer));
  // Default to the CPU integrator. It is exact and trivially cheap for this app's
  // body counts (≤14), and — crucially — it avoids the GPU path's per-frame
  // position+velocity read-back, which forces a CPU↔GPU sync every frame and
  // stalls the pipeline. The GPU compute kernel stays an opt-in (Advanced → GPU
  // physics): a scaling foundation for many bodies, not a win for a handful.
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

  // The load splash (built by the inline window.__ospSplash in index.html). We
  // *hide* rather than remove it, so "Replay intro" can rebuild + replay it; the
  // canvas dust self-stops when the `--hide` class appears, freeing the GPU for
  // the crossfade.
  const splash = document.getElementById('osp-splash');
  const dismissSplash = (): void => splash?.classList.add('osp-splash--hide');
  const replaySplash = (): void => {
    window.__ospSplash?.(); // rebuild + restart; the renderer is already warm
    window.setTimeout(dismissSplash, 1350); // let the merger play, then crossfade
  };

  createControls({
    blackHole, scene, physics, time, formation, backend, renderer, scaler,
    bloom: post.bloom, hud, autoTier, applyQuality, background: uniforms.background,
    bgLook: { brightness: uniforms.bgBrightness, saturation: uniforms.bgSaturation, tint: uniforms.bgTint },
    replaySplash,
  });

  // Crossfade the load splash out once the first real frame is on screen (the
  // heavy shader has compiled), into the formation playing underneath. Keep it up
  // for a short minimum so its merge animation reads on a fast load.
  let firstFrame = true;

  loop.onTick = (frameDelta) => {
    if (scaler.update(frameDelta)) applySize();

    const t = time.tick(frameDelta);
    uniforms.time.value += t.animDelta; // bounded dust clock
    uniforms.timeBlur.value = t.timeBlur;
    physics.timeScale = t.orbitMul;
    if (t.fd > 0) physics.step(t.fd);

    updateBodyUniforms(bodyUniforms, scene, formation.progress);
    // The intro drives the camera (controls disabled) until it settles home.
    if (formation.done) rig.update();
    else formation.update(frameDelta);
    post.render();
    hud.update(frameDelta);

    if (firstFrame) {
      firstFrame = false;
      // performance.now() ≈ ms since page load, so this also enforces a minimum
      // on-screen time so the splash's binary-merger animation (~0.85s) reads even
      // on a very fast load.
      window.setTimeout(dismissSplash, Math.max(0, 820 - performance.now()));
    }
  };

  // Pre-warm the render pipeline (compile the heavy WGSL, prime the GPU) while the
  // splash still covers the screen, so the live scene doesn't hitch the moment it
  // is revealed — the "choppiness before the physics kicks in".
  post.render();
  loop.start();

  // Expose handles for console poking during development.
  Object.assign(globalThis, {
    osp: { renderer, rig, pass, post, loop, time, formation, uniforms, blackHole, scene, physics, bodyUniforms, scaler },
  });
}

main().catch((error) => {
  console.error('[One Still Point] fatal:', error);
  document.getElementById('osp-splash')?.remove(); // don't hide the error behind the splash
  showFatalError(error);
});
