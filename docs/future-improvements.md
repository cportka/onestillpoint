# Future improvements — roadmap

A living backlog, **flattened into one loose roadmap** (top = next), aimed at a polished
**1.0.0**. It distills the development sessions — screen-recording reviews, perf audits,
feature asks — into a single ordered list rather than tiered buckets. The first two items
are *active problems*; the rest run roughly fix → polish/brand → features → big physics, and
the **[Road to 1.0.0](#road-to-100--the-sequence)** below makes that sequence explicit.

The intro/splash is considered **fully tuned for now** — its remaining cost shows up only as
item 1 below (the engine takeover), not as more splash dialing. The **history scrub bar /
timeline** (former item 5) is **shipped** (v0.24.0 → v0.26.0: always-on, 2-min window, colour
key, start/current markers, DVR replay) — see the [CHANGELOG](../CHANGELOG.md).

Each item is annotated:

- **Effort** — a rough T-shirt size: **S** ≈ an afternoon · **M** ≈ a few sessions ·
  **L** ≈ a project of its own.
- **Risks / bugs** — where it's likely to bite.
- **Viz / perf** — what it changes for the look or the frame budget.
- **Notes** — anything else worth knowing, plus the files it *touches*.

This is a wish-list, not a commitment. When something here ships, move it to the
[CHANGELOG](../CHANGELOG.md) and delete it here.

---

## Road to 1.0.0 — the sequence

A suggested build order (the numbered items below detail each). The two **active problems**
gate quality; **polish/brand** follows; then the new viz/physics features run **cheap →
expensive**, with **Kerr deliberately last** — it's the trophy, but it *worsens* problem 1, so
it waits until 1 is solved and gets its own step budget.

1. **Fix what's broken** — #1 engine-takeover lag · #2 Share → mp4. (Quality gates for any "1.0".)
2. **Polish + brand** — #3 theme/logo · #4 README live clip · #5 bundle (delivery done; the
   WebGL2-drop lever is optional).
3. **Cheap dramatic wins** — #6 merger ripple (✅ shipped v0.27–0.29) → #7 precession (the
   position-only r⁻³ route is low-risk and validatable).
4. **Bigger set pieces** — ~~#8 TDE~~ (✅ shipped v0.29–0.32: tear → stream → feed the disk →
   ringdown) → #9 swarm / galaxy (the GPU path's payoff).
5. **The trophy, last** — #10 Kerr, only after #1 is solved and behind its own step budget.

Net (from the items-8–11 review): with #8 and the #6 ripple now shipped, the remaining discipline
is all about **Kerr** — it's the one in active tension with problem 1. The other physics items are
tractable, and **#7/precession is genuinely low-risk once you keep the perturbation position-only**
(see its entry).

---

## 1. Persistent lag as the physics visualizer takes over  ⚠️ active problem

The single biggest remaining problem, and it **regressed again** with the roadmap-#8 work
(v0.29–0.32): the torn-stream + disk-feeding additions grew the raymarch WGSL, so the
**first-load** shader compile is longer and each live frame is a touch heavier. The tell is sharp —
**"Replay intro" is smooth and near-flawless** (the pipeline is already compiled and the GPU caches
are warm), while the **first** splash→engine takeover hitches: the camera dolly + disk ignition at
the reveal (~1–2 s in) is the heaviest the app ever is, now landing on a cold, first-time pipeline.

### Can we multi-thread the first download + load + render?

Mostly it's *already* multi-threaded — which is why "just thread it" isn't the quick fix:

