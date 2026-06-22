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

1. **Pre-warm / pre-compile the shaders under the splash (S–M).** The single
   biggest "feel" win left. On a fresh load the intro drops frames (a recording
   measured ~24 fps average vs a 60 fps display) because the heavy WebGPU shader
   is still compiling while the formation plays, and the final hand-off is gated
   on the *first real frame* — so on slower devices the splash also lingers.
   Compiling/priming the pipeline (e.g. an off-screen warm-up render, or
   `renderer.compileAsync`) during the splash would smooth the intro **and**
   let it hand off closer to the 0.5–0.8 s target everywhere, not just on fast
   machines. *Touches: `src/main.ts`, `src/core/Renderer.ts`.*

2. **Tighten "Replay intro" alignment (S–M).** A side-by-side of a fresh load vs
   a replay (v0.16.4 recordings) shows the replay is ~0.8 s longer and looser:
   it fades the splash *in* over the still-visible old scene for ~0.45 s and then
   dismisses on a **fixed 760 ms timer**, whereas the fresh load dismisses when
   the real first frame is ready, so the splash-hole and the real hole line up.
   Fix: on replay, hide the live scene instantly (no fade-in over it) and gate
   the dismiss on **formation progress** (as the fresh path does) instead of a
   timer. *Touches: `src/main.ts` (`replaySplash`), `src/core/FormationSequence.ts`.*
   — Noted by the user as "pretty great" already; this is a refinement, not a bug.

3. **A keyboard-shortcuts help overlay + a few more keys (S).** Now that there
   are shortcuts (`Esc`, `Space`, `←/→`, `↑/↓`), add a `?` overlay that lists
   them, and consider `R` = Replay intro, `C` = Clear companions, `F` = toggle
   FPS. *Touches: `src/ui/keybindings.ts`, a small overlay like `about.ts`.*

4. **A hero image / GIF in the README (S).** The landing page is text-only. A
   single looping GIF of the intro + a lensed companion would sell it instantly
   on the GitHub page. *Touches: `README.md`, `docs/`.*

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
