import { CameraRig } from './core/CameraRig';
import { Loop } from './core/Loop';
import { createRenderer } from './core/Renderer';
import { ResolutionScaler } from './core/ResolutionScaler';
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
  const loop = new Loop(renderer, uniforms);
  const physics = new PhysicsController(scene, new GPUPhysicsEngine(renderer));
  const scaler = new ResolutionScaler();
  scaler.scale = 0.85; // start a touch soft; the scaler ramps to native if there's headroom
  const hud = createHud(backend, () => scaler.scale);

  // Drawing-buffer size = CSS size × capped DPR × adaptive scale. The canvas is
  // forced to fill the viewport in CSS, so a smaller buffer simply upscales.
  const dprCap = Math.min(window.devicePixelRatio, 2);
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
  applySize();

  createControls({ blackHole, scene, physics, loop, renderer, scaler, bloom: post.bloom });

  loop.onTick = (frameDelta) => {
    if (scaler.update(frameDelta)) applySize();
    if (!loop.paused) physics.step(frameDelta);
    updateBodyUniforms(bodyUniforms, scene);
    rig.update();
    post.render();
    hud.update(frameDelta);
  };
  loop.start();

  // Expose handles for console poking during development.
  Object.assign(globalThis, {
    osp: { renderer, rig, pass, post, loop, uniforms, blackHole, scene, physics, bodyUniforms, scaler },
  });
}

main().catch((error) => {
  console.error('[One Still Point] fatal:', error);
  showFatalError(error);
});
