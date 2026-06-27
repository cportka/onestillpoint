import { Vector3 } from 'three';
import { SOFTENING2 } from '../physics/integrators';
import { PhysicsEngine } from '../physics/PhysicsEngine';
import type { Body, BodyType } from './Body';
import { createBlackHole, type BlackHole } from './BlackHole';

const PRIMARY_MASS = 1; // gravitational mass of the hole (geometric units, = M)

/**
 * How many of a body type may be added, given how many black holes already orbit
 * (and, for holes, how many stars/planets are present). Black holes are the
 * budget — at most 4, but the fourth only when nothing else orbits (no stars or
 * planets), otherwise 3 — and the more holes there are the fewer stars/planets
 * are allowed (at 4 holes, nothing else).
 */
export function bodyCap(type: BodyType, holeCount: number, otherCount = 0): number {
  if (type === 'hole') return otherCount === 0 ? 4 : 3;
  if (holeCount >= 4) return 0;
  if (holeCount === 3) return 3;
  if (holeCount === 2) return 4;
  return 5; // 0–1 holes
}

// A companion is gone once it is flung far past the scene (escaped) or has fallen
// in to the centre (merged) — at which point its memory and slot are freed.
const ESCAPE_RADIUS = 300;
const MERGE_RADIUS = 3;
// Seconds a merged companion spends being absorbed (held still, shrinking and
// redshifting in the shader) before it is finally freed — so it eases out of the
// scene rather than popping out of existence the instant it reaches the centre.
const ABSORB_DURATION = 0.6;
// Seconds the user-removed (− stepper) body's spiral takes to wind from its orbit
// down to the merge radius, where it hands off to the *same* absorption a natural
// merge uses. A long, graceful inspiral (the body reaches the centre in ~0.8 of
// this, then the absorption fade adds ~ABSORB_DURATION on top). The UI blocks
// another removal until the whole thing completes.
const PLUNGE_DURATION = 4.5;
// How many turns the plunge winds as it spirals in — more turns = a less direct,
// prettier fall (it reads as an inspiral, not a straight dive to the centre).
const PLUNGE_TURNS = 4;

/** Hermite smoothstep, clamped — 0 at edge0, 1 at edge1, eased at both ends. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The scene graph: the primary black hole (body 0, fixed at the origin) plus any
 * orbiting companions, all driven by the N-body PhysicsEngine. Companions are
 * placed on circular orbits beyond the disk; `addStar` / `addPlanet` is the
 * single-call "add a body via the UI" the Phase 5 plan asks for.
 */
/** A transient event worth marking on the scrub-bar timeline: a body added (by its
 *  type), absorbed at the centre, or flung clear of the scene. */
export type SceneEvent = BodyType | 'absorb' | 'escape';

/** The immutable identity of a body — enough to *revive* one the timeline rewinds back across an
 *  absorption/removal (its kinematics come from the History frame). Kept per id forever, so a body
 *  that fell in can be put back exactly where it was when you scrub before the merger. */
interface BodyTemplate {
  id: number;
  type: BodyType;
  mass: number;
  lensMass: number;
  radius: number;
  color: Vector3;
}