- **Shader compile** — `createRenderPipelineAsync` (what our `compileAsync` pre-warm uses) compiles
  WGSL on the browser's **GPU-process worker threads**, off our main thread, already. Growing the
  shader (#8) lengthens that compile, but it's not blocking the main thread.
- **Download** — the engine chunk is code-split and HTTP/2-multiplexed, and v0.25.1 added a
  `prefetch` so the bytes land *during* the splash (item 5). Already parallel.
- **What's left on the single main thread** is JS module eval + scene/pipeline setup and the
  **first use** of each pipeline (the first draw can still stall while the driver finalises state).
  The real lever to move *that* off the main thread is **OffscreenCanvas + a Web Worker** — run the
  whole renderer in a worker so the main thread (splash, DOM, input) never blocks. three.js's WebGPU
  renderer supports OffscreenCanvas, but it's an **L-effort architectural change** (the renderer,
  loop, resolution scaler and every uniform write move to the worker; scene/UI state crosses a
  message boundary) and it risks the same render/sim desync a physics Worker would. It's the right
  big swing for 1.0 — not a patch. **Scaffolding started (v0.36.0)** — see
  [`offscreen-canvas.md`](offscreen-canvas.md) for the full scope, the typed main↔worker message
  protocol, and the 6-step incremental migration plan (build behind a flag, then a clean switchover).

### What v0.32.1 did (the cheap masking lever) + the tuning dials, defined

Cut the reveal resolution **deeper** and **lengthen the haze** that hides it — two halves of one
dial. The pieces, so the next tuning pass has one map:

- **Resolution ramp — the "steps".** Each tier now carries an explicit `introScale` *below* its
  steady-state `minScale` (high `0.40 → 0.30`, med `0.36 → 0.27`, low `0.30 → 0.24`; `quality.ts`).
  `armIntroScale` (`main.ts`) drops both the scale **and the scaler's floor** to it, so the reveal
  actually *holds* that low through the heavy frames.
- **How fast it sharpens.** The `ResolutionScaler` then climbs back at **`+0.07` every `0.4 s`** of
  frame-time headroom (down-steps are `−0.1`); the floor is restored to the tier `minScale` the
  moment it has climbed past it — so the deep cut belongs to the reveal alone, and a genuinely weak
  device that never climbs back simply keeps the lower floor.
- **How long the haze covers it.** The warm-fuzzy veil (`uniforms.fuzz` → `PostPipeline`) is
  **stronger** (warmer grade + `+1.1×` bloom glow, was `+0.7×`) and **lingers longer**
  (`FUZZ_FADE_S` `2.0 → 3.0 s`), so the softer/longer reveal reads as an intentional warm,
  out-of-focus look the whole way through.

**The dials, in one place:** how *deep* → `introScale` per tier (`quality.ts`); how *fast it
sharpens* → the `+0.07 / 0.4 s` climb + cooldown (`ResolutionScaler.ts`); how *long the haze masks
it* → `FUZZ_FADE_S` + the veil strength (`PostPipeline.ts`). Next finer steps to try: make the climb
**rate a curve** (slow-hold-then-fast) rather than a fixed step, and/or a short **raymarch step
budget** for the first N live frames that ramps up as FPS recovers.

- **Effort:** S for more dial-tuning of the above; **L** for the real fix (OffscreenCanvas/Worker
  render, or a per-frame render-budget scheduler).
- **Risks / bugs:** device-dependent, hard to reproduce deterministically; pushing `introScale`
  lower trades the hitch for a visibly soft reveal (the haze must keep pace); the OffscreenCanvas
  move risks render/sim desync + message latency; restoring the scaler floor too eagerly can *pop*
  the resolution.
- **Viz / perf:** the highest-value perf win — it's the first impression.
- **Notes:** re-characterise with a *fresh* screen capture on the target Mac before more dialing
  (earlier analysis in `docs/`). Touches: `src/main.ts` (`armIntroScale`, the floor restore,
  `FUZZ_FADE_S`, the pre-warm sequence), `src/core/ResolutionScaler.ts`, `src/core/quality.ts`
  (`introScale`), `src/render/PostPipeline.ts` (the veil), `src/render/RaymarchPass.ts` (a possible
  step budget), `src/physics/` (a Worker path).

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

## 5. Shrink the bundle further

*Progressed in v0.18–0.19* (the control panel + GPU physics engine are lazy `import()`s) and
**investigated in depth in v0.25.1.** The conclusion: **the engine bytes are at three.js's
floor — ~808 KB raw / ~222 KB gzip — and no *safe* change shrinks them.** What v0.25.1 shipped
instead is a **first-load latency** win (prefetch, below). The remaining byte lever is a product
decision (drop the WebGL2 fallback), not a quick patch.

### What the bytes actually are

