# The intro — visual script

A living storyboard of the opening, so we can tune it deliberately. Everything is
oriented toward **⊙, the One Still Point** — the centre of the screen, where the
event horizon settles. Each beat moves *toward* ⊙ or *away from* ⊙, brightens or
fades, and hands off to the next mid-stride so the whole thing reads as one
continuous birth.

**What drives it.** The *intro story* — the black hold, the test pattern, the moment
of creation, the splash — is a cheap, JS-free-ish overlay (inline CSS + one `<canvas>`)
that paints before the bundle parses (`index.html`, `style.css`, `src/intro/*`). The
*physics model* underneath is the real renderer: `src/core/FormationSequence.ts`
(camera dolly + the `formation` ignition factor), `src/render/tsl/raymarch.ts` (the
disk fades in with `u.formation`), and the per-body `appearFor` curve in
`src/render/bodyUniforms.ts` (the staggered swoosh).

**Frame rates (per section).** The intro story is rendered **uncapped** and we target
**200 FPS** — past the limit of human flicker detection, so it's as smooth as the
display can show (a 60/120/240 Hz panel simply can't draw all 200; the single-frame
test pattern therefore lasts 5 ms at 200 Hz but ~16.7 ms at 60 Hz). The physics model
renders at its own rate and is the one thing the optional **cinematic frame cap**
(Quality → Cap frame rate) may throttle. The source of truth for the timings is
`src/intro/introTimeline.ts` (the inline boot script mirrors it; a test guards the two
against drifting).

---

## 1 · Moment by moment (the master table)

Every transient, tied to a time + frame marker. `t` is seconds from the first painted
frame; **frame** is the design-target frame at that section's FPS. **Motion** is
relative to ⊙ (`→⊙` inward, `⊙→` outward, `·⊙·` holding at/around it). Splash-internal
animations are offset by the splash's own start (~0.33 s); their splash-local time is
noted as `(+x)`.

| beat | t (s) | frame | fps | element / transient | mechanism | motion | radius (from ⊙) | opacity / fade | colour | overlap |
| ---- | ----- | ----- | --- | ------------------- | --------- | ------ | --------------- | -------------- | ------ | ------- |
| **A · Black** | 0.00–0.25 | 0–50 | 200 | the void (opaque creation layer, burst paused) | CSS layer `#osp-creation` | `·⊙·` hold | full screen | flat, 1.0 | `#05060a` | → B |
| **B · Lines** | ~0.25 | 50 | 200 | test pattern — full-width 40 px white/black bands | CSS `.osp-lines`, **one painted frame** | `·⊙·` full field | full screen | 0→**1**→0 (1 frame) | `#fff` / `#000` | → C |
| **C · Creation — seed** | 0.28 | 56 | 200 | white-hot core at ⊙ | CSS `.osp-cr-core` | `⊙` born, then `→⊙` collapse | 0 (at ⊙) | 0→1→0 | white→`#fff6e0` | over B end |
| **C · Creation — flash** | 0.28–0.48 | 56–96 | 200 | full-screen light flashes (×2) | CSS `.osp-cr-flash` | `⊙→` bloom out | 0 → 8× | 0→.95→0 | `#fff7e8` / `#ffd9a0` | with seed |
| **C · Creation — rays** | 0.29–0.50 | 58–100 | 200 | 6 neon beams sweeping to the edges | CSS `.osp-cr-ray` (rotate + scaleX) | `⊙→` radial | 0 → 150 vmax | 0→.9→0 | gold·magenta·cyan·violet | with rings |
| **C · Creation — rings** | 0.28–0.56 | 56–112 | 200 | 3 reverberating shock rings | CSS `.osp-cr-ring` | `⊙→` expand | 0 → 13× | 0→.85→0 | warm·cyan·pink | → D (fades 0.50) |
| **D · Splash — dust** | 0.33–2.0 | 67+ | 200 | hundreds of warm dust points | `<canvas>` field | `→⊙` inspiral to an **annulus**, then `⊙→` gaseous drift | r₀ 22–54 → annulus 7–20 → out | quick in, hold, gentle fade | warm golds (few cool sparkles) | with C + E |
| **D · Splash — twins** | (+0)–(+0.3) | — | 200 | two orbs twirl together | CSS `.osp-splash__orb` | `→⊙` accelerating inspiral (~2 turns) | 27 vmin → 0 | 0→1→0 (dissolve into flash) | white-gold + amber | hands to flash |
| **D · Splash — merger** | (+0.16)–(+0.6) | — | 200 | flash · tilted jet · gas plumes | CSS `__flash`/`__jet`/`__plume` | `⊙→` burst | 0 → 2–24 vmin | 0→.95→0 | warm white / gold | bridges twins→rings |
| **D · Splash — neon burst** | (+0.24)–(+0.7) | — | 200 | shock rings + streaks, hue-shifted | CSS `__shock`/`__streak` + `osp-hue` | `⊙→` radial waves | 0.12× → 7× | 0→.95→0 | neon (cycles spectrum) | the one colour splurge |
| **D · Splash — disk** | (+0.14)→hold | — | 200 | warm accretion ring forms + **holds** | CSS `.osp-splash__disk` | `·⊙·` settle around ⊙ | ~16 vmin, tilted flat | 0→.95→.8 (holds) | warm amber | bridge to real disk |
| **D · Splash — horizon** | (+0)–(+0.56) | — | 200 | event horizon holds at ⊙, expands to final circle | CSS `.osp-splash__core` | `·⊙·` → slight overshoot → settle | 0 → `--core-d` (28 vmin) | opaque (a hole in the light) | matches real shadow |
| **E · Engine** | 0.6 → 6.5 | — | engine | the live model crossfades up: disk ignites, stars/planets swoosh, camera dollies home | WebGPU + `FormationSequence` | camera `→⊙` then `·⊙·` rest; bodies swoosh in | dolly 2.6× home → home | splash crossfades −0.45 s | lit hole + igniting disk | under fading D |

