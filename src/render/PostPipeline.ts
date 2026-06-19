import type { Camera, Scene } from 'three';
import BloomNode, { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { pass } from 'three/tsl';
import { RenderPipeline } from 'three/webgpu';
import type { WebGPURenderer } from 'three/webgpu';

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
 */
export function createPostPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
): PostPipeline {
  const scenePass = pass(scene, camera);
  const bloomPass = bloom(scenePass, 0.6, 0.85, 0.0); // strength, radius, threshold
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = scenePass.add(bloomPass);

  return {
    render: () => pipeline.render(),
    resize: () => {
      pipeline.needsUpdate = true;
    },
    bloom: bloomPass,
  };
}
