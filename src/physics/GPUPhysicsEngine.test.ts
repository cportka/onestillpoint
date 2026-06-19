import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Body } from '../scene/Body';
import { buildInitialState } from './GPUPhysicsEngine';

function body(over: Partial<Body>): Body {
  return {
    id: 0,
    type: 'star',
    mass: 1,
    lensMass: 0,
    fixed: false,
    position: new Vector3(),
    velocity: new Vector3(),
    radius: 1,
    color: new Vector3(),
    ...over,
  };
}

describe('buildInitialState (GPU storage marshalling)', () => {
  it('packs positions/velocities as vec4 (xyz + pad) and masses/movable flags', () => {
    const bodies = [
      body({ position: new Vector3(1, 2, 3), velocity: new Vector3(4, 5, 6), mass: 10, fixed: true }),
      body({ position: new Vector3(-1, 0, 2), velocity: new Vector3(0, 1, 0), mass: 0.5, fixed: false }),
    ];
    const s = buildInitialState(bodies);

    expect(s.count).toBe(2);
    expect(s.positions.length).toBe(8); // 4 floats per body
    expect(Array.from(s.positions.slice(0, 4))).toEqual([1, 2, 3, 0]); // xyz + pad
    expect(Array.from(s.velocities.slice(4, 8))).toEqual([0, 1, 0, 0]);
    expect(Array.from(s.masses)).toEqual([10, 0.5]);
    expect(Array.from(s.movable)).toEqual([0, 1]); // fixed primary → 0, movable → 1
  });
});