**The guiding rule:** adjacent beats **share silhouette, colour and motion at the
seam**, so nothing ever "pops." Black dissolves into the seed; the seed's collapse
rhymes with the twins' inspiral; the splash's warm horizon + accretion ring rhyme
with the engine's lit hole + igniting disk. Tune the seams (`INTRO_TIMING`,
`MIN_SPLASH_MS`, the crossfade duration) against each recording.

---

## 2 · The screenplay (the dance of creation)

> Read it as a film. ⊙ is the One Still Point at the centre of frame — the place
> everything falls toward and is flung from.

```
FADE IN FROM BLACK — hold.

INT. BEFORE ANYTHING — A QUARTER-SECOND OF NIGHT

Pure black, edge to edge. No stars. No sound but the sound of a screen
deciding to exist. A full quarter second — long enough to notice you are
waiting for something.

                         THE VOID
              (not moving, because there is
               nowhere yet to move)
              Wait.

A SINGLE FRAME — gone almost before it lands — of horizontal bands,
white and black, forty pixels each, top to bottom. A test card. A struck
match held to the lens. The machine clearing its throat.

                         THE SIGNAL
              (one frame, all at once)
              Here.

And then, at the exact centre of the dark — ⊙ —

INT. THE CENTRE OF THE SCREEN — THE INSTANT OF CREATION

A white-hot SEED ignites at ⊙ and, in the same breath, throws everything
outward: two flashes of light bloom past the edges, six neon beams sweep
to the corners, three shock rings reverberate out and dissolve. It is
loud and it is over in a third of a second. Nobody is strobed; it breathes.

                         THE STILL POINT
              I'm the only thing that holds still.
              Everything else is going to fall
              toward me. Watch.

EXT. AROUND THE STILL POINT — THE MERGER

Out of the fading burst, warm DUST — hundreds of motes — spirals inward
toward ⊙, never quite reaching it, settling into a turning ring. Two ORBS,
a white-gold and an amber, find each other and twirl down the drain of
gravity, two full turns, faster and faster.

                         THE TWINS
              (closing the distance)
              Closer — closer — now —

They touch. A warm FLASH, a tilted JET, plumes of gas — and from the seam
a burst of NEON shock rings and streaks shimmers through the whole spectrum
and races outward.

                         THE DUST
              (flung back out, still turning)
              Out we go again — but turning,
              always turning. Nothing here is
              ever truly still except —

A warm ACCRETION RING forms and *holds*, tilted nearly flat, encircling ⊙.
Inside it, a perfect dark CIRCLE grows outward, overshoots, settles: the
EVENT HORIZON, taking its final size — the shadow that matches the real one.

                         THE HORIZON
              (opaque, calm, exactly centred)
              Now I am here. A hole in all that
              light. Hello.

DISSOLVE TO:

INT. THE LIVING MODEL — THE SETTLE

The real thing fades up *underneath* the cooling splash — its disk already
lit, its first stars already swooshing in — so the two are the same picture
for half a second. The camera, which had been far away this whole time,
glides home toward ⊙ and eases to rest. The dust drifts off. The rings
cool. The disk churns and the inner edge begins to sparkle.

                         THE STILL POINT
              (as control returns to the audience)
              Told you. Everything falls toward
              the still point. Stay as long as
              you like.

HOLD on the turning disk.
```

