import { describe, expect, it } from 'vitest';
import { SOFTENING2 } from '../physics/integrators';
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

  it('addStar adds a companion on a circular bound orbit at the requested radius', () => {
    const scene = new Scene();
    const before = scene.companions.length;
    const star = scene.addStar(35);

    expect(scene.companions.length).toBe(before + 1);
    // Placed exactly on the requested orbit radius — the inclination no longer
    // inflates it, so added bodies keep their intended separations.
    expect(star.position.length()).toBeCloseTo(35, 5);
    // Velocity is the circular-orbit speed in the *softened* central field,
    // v = √(M·r² / (r² + ε²)^{3/2}) with M = 1 — a closed circle, not a drifting
    // ellipse.
    const r = star.position.length();
    const v = Math.sqrt((r * r) / Math.pow(r * r + SOFTENING2, 1.5));
    expect(star.velocity.length()).toBeCloseTo(v, 6);
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

  it('frees escaped companions at once but absorbs merged ones over a brief window', () => {
    const scene = new Scene();
    const before = scene.companions.length;
    const escaped = scene.companions[0]!;
    const merging = scene.companions[1]!;
    escaped.position.set(0, 9999, 0); // flung away → freed immediately
    merging.position.set(0.5, 0, 0); // fallen to the centre → absorbed, not instant
    let changed = 0;
    scene.onChange = () => {
      changed += 1;
    };

    // First pass frees the escaped body and *starts* absorbing the merged one.
    expect(scene.prune(0)).toBe(true);
    expect(scene.companions.length).toBe(before - 1);
    expect(changed).toBe(1);
    expect(merging.absorbing).toBe(0);
    expect(scene.companions).toContain(merging); // still present, fading out

    // Advancing past the absorption window frees it (held at its anchor meanwhile).
    expect(scene.prune(10)).toBe(true);
    expect(scene.companions.length).toBe(before - 2);
    expect(changed).toBe(2);
    expect(scene.bodies[0]!.fixed).toBe(true); // the primary is kept
    expect(scene.prune(1)).toBe(false); // nothing left to prune
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
  it('allows a 4th black hole only when no stars or planets are present', () => {
    for (const holes of [0, 1, 2, 3, 4]) expect(bodyCap('hole', holes, 0)).toBe(4); // nothing else orbits
    for (const holes of [0, 1, 2, 3]) expect(bodyCap('hole', holes, 1)).toBe(3); // a star/planet present → 3
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
