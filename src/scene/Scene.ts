import { Vector3 } from 'three';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import type { Body, BodyType } from './Body';
import { createBlackHole, type BlackHole } from './BlackHole';

const PRIMARY_MASS = 1; // gravitational mass of the hole (geometric units, = M)

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

  constructor() {
    this.blackHole = createBlackHole();
    this.bodies.push({
      id: 0,
      type: 'hole',
      mass: PRIMARY_MASS,
      fixed: true,
      position: new Vector3(0, 0, 0),
      velocity: new Vector3(),
      radius: 2,
      color: new Vector3(),
    });
    this.physics = new PhysicsEngine(this.bodies);

    this.addStar(30);
    this.addStar(42);
  }

  get companions(): Body[] {
    return this.bodies.filter((b) => b.type !== 'hole');
  }

  addStar(orbitRadius = 26 + Math.random() * 22): Body {
    const warm = Math.random() < 0.5;
    const tint = warm ? new Vector3(1.0, 0.84, 0.62) : new Vector3(0.7, 0.82, 1.0);
    return this.addBody('star', orbitRadius, 1.2, tint.multiplyScalar(7)); // HDR → blooms
  }

  addPlanet(orbitRadius = 24 + Math.random() * 24): Body {
    return this.addBody('planet', orbitRadius, 0.6, new Vector3(0.5, 0.6, 0.8).multiplyScalar(1.2));
  }

  addBody(type: BodyType, orbitRadius: number, radius: number, color: Vector3): Body {
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
      mass: type === 'star' ? 1e-3 : 1e-5, // test particles (negligible mutual pull)
      fixed: false,
      position: pos,
      velocity: tangent.multiplyScalar(speed),
      radius,
      color,
    };
    this.bodies.push(body);
    this.physics.bodies = this.bodies;
    this.physics.reset();
    return body;
  }

  clearCompanions(): void {
    this.bodies = this.bodies.filter((b) => b.type === 'hole');
    this.physics.bodies = this.bodies;
    this.physics.reset();
  }

  step(frameDelta: number): void {
    this.physics.step(frameDelta);
  }
}
