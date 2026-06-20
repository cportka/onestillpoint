import { Vector3 } from 'three';
import {
  dot,
  float,
  Fn,
  If,
  instancedArray,
  instanceIndex,
  Loop,
  pow,
  uniform,
  vec3,
  vec4,
} from 'three/tsl';
import type { Node, WebGPURenderer } from 'three/webgpu';
import type { Body } from '../scene/Body';

const G = 1;
const SOFTENING2 = 0.25; // matches the CPU integrator

export interface InitialState {
  count: number;
  positions: Float32Array; // 4 floats per body (xyz + pad), for clean vec4 readback
  velocities: Float32Array; // 4 floats per body
  masses: Float32Array; // 1 per body
  movable: Float32Array; // 1 per body: 0 = fixed (primary), 1 = movable
}

/** Pack the body list into the flat typed arrays the storage buffers want.
 *  Pure and deterministic — this is the unit-tested part of the GPU path. */
export function buildInitialState(bodies: Body[]): InitialState {
  const count = bodies.length;
  const positions = new Float32Array(count * 4);
  const velocities = new Float32Array(count * 4);
  const masses = new Float32Array(count);
  const movable = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const b = bodies[i]!;
    positions[i * 4] = b.position.x;
    positions[i * 4 + 1] = b.position.y;
    positions[i * 4 + 2] = b.position.z;
    velocities[i * 4] = b.velocity.x;
    velocities[i * 4 + 1] = b.velocity.y;
    velocities[i * 4 + 2] = b.velocity.z;
    masses[i] = b.mass;
    movable[i] = b.fixed ? 0 : 1;
  }
  return { count, positions, velocities, masses, movable };
}

/**
 * Builds the storage buffers and the velocity-Verlet compute kernels for a body
 * set. Two kernels per substep give a clean barrier: the drift kernel only
 * touches each body's own data, then the kick kernel reads everyone's new
 * positions (O(N²) all-pairs) to recompute acceleration — the part that scales
 * on the GPU. Returns closures so the node types stay inferred.
 */
function createGPUKernels(renderer: WebGPURenderer, init: InitialState) {
  const { count } = init;
  const pos = instancedArray(init.positions, 'vec4');
  const vel = instancedArray(init.velocities, 'vec4');
  const acc = instancedArray(count, 'vec4');
  const mass = instancedArray(init.masses, 'float');
  const movable = instancedArray(init.movable, 'float');

  const dt = uniform(0);
  const dtHalf = uniform(0);

  // Newtonian acceleration on the body at xi from all bodies (self contributes 0).
  const accelAt = (xi: Node<'vec3'>) => {
    const a = vec3(0).toVar();
    Loop(count, ({ i }) => {
      const d = pos.element(i).xyz.sub(xi);
      const invR3 = pow(dot(d, d).add(SOFTENING2), float(-1.5));
      a.addAssign(d.mul(mass.element(i).mul(G).mul(invR3)));
    });
    return a;
  };

  const initAccel = Fn(() => {
    acc.element(instanceIndex).assign(vec4(accelAt(pos.element(instanceIndex).xyz), 0));
  })().compute(count);

  const drift = Fn(() => {
    If(movable.element(instanceIndex).greaterThan(0.5), () => {
      vel.element(instanceIndex).addAssign(acc.element(instanceIndex).mul(dtHalf));
      pos.element(instanceIndex).addAssign(vel.element(instanceIndex).mul(dt));
    });
  })().compute(count);

  const kick = Fn(() => {
    If(movable.element(instanceIndex).greaterThan(0.5), () => {
      const a = vec4(accelAt(pos.element(instanceIndex).xyz), 0);
      acc.element(instanceIndex).assign(a);
      vel.element(instanceIndex).addAssign(a.mul(dtHalf));
    });
  })().compute(count);

  // Prime the stored acceleration for the first step's half-kick.
  void renderer.computeAsync(initAccel);

  return {
    count,
    substep(h: number): void {
      dt.value = h;
      dtHalf.value = h * 0.5;
      void renderer.computeAsync(drift);
      void renderer.computeAsync(kick);
    },
    async readPositions(): Promise<Float32Array> {
      const buffer = await renderer.getArrayBufferAsync(pos.value);
      return new Float32Array(buffer);
    },
    /** Free this set's GPU storage buffers (called before a rebuild so adding /
     *  removing bodies doesn't leak a buffer set each time). */
    dispose(): void {
      for (const buf of [pos, vel, acc, mass, movable]) {
        (buf.value as { dispose?: () => void }).dispose?.();
      }
    },
  };
}

/**
 * GPU N-body integrator — same `step(dt)` shape as the CPU PhysicsEngine, so it
 * is a drop-in (opt-in) alternative. It is built for *scaling* (the all-pairs
 * force runs on the GPU); for a handful of bodies the CPU engine is exact and
 * has no dispatch/readback overhead, so the CPU one stays the default. Positions
 * are read back asynchronously into the bodies so the existing renderer is
 * unchanged.
 */
export class GPUPhysicsEngine {
  timeScale = 80;
  substeps = 2;

  private kernels: ReturnType<typeof createGPUKernels> | null = null;
  private bodies: Body[] = [];
  private reading = false;

  constructor(private readonly renderer: WebGPURenderer) {}

  setBodies(bodies: Body[]): void {
    this.kernels?.dispose(); // free the previous run's GPU buffers before rebuilding
    this.bodies = bodies;
    this.kernels = createGPUKernels(this.renderer, buildInitialState(bodies));
  }

  step(frameDelta: number): void {
    if (!this.kernels) return;
    const h = (frameDelta * this.timeScale) / this.substeps;
    for (let s = 0; s < this.substeps; s++) this.kernels.substep(h);
    void this.applyReadback();
  }

  /** Pull the latest positions back to the CPU bodies (one read in flight). */
  private async applyReadback(): Promise<void> {
    if (this.reading || !this.kernels) return;
    this.reading = true;
    try {
      const data = await this.kernels.readPositions();
      const tmp = new Vector3();
      for (let i = 0; i < this.bodies.length && i < this.kernels.count; i++) {
        this.bodies[i]!.position.copy(tmp.set(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!));
      }
    } finally {
      this.reading = false;
    }
  }
}
