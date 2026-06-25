# Future improvements — roadmap

A living backlog, **flattened into one loose roadmap** (top = next). It distills the
development sessions — screen-recording reviews, perf audits, feature asks — into a
single ordered list rather than tiered buckets. The first two items are *active
problems*; the rest run roughly fix → polish/brand → features → big physics.

The intro/splash is considered **fully tuned for now** — its remaining cost shows up
only as item 1 below (the engine takeover), not as more splash dialing.

Each item is annotated:

- **Effort** — a rough T-shirt size: **S** ≈ an afternoon · **M** ≈ a few sessions ·
  **L** ≈ a project of its own.
- **Risks / bugs** — where it's likely to bite.
- **Viz / perf** — what it changes for the look or the frame budget.
- **Notes** — anything else worth knowing, plus the files it *touches*.

This is a wish-list, not a commitment. When something here ships, move it to the
[CHANGELOG](../CHANGELOG.md) and delete it here.

---

## 1. Persistent lag as the physics visualizer takes over  ⚠️ active problem

The single biggest remaining problem. The splash lifts cleanly, but the live
raymarch engine still **hitches as it takes over** — the camera dolly + disk
ignition at the reveal (~1–2 s in) is the heaviest the app ever is, and a fresh
capture still shows sustained heavy frames / a choppy recovery before it settles.
Three prior passes chipped at it — `compileAsync` pre-warm (v0.17.1), the
engine-bundle deferral so the prelude runs unstarved (v0.20.2), and the intro
resolution ramp that starts the reveal cheap and climbs back (v0.21.1) — but the
takeover itself is not yet smooth.

- **Effort:** M (could be **L** if the fix is a physics Worker or a per-frame render
  budget scheduler).
- **Risks / bugs:** device-dependent and hard to reproduce deterministically; pushing
  `introResolutionScale` lower trades the hitch for a visibly soft reveal; a physics
  Worker risks render/sim desync and adds message-passing latency; resetting the
  scaler's smoothing too aggressively can let it overshoot.
- **Viz / perf:** the highest-value perf win — it's the first impression. Levers to
  try: drop the intro-scale floor a touch more and lengthen the climb-back; **stagger
  the disk-ignition shader cost** over more frames; pre-compile more pipeline
  permutations under the splash; or **cap raymarch steps for the first N live frames**
  (a temporary step budget that ramps up as FPS recovers).
- **Notes:** re-characterize with a *fresh* screen capture on the target Mac before
  changing dials (the earlier analysis lives in `docs/`). Touches: `src/main.ts`
  (`armIntroScale`, the pre-warm sequence), `src/core/ResolutionScaler.ts`,
  `src/core/quality.ts` (`introResolutionScale`), `src/render/RaymarchPass.ts` (a
  possible step budget), `src/physics/` (a Worker path).

## 2. Share saves a PNG, not an mp4  ⚠️ active problem

The Share button should **always** hand over an **mp4 of the last ~5 seconds**. In
practice it still falls back to a **still PNG** on the dev Mac / desktop Chromium.
v0.21.4 made the clip a real H.264 mp4 (WebCodecs + `mp4-muxer`) and removed the old
WebM, but the recorder's null-return path — which drops Share to a PNG — is still
being hit, so the shared artifact isn't the animation.

- **Effort:** S–M — **diagnose first**, then a small fix (eager encoder config, a
  brief readiness wait on click, or surfacing the reason instead of silently
  degrading).
- **Risks / bugs:** several silent fall-throughs to investigate —
  `VideoEncoder.isConfigSupported` may report unsupported on some Chromium builds;
  `clip.ready` requires ≥2 s buffered **and** a keyframe **and** decoder meta, so a
  click too soon returns `null` → PNG; the recorder only `start()`s after the intro;
  a thrown encode silently marks the recorder `dead` for the whole session. (The
  desktop `navigator.canShare({files})` → download branch is *correct* — the bug is
  upstream, where no mp4 is produced.) **CI/headless has no H.264 encoder, so it always
  PNGs there** — this can't be verified in CI.
- **Viz / perf:** none — this is correctness of the shared artifact.
- **Notes:** add a tiny **dev readout of recorder state** (configured? codec chosen?
  ready? last error?) to see *why* it falls back; consider briefly awaiting `ready` on
  click, or showing "couldn't record video" rather than silently sending a PNG. **Must
  be verified on the actual Mac/Chromium.** Touches: `src/ui/clipRecorder.ts`,
  `src/ui/share.ts`, `src/main.ts` (`captureShare`).

## 3. Finish the branding / theme pass

