import { describe, expect, it } from 'vitest';
import { Scene } from './Scene';

describe('Scene', () => {
  it('starts with a fixed primary hole, two stars and two retrograde planets', () => {
    const scene = new Scene();
    const primary = scene.bodies[0]!;
    expect(primary.type).toBe('hole');
    expect(primary.fixed).toBe(true);

    const stars = scene.companions.filter((b) => b.type === 'star');
    const planets = scene.companions.filter((b) => b.type === 'planet');
    expect(scene.companions.length).toBe(4);
    expect(stars.length).toBe(2);
    expect(planets.length).toBe(2);

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
});
