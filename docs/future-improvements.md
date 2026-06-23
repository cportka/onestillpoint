# Future improvements — roadmap

A living backlog of things worth doing next, distilled from the development
sessions (screen-recording reviews, perf audits, and feature asks) and ordered
roughly by **value ÷ effort**. Effort is a rough T-shirt size: **S** ≈ an
afternoon, **M** ≈ a few sessions, **L** ≈ a project of its own.

This is a wish-list, not a commitment. When something here ships, move it to the
[CHANGELOG](../CHANGELOG.md) and delete it here. Newest thinking lives at the top
of each tier.

---

## Tier 1 — near-term polish (do these first)

1. **Keep tuning the splash ↔ engine overlap (S, ongoing).** Much improved in
   v0.17.1 — the dust now drifts past the burst and fades through the crossfade
   (no black void), and the live disk is revealed a touch earlier. The standing
   goal (see `intro-script.md` → "the overlap"): the splash's last ½-second and the
   engine's first ½-second should share silhouette, **ring orientation**, and
   warmth so the cut reads as one continuous motion. The remaining mismatch is
   *ring orientation* — the splash rings reverberate roughly head-on while the real
   disk is a near-edge-on band; nudging the splash's late rings toward the disk's
   tilt would seal it. Dial against each new recording. *Touches: `index.html`,
   `src/style.css`, `src/core/FormationSequence.ts`.*

2. **Fresh-load smoothness — and a video-splash fallback (S now, M later).** A
   recording put the *live* splash at ~21 fps vs a steady 25 fps for the captured
   GIF: the CSS+canvas splash competes with the bundle parse, WebGPU init and the
   lil-gui DOM build for the main thread. **Done now (v0.18.0):** the heavy panel
   is a lazy `import()` mounted at idle (off the splash) and the initial bundle is
   smaller; `compileAsync` (v0.17.1) already hides the shader compile. **If that
   isn't enough, the longer-term plan:** play the *already-smooth* captured splash
   as a **`<video>`/WebM** (hardware-decoded, off the main thread — exactly why the
   GIF is smooth), with the instant CSS splash as the first-paint poster, then
   crossfade CSS → video → engine. The capture system (`npm run capture:splash`)
   can emit the WebM. Fallback levers if even that lags: move physics to a Worker,
   lazy-load GPU physics, trim the splash's CSS-filter cost. *Touches: `src/main.ts`,
   `index.html`, `scripts/capture-splash.mjs`.*

3. **A captured *scene* clip for the README (S).** v0.17.2 added a captured,
   looping **splash** GIF (`assets/splash.gif`, via `npm run capture:splash`) and
   a "Splash" section. A short clip of the *live engine* — a lensed companion
   swinging past the disk — would round out the README. The capture harness in
   `scripts/capture-splash.mjs` is splash-specific (deterministic freeze); a live
   clip needs a real-time screen grab instead. *Touches: `README.md`, `assets/`.*

> **Shipped from Tier 1:** captured looping splash GIF + capture system (v0.17.2) ·
> the bulk of pre-warm (`compileAsync`, v0.17.1) · splash→engine dust bridge / no
> black void (v0.17.1) · Replay-intro alignment (v0.17) · keyboard-shortcuts
> overlay → top-left panel + R/C/F + `?`/`/` (v0.17–0.17.1) · README hero +
> About-style framing (v0.17–0.17.1). The mobile "splash never plays" bug
> (first-paint gating) also shipped in v0.17.

---

## Tier 2 — medium-term (features & foundations)

5. **A true timeline / scrub bar, superseding Step back's limits (M).**
   *Foundation laid in v0.18.0* — [`src/core/History.ts`](../src/core/History.ts)
   is a bounded, zero-allocation ring buffer that records the bodies' kinematics
   each frame (with a generation tag so a restore is only valid while the body set
   matches), unit-tested, and the loop now records into it. **Remaining:** the UI —
   a draggable scrub bar that calls `history.restore()` (and pauses the sim while
   scrubbing), plus deciding how to present scrubbing *across* a body-set change
   (the generation boundary). *Touches: `src/core/TimeController.ts`, a scrub-bar
   component.*

