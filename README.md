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
| 6 | Time acceleration with representation crossfade | ⏳ |
| 7 | Formation sequence (art-directed) | ⏳ |

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
    CameraRig.ts       PerspectiveCamera + OrbitControls → camera uniforms
    Loop.ts            frame driver + simulation clock → time uniform
    ResolutionScaler.ts  adaptive drawing-buffer scale from frame time
  scene/
    Scene.ts           owns the Body list + PhysicsEngine; spawns companions
    Body.ts            a gravitating body (hole / star / planet)
    BlackHole.ts       the hole's parameters as uniforms (mass = length scale)
  physics/
    PhysicsController.ts  switches CPU/GPU integrators behind one step(dt)
    PhysicsEngine.ts   N-body integrator driver (CPU velocity-Verlet)
    integrators.ts     velocity-Verlet + Newtonian accelerations
    GPUPhysicsEngine.ts  opt-in WebGPU compute N-body (storage buffers + kernels)
  ui/
    Controls.ts        lil-gui panel (look / animation / bloom / quality) + presets
    presets.ts         named looks (Physical / EHT / Interstellar / Stylized)
    versionBadge.ts    click-to-copy version chip
    hud.ts             backend + fps + render-scale readout
  render/
    uniforms.ts        the shared uniform "bus" (camera, time, resolution)
    RaymarchPass.ts    fullscreen quad + node material (the colour node plugs in here)
    PostPipeline.ts    WebGPU node pipeline: HDR bloom → ACES tone-map
    bodyUniforms.ts    companion render slots (position / radius / colour)
    tsl/
      raymarch.ts      geodesic loop + volume march + body spheres
      schwarzschild.ts photon acceleration + static-observer ray (the metric)
      disk.ts          flux/temperature profile + Doppler & redshift shift
      medium.ts        volumetric dust: density, emission, scatter, extinction
      flow.ts          Keplerian Ω(r) + advected (co-rotating) noise coordinate
      turbulence.ts    fractal (FBM) noise
      blackbody.ts     temperature (K) → linear RGB
      bodies.ts        segment–sphere test for companions
      starfield.ts     procedural lensed background
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
