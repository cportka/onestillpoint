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

**Phase 4 — look UI + post + perf (v0.4).** A collapsible **lil-gui panel**
exposes the look, animation, bloom, and quality controls (with Physical / EHT /
Interstellar / Stylized presets and a click-to-copy version chip). **HDR bloom**
runs through the WebGPU node pipeline (linear HDR → bloom → ACES tone-map), and
**dynamic resolution** drives the drawing-buffer size from the measured frame
time so the heavy volume march stays interactive across GPUs (the HUD shows the
current render scale).

| Phase | What | State |
| ----- | ---- | ----- |
| 0 | Scaffold: renderer + fallback + fullscreen TSL pass + camera/time uniforms + deploy | ✅ done |
| 1 | Schwarzschild geometry: photon geodesics, shadow, photon ring, lensed starfield | ✅ done |
| 2 | Accretion disk (static): Shakura–Sunyaev temperature → blackbody, Doppler, redshift, lensing | ✅ done |
| 3 | Animate & volumetric dust: Keplerian shear, advected turbulence, infall, single-scatter | ✅ done |
| 4 | Look UI + post (bloom, tone-map) + perf (dynamic resolution, mobile path) | ✅ done |
| 5 | Gravitational body simulator: N-body compute, weak-field lensing for secondaries | ⏳ next (v0.5) |
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
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + vite build → dist/
npm run preview    # serve the production build locally
```

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
    BlackHole.ts       the hole's parameters as uniforms (mass = length scale)
  ui/
    Controls.ts        lil-gui panel (look / animation / bloom / quality) + presets
    presets.ts         named looks (Physical / EHT / Interstellar / Stylized)
    versionBadge.ts    click-to-copy version chip
    hud.ts             backend + fps + render-scale readout
  render/
    uniforms.ts        the shared uniform "bus" (camera, time, resolution)
    RaymarchPass.ts    fullscreen quad + node material (the colour node plugs in here)
    PostPipeline.ts    WebGPU node pipeline: HDR bloom → ACES tone-map
    tsl/
      raymarch.ts      geodesic loop + volume march → disk / shadow / lensing
      schwarzschild.ts photon acceleration + static-observer ray (the metric)
      disk.ts          flux/temperature profile + Doppler & redshift shift
      medium.ts        volumetric dust: density, emission, scatter, extinction
      flow.ts          Keplerian Ω(r) + advected (co-rotating) noise coordinate
      turbulence.ts    fractal (FBM) noise
      blackbody.ts     temperature (K) → linear RGB
      starfield.ts     procedural lensed background
scripts/
  validate-geodesic.mjs  CPU check: recovers b_crit = 3√3·M
  validate-disk.mjs      CPU check: ISCO speed, flux profile, beaming (npm run validate)
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