6. **Shrink the bundle further (M).** *Progressed in v0.18.0* — the control panel
   (lil-gui + `Controls` and friends) is now a **lazy `import()`** (its own ~52 kB
   chunk, mounted at idle after the splash), trimming the initial bundle and
   un-janking the load. The bulk that remains is **three.js/WebGPU** (~860 kB); the
   next wins are lazy-loading the opt-in **GPU physics** path and pruning unused
   Three add-ons. *Touches: dynamic `import()` in `src/main.ts` /
   `PhysicsController.ts`, `vite.config.ts`.*

7. **A richer perf overlay behind Advanced (S–M).** The HUD is now just an FPS
   number. A small frame-time graph (and the current resolution scale) behind the
   Advanced toggle would make regressions like the intro stutter visible without
   a screen recording. *Touches: `src/ui/hud.ts`, `src/ui/Controls.ts`.*

> **Shipped from Tier 2:** the scrub-bar **history foundation** (zero-GC ring
> buffer + tests, v0.18.0) · control-panel **code-split** (v0.18.0) · **UI smoke
> tests** — jsdom keybindings coverage + a History suite (v0.18.0).

---

## Tier 3 — longer-term (big physics / visual features)

9. **Kerr (spinning) black hole (L).** The headline scientific upgrade: a spin
   parameter brings frame-dragging, an ergosphere, the off-centre/asymmetric
   shadow, and the characteristic one-sided photon ring. Currently the metric is
   Schwarzschild only. *Touches: `src/render/tsl/schwarzschild.ts` (→ Kerr
   geodesics), `disk.ts`, the validation scripts.*

10. **Deeper spaghettification / tidal disruption (M–L).** v0.16.0 added a
    tidal-stretch absorption. A real **tidal disruption event** — a star pulled
    into a stream that wraps and feeds the disk, gated by the Roche limit — would
    be a striking, physically-motivated set piece. *Touches: `src/scene/Scene.ts`,
    `src/render/tsl/bodies.ts`, `medium.ts`.*

11. **Relativistic companion orbits (M).** Companions integrate with Newtonian
    N-body gravity. A post-Newtonian correction (or geodesic orbits in the
    primary's field) would add **perihelion precession** — visible, correct, and
    on-theme. *Touches: `src/physics/integrators.ts`, the validation scripts.*

12. **"Swarm / galaxy" mode → GPU physics auto-enable (M–L).** `MAX_BODIES` is
    14 and the CPU integrator wins at that scale, so GPU physics stays a manual
    toggle (see [`perf-audit-v0.15.md`](./perf-audit-v0.15.md)). A mode that
    raises the cap into the hundreds would finally make the GPU path pay off —
    auto-enable it above ~256 bodies, with a `manual` flag so the auto-selector
    doesn't fight the user's toggle. *Touches: `src/physics/PhysicsController.ts`,
    `src/scene/Scene.ts`, `src/render/bodyUniforms.ts` (slot count).*

13. **Merger ringdown / gravitational-wave cue (M).** The splash *fakes* a binary
    merger beautifully; the live scene could show a real one — two holes that
    actually inspiral, merge, and ring down, with a subtle spacetime-ripple cue
    (a natural fit for the **Lattice** background). *Touches: `src/scene/Scene.ts`,
    `src/render/tsl/background.ts`.*

---

## Notes

**Testing structure (reviewed v0.18.0).** The suite is lean — no cruft found.
Physics/maths is the deepest coverage (`integrators` incl. reversibility, `Scene`,
`TimeController`, `GPUPhysicsEngine` packing, `FormationSequence`, `ResolutionScaler`,
`quality`, `bodyUniforms`), with `tagline` guarding the README mirror. v0.18.0 added
the first **UI smoke test** (`keybindings`, jsdom) and a **History** suite. Default
env is Node (fast); DOM tests opt in per-file with `// @vitest-environment jsdom`,
so the physics tests stay quick. Next gaps worth covering: `stepper` add/remove
caps and the `Controls` speed/clamp math (currently only exercised via keybindings).

**Headless splash capture.** Headless *virtual-time* does **not** advance compositor
CSS animations — freeze them with a Web-Animations `currentTime` (the canvas, on
main-thread rAF, *does* advance under virtual time). `scripts/capture-splash.mjs`
relies on this two-pass trick; remember it for the next splash tweak.