The checkbox de-saturation (v0.22.0, the `--osp-check` silver) is the first step
toward a **neutral, barely-warm silver** identity. Remaining: unify the other accent
greens that are *chrome* rather than *status* (the version-copied check, the HUD
appear-pulse, the About-copied check) into the palette; **keep the semantic greens
that mean "success / go"** (the ✓ add-flash, the Resume/running state) — unless the
new palette defines its own success hue; finalize the **logo / wordmark** and the
About-card art; align the share/HUD accents. (The CPU/GPU HUD tokens are deliberately
*functional* slate/amber, not branding.)

- **Effort:** S–M — mostly CSS + asset work once the palette and logo are locked.
- **Risks / bugs:** low; the trap is over-applying neutral silver to status colors and
  flattening their meaning. A fuller theme wants a small **token set** (accent,
  success, warn, danger), not just the one `--osp-check` knob.
- **Viz / perf:** pure visual identity; no perf impact.
- **Notes:** target palette is "neutral silver to barely warm, subtle, elegant."
  Touches: `src/style.css`, `src/intro/intro.css`, `src/ui/about.ts` (logo SVG),
  `assets/`.

## 4. A captured live-engine clip for the README

v0.17.2 added a captured looping **splash** GIF; a short clip of the **live engine** —
a lensed companion swinging past the disk — would round out the README hero. The
splash harness (`scripts/capture-splash.mjs`) is splash-specific (a deterministic
freeze under virtual time); a live clip needs a real-time grab.

- **Effort:** S (a capture script + a README section); **M** if a clean, deterministic
  live capture proves fussy.
- **Risks / bugs:** headless virtual-time does **not** advance CSS animations (the
  documented two-pass trick); a live clip is non-deterministic, so the seed + framing
  need pinning; mind GIF size vs a short mp4/webm.
- **Viz / perf:** marketing / first-impression; no runtime impact.
- **Notes:** the new `clipRecorder` (mp4) could back an in-app "record this" path and
  double as the capture source. Touches: `scripts/`, `README.md`, `assets/`.

## 5. A true timeline / scrub bar (supersedes Step back's limits)

*Foundation laid in v0.18.0* — [`src/core/History.ts`](../src/core/History.ts) is a
bounded, zero-allocation ring buffer that records the bodies' kinematics each forward
frame (generation-tagged, so a restore is valid only while the body set matches),
unit-tested, and the loop already records into it. **Remaining:** the UI — a draggable
scrub bar that calls `history.restore()` (pausing the sim while scrubbing) — plus
deciding how to present scrubbing **across a body-set change** (the generation
boundary).

- **Effort:** M.
- **Risks / bugs:** the generation boundary (adding/removing a body invalidates older
  frames) must be legible in the UI — you can't scrub past it; scrubbing must pause the
  integrator so it doesn't fight the restore; irreversible events (absorptions,
  plunges, the one-shot intro) don't come back, matching Step back's caveat; ring-wrap
  vs the scrub range.
- **Viz / perf:** a flagship UX feature; `History` is cheap (zero-GC) and the scrub-bar
  redraw is trivial — no perf risk as long as the recorder stays zero-allocation.
- **Notes:** Touches: `src/core/TimeController.ts`, `src/core/History.ts`, a new
  scrub-bar component, `src/ui/Controls.ts`.

## 6. Shrink the bundle further

*Progressed in v0.18–0.19* — the control panel (lil-gui + `Controls`) and the GPU
physics engine are both lazy `import()`s (their own chunks). The bulk that remains is
**three.js / WebGPU** (~808 kB raw / ~222 kB gzip in the latest build). The real lever
left is tree-shaking / trimming unused Three add-ons, or splitting the WebGL2 fallback
path out of the initial load.

- **Effort:** M.
- **Risks / bugs:** Three's TSL/WebGPU surface is large and interdependent — aggressive
  trimming can break the raymarch or the bloom node graph; a WebGL2 split roughly
  doubles the path test matrix.
- **Viz / perf:** faster first load (cold cache / mobile) — which **feeds directly into
  problem 1**, since less main-thread parse competes with the intro. No visual change
  if done carefully.
- **Notes:** the build's chunk report names the target (`three.tsl`). Touches:
  `vite.config.ts`, the `three` import surface.

## 7. Swarm / galaxy mode → let the GPU path finally pay off

With CPU/GPU now chosen **automatically** by body count (v0.22.0 —
`PhysicsController.autoSelect`, threshold `GPU_AUTO_BODIES = 256`), the missing half is
a mode that raises `MAX_BODIES` (currently **14**) into the hundreds. At that scale the
selector flips to the GPU compute path on its own and it finally beats the CPU's O(N²).
The switch is already wired — this item is now *"raise the cap + author the mode,"* not
*"add a toggle."*

- **Effort:** M–L.
- **Risks / bugs:** the GPU engine's storage-buffer slot count and the render path's
  per-body uniforms must scale together (`MAX_BODIES` is shared); **lensing is per-body
  in the raymarch**, so hundreds of *lensing* bodies is a render problem, not just a
  physics one — a swarm likely means cheap, non-lensing point bodies; the auto-selector's
  first cross-threshold enable lazy-loads the GPU engine + builds buffers (a one-time
  hitch); hand-placed orbit radii don't scale — a swarm needs a seeded distribution.
