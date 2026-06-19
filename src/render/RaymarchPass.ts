import { DoubleSide, Mesh, OrthographicCamera, PlaneGeometry, Scene } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { WebGPURenderer } from 'three/webgpu';

/**
 * The fullscreen TSL pass: a single screen-filling quad whose colour is computed
 * entirely in the fragment shader. The orbit camera never renders this scene
 * directly — it only feeds uniforms (CameraRig) that the colour node reads.
 *
 * We own a Scene + a fixed OrthographicCamera (rather than a bare QuadMesh) so
 * the Phase 4 post-processing pipeline drops in as `pass(this.scene, this.camera)`
 * → bloom → tone-map.
 */
export class RaymarchPass {
  readonly scene = new Scene();
  readonly camera: OrthographicCamera;
  readonly material: MeshBasicNodeMaterial;
  private readonly mesh: Mesh;

  constructor(colorNode: MeshBasicNodeMaterial['colorNode']) {
    // Looks down -Z at a 2×2 quad on the z=0 plane → exactly fills clip space.
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    this.material = new MeshBasicNodeMaterial();
    this.material.colorNode = colorNode;
    this.material.toneMapped = false; // tone mapping arrives with the disk (Phase 4)
    this.material.depthTest = false;
    this.material.depthWrite = false;
    this.material.side = DoubleSide;

    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  /** Swap the shader that paints the quad (each phase plugs its node in here). */
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
