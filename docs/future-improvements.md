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

2. **Verify the pre-warm actually flattened the stutter (S).** v0.17.1
   `compileAsync`-compiles the raymarch WGSL under the splash (Tier 1.1, the bulk
   of it) and the splash hides the rest. Worth a fresh recording to confirm the
   ~24 fps fresh-load dip is gone; if a residual hitch remains it's likely the
   bloom post-chain's first compile — pre-warm that too (an off-screen `post`
   render already runs; may need one more, or a compile hook). *Touches:
   `src/main.ts`, `src/render/PostPipeline.ts`.*

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

5. **A true timeline / scrub bar, superseding Step back's limits (M).** Step
   back (v0.16.5) reverses the orbits exactly (velocity-Verlet is time-reversible)
   but **cannot un-happen irreversible events** — an absorbed or removed body
   stays gone, the one-shot intro doesn't rewind, and a *very* long reverse scrub
   accumulates floating-point drift. A small **state-history ring buffer**
   (snapshot positions/velocities + the body set every frame, say ~10 s worth)
   would give a proper draggable scrub bar with exact reversal *including*
   add/remove, and a cheap "reset to T". *Touches: `src/core/TimeController.ts`,
   `src/scene/Scene.ts`, a new history buffer + UI slider.*

6. **Shrink the bundle (M).** Every build warns that the main chunk is ~900 kB
   (~250 kB gzip). The splash hides most of the cost, but code-splitting the
   heavy bits (lazy-load `lil-gui`, defer non-critical Three add-ons) would cut
   time-to-interactive on slow links. *Touches: `vite.config.ts`, dynamic
   `import()` in `src/main.ts`.*

7. **A richer perf overlay behind Advanced (S–M).** The HUD is now just an FPS
   number. A small frame-time graph (and the current resolution scale) behind the
   Advanced toggle would make regressions like the intro stutter visible without
   a screen recording. *Touches: `src/ui/hud.ts`, `src/ui/Controls.ts`.*

8. **UI-module smoke tests (S–M).** Physics is well-tested; the UI glue
   (`keybindings.ts`, `Controls.ts`, `stepper.ts`) is not. A jsdom test
   environment for a few high-value cases (a key dispatches the right action and
   ignores text fields; the speed keys double/halve and clamp) would lock in the
   behaviour. *Touches: `vitest` config + `src/ui/*.test.ts`.*

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

## Standing tooling note

Headless verification of the **CSS/canvas splash** works (Chromium screenshots),
but headless *virtual-time* does **not** advance compositor CSS animations — use a
Web-Animations `currentTime` freeze (or real wall-clock) to capture keyframes.
The canvas (main-thread rAF) does advance under virtual time. Worth remembering
for the next splash tweak.
