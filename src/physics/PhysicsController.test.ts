import { describe, expect, it, vi } from 'vitest';
import type { WebGPURenderer } from 'three/webgpu';
import { Scene } from '../scene/Scene';
import { PhysicsController } from './PhysicsController';

// autoSelect's CPU branch never touches the renderer (setGPU(false) returns before
// any GPU work), so a bare stub stands in for the WebGPU renderer in these unit tests.
const fakeRenderer = {} as unknown as WebGPURenderer;

describe('PhysicsController.autoSelect', () => {
  it('stays on the CPU for the body counts the app can currently reach', () => {
    const scene = new Scene(); // default seed: primary + 3 stars + 3 planets
    const pc = new PhysicsController(scene, fakeRenderer);
    pc.gpuAvailable = true; // even with WebGPU present…
    pc.autoSelect();
    expect(pc.useGPU).toBe(false); // …a handful of bodies is far below the GPU threshold
  });

  it('never selects the GPU when WebGPU is unavailable, even for a large swarm', () => {
    const scene = new Scene();
    for (let i = 0; i < 400; i++) scene.addStar(50); // a swarm well past the threshold
    const pc = new PhysicsController(scene, fakeRenderer);
    pc.gpuAvailable = false; // WebGL2 fallback — CPU is the only path
    pc.autoSelect();
    expect(pc.useGPU).toBe(false);
  });

  it('wants the GPU once a large swarm crosses the threshold (WebGPU present)', () => {
    const scene = new Scene();
    for (let i = 0; i < 400; i++) scene.addStar(50);
    const pc = new PhysicsController(scene, fakeRenderer);
    pc.gpuAvailable = true;
    // Stub the (heavy, WebGPU-only) engine load — we're asserting the *decision*, not the switch.
    const setGPU = vi.spyOn(pc, 'setGPU').mockResolvedValue(undefined);
    pc.autoSelect();
    expect(setGPU).toHaveBeenCalledWith(true);
  });
});