export class Scene {
  readonly blackHole: BlackHole;
  readonly physics: PhysicsEngine;
  bodies: Body[] = [];
  private nextId = 1;
  /** Every movable body ever created, by id — so `restoreRoster` can revive absorbed/removed ones
   *  when the timeline rewinds across the event that took them out. */
  private readonly registry = new Map<number, BodyTemplate>();
  /** Fired when the body set changes during simulation (pruning), so the UI
   *  count can refresh. */
  onChange?: () => void;
  /** Fired for a transient event worth marking on the history timeline — a body
   *  added (by type), absorbed at the centre, or flung clear (escaped). */
  onEvent?: (event: SceneEvent) => void;
  /** True while `seed()` populates the default / reseeded line-up, so those bulk adds
   *  don't each fire an `onEvent` (only user-driven adds are timeline events). */
  private seeding = false;

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
   *  substantially → update docs/intro-script.md (the master beats + tuning log). */
  private seed(stars: number, planets: number, holes: number): void {
    this.seeding = true; // a bulk line-up, not individual timeline events
    try {
      for (let i = 0; i < stars; i++) this.addStar(28 + i * 9);
      for (let i = 0; i < planets; i++) this.addPlanet(22 + i * 5);
      for (let i = 0; i < holes; i++) this.addBlackHole();
    } finally {
      this.seeding = false;
    }
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

  /** A secondary black hole: heavy enough to perturb orbits and to lens light
   *  (lensMass = mass), rendered as a dark core ringed by a lensed photon ring.
   *  New holes are placed on well-separated radii (34, 39, 44, 49) so up to four
   *  stay clear of each other and the centre rather than quickly merging out. The
   *  mass is 0.2 (was 0.3) so an added hole scatters the lighter stars/planets
   *  less violently — they hold their orbits longer — while still clearly lensing. */
  addBlackHole(orbitRadius = 34 + this.holeCount() * 5): Body {
    return this.addBody('hole', orbitRadius, 1.5, new Vector3(0.02, 0.01, 0.0), 0.2, 0.2);
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
    // Place the body *exactly* on the requested orbit radius: folding cos(incl)
    // into the horizontal components keeps |pos| === orbitRadius. The old form
    // (a bare sin(incl) on y) inflated the radius by √(1+sin²incl) — up to ~4% —
    // which scrambled the careful separations between added bodies.
    const ci = Math.cos(inclination);
    const pos = new Vector3(
      Math.cos(azimuth) * ci * orbitRadius,
      Math.sin(inclination) * orbitRadius,
      Math.sin(azimuth) * ci * orbitRadius,
    );
    // Circular-orbit speed in the primary's *softened* field (matching the
    // integrator's SOFTENING2): v = √(M·r² / (r² + ε²)^{3/2}). The bare √(M/r)
    // left a slight excess that opened the orbit into a slowly drifting ellipse —
    // part of why freshly added bodies wandered inward toward a merge.
    const r = pos.length();
    const speed = Math.sqrt((PRIMARY_MASS * r * r) / Math.pow(r * r + SOFTENING2, 1.5));
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
    this.registry.set(body.id, { id: body.id, type, mass, lensMass, radius, color: color.clone() });
    this.physics.bodies = this.bodies;
    this.physics.reset();
    if (!this.seeding) this.onEvent?.(type); // a user-driven add → a timeline event
    return body;
  }

  /** Make the movable roster *exactly* match `ids` (in order): revive any that were absorbed/removed
   *  (from the registry) and drop any added since, so the timeline can restore a frame from **before**
   *  a merger — not just kinematics, the whole line-up. Returns whether anything changed (so the
   *  caller can rebuild the GPU buffers). Kinematics are written by the History restore that follows. */
  restoreRoster(ids: Int32Array): boolean {
    const want = Array.from(ids);
    const current = this.companions;
    // Already the right set in the right order? (the common case during replay → no rebuild)
    if (current.length === want.length && current.every((b, i) => b.id === want[i])) return false;
    const byId = new Map(current.map((b) => [b.id, b]));
    const primary = this.bodies.filter((b) => b.fixed);
    const movable: Body[] = [];
    for (const id of want) {
      const existing = byId.get(id);
      if (existing) {
        // Rewound to a moment this body was live — clear any absorption/plunge animation state.
        delete existing.absorbing;
        delete existing.absorbAnchor;
        delete existing.plunging;
        delete existing.plungeFrom;
        movable.push(existing);
      } else {
        const tmpl = this.registry.get(id);
        if (tmpl) movable.push(this.reviveBody(tmpl)); // back from the dead at its recorded slot
      }
    }
    this.bodies = [...primary, ...movable];
    this.physics.bodies = this.bodies;
    this.physics.reset();
    this.onChange?.(); // the count changed → refresh the Bodies panel
    return true;
  }

  /** Re-create a body from its template (placeholder kinematics — the History restore sets them). */
  private reviveBody(t: BodyTemplate): Body {
    return {
      id: t.id,
      type: t.type,
      mass: t.mass,
      lensMass: t.lensMass,
      fixed: false,
      position: new Vector3(),
      velocity: new Vector3(),
      radius: t.radius,
      color: t.color.clone(),
    };
  }

  clearCompanions(): void {
    this.bodies = this.bodies.filter((b) => b.fixed); // keep only the primary hole
    this.physics.bodies = this.bodies;
    this.physics.reset();
  }

  /** Whether a user-initiated removal (plunge) is currently animating. The UI
   *  blocks another removal until it lands, so removals queue one at a time. */
  get removing(): boolean {
    return this.bodies.some((b) => b.plunging !== undefined);
  }

  /** Remove the most recently added companion of a type (the − stepper button) by
   *  sending it on a graceful *inspiral* down to the merge radius, where it is
   *  absorbed exactly as a natural merger is (see prune) — rather than deleting it
   *  instantly. It is freed when that completes. Returns whether one was sent in. */
  removeOne(type: BodyType): boolean {
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i]!;
      if (!b.fixed && b.type === type && b.plunging === undefined && b.absorbing === undefined) {
        b.plunging = 0;
        b.plungeFrom = b.position.clone();
        return true;
      }
    }
    return false;
  }

  /** Free companions that have escaped far past the scene or finished being
   *  absorbed at the centre — drop them from the body list (and so the render
   *  slots and the count). A companion that reaches the merge radius is *not*
   *  removed at once: it begins an `absorbing` 0→1 fade (held still at its anchor,
   *  shrinking and redshifting in the shader) and is freed only when that
   *  completes. `frameDelta` is wall-clock seconds, so the fade runs at a steady
   *  rate at any Speed. Returns whether anything was freed, so the GPU buffers can
   *  rebuild. */
  prune(frameDelta = 0): boolean {
    for (const b of this.bodies) {
      if (b.fixed) continue;
      // User-initiated removal: spiral the body gracefully inward — the controlled
      // "approach" — winding several turns on a smooth (eased) descent, *until it
      // reaches the merge radius*, where it falls through to the exact same
      // absorption a natural merge uses below. So − tears (tidal, radius-gated),
      // ripples and fades identically; it just delivers the body there itself.
      // Wall-clock driven (steady at any Speed); the body is held on this path so
      // the physics can't move it.
      if (b.plunging !== undefined && b.plungeFrom && b.absorbing === undefined) {
        b.plunging = Math.min(1, b.plunging + frameDelta / PLUNGE_DURATION);
        const t = b.plunging;
        const radial = 1 - smoothstep(0, 1, t); // 1 → 0, eased out of the orbit and into the centre
        const angle = t * PLUNGE_TURNS * Math.PI * 2; // wind inward
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        const f = b.plungeFrom;
        b.position.set((f.x * c - f.z * s) * radial, f.y * radial, (f.x * s + f.z * c) * radial);
        if (b.position.length() > MERGE_RADIUS && t < 1) continue; // still approaching → keep spiralling
        // Reached the merge radius (or fully wound in) → fall through to the natural merge.
      }
      // Natural merge (and the tail of a − plunge, identical from here): a body
      // carried to the centre begins the in-place absorption fade rather than
      // vanishing the instant it arrives.
      if (b.absorbing === undefined && b.position.length() <= MERGE_RADIUS) {
        b.absorbing = 0; // just reached the centre — begin the absorption fade
        b.absorbAnchor = b.position.clone();
        this.onEvent?.('absorb'); // a body fell in — mark the moment on the timeline
      }
      if (b.absorbing !== undefined) {
        b.absorbing = Math.min(1, b.absorbing + frameDelta / ABSORB_DURATION);
        if (b.absorbAnchor) b.position.copy(b.absorbAnchor); // hold still while absorbing
      }
    }

    const gone = (b: Body): boolean => {
      if (b.fixed) return false; // never the primary
      // A non-finite position (a rare close-encounter integration blow-up) would
      // poison every ray's geodesic and black out the whole render, and it never
      // escapes (NaN ≥ R is false) — so drop it at once.
      if (!Number.isFinite(b.position.x + b.position.y + b.position.z)) return true;
      if (b.absorbing !== undefined) return b.absorbing >= 1; // freed once fully absorbed
      return b.position.length() >= ESCAPE_RADIUS; // flung clear of the scene
    };
    // Scan first — mark escapes (an absorbed body already fired 'absorb' when it
    // reached the centre), then only rebuild the list when something is actually out.
    let anyGone = false;
    for (const b of this.bodies) {
      if (!gone(b)) continue;
      anyGone = true;
      if (b.absorbing === undefined && Number.isFinite(b.position.x + b.position.y + b.position.z)) {
        this.onEvent?.('escape'); // flung clear of the scene
      }
    }
    if (!anyGone) return false;
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