`import { WebGPURenderer } from 'three/webgpu'` resolves to a **prebuilt bundle**
(`node_modules/three/build/three.webgpu.js`, ~2 MB unminified) — not the granular `src/` tree.
It is one tightly-interconnected module that Rollup can neither split nor tree-shake meaningfully,
and it **statically `import`s the WebGL2 fallback backend** (`WebGPURenderer.js` →
`webgl-fallback/WebGLBackend.js`), so the fallback ships whether or not WebGPU is used.

### What shipped (v0.25.1): prefetch the engine chunk

The engine bundle is loaded *late on purpose* — the inline `window.__ospBoot` (see `index.html`)
only `import()`s it once the splash is up, so the ~800 KB parse + WebGPU compile happen under
cover instead of starving the cheap CSS prelude. Correct, but it also delays the *download* to
the splash hand-off (a serial entry → main → three waterfall on a cold connection). A
`rel="prefetch"` for the three chunk (`prefetchEngineChunk()` in `vite.config.ts`) fills the
network's idle time *during* the splash at lowest priority and parks the bytes in cache —
**without** `modulepreload`'s compile, so it can't steal main-thread time from the prelude. Net:
same tuned execution timing, engine bytes already local when boot fires. **Verify on real
hardware** — the benefit is connection-dependent, and `vite preview` sends `Cache-Control:
no-cache` so the prefetch isn't reused there (a preview artifact; GitHub Pages serves hashed
assets cacheable, so production reuses it as a single download).

### Approaches measured and rejected (so we don't re-derive them)

- **Dedupe three's core** (`from 'three'` vs `from 'three/webgpu'`) — *no-op.* Both prebuilt
  bundles re-export a shared `three.core.js`, which Rollup already includes **once**. An exact
  `^three$ → three/webgpu` alias produced a **byte-identical** chunk (same hash). No duplication
  exists.
- **`manualChunks`** to split three apart — *conserves bytes.* It only moves the ~25 KB of core
  primitives between `main` and the vendor chunk (e.g. `main` 82 → 57 KB, three 808 → 833 KB);
  total ~890 KB raw either way. A caching nicety at best; three is already its own chunk.
- **terser instead of esbuild** — *no change* (808.5 vs 808.3 KB). three's own
  `three.webgpu.min.js` is smaller (~623 KB) only because three's build mangles its internal
  module properties before publishing; we can't replicate that on the consumed bundle.
- **Split the WebGL2 fallback out of the initial load** — *not possible without forking three.*
  It's statically imported and inlined into the prebuilt `three.webgpu.js`.