- **Viz / perf:** exactly what the GPU compute path was built for; a galaxy/swarm is a
  striking new mode. Watch the **render** budget (lensing N), not just the sim.
- **Notes:** Touches: `src/render/bodyUniforms.ts` (slot count), `src/scene/Scene.ts`
  (seeding), `src/physics/PhysicsController.ts` (threshold), `src/render/tsl/bodies.ts`
  (a cheap-body path).

## 8. Kerr (spinning) black hole

The headline scientific upgrade: a spin parameter brings frame-dragging, an
ergosphere, the off-centre/asymmetric shadow, and the characteristic one-sided photon
ring. The metric is **Schwarzschild-only** today.

- **Effort:** L.
- **Risks / bugs:** Kerr geodesics are materially harder per-ray than Schwarzschild
  (more state, stiffer near the horizon) → a real raymarch cost; numerical stability
  near the ergosphere; the validation scripts assume Schwarzschild and need Kerr
  analogues; a spin control + persistence.
- **Viz / perf:** the most scientifically impressive feature — and the heaviest per-ray
  cost, so it likely wants its own quality/step-budget consideration.
- **Notes:** Touches: `src/render/tsl/schwarzschild.ts` (→ Kerr geodesics),
  `src/render/tsl/disk.ts`, `src/render/tsl/raymarch.ts`, the validation scripts.

## 9. Deeper spaghettification / tidal disruption event

v0.16.0 added a tidal-stretch absorption. A real **tidal disruption event** — a star
pulled into a stream that wraps and feeds the disk, gated by the Roche limit — would be
a striking, physically-motivated set piece.

- **Effort:** M–L.
- **Risks / bugs:** a stream is a particle/zone system the current single-body
  absorption doesn't model; *feeding the disk* means coupling the body system to the
  disk shader (today they're independent); performance of a fragment stream; tuning the
  Roche threshold so it triggers believably rather than constantly.
- **Viz / perf:** a memorable visual; moderate render cost for the stream.
- **Notes:** Touches: `src/scene/Scene.ts`, `src/render/tsl/bodies.ts`,
  `src/render/tsl/medium.ts`.

## 10. Relativistic companion orbits (perihelion precession)

Companions integrate with Newtonian N-body gravity. A post-Newtonian correction (or
geodesic orbits in the primary's field) would add **perihelion precession** — visible,
correct, and on-theme.

- **Effort:** M.
- **Risks / bugs:** a PN term changes the force law — it must **preserve
  time-reversibility** (Step back / the History buffer rely on it) and not destabilize
  orbits over a session; tuning so precession is visible but bounded; the orbit
  validation script needs updating.
- **Viz / perf:** subtle but correct; negligible perf cost (a force-law term).
- **Notes:** Touches: `src/physics/integrators.ts`, the orbit validation script.

## 11. Merger ringdown / gravitational-wave cue

The splash *fakes* a binary merger beautifully; the live scene could show a real one —
two holes that actually inspiral, merge, and ring down, with a subtle spacetime-ripple
cue (a natural fit for the **Lattice** background).

- **Effort:** M.
- **Risks / bugs:** a real inspiral→merge needs more than Newtonian gravity at close
  separation (otherwise it just slingshots); the ringdown ripple is a shader cue that
  must read on the Lattice without looking gimmicky; sequencing/coupling with the
  existing absorption.
- **Viz / perf:** a dramatic set piece; the ripple is a cheap background-shader effect.
- **Notes:** Touches: `src/scene/Scene.ts`, `src/render/tsl/background.ts`.

---

## Notes

**Testing structure (reviewed v0.18.0; still lean — no cruft).** Physics/maths is the
deepest coverage (`integrators` incl. reversibility, `Scene`, `TimeController`,
`GPUPhysicsEngine` packing, `FormationSequence`, `ResolutionScaler`, `quality`,
`bodyUniforms`), with `tagline` guarding the README mirror, plus UI smoke tests
(`keybindings`, `hudFolder`) and the `History` suite. v0.22.0 added
`PhysicsController.autoSelect` (the CPU/GPU decision) and a `hud` detail-line suite
(the S/P/B breakdown + compute token). Default env is Node (fast); DOM tests opt in
per-file with `// @vitest-environment jsdom`. Next gaps worth covering: `stepper`
add/remove caps and the `Controls` speed/clamp math.

**Headless splash capture.** Headless *virtual-time* does **not** advance compositor
CSS animations — freeze them with a Web-Animations `currentTime` (the canvas, on
main-thread rAF, *does* advance under virtual time). `scripts/capture-splash.mjs`
relies on this two-pass trick; remember it for the next splash tweak.