---

## 3 · The settle — engine timeline

The physics model's own arc, once it crossfades up (progress = elapsed / duration;
**6.5 s**, or 2.6 s under reduced motion). Camera dollies from **2.6× the home
distance → home** on an ease-out-cubic; the disk **ignites fast** (formed by ~0.6 s,
over the first ~10% — `formationCurve`); the default scene seeds **3 stars (prograde,
outer) + 3 planets (retrograde, inner)**.

| t (≈) | progress | what you see |
| --- | --- | --- |
| 0.0 s | 0.00 | (Under the splash.) Camera far back; ignition beginning. |
| 0.0–0.6 s | 0.00–0.10 | The **disk ignites** to formed (masked by the splash); the photon ring forms. |
| 0.0–1.3 s | 0.00–0.20 | Camera rushes inward (fast early). **Outer stars fade + swoosh** in (prograde). The lensed starfield streaks. |
| 1.3–3.4 s | 0.20–0.52 | **Inner planets fade + swoosh the opposite way** (retrograde) — the two-direction choreography. |
| 5–6.5 s | 0.80–1.00 | Camera **eases to rest** at ⊙; the disk is fully formed; the inner edge **sparkles** (Doppler-beamed turbulence). Control returns. |

---

## 4 · Replay — the melt inward

**Replay intro** (the panel button or **R**) is now a deliberate gesture, not a cut:

1. **Melt (2 s).** The whole live view *collapses toward ⊙* — the engine canvas scales
   and spins down to a point, blurring and fading to black (CSS `canvas.osp-melting`,
   driven by `src/intro/melt.ts`; the duration is `INTRO_TIMING.meltMs`). The universe
   falls back into the singularity.
2. **Replay from black.** Once melted, the scene quietly re-seeds onto fresh orbits and
   the formation restarts (hidden behind the black), and the **whole intro replays from
   the top** — the black hold, the test pattern, the creation burst, the splash — via
   the same `window.__ospIntro` the first load uses. The canvas is un-melted under the
   covering splash, so the snap-back is invisible; the crossfade then reveals the
   re-formed model.

`__ospIntro` resets `window.__ospSplashStart` each run, so `main.ts` waits for the
*fresh* splash's first painted frame before playing it out — a replay never reads a
stale start and cuts the merger short. Verified by `src/intro/melt.test.ts`,
`introTimeline.test.ts`, and the headless `npm run verify:intro` (below).

---

## 5 · The short story (the summary)

> *One Still Point — the birth, in plain words.*

First there is nothing: a black screen, a quarter of a second of patience. Then, for
a single flicker, a striped test card — the projector finding its focus.

In the middle of the dark, a spark catches. It flares once, hard — light, beams, and
ringing circles thrown out to every edge — and just as fast it folds back in.

Out of that flare, warm dust comes spiralling inward, and two glowing orbs chase each
other down toward the centre, turning faster and faster until they merge in a flash.
The collision rings out in neon, a warm ring of gas settles into place, and inside it
a round, perfect darkness opens up and holds its size: a black hole, exactly where the
spark had been.

As the splash cools, the real thing is already there underneath it — the disk lit, the
first stars sweeping in — and the camera, which had been watching from far away, drifts
home and comes to rest. The dust thins, the rings fade, the disk keeps turning.

Everything fell toward one still point in the middle of the screen. Now it stays there,
turning, for as long as you want to watch.

---

## Tuning log & targets

