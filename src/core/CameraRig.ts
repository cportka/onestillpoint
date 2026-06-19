import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Uniforms } from '../render/uniforms';

/**
 * The camera is purely an input device. OrbitControls drives a real
 * PerspectiveCamera — swipe / drag to orbit, pinch / scroll to dolly — and each
 * frame we read its world position and orthonormal basis into the uniform bus,
 * where the raymarch shader uses them to build a view ray per pixel.
 *
 * Distances are in units of M (gravitational radii); the horizon sits at 2M, so
 * minDistance keeps the camera comfortably outside it. See build plan §5 / §7.
 */
export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;

  constructor(
    private readonly uniforms: Uniforms,
    domElement: HTMLElement,
  ) {
    this.camera = new PerspectiveCamera(60, 1, 0.01, 1000);
    // Start elevated, looking down onto the disk from above the ring.
    this.camera.position.set(0, 13, 17);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;
    this.controls.minDistance = 4; // stay outside the 3M photon sphere
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);
    this.controls.update();

    this.setAspect(1);
  }

  /** Re-derive projection params after a viewport resize. */
  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.uniforms.aspect.value = aspect;
    this.uniforms.tanHalfFov.value = Math.tan((this.camera.fov * Math.PI) / 360);
  }

  /** Advance damping and publish the camera state to the uniform bus. */
  update(): void {
    this.controls.update();
    this.camera.updateMatrixWorld();

    // matrixWorld is column-major: columns 0/1/2 are the camera's right / up /
    // back axes. The camera looks down its local -Z, so forward = -column2.
    const e = this.camera.matrixWorld.elements;
    this.uniforms.camPos.value.copy(this.camera.position);
    this.uniforms.camRight.value.set(e[0]!, e[1]!, e[2]!);
    this.uniforms.camUp.value.set(e[4]!, e[5]!, e[6]!);
    this.uniforms.camForward.value.set(-e[8]!, -e[9]!, -e[10]!);
  }

  dispose(): void {
    this.controls.dispose();
  }
}
