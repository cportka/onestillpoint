import { describe, expect, it } from 'vitest';
import { bodyCap, Scene } from './Scene';

describe('Scene', () => {
  it('starts with a fixed primary hole, prograde stars and retrograde planets', () => {
    const scene = new Scene();
    const primary = scene.bodies[0]!;
    expect(primary.type).toBe('hole');
    expect(primary.fixed).toBe(true);

    const stars = scene.companions.filter((b) => b.type === 'star');
    const planets = scene.companions.filter((b) => b.type === 'planet');
    expect(scene.companions.length).toBe(6);
    expect(stars.length).toBe(3);
    expect(planets.length).toBe(3);

    // Planets orbit the opposite way to the stars (the reverse-direction swoosh):
    // their vertical angular momentum L_y = (r × v)_y has the opposite sign.
    const ly = (b: { position: { x: number; z: number }; velocity: { x: number; z: number } }): number =>
      b.position.z * b.velocity.x - b.position.x * b.velocity.z;
    expect(Math.sign(ly(stars[0]!))).toBe(Math.sign(ly(stars[1]!))); // stars agree
    expect(Math.sign(ly(planets[0]!))).toBe(-Math.sign(ly(stars[0]!))); // planets opposed
  });

  it('addStar adds a companion on a (near-)circular bound orbit', () => {
    const scene = new Scene();
    const before = scene.companions.length;
    const star = scene.addStar(35);

    expect(scene.companions.length).toBe(before + 1);
    // velocity is the circular-orbit speed √(M/r) for the primary mass M = 1.
    expect(star.velocity.length()).toBeCloseTo(Math.sqrt(1 / star.position.length()), 5);
    // and perpendicular to the radius (a circular orbit).
    expect(star.position.dot(star.velocity)).toBeCloseTo(0, 5);
  });

  it('clearCompanions leaves only the hole', () => {
    const scene = new Scene();
    scene.clearCompanions();
    expect(scene.bodies.length).toBe(1);
    expect(scene.companions.length).toBe(0);
  });

  it('advancing physics moves a companion but not the fixed hole', () => {
    const scene = new Scene();
    const star = scene.companions[0]!;
    const start = star.position.clone();
    scene.physics.timeScale = 1;
    scene.step(1);
    expect(star.position.distanceTo(start)).toBeGreaterThan(0);
    expect(scene.bodies[0]!.position.length()).toBe(0);
  });

  it('removeOne takes one companion of a type (or reports none)', () => {
    const scene = new Scene();
    const stars = () => scene.companions.filter((b) => b.type === 'star').length;
    const before = stars();
    expect(scene.removeOne('star')).toBe(true);
    expect(stars()).toBe(before - 1);
    expect(scene.removeOne('hole')).toBe(false); // no orbiting holes to remove
    expect(scene.bodies[0]!.fixed).toBe(true); // the primary is untouched
  });
});

describe('bodyCap', () => {
  it('caps black holes at 4 regardless', () => {
    for (const holes of [0, 1, 2, 3, 4]) expect(bodyCap('hole', holes)).toBe(4);
  });

  it('shrinks the star/planet allowance as black holes are added', () => {
    for (const type of ['star', 'planet'] as const) {
      expect(bodyCap(type, 0)).toBe(5);
      expect(bodyCap(type, 1)).toBe(5);
      expect(bodyCap(type, 2)).toBe(4);
      expect(bodyCap(type, 3)).toBe(3);
      expect(bodyCap(type, 4)).toBe(0); // 4 holes → nothing else
    }
  });
});
