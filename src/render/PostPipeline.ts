import type { Camera, Scene } from 'three';
import BloomNode, { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { mix, pass, vec3 } from 'three/tsl';
import { RenderPipeline } from 'three/webgpu';
import type { WebGPURenderer } from 'three/webgpu';
import type { Uniforms } from './uniforms';

export interface PostPipeline {
  /** Render the scene through the post chain to the screen. */
  render(): void;
  /** Call after the renderer's drawing-buffer size changes (dynamic resolution). */
  resize(): void;
  /** The bloom node, exposed so the GUI can drive strength/radius/threshold. */
  bloom: BloomNode;
}

/**
 * HDR bloom via the WebGPU node pipeline (the legacy EffectComposer is WebGL
 * only). The raymarch pass outputs linear HDR (material.toneMapped = false);
 * bloom blooms that HDR, then `outputColorTransform` (on by default) applies the
 * renderer's ACES tone mapping + sRGB at the very end — so the bright inner disk
 * and photon ring bleed glow before being compressed to display range.
 *
 * On top of bloom sits the **warm-fuzzy reveal veil**, weighted by `fuzz` (0..1):
 * the intro reveals at a deliberately low resolution (see `introResolutionScale`),
 * and this veil turns that softness into an intentional *warm, out-of-focus* look —
 * a warm tint plus extra bloom glow — that fades to nothing as `fuzz` eases to 0 and
 * the scene sharpens into reality. At `fuzz = 0` (steady state) it's a passthrough.
 */
export function createPostPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  fuzz: Uniforms['fuzz'],
): PostPipeline {
  const scenePass = pass(scene, camera);
  const bloomPass = bloom(scenePass, 0.6, 0.85, 0.0); // strength, radius, threshold
  const base = scenePass.add(bloomPass); // the normal HDR output

  // The warm, dreamy veil: a warm grade (more red, less blue) plus extra soft glow
  // reused from the bloom (so there's no second blur pass to pay for). The low-res
  // buffer supplies the actual fuzz; this makes it read as warm and out-of-focus.
  const warm = base.mul(vec3(1.12, 1.0, 0.85));
  const dreamy = warm.add(bloomPass.mul(0.7));
  // mix(base, dreamy, fuzz): fuzz=1 → full warm veil at the reveal; fuzz=0 → base.
  const outputNode = mix(base, dreamy, fuzz);

  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = outputNode;

  return {
    render: () => pipeline.render(),
    resize: () => {
      pipeline.needsUpdate = true;
    },
    bloom: bloomPass,
  };
}
