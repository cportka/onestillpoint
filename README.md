# One Still Point

> The worldline · The present resting place · The circle of eternal return · The spinning cycle of time

A scientifically grounded, GPU-accelerated, animated **black hole visualizer** that
runs in the browser — event-horizon shadow, photon ring, gravitationally lensed
background, and a live relativistic accretion disk. Built on WebGPU (with an
automatic WebGL2 fallback) and architected to grow into a general gravitational
N-body simulator.

🌐 **Live:** [onestillpoint.app](https://onestillpoint.app)

---

## Status

**Phase 14 — background revamp & intro reality doc (v0.14).** The backgrounds
get a glow-up: **Nebula** is reborn in the Hubble/Eagle palette (glowing teal &
gold gas carved by dark dust pillars), a new **Filaments** sky draws the
monochrome cosmic web (ridged-noise threads with bright cluster knots), and
**Lattice** gains fainter in-between grid lines. The intro itself is unchanged —
but it now has a *reality* doc, [`docs/intro-description.md`](docs/intro-description.md),
transcribed from the v0.13 recording to sit beside the *ideal*
[`docs/intro-script.md`](docs/intro-script.md); the intro-shaping code carries
`⟳` reminders to keep it current.

**Phase 13 — backgrounds, intro tuning & video workflow (v0.13).** A new
**Background** dropdown (right after Filter) swaps the sky — **Stars** (default),
**Nebula** (colourful gas clouds), **Aurora** (flowing colour bands), or
**Lattice** (a spacetime grid that visibly warps near the holes) — all sampled
along the bent escape direction, so each one lenses. The formation intro gets
its first video-driven tuning (see `docs/intro-script.md`): the default scene now
seeds 3 stars + 3 planets and they enter earlier, so the intro has company from
the start. Small panel tweaks: the About/version row is split 50/50, **Step**
sits right after **Pause**, and the Bodies labels are a fixed half-width. The
Portka Tools `video-bug-analyzer` marketplace is wired in (`.claude/settings.json`)
for frame-accurate intro work.

**Phase 12 — body steppers, caps & About (v0.12).** The Bodies folder is now
**− N + steppers** (add/remove per type, count between, ✓/✗ flash) governed by a
budget: **at most 4 orbiting black holes**, and the more holes there are the
fewer stars/planets are allowed (≤1 → 5 each, 2 → 4, 3 → 3, 4 → nothing else;
`bodyCap`). Panel housekeeping: the single-child **Time** folder is gone (Speed
stands alone), **Pause** moves out to the last basic row, the advanced tuning
folders **start collapsed**, and an **About** button (left of the version chip)
credits the author with the project link and Venmo / click-to-copy ETH donations.
Queued for the next pass: the **video-bug-analyzer** plugin (Portka Tools) for
frame-accurate intro tuning, and reworking the intro into a **collision→formation**
of two objects.

**Phase 11 — the secondary black hole's accretion disk (v0.11).** "Add black
hole" now drops in a *full* second system: a dark core wrapped in its **own
compact volumetric accretion disk** (`secondaryDisk.ts`) — radial envelope × thin
Gaussian × co-rotating, inward-drifting turbulence, blackbody-coloured by the
shared flux law, scaled to the hole and marched only where a ray grazes its slab
(with a step-cap so the thin disk is never skipped). To keep slower machines
smooth as the scene gets heavier, the auto-resolution now targets a configurable
**frame rate (default 50 fps, adjustable in Quality)**. Plus panel polish:
elegant spacing and **bolder section dividers**, a bold **Advanced settings**
break, the **Add-body buttons show live counts** and flash **✓ / ✗** on click,
and "Click outside closes" moves up to the first batch of Advanced toggles.

**Phase 10 — UX polish & intro robustness (v0.10).** The panel leads with the
essentials and tucks **GPU physics · Display FPS · Pause · Step** as the first
items under **Advanced settings**, with **Replay intro** as the last basic row;
it sits flush to the right edge. The long-press tooltip now renders fully opaque
and above the panel. And the formation intro is hardened for mobile: it no longer
skips entirely under `prefers-reduced-motion` (which iOS Low Power Mode reports) —
it plays a gentler, shorter zoom — and a brief guard stops a stray load-time tap
from cancelling it, fixing the "no intro zoom" seen on an older iPhone.

**Phase 9 — performance auto-tuning & panel polish (v0.9).** A new quality
**auto-detect** picks a tier (Low / Medium / High) from device signals on load —
phones default Low — setting the starting resolution, the dust step, and the
device-pixel-ratio cap (overridable in **Quality → Quality**). Adding a second
black hole is now far cheaper: its weak-field deflection is evaluated **once per
geodesic step** (shared across the RK4 stages) instead of four times, and empty
companion slots short-circuit. The panel is restyled (≈70% opaque, monospace to
match the corner readout); the duplicate name is gone from the HUD, which is now
a **Display FPS** toggle (off by default; the "% res" is the live render-scale);
and click/tap-outside-to-close is on by default.

**Phase 8 — choreography & panel (v0.8).** The formation intro is now
choreographed: the default scene gains **two inner retrograde planets** that
swoosh in *after* the outer stars (a per-type `appear` fade staggers the entrance,
so the two swooshes read as a sequence in opposite directions). The control panel
is reorganised to lead with the essentials — version · **Filter** (formerly
Preset) · **Time** · **Bodies** · an **Advanced settings** toggle (remembered
across sessions) that folds the deep tuning, the **Movie** pause/step, and
**Replay intro** away. Touch gains an optional *tap-outside-to-close*. And a
latent bug is fixed: an added **black hole** was filtered out of the render slots
entirely (so it never drew) — companions are now split by movability, so a
secondary hole renders (dark core + lensed photon ring) and is properly cleared.

**Phase 7 — formation sequence (v0.7).** On load the visualizer now *forms*: the
camera dollies in from far while the accretion disk **ignites** (a `formation`
factor 0 → 1 the shader multiplies into the dust, so the disk condenses and
brightens into being). It is skippable (tap the scene), replayable (**Time →
Replay intro**), and honours `prefers-reduced-motion` by settling instantly.
Alongside it: touch devices start pulled further back and gain **long-press
tooltips**; the **Time** speed scrubs down to ×1/1000 slow-motion; **GPU physics**
auto-enables where WebGPU compute exists (and is disabled, explained, on the
WebGL2 fallback); and **Add black hole** now reads as one — a dark core ringed by
a luminous lensed photon ring (its full accretion disk is the next step).

**Phase 6 — time acceleration (v0.6).** Simulation time is now decoupled from
wall-clock by a `TimeController`: a **Time** folder scrubs the rate from ×1
(real-time) up to ×1,000,000, with pause and single-step. The key idea (build
plan §6) is that you *cannot* brute-force integrate sub-second dynamics billions
of times — it is wrong, impossibly slow, and strobes. Instead the visualizer
**crossfades the representation**: orbits accelerate (bounded), the
dust-animation clock saturates at a rate it can resolve, and the fine turbulence
smoothly fades into a steady, time-averaged disk — so the image stays coherent
at every scale.

**Phase 5 — gravitational body simulator (v0.5).** The engine now grows past a
single hole: a `Scene` of gravitating `Body` objects is advanced by an N-body
`PhysicsEngine` (CPU velocity-Verlet, symplectic → stable orbits, validated in
`scripts/validate-orbit.mjs`). Companion stars orbit the primary and are
raymarched as emissive spheres **inside the hole's curved spacetime**, so they
lens and are occluded by the shadow for free. Add/remove bodies from the panel's
**Bodies** folder.

_v0.5.1–0.5.3_ round out Phase 5: unit tests (Vitest) + CI (lint/typecheck/test/
validate); a vertical render-flip fix and the full vertical orbit sweep; **weak-field
lensing of secondary masses** — the panel's **Add black hole** drops in a massive
companion that bends light around it (`a = −2·m·d/|d|³`, CPU-validated against the GR
value 4Gm/b, gated so the default scene is unchanged); an **opt-in WebGPU compute
N-body kernel** (a *GPU physics* toggle — CPU velocity-Verlet stays the exact default,
the GPU path is the scaling road for many bodies); and hover tooltips on every control.

| Phase | What | State |
| ----- | ---- | ----- |
| 0 | Scaffold: renderer + fallback + fullscreen TSL pass + camera/time uniforms + deploy | ✅ done |
| 1 | Schwarzschild geometry: photon geodesics, shadow, photon ring, lensed starfield | ✅ done |
| 2 | Accretion disk (static): Shakura–Sunyaev temperature → blackbody, Doppler, redshift, lensing | ✅ done |
| 3 | Animate & volumetric dust: Keplerian shear, advected turbulence, infall, single-scatter | ✅ done |
| 4 | Look UI + post (bloom, tone-map) + perf (dynamic resolution, mobile path) | ✅ done |
| 5 | Gravitational body simulator: N-body (CPU + opt-in GPU compute), lensed companions | ✅ done |
| 6 | Time acceleration with representation crossfade | ✅ done |
| 7 | Formation sequence (art-directed): camera dolly + disk ignition, skip/replay | ✅ done |
| 8 | Choreographed entrance (retrograde planets) + panel reorg (Filter / Advanced settings) | ✅ done |
| 9 | Performance auto-tuning (quality tiers) + cheaper companion lensing + panel polish | ✅ done |
| 10 | UX polish (panel reorder / flush-right, opaque tooltip) + reduced-motion intro fix | ✅ done |
| 11 | Secondary black hole's own accretion disk + frame-rate-targeted auto-resolution + panel polish | ✅ done |
| 12 | Body ± steppers + black-hole-budget caps + About modal + panel reorg | ✅ done |
| 13 | Selectable backgrounds (Stars / Nebula / Aurora / Lattice) + video-driven intro tuning | ✅ done |
| 14 | Background revamp (Eagle Nebula / cosmic-web Filaments / finer Lattice) + intro reality doc | ✅ done |

## Stack

- **TypeScript** + **Vite**
- **Three.js r184** via `three/webgpu` (`WebGPURenderer`, auto WebGL2 fallback)
- **TSL** (`three/tsl`) — one shader source compiles to both WGSL and GLSL
- **OrbitControls** for swipe-orbit / pinch-zoom
- **lil-gui** for the look + animation panel (Phase 4)

## Develop

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173 (a secure context, so WebGPU works)
```

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm test           # vitest (unit tests for the physics)
npm run validate   # CPU physics checks (geodesic / disk / orbit)
npm run build      # typecheck + vite build → dist/
npm run preview    # serve the production build locally
```

Lint, typecheck, tests, and the validation scripts run in CI
(`.github/workflows/ci.yml`) on every push to `main` and every pull request.

Append **`?webgl`** to the URL to force the WebGL2 fallback path for testing
(e.g. `http://localhost:5173/?webgl`). The on-screen HUD reports the active
backend and frame rate.

## Architecture

The camera is an *input device only*. We render a single fullscreen quad and
feed the orbit camera's position/orientation into the raymarch shader as
uniforms each frame.

```
src/
  main.ts              bootstrap: wire uniforms → camera/loop/pass → render loop
  core/
    Renderer.ts        WebGPURenderer + automatic WebGL2 fallback
    CameraRig.ts       PerspectiveCamera + OrbitControls → camera uniforms; intro dolly driver
    Loop.ts            requestAnimationFrame driver → real frame delta
    TimeController.ts  decouples sim time from wall-clock: scale / pause / step + crossfade
    FormationSequence.ts  the intro: camera dolly + disk "ignition" (skip / replay / reduced-motion)
    ResolutionScaler.ts  adaptive drawing-buffer scale from frame time
    quality.ts         device-tier auto-detect (resolution / dust step / DPR cap)
    device.ts          coarse-pointer / reduced-motion probes (framing, tooltips, intro)
  scene/
    Scene.ts           owns the Body list + PhysicsEngine; spawns companions (prograde stars + retrograde planets)
    Body.ts            a gravitating body (hole / star / planet)
    BlackHole.ts       the hole's parameters as uniforms (mass = length scale)
  physics/
    PhysicsController.ts  switches CPU/GPU integrators behind one step(dt)
    PhysicsEngine.ts   N-body integrator driver (CPU velocity-Verlet)
    integrators.ts     velocity-Verlet + Newtonian accelerations
    GPUPhysicsEngine.ts  opt-in WebGPU compute N-body (storage buffers + kernels)
  ui/
    Controls.ts        lil-gui panel: Filter / Time / Bodies up front, deep tuning behind Advanced
    presets.ts         named looks / "filters" (Physical / EHT / Interstellar / Stylized)
    prefs.ts           remembered UI prefs (advanced on/off, tap-outside-close) via localStorage
    stepper.ts         the Bodies "− N +" add/remove rows (✓/✗ flash)
    about.ts           the About modal (author, project link, donations)
    touchTooltips.ts   long-press tooltips for touch devices (no native hover)
    versionBadge.ts    click-to-copy version chip
    hud.ts             corner readout (backend / fps / % res), toggled by "Display FPS"
  render/
    uniforms.ts        the shared uniform "bus" (camera, time, resolution)
    RaymarchPass.ts    fullscreen quad + node material (the colour node plugs in here)
    PostPipeline.ts    WebGPU node pipeline: HDR bloom → ACES tone-map
    bodyUniforms.ts    companion render slots (position / radius / colour / staggered appear)
    tsl/
      raymarch.ts      geodesic loop + volume march + body spheres + secondary-hole halo
      schwarzschild.ts photon acceleration + static-observer ray (the metric)
      disk.ts          flux/temperature profile + Doppler & redshift shift
      medium.ts        volumetric dust: density, emission, scatter, extinction
      secondaryDisk.ts compact accretion disk around an added (secondary) black hole
      flow.ts          Keplerian Ω(r) + advected (co-rotating) noise coordinate
      turbulence.ts    fractal (FBM) noise
      blackbody.ts     temperature (K) → linear RGB
      bodies.ts        segment–sphere test for companions
      starfield.ts     procedural lensed star field
      background.ts    selectable sky (Stars / Nebula / Filaments / Lattice), all lensed
scripts/
  validate-geodesic.mjs  CPU check: recovers b_crit = 3√3·M
  validate-disk.mjs      CPU check: ISCO speed, flux profile, beaming
  validate-orbit.mjs     CPU check: orbit stability + energy conservation
  validate-lensing.mjs   CPU check: weak-field deflection = 4Gm/b (npm run validate)
```

A guiding constraint: the infalling dust is a **volumetric participating
medium** sampled inside the raymarch, never rasterized particles — only that way
does it lens correctly along the bent light rays. See the build plan for the
full design and physics.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds with
Vite and publishes `dist/` to GitHub Pages. The custom apex domain is set in
**Settings → Pages → Custom domain** (`onestillpoint.app`); with artifact-based
deploys no committed `CNAME` file is needed. `vite.config.ts` uses `base: '/'`
because the site serves from the domain root.

## License

[MIT](./LICENSE) © 2026 Chris Portka. Bundled environment assets (star
cubemaps / HDRIs), if any, retain their own licenses.
