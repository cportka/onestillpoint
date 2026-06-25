# Changelog

All notable changes to One Still Point, newest first. Dev notes and deep dives
live in [`docs/`](docs/) (intro script, recording findings, perf audits).

## 0.23.x — warm-fuzzy reveal + leaner intro

- **0.23.2** — **Hide the control panel during a Replay.** Triggering **Replay intro** now
  collapses *and* hides the lil-gui panel for the whole replayed intro, so it doesn't float over
  the black/splash/dolly. It reappears — folded — only once the replayed intro has finished
  settling, driven by a new `FormationSequence.onDone` hook (fired at the end of the dolly, or on
  a skip). No-op on first load (the panel is already shown).
- **0.23.1** — **Share actually produces an mp4 on the desktop (the PNG fallback bug).**
  - **Root cause #1 (Chrome): `latencyMode: 'realtime'`.** It biased the encoder toward a
    *hardware* H.264 path that, on desktop, frequently omits the `avcC` decoder config from its
    chunk metadata — so the recorder never had what `mp4-muxer` needs, never became `ready`, and
    Share silently fell back to a still PNG. Dropped it; the default software path reliably emits
    `avcC` (a 5s clip doesn't need realtime latency, and `takeClip()` still flushes to end at ~now).
  - **Root cause #2 (Chromium): no H.264 encoder at all.** Plain Chromium ships without the
    proprietary codec, so H.264 encode is simply unavailable. Added an **AV1 fallback** — still an
    `.mp4`, and playable on modern OSes. *Verified end-to-end in real Chromium:* the recorder now
    emits a valid `onestillpoint.mp4` (AV1, correct `ftyp`/`avcC`) instead of a PNG.
  - **No more silent PNG.** When a share *does* fall back to a still (no encoder at all, or the
    clip isn't buffered yet), the reason is logged to the console and exposed on the recorder's new
    `status` snapshot (`reason` · `codec` · `hasMeta` · `frames` · `ready`).

## 0.22.x — HUD & controls polish
  - **Warm-fuzzy reveal (smoother engine takeover).** The live engine now reveals at a much lower
    resolution — every quality tier bottoms out at its `minScale` floor for the first ~2s
    (`INTRO_SCALE_DROP` 0.2 → 0.45), so the heaviest moment (the camera dolly + disk ignition as
    the splash lifts) is far cheaper to draw. That softness is *masked, and made intentional,* by a
    new **warm-fuzzy veil** ([`uniforms.fuzz`](src/render/uniforms.ts) →
    [`PostPipeline`](src/render/PostPipeline.ts)): a warm tint + soft bloom glow at full strength
    the instant the engine appears, easing to nothing over the settle as the `ResolutionScaler`
    climbs back — so the scene **comes into focus** rather than stuttering in sharp. A no-op once
    settled (`fuzz = 0`).
  - **Removed the intro tuning scaffolding.** The dev-only **intro lab** (`intro-lab.html`,
    `src/intro/lab.ts`, the lab screenshot) and the "Tuning the intro" / tuning-log prose (in the
    README, `docs/intro-script.md`, and `src/intro/README.md`) are gone — the intro is considered
    tuned. The intro itself — the dials, overlay, timeline, melt, and the CI guards — is unchanged
    and stays well-documented.

## 0.22.x — HUD & controls polish

- **0.22.1** — **Adopt the Portka standard workflow + gate physics validation by path.**
  - **CI: physics validation is now path-gated.** Split the maths validation scripts (geodesic ·
    disk · orbit · lensing) out of `ci.yml` into their own
    [`validate-physics.yml`](.github/workflows/validate-physics.yml) that runs **only when physics
    or shader-maths files change** (`src/physics/**`, `src/render/tsl/**`, `src/scene/**`,
    `scripts/validate-*.mjs`). `ci.yml` keeps lint · typecheck · unit tests on every PR — so a
    UI/docs/CSS change no longer pays for the geodesic/orbit/lensing checks.
  - **Portka standard workflow.** Committed [`.claude/CLAUDE.md`](.claude/CLAUDE.md) encoding the
    standing process — update `main` → branch per change → tests + CI → PR → merge on green → hand
    back the PR link the user deletes as confirmation — so each session stays on the code, not the
    process.
  - **Version sync, enforced.** New [`src/version.test.ts`](src/version.test.ts) asserts
    `package.json` ↔ `src/version.ts` ↔ `CHANGELOG.md` agree (the repo-native form of the Portka
    SemVer triplet); CI runs it so they can't drift.
- **0.22.0** — **Automated GPU, a clearer HUD, and the first branding de-saturation.**
  - **GPU physics is now automatic.** Removed the **GPU physics** checkbox — the CPU/GPU
    integrator is chosen for you by body count
    ([`PhysicsController.autoSelect`](src/physics/PhysicsController.ts)). For every count the
    app can currently reach (`MAX_BODIES` is 14) that's the exact, faster **CPU** path; the GPU
    compute path only switches in past ~256 bodies (a future "swarm" mode). The HUD's CPU/GPU
    readout shows which path the selector picked — handy for debugging.
  - **HUD readout, clarified.** Dropped the static **WebGPU/WebGL2** label from the detail line.
    The **CPU/GPU** token is now **colour-coded** — a cool-slate dot for CPU, warm amber for GPU
    — so the one-letter C/G difference registers at a glance. And the body count is now an
    **S/P/B breakdown**: e.g. `3/2/1 bodies` = 3 stars, 2 planets, 1 (orbiting) black hole,
    mirroring the Bodies panel.
  - **De-saturated checkboxes.** The panel's checkboxes were a bright confirm-green; they're now
    a neutral, barely-warm **silver** (the new `--osp-check` variable) — quiet chrome, not a
    status colour. The first step of a wider branding/theme pass.
  - **"Click outside closes" moved to the top** of Advanced settings (it was last in the list).
  - New tests cover the `autoSelect` CPU/GPU decision and the HUD detail line.

## 0.21.x — modular intro + the intro lab

- **0.21.4** — **Share a real mp4 of the *recent* view, + camera tweaks.**
  - **Real .mp4.** The Share clip is now true H.264 mp4 (encoded with **WebCodecs** and muxed
    by **mp4-muxer**), so macOS can preview/AirDrop it — instead of the WebM that just
    downloaded as an unplayable file. Where there's no native file share (desktop Chromium),
    Share now **downloads the mp4**; the OS share sheet is still preferred on mobile/Safari.
    (Browsers can't put a video on the clipboard, so a download is the honest hand-off.)
  - **Fixed the clip content.** It's now the *actual previous ~5 seconds, ending at your
    current view*, with a correct duration. The old recorder kept a stale "header" chunk, so
    every clip began near the start of formation rather than what you were looking at.
  - Where H.264 can't be encoded (rare — e.g. some Linux Chrome), Share falls back to a still
    PNG rather than a WebM.
  - **Camera.** Doubled the maximum zoom-out distance (120 → 240), and **disabled panning** —
    there's no re-centre control yet, so a pan could strand the hole off-screen with no way back.
- **0.21.3** — **Share the last 5 seconds as a clip, + panel polish.**
  - **Share → a rolling clip.** The Share button now captures the **previous ~5 seconds**
    of the live view as a short, **square 720p, looping** video (mp4 where the platform can
    record it, else WebM) instead of a still PNG. A lightweight recorder
    ([`src/ui/clipRecorder.ts`](src/ui/clipRecorder.ts)) continuously buffers the canvas
    (centre-cropped to a square, started after the intro) so the recent moment is always
    ready. Sharing prefers the **native share sheet** (with the text `onestillpoint.app`),
    then the clipboard, then a download — falling back to a still PNG where canvas video
    can't be recorded.
  - **One-line confirmation.** The Share button's confirmation no longer wraps, and reads
    **"Shared ✓"** for the native share sheet vs **"Copied ✓"** / **"Saved ✓"** for the
    fallbacks.
  - **Checkboxes line up.** Every panel toggle is now the same native green checkbox,
    **right-justified into one clean vertical column** (the row toggles and the Display-HUD
    title box now match and align).
  - **Removed the Privacy link** from the About dialog (PRIVACY.md still lives in the repo).
- **0.21.2** — **Make the intro a self-contained, forkable unit (+ fix a latent keyframe
  collision).** The intro's stylesheet is split out of the app's into its own
  [`src/intro/intro.css`](src/intro/intro.css) (linked separately by `index.html` and on
  its own by `intro-lab.html`), so the whole intro — the moment of creation, the splash,
  the Replay melt, the sequencing, and now its styles — lives as one cohesive unit under
  [`src/intro/`](src/intro/). A new [`src/intro/README.md`](src/intro/README.md) documents
  the integration contract (`window.__osp*` + the `__ospBoot` hook) and a `git filter-repo`
  recipe + minimal scaffold for lifting it into its own repo. Splitting surfaced a **real
  bug**: the splash's merger-flash keyframe was named `osp-flash`, the *same* as the app's
  stepper-button flash — so the later definition silently won and the merger flash animated
  with the **wrong keyframe** (a stray `translateY` + wrong scale arc). Renamed to
  `osp-splash-flash`. The intro now ships as one `<link>` the lab can load *without* the
  full 1200-line app stylesheet. No app behaviour change; new tests guard the split.
- **0.21.1** — **Smooth the splash→engine handoff (an intro resolution ramp).** A phone
  recording caught the intro stuttering for ~1.5 s right as the splash lifts (~1.3 s):
  a couple of multi-hundred-ms hitches, then a choppy 20–30 fps recovery before it
  settles. The WGSL compile is already paid *under* the splash (`compileAsync` + priming
  renders), so this isn't a compile hitch — it's **sustained full-resolution raymarch
  load** at the heaviest moment (the camera dolly + disk ignition at the reveal), and the
  adaptive `ResolutionScaler` only fixed it *reactively* (starting sharp, then creeping
  down). Now the reveal starts **already cheap** — `introResolutionScale()` drops the
  starting drawing-buffer scale 0.2 below the device tier (floored at its `minScale`) for
  the pre-warm, the covered frames, and the reveal — and the scaler climbs *back up* to
  full quality as the scene calms (`ResolutionScaler.resetSmoothing()` keeps the prior
  heavy frames from dragging it down first). Same steady-state quality the scaler always
  seeks, just reached from below (smooth) instead of above (stuttering), masked by the
  crossfade; re-armed on **Replay**. See
  [`docs/perf-frame-rate.md`](docs/perf-frame-rate.md).
- **0.21.0** — **Modularize the intro, add a dev "intro lab", and two recording fixes.**
  The whole intro — the moment-of-creation markup, the splash markup, and the inline boot
  script that sequences them — now lives in **one source of truth**,
  [`src/intro/overlay.html`](src/intro/overlay.html). A small Vite plugin (`introOverlay()`
  in [`vite.config.ts`](vite.config.ts)) inlines it into both the app (`index.html`) and a
  new dev-only **intro lab** (`intro-lab.html`), so the lab previews the *exact* intro the
  site ships and can't drift. The lab ([`src/intro/lab.ts`](src/intro/lab.ts) — `npm run
  dev` → `/intro-lab.html`) loops the intro behind a panel of **sliders bound live to every
  dial** (`window.__ospDials`): adjust the visual sequence, watch it loop (or hit **Replay
  now**), then **Copy values** and paste the snippet back into the source. It isn't part of
  the production build (`intro-lab.html` isn't a Vite input) but is typechecked/linted with
  `src`, and a new README **"Tuning the intro"** section documents it. Two fixes from a
  screen recording: (1) **Replay intro now plays the moment of creation** — the burst's CSS
  animations finished on first load, and a parent reflow doesn't restart reused children, so
  Replay jumped straight to the splash; the burst is now genuinely restarted
  (`animation:'none'` → reflow → `''`), so Replay matches the first-load sequence exactly.
  (2) **The splash lands earlier** — the creation beat is now **240 ms** (was 340), so the
  splash is fully revealed by ~0.95 s and the **~1.0–1.14 s black gap is gone**.

## 0.20.x — the intro prelude (black → test pattern → birth)

- **0.20.7** — **Explicit intro dials + three splash fixes.** Every intro timing/speed is
  now an explicit, named dial in one place — `window.__ospDials` (inline) mirrored by
  `INTRO_DIALS` ([`src/intro/introTimeline.ts`](src/intro/introTimeline.ts)), kept in
  lockstep by a test: opening-black length, the split-second black, moment-of-creation
  **speed**, splash **speed**, the creation→splash crossfade **overlap + speed**, and the
  splash→engine crossfade **hold + speed** (speeds drive CSS `calc()` durations via custom
  properties). Three fixes from a recording: (1) the **engine bundle now boots at the
  *start* of the intro**, so its ~860 kB parse runs *under the black hold* instead of when
  the splash plays — that parse was **freezing the dust canvas** (~0.5 s) and lagging the
  splash's first paint (the "0.1 s black gap"); the splash now plays on a free thread.
  (2) The creation→splash crossfade defaults to **−80 ms overlap** (was a gap). (3) The
  splash **event horizon grows bigger** (`--core-d` 28 → 38 vmin, accretion ring 33 → 44
  vmin) so the dark circle ≈ the engine shadow at the crossfade — no size jump.
- **0.20.6** — **Separate the beats; bring back the twirling orbs.** v0.20.5 over-merged
  the moment of creation into the splash — they blurred together and the splash's
  **twirling orbs were hidden** (the splash played *under* the burst, so they finished
  off-screen). Now the beats are distinct: interference pattern → a deliberate
  **split-second of black** → the **moment of creation as its own beat** (~0.34s) →
  *then* the prebuilt splash plays **as the creation fades**, so the orbs play fresh and
  **visible**. (Reverses the "start the splash way earlier" overlap from 0.20.4–0.20.5 —
  separation reads better.)
- **0.20.5** — **Test pattern hands straight to the lit creation (no black flash).** A
  recording showed the black + test pattern looking great, but then briefly going **back
  to black** before the moment of creation — because the burst was fired *as* the pattern
  lifted, so its ~50ms fade-in (the core/flash/rays ramp up from zero) read as a black
  gap. Now `--go` fires **while the pattern is still up** (the opaque bands hide the
  burst's ramp), and the pattern is lifted ~45ms later once the burst is lit — so the
  interference pattern leads *directly* into a bright moment of creation. `verify:intro`
  now also freezes the burst at the lift instant and asserts it's lit (luma ≫ black).
- **0.20.4** — **Longer black + a seamless creation→splash crossfade.** The black hold
  is now **0.5 s** (was 0.25 s), and the splash **starts way earlier**: it's **prebuilt
  during the black hold** (on an idle thread, hidden under the opaque creation) and then
  **plays on the very frame the creation burst fires**, so it crossfades straight out of
  the moment of creation with **no black gap** (a recording showed the splash arriving
  ~0.3 s after the creation had already faded to black). This required fixing the **same
  `animation-play-state` shorthand-cascade bug on the splash** that the burst had in
  0.20.3 (`#osp-splash:not(--go) .osp-splash__stage > *`), so a prebuilt splash stays
  frozen until it's played. `__ospSplash(true)` prebuilds; `__ospSplashPlay()` plays.
  Verified by computed-style guards (creation *and* splash paused-before-`--go`) plus a
  prebuild/play integration check.
- **0.20.3** — **The actual intro-order fix (a CSS cascade bug).** The black still
  wasn't going first: the moment-of-creation burst played the instant the page loaded,
  *then* the screen went black. Root cause (missed in 0.20.1–0.20.2): each burst
  element uses the `animation:` **shorthand**, which resets `animation-play-state` to
  its initial **`running`** — overriding the `paused` on `.osp-cr`, so the burst never
  actually waited for `--go`. Fixed with a higher-specificity rule
  (`#osp-creation:not(.osp-creation--go) .osp-cr { animation-play-state: paused }`) that
  beats the shorthand, so the burst genuinely holds until the black hold + test pattern
  have played. Now verifiable for real: `npm run verify:intro` reads the **computed
  play-state** (paused before `--go`, running after) — a guard the earlier screenshot
  checks couldn't catch (headless virtual-time doesn't advance CSS animations, so they
  looked black either way). Order is finally **black → test pattern → creation → splash**.
- **0.20.2** — **Intro fix + tuning + docs de-cruft.** A screen recording (analysed
  with the Portka `video-bug-analysis` workflow) caught the live intro playing its
  beats **out of order** — the creation burst on the very first frame, the test pattern
  *after* it, then a **~0.5 s black void** before the splash — because the 860 kB engine
  bundle parsed on the main thread *during* the cheap CSS prelude, starving its timers
  and the splash's first paint. The bundle is now **deferred behind a dynamic `import()`
  (`window.__ospBoot`)** that the splash calls once it's covering, so the prelude runs
  **unstarved** (black is first again, beats in order, no black gap) and the heavy parse
  + WebGPU compile happen under the splash (verified: the built site is uniform black at
  150 ms, content only after). The **"Display HUD"** title checkbox moved to the
  **right** of its label. Docs **de-crufted**: four stale point-in-time notes
  (`intro-description`, `perf-audit-v0.15`, two `video-findings`) compressed into one
  [`docs/archive.md`](docs/archive.md), and Tier 1 of the roadmap refreshed.
- **0.20.1** — The README now shows the **moment of creation** as a looping GIF
  ([`assets/creation.gif`](assets/creation.gif)), a sibling to the splash GIF. It's
  captured straight from the running CSS burst by the new `npm run capture:creation`
  ([`scripts/capture-creation.mjs`](scripts/capture-creation.mjs)) — a single
  deterministic pass per frame (fire `--go`, freeze every animation via the Web
  Animations API, screenshot, stitch with ffmpeg).
- **0.20.0** (Phase 20) — A new two-beat **prelude** opens the intro: **0.25 s of
  black**, then a **single frame** of 40 px white/black **test-pattern bands**, before
  the moment-of-creation burst and the splash. The **intro story** (everything but the
  live physics model) now targets **200 fps** — uncapped, past the limit of human
  flicker detection. **Replay intro** is reborn: the live view **melts inward** toward
  the One Still Point over ~2 s (scaling + spinning down to a point, blurring to black),
  then replays the whole intro from the black screen. The **HUD** section is more
  compact: the **"Display HUD"** *folder title itself* now carries the on/off checkbox
  (off + collapsed by default), with **Frame-time graph** + **Detail** as children that
  are **on by default** — so the first time you turn the HUD on it shows everything. The
  intro is fully storyboarded — a master moment-by-moment table, a **screenplay**, and a
  short story — in [`docs/intro-script.md`](docs/intro-script.md), with shared timing in
  `src/intro/introTimeline.ts`. New unit tests (melt · timeline · HUD folder · an inline
  drift-guard) plus a **headless visual test** of the prelude beats
  (`npm run verify:intro`).

## 0.19.x — moment of creation, settings, share, rich HUD

- **0.19.1** — **Cinematic frame cap**: a new **Cap frame rate** toggle + the
  **Target FPS** slider now reaching **24** (Advanced → Quality) render at most that
  rate, locking to the nearest display divisor so the pacing stays even (full
  evaluation, incl. the 24-on-60Hz judder caveat, in
  [`docs/perf-frame-rate.md`](docs/perf-frame-rate.md); default stays uncapped).
  The **moment of creation** now overlaps the splash **earlier** (splash starts at
  ~0.05s). HUD: **"Display FPS" → "Display HUD"**, now a **collapsible HUD section**
  (collapsed by default) with the child toggles inside; the **resolution shows next
  to the FPS** (where the backend was), the backend moved into the detail line, and
  the redundant "HUD resolution" toggle is gone.
- **0.19.0** (Phase 19) — A new **"moment of creation"** opens the intro (beat 0,
  ~0–0.18s): a full-screen CSS firework — flash, neon beams, reverberating shock
  rings — that's a *separate, deliberately cheap* mechanism from the splash (no
  canvas), so it's instant and consistent on every device; the splash overlaps it
  from ~0.1s. The three intro **beats** are now documented explicitly. **Settings
  persistence**: every panel control (Filter, Background, Speed, all Look /
  Animation / Bloom / Quality / HUD knobs, toggles) now auto-saves to one
  `localStorage` profile and auto-loads on start; **Advanced settings defaults
  off**. New **Share** button (top row): captures the view and throws to the OS
  share sheet on mobile, or copies the image to the clipboard (✓) on desktop. A
  rich lower-left **HUD** — frame-time graph + resolution % + a bodies/speed/physics
  detail line, with Advanced toggles — augments the FPS readout. A witty
  [**privacy statement**](PRIVACY.md) linked from About. Bundle: **GPU physics**
  lazy-loads now too.

## 0.18.x — load smoothness + Tier-2 foundations

- **0.18.0** (Phase 18) — **Fresh-load smoothness**: a recording put the live splash
  at ~21 fps vs the captured GIF's steady 25 — the CSS+canvas splash was competing
  with the bundle parse and the **lil-gui panel build** for the main thread. The
  control panel is now a **lazy `import()`** (its own ~52 kB chunk) **mounted at idle
  after the splash**, so the heavy DOM build is off the critical path and the initial
  bundle is smaller. A documented **longer-term plan** (a hardware-decoded
  `<video>`/WebM splash) is in [`docs/future-improvements.md`](docs/future-improvements.md)
  if that isn't enough. **Tier-2 foundations**: a zero-allocation **history ring
  buffer** ([`src/core/History.ts`](src/core/History.ts)) records the bodies each
  frame — the groundwork for a scrub bar (no UI yet). **Tests**: first **UI smoke
  test** (jsdom `keybindings`) + a `History` suite; the suite was reviewed (lean, no
  cruft) — 50 tests.

## 0.17.x — intro robustness + Tier-1 polish

- **0.17.2** — Splash cohesion: the dust is now one **continuous breath** per
  particle (no separate inward/burst/drift beats), each turning at its own
  **staggered** time through an **annulus** — never the centre — so it stops piling
  into the **static central clot** seen before the cut, and a constant drift keeps
  everything moving. The flash starts earlier + lingers and the orbs dissolve into
  it, so the beats overlap rather than pop. New **assets/** folder (the logo moved
  here) and an auto-capture system — `npm run capture:splash`
  ([`scripts/capture-splash.mjs`](scripts/capture-splash.mjs)) renders the live
  splash to a looping **`assets/splash.gif`**, shown in a new README **Splash**
  section.
- **0.17.1** — Splash → engine handoff: the dust now **drifts gaseously** past the
  burst and fades *through* the crossfade (with a constant angular drift so nothing
  is ever momentarily static), so space no longer empties to a **black void** before
  the stars take over; the live disk is revealed a touch earlier over a gentler fade
  so it overlaps the expanding splash rings. **Tier 1.1 pre-warm**: the heavy
  raymarch WGSL is now **`compileAsync`-compiled** under the splash, cutting the
  fresh-load hitch. The **`?` shortcut also accepts `/`** (no Shift), and its
  cheat-sheet is now a **translucent top-left panel** (like the control dropdown),
  not a modal. README reframed like the About dialog (tagline above/below, byline
  framing the animated mark).
- **0.17.0** (Phase 17) — **Mobile splash fix**: the merger animation now starts on
  the **first painted frame** (it was on a parse-time timeline, which mobile Safari
  ran through before its first paint, so the splash was never seen). The crossfade
  waits for that first paint + holds over the first few rendered frames, so the
  shader-compile hitch hides under the splash. The **gas/dust ring forms earlier and
  holds**, bridging to the real disk. **Replay intro** now covers the old scene
  **instantly** (no fade-in) and plays the same as a fresh load. New **keyboard
  shortcuts** — `?` (cheat-sheet overlay), **R** Replay, **C** Clear, **F** FPS — on
  top of Esc / Space / arrows. README gains an **animated hero** (the About mark).
  Intro [ideal/reality docs](docs/intro-script.md) refreshed.

## 0.16.x — spaghettification, binary-merger splash, controls

- **0.16.5** — **Step back**: rewind time — one frame (paused) or a ~1 s jump
  (running) — with the new button or the <kbd>←</kbd> key. The orbits reverse
  exactly because the velocity-Verlet integrator is time-reversible (now unit
  tested); irreversible events (absorbed/removed bodies, the intro) don't come
  back. Started a **[roadmap](docs/future-improvements.md)** and logged the intro
  notes from this session's recordings (fresh-load stutter + the looser — but, per
  the user, "pretty great" — Replay-intro alignment) as future refinements.
- **0.16.4** — Splash, shorter + warmer: the whole binary merger now plays in
  ~0.6s (was ~1s). The two orbs are a **warm white-gold + amber** pair (no more
  pink/blue), with plumes/flash/jet/dust all warm, and the surrounding dust
  **spirals from the very first frame** (was an ease-in crawl that read as static).
  The neon is concentrated where it's wanted: the reverberating **shock rings now
  shimmer through an animated hue-shift**, joined by bright **neon streaks**. New
  **keyboard shortcuts**: <kbd>Esc</kbd> About · <kbd>Space</kbd> Pause/Resume ·
  <kbd>→</kbd> Step forward · <kbd>↑</kbd>/<kbd>↓</kbd> double / halve Speed.
- **0.16.3** — Splash: the dust is now **small, mostly-warm and lightly
  saturated** (was clownish rainbow) and **spirals** coherently in and back out;
  the canvas is capped-resolution with smaller sprites, so it's much **smoother**.
  **Replay intro** now replays the load splash too. Removing a body **spirals**
  into the centre instead of falling straight in. **Step** → **Step forward**. The
  **FPS** readout fades + pulses in/out so it's easy to spot.
- **0.16.2** — Fixed the two orbs briefly flying apart mid-inspiral on
  Safari/WebKit (keyframes now rotate < 180°/step, so every browser takes the same
  arc). Dust moved to a canvas particle field; render pipeline **pre-warmed** under
  the splash to cut the reveal hitch. **FPS** readout trimmed to just the number.
  **Pause** colours corrected (red running / green stopped). Background presets
  retuned.
- **0.16.1** — A **colourful binary-merger splash**: two orbs (cool + warm) twirl
  together, then a flash, tilted jet, colour plumes and reverberating shock rings
  burst at the merger before the event horizon settles. **Pause** shows state by
  colour; each **Background** loads its own look preset on selection.
- **0.16.0** (Phase 16) — **Spaghettification**: an absorbed body is tidally
  stretched along the line to the hole and thinned across it (a prolate ellipsoid
  in the raymarch — `segmentHitsStretched`), then redshifts and fades. **Pause** is
  a real toggle button; a new **Advanced → Background** folder post-processes the
  selected sky (Brightness · Saturation · Tint). **Lattice** re-tinted greener.

## 0.15.x — performance pass + instant load splash

- **0.15.1** — Splash sized in `vmin` so the forming horizon lines up with the
  real shadow; varied body/dust sizes. About logo full-width then moved below the
  byline. GPU auto-switch investigated and documented
  ([`docs/archive.md`](docs/archive.md)): not worth it below
  ~150–300 bodies, so it stays a manual toggle.
- **0.15.0** (Phase 15) — **N-body sim back on the CPU by default** (the GPU
  compute path's per-frame read-back stalled the pipeline for ≤14 bodies); removed
  a per-frame allocation in the render loop. A **load splash** paints before the
  WebGPU shader compiles and crossfades into the scene, which now ignites fast.
  **Step** also works while running (~1 s jump); add de-bounce; full-width About
  logo.

## 0.14.x — backgrounds, orbits & absorption

- **0.14.6** — Adding bodies is solid again: the GPU integrator now reads
  **velocities** back (not just positions), so an add no longer re-seeds bodies
  onto wrong orbits; a readback↔rebuild race is closed; substep size is bounded.
  Animated **About logo**; deeper-orange Nebula. See
  [`docs/archive.md`](docs/archive.md).
- **0.14.5** — Adds rate-limited to 1/s; removing a body **plunges** it into the
  centre with the absorption fade. Fixed an **all-black-screen** bug (a non-finite
  body position poisoning the lensing uniforms, never pruned) — see
  [`docs/archive.md`](docs/archive.md). Longer ✓/✗
  flash; Nebula reverted to its punchy orange.
- **0.14.4** — A 4th black hole only when nothing else orbits; added bodies last
  longer (exact radius + softened circular speed); absorbed bodies fade rather than
  pop (groundwork for collision animations). Richer dark-orange Nebula.
- **0.14.3** — Intro performance: geodesic escapes at the scene radius; DPR capped
  ≤ 1.5; cleaner Nebula ramp; About tagline frames the dialog.
- **0.14.2** — More background contrast; ± buttons disable at caps; added holes
  spread onto separated orbits; Replay re-seeds on fresh orbits.
- **0.14.1** — Nebula re-tuned for punch; About gains a BTC donation + the shared
  tagline; escaped/merged companions are pruned (and GPU buffers disposed).
- **0.14.0** (Phase 14) — Background revamp: Eagle-palette **Nebula**, cosmic-web
  **Filaments**, finer **Lattice**. Intro *reality* doc (since folded into
  [`docs/archive.md`](docs/archive.md)) beside the *ideal*
  ([`docs/intro-script.md`](docs/intro-script.md)).

## 0.5–0.13 — foundations

- **0.13** — Selectable **Background** dropdown (all lensed); first video-driven
  intro tuning (default scene seeds 3 stars + 3 planets, earlier entrance); Portka
  Tools `video-bug-analyzer` wired in.
- **0.12** — Bodies **− N + steppers** with a black-hole budget (`bodyCap`);
  **About** modal; panel reorg.
- **0.11** — Each added black hole gets its **own compact accretion disk**
  (`secondaryDisk.ts`); frame-rate-targeted auto-resolution; panel polish.
- **0.10** — UX polish (panel reorder, flush-right, opaque tooltip); reduced-motion
  intro hardening for mobile.
- **0.9** — Performance auto-tuning (quality tiers); cheaper companion lensing
  (weak-field deflection shared across RK4 stages); panel restyle.
- **0.8** — Choreographed entrance (retrograde planets swoosh in after the stars);
  panel reorg (Filter / Advanced settings); secondary-hole render fix.
- **0.7** — Formation sequence: camera dolly + disk **ignition**, skip/replay,
  reduced-motion aware; long-press tooltips; slow-motion Speed.
- **0.6** — **Time acceleration** with representation crossfade (you can't
  brute-force sub-second dynamics at huge scales, so the representation crossfades).
- **0.5** — **Gravitational body simulator**: N-body `PhysicsEngine` (CPU
  velocity-Verlet), companions raymarched inside the curved spacetime so they lens
  and occlude for free. `0.5.1–0.5.3`: tests + CI; weak-field lensing of secondary
  masses; opt-in WebGPU compute N-body kernel; hover tooltips.
- **0.0–0.4** — Scaffold (renderer + WebGL2 fallback + fullscreen TSL pass) →
  Schwarzschild geometry (photon geodesics, shadow, photon ring, lensed starfield)
  → static accretion disk (Shakura–Sunyaev → blackbody, Doppler, redshift) →
  animated volumetric dust → look UI + bloom/tone-map + adaptive resolution.

## Phase map

| Phase | Theme |
| ----- | ----- |
| 0–4 | Renderer, Schwarzschild geometry, accretion disk, volumetric dust, look UI + perf |
| 5–6 | N-body companions; time acceleration |
| 7–8 | Formation intro; choreographed entrance + panel reorg |
| 9–11 | Perf auto-tuning; UX polish; secondary black-hole disk |
| 12–14 | Body steppers + caps + About; selectable backgrounds; background revamp |
| 15–16 | CPU-physics perf pass + load splash; spaghettification + background controls |
| 17 | Intro robustness (mobile first-paint splash) + Tier-1 polish (shortcuts, hero) |
| 18 | Load smoothness (lazy panel / code-split) + Tier-2 foundations (history buffer, UI tests) |
| 19 | Moment-of-creation intro beat; full settings persistence; Share button; rich HUD |
