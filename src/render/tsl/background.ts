import { abs, acos, asin, atan, clamp, dot, exp, float, fract, If, max, mix, normalize, pow, sin, smoothstep, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { starfield } from './starfield';
import { fbm } from './turbulence';

const TWO_PI = 6.2831853;
const PI = 3.14159265;

// --- Merger ringdown ripple (roadmap #6) — tuning dials -----------------------------------------
// A decaying, expanding ring radiating from the hole (the merger point) across the Lattice grid,
// fired by an absorption. `ripple` (uniform) is seconds since the event; large when idle → no-op.
// First pass — expect to tune these against the look on real hardware.
const RIPPLE_SPEED = 0.75; // how fast the wavefront sweeps outward, in radians of sky-angle per second
const RIPPLE_TAU = 1.4; // amplitude decay time (s) — the "ringdown" length
const RIPPLE_WIDTH2 = 0.02; // squared angular half-width of the wavefront band (smaller = tighter ring)
const RIPPLE_FREQ = 34; // spatial ringing frequency within the band (more = more wave crests)
const RIPPLE_WARP = 0.07; // how far the grid is dragged radially at the crest (the visible distortion)
const RIPPLE_GLOW = 1.3; // brightness of the soft glow riding the wavefront (reads across grid gaps)

/** Thin bright lines wherever `coord × count` lands on an integer. */
function gridLines(coord: Node<'float'>, count: number) {
  const f = abs(fract(coord.mul(count).add(0.5)).sub(0.5));
  return smoothstep(float(0.035), float(0), f);
}

/**
 * Mode 1 — a high-contrast emission nebula: orange-dominant glowing gas with dark
 * ember shadows and rare cool-blue pockets, carved hard by black dust pillars.
 * This is the v0.14.1 look (tuned for punch — deep voids, bright cores), which
 * the later "blue-green darks" ramps had drifted away from; the only addition is
 * a *faint* dark blue-green floor that lifts the blackest gaps just enough to
 * read as deep space rather than pure void.
 */
function nebula(dir: Node<'vec3'>) {
  const base = fbm(dir.mul(1.8)).mul(0.5).add(0.5); // large-scale structure
  const detail = fbm(dir.mul(4.0).add(vec3(19, 7, 13))).mul(0.5).add(0.5);
  const dust = fbm(dir.mul(2.6).add(vec3(40, 5, 30))).mul(0.5).add(0.5);

  // Narrow, powered masks → dark voids and bright cores (the contrast/punch).
  const orangeMask = pow(smoothstep(float(0.45), float(0.85), base), float(1.5)); // dominant
  const blueMask = pow(smoothstep(float(0.62), float(0.92), detail), float(2)).mul(0.6); // accent

  // Deep, saturated tones: ACES tone-mapping + bloom desaturate bright values
  // toward white, so the orange is kept rich (low green, ~no blue) and not too
  // hot — that is what stops the cores washing out to pale cream.
  const orange = vec3(0.95, 0.3, 0.04); // rich, red-leaning orange (saturated)
  const ember = vec3(0.5, 0.1, 0.014); // deep rust mid-shadow
  const blue = vec3(0.1, 0.42, 0.62);

  const warm = mix(ember, orange, orangeMask).mul(orangeMask);
  const gas = warm.add(blue.mul(blueMask));

  const dustMask = smoothstep(float(0.45), float(0.7), dust); // pillars carve to black
  const carved = gas.mul(float(1).sub(dustMask)).mul(1.45); // dimmer → less bloom-to-white, deeper orange

  // The "little dark blue/green near the blacker areas": a dim cool floor where
  // the orange gas is absent, mostly (not fully) carved by the dust so the
  // pillars stay near-black and the punch survives.
  const darkBlueGreen = vec3(0.02, 0.07, 0.06);
  const floor = darkBlueGreen.mul(float(1).sub(orangeMask)).mul(float(1).sub(dustMask.mul(0.6)));

  // Knots: deep-orange (not cream) and rarer, so the hot spots glow amber rather
  // than blowing out to white.
  const tips = vec3(1.0, 0.5, 0.12).mul(pow(detail, float(11)).mul(1.4));
  return carved.add(floor).add(tips).add(starfield(dir, float(0.5)));
}

/**
 * Mode 2 — Filaments: a high-contrast cosmic web. Ridged noise (1 − |noise|)
 * makes sharp threads over big dark gaps, with brighter knots at the
 * intersections. Tinted cool blue-silver so it always reads as *background*
 * against the warm-white central disk rather than washing into it.
 */
function filaments(dir: Node<'vec3'>) {
  const r1 = float(1).sub(abs(fbm(dir.mul(2.2))));
  const r2 = float(1).sub(abs(fbm(dir.mul(5.0).add(vec3(13, 9, 21)))));
  const web = max(float(0), r1.mul(0.55).add(r2.mul(0.55)).sub(0.52)); // high threshold → dark gaps
  const webGlow = pow(web, float(3)).mul(6);
  const nodes = pow(max(float(0), r1.mul(r2)), float(10)).mul(4); // bright cluster knots
  const intensity = clamp(webGlow.add(nodes), float(0), float(2.6)); // lower cap → less blowout
  return vec3(0.5, 0.68, 1.0).mul(intensity).add(starfield(dir, float(0.22)));
}

/**
 * Mode 3 — a glowing spacetime lattice; lat/long lines bend through the lensing.
 * Major lines plus fainter minor lines four to a cell for a finer grid. When a merger fires
 * (`ripple` ≈ 0), a decaying ring sweeps outward from the hole (`camFwd` direction), dragging the
 * grid radially and trailing a soft glow — the **ringdown** cue (roadmap #6).
 */
function lattice(dir: Node<'vec3'>, camFwd: Node<'vec3'>, ripple: Node<'float'>) {
  // Sky-angle from the screen centre (the hole / merger point); 0 = straight at it.
  const cosT = clamp(dot(dir, camFwd), float(-0.9999), float(0.9999));
  const theta = acos(cosT);
  const front = ripple.mul(RIPPLE_SPEED); // the wavefront radius, expanding with time
  // Rise fast then decay (the ringdown), and ≈0 when idle (ripple large → exp underflows to 0).
  const env = exp(ripple.div(-RIPPLE_TAU)).mul(smoothstep(float(0), float(0.08), ripple));
  const d = theta.sub(front);
  const band = exp(d.mul(d).div(-RIPPLE_WIDTH2)); // a gaussian band hugging the wavefront
  const wave = sin(d.mul(RIPPLE_FREQ)).mul(band).mul(env); // ringing inside the band
  // Drag the sampled direction radially (outward from the centre) by the wave → the grid
  // bunches and stretches as the ring passes. `radial` is dir's component ⟂ to centre.
  const radial = normalize(dir.sub(camFwd.mul(cosT)).add(vec3(1e-4, 0, 0)));
  const warped = normalize(dir.add(radial.mul(wave.mul(RIPPLE_WARP))));

  const lon = atan(warped.z, warped.x).div(TWO_PI).add(0.5);
  const lat = asin(clamp(warped.y, float(-0.999), float(0.999))).div(PI).add(0.5);
  const major = max(gridLines(lon, 24), gridLines(lat, 12));
  const minor = max(gridLines(lon, 96), gridLines(lat, 48)).mul(0.3); // in-between lines
  // Greener and a touch less saturated than the old cyan (raised red toward the
  // others, lowered blue so green leads).
  const grid = vec3(0.4, 0.66, 0.6).mul(max(major, minor));
  const glow = vec3(0.5, 0.85, 0.8).mul(band.mul(env).mul(RIPPLE_GLOW)); // wavefront glow
  return grid.add(glow).add(starfield(warped, float(0.35)));
}

/**
 * The background sky, selected by a mode uniform and sampled along each photon's
 * bent escape direction — so every option lenses around the holes. Mode 0 is the
 * original star field (the default); 1–3 are stylised alternatives. Each mode is
 * gated, so only the selected one runs. `brightness`, `saturation` and `tint`
 * (Advanced → Background) post-process whichever one is chosen.
 */
export function background(
  dir: Node<'vec3'>,
  mode: Node<'float'>,
  brightness: Node<'float'>,
  saturation: Node<'float'>,
  tint: Node<'float'>,
  camFwd: Node<'vec3'>,
  ripple: Node<'float'>,
) {
  const col = vec3(0).toVar();
  If(mode.lessThan(0.5), () => col.assign(starfield(dir, float(1.2))));
  If(mode.greaterThan(0.5).and(mode.lessThan(1.5)), () => col.assign(nebula(dir)));
  If(mode.greaterThan(1.5).and(mode.lessThan(2.5)), () => col.assign(filaments(dir)));
  If(mode.greaterThan(2.5), () => col.assign(lattice(dir, camFwd, ripple)));

  // Universal post: saturation (toward luminance) → warm/cool tint → brightness.
  const luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  const sat = mix(vec3(luma), col, saturation);
  const tinted = sat.mul(vec3(float(1).add(tint), float(1), float(1).sub(tint)));
  return max(vec3(0), tinted).mul(brightness);
}
