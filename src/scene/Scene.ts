import { Vector3 } from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import type { Body, BodyType } from './Body';
import { createBlackHole, type BlackHole } from './BlackHole';

const PRIMARY_MASS = 1; // gravitational mass of the hole (geometric units, = M)

/**
 * How many of a body type may be added, given how many black holes already orbit.
 * Black holes are the budget (at most 4); the more there are, the fewer
 * stars/planets are allowed — and at 4 holes, nothing else can be added.
 */
export function bodyCap(type: BodyType, holeCount: number): number {
  if (type === 'hole') return 4;
  if (holeCount >= 4) return 0;
  if (holeCount === 3) return 3;
  if (holeCount === 2) return 4;
  return 5; // 0–1 holes
}

// A companion is gone once it is flung far past the scene (escaped) or has fallen
// in to the centre (merged) — at which point its memory and slot are freed.
const ESCAPE_RADIUS = 300;
const MERGE_RADIUS = 3;

/**
 * The scene graph: the primary black hole (body 0, fixed at the origin) plus any
 * orbiting companions, all driven by the N-body PhysicsEngine. Companions are
 * placed on circular orbits beyond the disk; `addStar` / `addPlanet` is the
 * single-call "add a body via the UI" the Phase 5 plan asks for.
 */
export class Scene {
  readonly blackHole: BlackHole;
  readonly physics: PhysicsEngine;
  bodies: Body[] = [];
  private nextId = 1;
  /** Fired when the body set changes during simulation (pruning), so the UI
   *  count can refresh. */
  onChange?: () => void;

  constructor() {
    this.blackHole = createBlackHole();
    this.bodies.push({
      id: 0,
      type: 'hole',
      mass: PRIMARY_MASS,
      lensMass: 0, // the primary is lensed exactly by the Schwarzschild metric, not weak-field
      fixed: true,
      position: new Vector3(0, 0, 0),
      velocity: new Vector3(),
      radius: 2,
      color: new Vector3(),
    });
    this.physics = new PhysicsEngine(this.bodies);
    this.seed(3, 3, 0);
  }

  /** Seed a fresh set of companions on well-separated orbits: outer prograde
   *  stars (the load-in swoosh) + inner retrograde planets (the reverse swoosh).
   *  Used both for the default load and by `reseed` (Replay intro).
   *  ⟳ Intro look: the counts/radii here shape the load intro — changing them
   *  substantially → refresh docs/intro-description.md (note the version). */
  private seed(stars: number, planets: number, holes: number): void {
    for (let i = 0; i < stars; i++) this.addStar(28 + i * 9);
    for (let i = 0; i < planets; i++) this.addPlanet(22 + i * 5);
    for (let i = 0; i < holes; i++) this.addBlackHole();
  }

  /** Re-seed the *current* composition on fresh orbits, so Replay intro shows
   *  the same kind of intro as a page load (identical for the default 3 + 3). */
  reseed(): void {
    const n = { star: 0, planet: 0, hole: 0 };
    for (const b of this.companions) n[b.type] += 1;
    this.clearCompanions();
    this.seed(n.star, n.planet, n.hole);
  }

  /** Everything orbiting the primary — stars, planets, and any added black hole.
   *  The primary (body 0) is the only fixed body, so movability is the divide
   *  (a secondary hole is type 'hole' too, but it orbits and must render). */
  get companions(): Body[] {
    return this.bodies.filter((b) => !b.fixed);
  }

  /** Count of orbiting (non-primary) black holes. */
  private holeCount(): number {
    return this.bodies.filter((b) => !b.fixed && b.type === 'hole').length;
  }

  addStar(orbitRadius = 26 + Math.random() * 22): Body {
    const warm = Math.random() < 0.5;
    const tint = warm ? new Vector3(1.0, 0.84, 0.62) : new Vector3(0.7, 0.82, 1.0);
    // HDR colour → blooms; test-particle mass; too light to lens (lensMass 0).
    return this.addBody('star', orbitRadius, 1.2, tint.multiplyScalar(7), 1e-3, 0);
  }

  addPlanet(orbitRadius = 24 + Math.random() * 24): Body {
    // Planets orbit retrograde — the reverse-direction swoosh vs the stars.
    return this.addBody('planet', orbitRadius, 0.6, new Vector3(0.5, 0.6, 0.8).multiplyScalar(1.2), 1e-5, 0, true);
  }

  /** A secondary black hole: massive enough to perturb orbits and to lens light
   *  (lensMass = mass), rendered as a dark core ringed by a lensed photon ring.
   *  New holes are placed on well-separated radii (34, 39, 44, 49) so up to four
   *  stay clear of each other and the centre rather than quickly merging out. */
  addBlackHole(orbitRadius = 34 + this.holeCount() * 5): Body {
    return this.addBody('hole', orbitRadius, 1.5, new Vector3(0.02, 0.01, 0.0), 0.3, 0.3);
  }

  addBody(
    type: BodyType,
    orbitRadius: number,
    radius: number,
    color: Vector3,
    mass: number,
    lensMass: number,
    retrograde = false,
  ): Body {
    const azimuth = Math.random() * Math.PI * 2;
    const inclination = (Math.random() - 0.5) * 0.6; // modest orbital tilt
    const pos = new Vector3(
      Math.cos(azimuth) * orbitRadius,
      Math.sin(inclination) * orbitRadius,
      Math.sin(azimuth) * orbitRadius,
    );
    const speed = Math.sqrt(PRIMARY_MASS / pos.length()); // circular orbit speed
    const radial = pos.clone().normalize();
    const tangent = new Vector3().crossVectors(new Vector3(0, 1, 0), radial).normalize();

    const body: Body = {
      id: this.nextId++,
      type,
      mass,
      lensMass,
      fixed: false,
      position: pos,
      velocity: tangent.multiplyScalar(retrograde ? -speed : speed),
      radius,
      color,
    };
    this.bodies.push(body);
    this.physics.bodies = this.bodies;
    this.physics.reset();
    return body;
  }

  clearCompanions(): void {
    this.bodies = this.bodies.filter((b) => b.fixed); // keep only the primary hole
    this.physics.bodies = this.bodies;
    this.physics.reset();
  }

  /** Remove the most recently added companion of a type (the − stepper button).
   *  Returns whether one was removed. */
  removeOne(type: BodyType): boolean {
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i]!;
      if (!b.fixed && b.type === type) {
        this.bodies.splice(i, 1);
        this.physics.bodies = this.bodies;
        this.physics.reset();
        return true;
      }
    }
    return false;
  }

  /** Free companions that have escaped far past the scene or fallen/merged into
   *  the centre — drop them from the body list (and so the render slots and the
   *  count). Returns whether anything was removed, so the GPU buffers can rebuild. */
  prune(): boolean {
    const gone = (b: Body): boolean => {
      if (b.fixed) return false; // never the primary
      const r = b.position.length();
      return r <= MERGE_RADIUS || r >= ESCAPE_RADIUS;
    };
    // Scan first (no allocation) — only rebuild the list when something is out.
    if (!this.bodies.some(gone)) return false;
    this.bodies = this.bodies.filter((b) => !gone(b));
    this.physics.bodies = this.bodies;
    this.physics.reset();
    this.onChange?.();
    return true;
  }

  step(frameDelta: number): void {
    this.physics.step(frameDelta);
  }
}