- **`modulepreload` the chunk earlier** — *rejected.* It would fetch **and compile** the module
  early — exactly the main-thread contention `index.html`'s boot comment guards against
  (starving the prelude's timers / first paint). `prefetch` (download-only) was chosen instead.

### The one real byte lever left (a product call)

**Drop / lazy-load the WebGL2 fallback (~30% of the engine).** This is the only change that
meaningfully shrinks the bytes, and it's an **L-effort, fragile** bet: it needs three patched so
`WebGLBackend` is a dynamic `import()` (or excluded), and **non-WebGPU browsers** then lose the
app or depend on an untested lazy path — contradicting the Phase-0 acceptance that *both* paths
render (see `Renderer.ts`, the `?webgl` force). A granular `three/src` tree-shake is the other
theoretical path, but three's package `exports` don't expose `src`, and `WebGPURenderer`'s static
fallback import means even that wouldn't auto-split. Either way: **not a quick patch**, and the
prize trades against browser reach.

- **Effort:** the byte win is **L** (fork/patch three, double the path test matrix); the shipped
  prefetch was **S**.
- **Risks / bugs:** dropping the fallback breaks WebGL2-only browsers; granular `src` imports can
  break the raymarch / bloom node graph and aren't a supported entry point.
- **Viz / perf:** faster first load (cold/mobile), feeding **problem 1** (less competing with the
  intro). The prefetch helps delivery; only the WebGL2 drop helps the byte/parse cost. No visual
  change.
- **Notes:** the build's chunk report names the target (`three.tsl`). Touches: `vite.config.ts`,
  `Renderer.ts` (the fallback path), the `three` import surface.

## 6. Merger ringdown / gravitational-wave cue

The splash *fakes* a binary merger; the live scene could show a real one — two holes that
inspiral, merge, and ring down, with a spacetime-ripple cue on the **Lattice** background.
**Better value than its size suggests: it splits cleanly, and most of it is already built.**

- **Effort:** M, front-loaded with done work. The two-hole *render* already exists (a secondary
  hole + `secondaryDisk` + weak-field lensing). What's missing is the **dynamics** and the **cue**.
- **Risks / bugs:** the **inspiral** is the only real work, and it splits well. Newtonian gravity
  at close separation *slingshots* (and `SOFTENING2` keeps it from merging cleanly), so a
  believable spiral-in needs an **energy-loss / radiation-reaction** term. That term is
  *dissipative → irreversible* — but that is **consistent with the existing model** (absorption is
  already one-way and isn't rewound), so the merged pair just stays merged and it **does not break
  Step-back / the DVR timeline** (unlike #7's naive route). The inspiral can also simply be
  *scripted* rather than dynamical.
- **Viz / perf:** dramatic set piece, and **cheap**. The ripple is a perfect fit for `lattice()`
  in `background.ts` — a time-decaying distortion of the lat/long grid radiating from the merger
  point (a few flops). The inspiral is just the N-body you already run.
- **Science:** phenomenological — a scripted / drag-driven inspiral and a *metaphorical* ripple,
  **not** a real waveform or metric perturbation. Frame it honestly.
- **Notes:** start with the ripple cue — the hook is sitting right there. Touches: `src/scene/Scene.ts`
  (inspiral / merge), `src/render/tsl/background.ts` (`lattice()` ripple).

## 7. Relativistic companion orbits (perihelion precession)

Companions integrate with Newtonian N-body gravity; a slowly **precessing ellipse** is visible,
correct-looking, and on-theme. **The sharper framing: the old "preserve reversibility" note was
the trap, not the fix — there's a route that sidesteps it entirely.**

- **Effort:** S–M — the **lowest-risk physics item**, *if* you take the effective-potential route.
- **Risks / bugs:** the obvious implementation — a true **1PN** correction `a(x, v)` — is
  **velocity-dependent**, which **breaks** the velocity-Verlet (KDK) reversibility identity (it
  holds *only* for position-only forces — `integrators.test.ts` proves exactly this). That loses
  bit-exact Step-back and symplecticity → orbits drift over a session, and the new DVR timeline
  leans on that reversibility even harder. **The move:** a **position-only inverse-cube (r⁻³)**
  effective-potential perturbation tuned to the GR precession rate. A `1/r² + 1/r³` force precesses
  the ellipse *analytically*; match the r⁻³ coefficient to the leading-order GR advance for
  near-circular orbits. One extra force term, reversibility + symplecticity intact,
  precession-per-orbit closed-form.
- **Viz / perf:** subtle, correct-*looking*; negligible cost (one force term).
- **Science:** "right observable, wrong mechanism" — a Newtonian-shaped perturbation that
  reproduces the GR rate, not true 1PN. For a look-driven visualizer that's the right trade, and
  the closed form drops straight into `validate-orbit`.
- **Notes:** Touches: `src/physics/integrators.ts` (`computeAccelerations` — add the r⁻³ term to
  the primary's pull), `scripts/validate-orbit.mjs`.

## 8. Deeper spaghettification / tidal disruption event — ✅ shipped (v0.29.0–v0.32.0)

Done end-to-end (see the [CHANGELOG](../CHANGELOG.md)). In four steps: a **Roche-gated `tidal`**
factor (v0.29.0) tears a star into a **long, blue-hot, tidally-heated stream** (v0.30.0) as it falls
within the Roche radius; the **−** removal was reworked into a graceful **inspiral** that absorbs
exactly like a natural merge (v0.29.2); and the stream now **feeds the disk** — `streamFeed` in
`medium.ts` adds a hot, semi-dense feeding streak (gated on `feedingActive`), i.e. the *honest*
**(b)** "procedural stream source grafted into the disk" route from the original note, not the faked
separate volume (v0.32.0). The whole arc reads as one event: **tear → stream → feed the disk →
absorb → ringdown ripple.** Tuning dials live at the tops of `raymarch.ts` and `medium.ts`.

**What's still open (a smaller future item, if wanted):** the *honest* accretion is still
art-directed — the **Roche trigger** is the only checkable number, and the stream is a radial streak,
not a true **particle/zone stream that wraps** the hole before feeding it. A wrapping stream + real
mass bookkeeping would be its own project; the current look is the intended phenomenological one.

## 9. Swarm / galaxy mode → let the GPU path finally pay off

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
  striking new mode. Watch the **render** budget (lensing N), not just the sim — the same
  per-body-lensing ceiling that gates #10/Kerr.
- **Notes:** Touches: `src/render/bodyUniforms.ts` (slot count), `src/scene/Scene.ts`
  (seeding), `src/physics/PhysicsController.ts` (threshold), `src/render/tsl/bodies.ts`
  (a cheap-body path).

## 10. Kerr (spinning) black hole — the trophy, deliberately last

The headline scientific upgrade: a spin parameter brings frame-dragging, an ergosphere, the
off-centre **D-shaped** shadow, and the one-sided photon ring — the most impressive thing on the
list. The metric is **Schwarzschild-only** today. **Sequenced last on purpose: highest payoff
*and* highest cost, and it directly worsens active problem #1.**

- **Effort:** L — and it's **render-engine** risk, not physics-engine: it lives in
  `schwarzschild.ts` → a new `kerr.ts`; the CPU N-body is untouched.
- **Risks / bugs:** today's geodesic is *almost free* — a tiny central force with a single
  conserved `h²` per ray. **Kerr kills that trick:** the full geodesic RHS (or the Hamiltonian
  form with `E`, `Lz`, and the **Carter constant**), frame-dragging from the off-diagonal `g_tφ`,
  and **stiffer steps near the ergosphere** — more per-ray state, more per-step math, no clean
  conserved scalar to lean on. It **invalidates `validate-geodesic`**; you'd write Kerr analogues
  (prograde / retrograde photon-orbit radii, the asymmetric shadow boundary).
- **Viz / perf:** **the worst on the list — realistically 2–4× the per-ray cost of the dominant
  pass**, which is the very pass that hitches at takeover (problem 1). **Do not ship until problem
  #1 is solved, and gate it behind its own step budget / quality tier.**
- **Science:** a big real gain — **but only if companion lensing is upgraded too.** Companions
  lens in the **weak field**; an exact-Kerr primary ringed by Newtonian-approx companions is a
  fidelity mismatch.
- **Notes:** Touches: `src/render/tsl/schwarzschild.ts` (→ `kerr.ts`), `src/render/tsl/disk.ts`,
  `src/render/tsl/raymarch.ts`, `src/render/tsl/bodies.ts` (companion lensing), the validation
  scripts.

---

## Notes

**Testing structure (reviewed v0.18.0; still lean — no cruft).** Physics/maths is the
deepest coverage (`integrators` incl. reversibility, `Scene`, `TimeController`,
`GPUPhysicsEngine` packing, `FormationSequence`, `ResolutionScaler`, `quality`,
`bodyUniforms`), with `tagline` guarding the README mirror, plus UI smoke tests
(`keybindings`, `hudFolder`, `historyBar` markers) and the `History` suite. v0.22.0 added
`PhysicsController.autoSelect` (the CPU/GPU decision) and a `hud` detail-line suite (the S/P/B
breakdown + compute token); v0.26.0 added the `Timeline` (DVR scrub / step / replay clamp) suite
and rewrote the `TimeController` step tests around the new discrete `step`. Default env is Node
(fast); DOM tests opt in per-file with `// @vitest-environment jsdom`. Next gaps worth covering:
`stepper` add/remove caps and the `Controls` speed/clamp math.

**Headless splash capture.** Headless *virtual-time* does **not** advance compositor
CSS animations — freeze them with a Web-Animations `currentTime` (the canvas, on
main-thread rAF, *does* advance under virtual time). `scripts/capture-splash.mjs`
relies on this two-pass trick; remember it for the next splash tweak.
