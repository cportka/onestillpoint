import { CameraRig } from './core/CameraRig';
import { Loop } from './core/Loop';
import { createRenderer } from './core/Renderer';
import { RaymarchPass } from './render/RaymarchPass';
import { createUniforms } from './render/uniforms';
import { createHud, showFatalError } from './ui/hud';

/**
 * Bootstrap. The shape here is the spine of every later phase:
 *
 *   uniforms ── written by ── CameraRig (camera) + Loop (time) + resize (size)
 *      └── read by ── RaymarchPass shader ── drawn each frame by ── Loop
 *
 * Phase 0 paints a procedural test grid; Phases 1+ replace only the shader.
 */
async function main(): Promise<void> {
  const uniforms = createUniforms();

  const { renderer, backend } = await createRenderer();
  document.body.appendChild(renderer.domElement);

  const rig = new CameraRig(uniforms, renderer.domElement);
  const pass = new RaymarchPass(uniforms);
  const loop = new Loop(renderer, uniforms);
  const hud = createHud(backend);

  const resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    rig.setAspect(w / h);
    const pr = renderer.getPixelRatio();
    uniforms.resolution.value.set(Math.floor(w * pr), Math.floor(h * pr));
  };
  window.addEventListener('resize', resize);
  resize();

  loop.onTick = (frameDelta) => {
    rig.update();
    pass.render(renderer);
    hud.update(frameDelta);
  };
  loop.start();

  // Expose handles for console poking during development.
  Object.assign(globalThis, { osp: { renderer, rig, pass, loop, uniforms } });
}

main().catch((error) => {
  console.error('[One Still Point] fatal:', error);
  showFatalError(error);
});
