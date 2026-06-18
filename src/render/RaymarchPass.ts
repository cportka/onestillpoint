import { DoubleSide, Mesh, OrthographicCamera, PlaneGeometry, Scene } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { WebGPURenderer } from 'three/webgpu';
import { createGradientNode } from './tsl/gradient';
import type { Uniforms } from './uniforms';

/**
 * The fullscreen TSL pass. The "scene" is a single screen-filling quad whose
 * colour is computed entirely in the fragment shader from the camera + time
 * uniforms — the orbit camera never renders this scene directly, it only feeds
 * uniforms (see CameraRig).
 *
 * We own a Scene + a fixed OrthographicCamera (rather than a bare QuadMesh) so
 * the Phase 4 post-processing pipeline is a drop-in: `pass(this.scene,
 * this.camera)` → bloom → tone-map.
 */
export class RaymarchPass {
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;
  readonly material: MeshBasicNodeMaterial;
  private readonly mesh: Mesh;

  constructor(uniforms: Uniforms) {
    // Looks down -Z at a 2×2 quad on the z=0 plane → exactly fills clip space.
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    this.material = new MeshBasicNodeMaterial();
    this.material.colorNode = createGradientNode(uniforms);
    this.material.toneMapped = false; // Phase 0: WYSIWYG test colours
    this.material.depthTest = false;
    this.material.depthWrite = false;
    this.material.side = DoubleSide;

    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  /** Swap the shader that paints the quad (Phase 1 plugs the raymarch in here). */
  setColorNode(node: MeshBasicNodeMaterial['colorNode']): void {
    this.material.colorNode = node;
    this.material.needsUpdate = true;
  }

  render(renderer: WebGPURenderer): void {
    renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