- **[done · v0.20.3] The real fix: a CSS-cascade bug kept the burst from waiting.**
  The black still wasn't first — the creation burst played on page-load, *then* black.
  Cause: every `.osp-cr-*` element sets the `animation:` **shorthand**, which resets
  `animation-play-state` to its initial **`running`**, overriding the `paused` on
  `.osp-cr` — so `--go` never gated anything (this defeated both 0.20.0's black hold
  and 0.20.2's bundle deferral). Fixed with a higher-specificity rule,
  `#osp-creation:not(.osp-creation--go) .osp-cr { animation-play-state: paused }`.
  **Lesson for verification:** headless *virtual-time* doesn't advance CSS animations,
  so a screenshot shows black whether the burst is paused *or* running-but-not-advanced
  — useless for this bug. `verify:intro` now reads the **computed `animation-play-state`**
  (paused before `--go`, running after), which catches it deterministically.
- **[done · v0.20.2] Defer the engine bundle so the prelude isn't starved.** A recording
  (analysed with the Portka `video-bug-analysis` workflow) showed the live intro playing
  the beats **out of order** — the creation burst on the very first frame, the test
  pattern *after* it, then a **~0.5 s black void** before the splash. Root cause: the
  static `<script type="module" src="main.ts">` parsed + executed the 860 kB bundle on
  the main thread *during* the prelude, starving the black-hold/test-pattern timers and
  the splash's first canvas paint. Fix: the bundle is now a **dynamic `import()` behind
  `window.__ospBoot`**, which the splash calls only once it's built + covering — so the
  cheap CSS prelude runs unstarved (verified: the built site is **uniform black at
  150 ms**, content only after), and the heavy parse + WebGPU compile happen under the
  splash. (Re-confirmed by the headless dist check + the inline-sync deferral guard.)
- **[done · v0.20.0] A black hold + a 1-frame test pattern; 200 fps story; melt replay.**
  The intro now opens on **0.25 s of black** (the opaque creation layer with its burst
  paused), then a **single painted frame** of 40 px white/black bands (`.osp-lines`),
  before the creation burst. The intro story targets **200 fps** (uncapped; the engine
  keeps its own rate). **Replay** melts the live view inward to ⊙ over **2 s**, then
  replays from black. New unit + headless visual tests cover each part. **[open]** dial
  the test-pattern dwell + the black-hold length on a recording (is 0.25 s the right
  pause? is one frame perceptible enough on a 60 Hz screen?).
- **[done · v0.19.0] Beat 0 — moment of creation.** A separate full-screen CSS firework
  (`#osp-creation`) opens the intro, overlapping the splash. The beats are documented
  explicitly above.
- **[done · v0.17.2] Cohesion + no static dust.** The dust is one continuous *breath*
  per particle (no separate inward/burst/drift beats), turning through an **annulus** —
  never ⊙ itself — so it never piles into a static central clot, with a constant drift
  keeping every particle moving. The splash is captured to a looping GIF for the README
  (`npm run capture:splash`).
- **[done · v0.17.1] No black void at the cut + pre-warm.** The dust drifts gaseously
  and fades *through* the crossfade; the live disk is revealed slightly earlier over a
  gentler 0.45 s fade; the heavy raymarch WGSL is `compileAsync`-compiled under the
  splash. **[open]** ring-orientation match at the cut (splash rings head-on vs the
  disk's near-edge-on band).
- **[done · v0.17] Mobile first-paint + overlap.** Splash animations start on the first
  painted frame (`--go`), fixing "the splash doesn't play on mobile"; the warm gas/dust
  ring forms early and holds to bridge to the real disk.
- **[done · v0.16] Warm, neon, shorter.** Orbs → warm white-gold + amber; neon moved
  into the hue-shifted shock rings + streaks; merger compressed to ~0.6 s.
- **[open] Sparkles earlier.** The inner-edge sparkle reads late (a steady-state
  effect). To pull it into the intro window: a steeper early `formationCurve`, a brief
  intro boost to `rotationSpeed`, and/or a closer camera arrival. **Wants a video pass.**
- **[open] Distance vs. visibility.** Bodies appear early but stay small/far until the
  camera arrives (~5 s). Lowering `FAR_FACTOR` or reshaping the dolly ease would surface
  them sooner without changing the choreography.

## How to verify / grab frames for tuning

```bash
# Headless visual integration test of the new prelude beats (black / test pattern /
# creation) — asserts the pixels and writes a contact sheet to .intro-verify/.
npm run verify:intro

# Capture the splash as a looping GIF for the README.
npm run capture:splash
```

By hand, with the Portka Tools `video-bug-analyzer` plugin or raw ffmpeg:

```bash
# overview contact sheet (1 fps, timestamped)
ffmpeg -i intro.mov -vf "fps=1,scale=210:-1,drawtext=text='%{eif\:t\:d}s':x=4:y=4:fontcolor=yellow,tile=6x5" -frames:v 1 overview.png
# zoom the centre during a moment of interest
ffmpeg -ss 20 -t 3 -i intro.mov -vf "crop=320:320:(iw-320)/2:(ih-320)/2,fps=3,scale=300:-1,tile=3x3" -frames:v 1 detail.png
```
