# The intro — visual script

A living storyboard of the formation intro, so we can tune timing deliberately.
The intro is driven by `src/core/FormationSequence.ts` (camera dolly + the
`formation` ignition factor), `src/render/tsl/raymarch.ts` (the dust fades in
with `u.formation`), and the per-body `appearFor` curve in
`src/render/bodyUniforms.ts` (the staggered swoosh).

**Defaults today:** a **load splash** (≈0.6 s, JS-free CSS + one canvas — see
below) hands off to the WebGPU formation, whose duration is **6.5 s** (2.6 s under
reduced motion): camera dollies from **2.6× the home distance → home** on an
ease-out-cubic, the disk now **ignites fast** (formed by ~0.6 s, over the first
~10% — `formationCurve`) and then holds with a gentle late bloom while the camera
settles, and the default scene seeds **3 stars (prograde, outer) + 3 planets
(retrograde, inner)**.

## The opening ~0.6 second (Phase 15–17)

Goal: *something beautiful on screen instantly*, before the heavy raymarch shader
compiles, **blending into the real scene** — see "the overlap" below. The whole
merger now plays in **~0.6 s** (compressed from ~1 s), warm and elegant, with the
neon reserved for the brief ring/streak burst.

| time (≈, from first paint) | what you see | how |
| --- | --- | --- |
| 0–~0.26 s | **Two warm orbs** (a white-gold + an amber twin — *no pink/blue*) **twirl together** (accelerating inspiral) while a few bigger bodies + small **spiral in** and **hundreds of warm dust** points **spiral inward from the very first frame**. | Static `#osp-splash` markup + a tiny **inline script**: a few CSS bodies and a **canvas particle field** (sprite `drawImage`, capped backing res). Orb keyframes rotate < 180°/step (a WebKit matrix-decomposition quirk made them fly apart). Dust uses ease-**out** so it moves at once (ease-in read as static). |
| ~0.14 s+ | A **warm accretion ring** forms early and **holds** around the forming horizon — the gas/dust ring, tilted nearly disk-flat. | `.osp-splash__disk` (forms at 0.14 s, settles + holds via `forwards`). |
| ~0.22–0.4 s | **Merger**: a warm-white **flash**, a warm **jet**, warm **plumes**, then **neon streaks** fire radially and **reverberating shock rings** expand — both **hue-shifted** so they shimmer through the spectrum. | `__flash` / `__jet` / `__plume` (warm) + `__streak` + `__shock` (neon `--rc` + `osp-hue`), transform/opacity only. |
| ~0.3–0.6 s | Dust **bursts back outward**; the dark **event horizon** grows back out (overshoot → settle) to the final circle + a warm photon ring (`--core-d ≈ 28vmin`, to match the real shadow). The warm disk ring persists. | canvas burst phase + `.osp-splash__core`. |
| ~0.6 s+ | Dust enters a **gaseous drift** (keeps expanding + rotating, fading) so the field never empties to black; the **crossfade** reveals the live scene — already pre-warmed, so its disk is lit and its stars are up — *under* the still-drifting dust + fading rings. | dust drift phase + a gentle **0.45 s** opacity crossfade beginning ~0.6 s; the formation continues to `t = 1`. |

**Start-on-first-paint (Phase 17).** The CSS choreography is held
(`animation-play-state: paused`) until the inline script adds `.osp-splash--go`
on its **first `requestAnimationFrame`** — i.e. the first painted frame — and the
canvas `t0` starts on that same frame. Mobile Safari often defers the first paint
past the short splash, so a parse-time timeline meant **the merger was never seen
on mobile**; this guarantees it plays in full, and keeps the CSS + canvas in
lockstep. `main.ts` then holds the crossfade until `MIN_SPLASH_MS` (700 ms) past
that first paint, and until a few frames have rendered (so the shader-compile
hitch hides under the splash).

### The overlap (always plan for it)

The splash and the real engine **co-exist across the crossfade** — both are on
screen for ~0.3 s — so they should rhyme, not cut. The vocabulary to keep aligned
(inward/outward motion · dust · gas · swirls · fractals · beams of light · vibrant
neon): the splash ends on a *warm hole + warm accretion ring*, and the engine
opens on a *lit hole + igniting disk*. Tune so the splash's last ½-second and the
engine's first ½-second share silhouette, ring orientation, and warmth.

*Warm elegance + neon-only-in-the-burst lives here (the rest of the app stays
tasteful). Fuzzy by design — dial against a recording. Levers: orb twirl/timing,
the warm `__disk` (when the gas ring forms), shock/streak neon + `osp-hue`
(`index.html` + `style.css`), `--core-d` (final circle size), `MIN_SPLASH_MS`
(`main.ts`, 700 ms) + crossfade (0.3 s); ignition speed (`t/0.1`) and `FAR_FACTOR`
for how "formed"/close the hole is at the handoff.*

## Timeline — the settle (progress = elapsed / duration)

| time (≈) | progress | what you see |
| --- | --- | --- |
| 0.0 s | 0.00 | (Under the splash.) Camera far back; ignition beginning. |
| 0.0–0.6 s | 0.00–0.10 | The **disk ignites** to formed (masked by / blending with the splash); the photon ring forms. |
| 0.0–1.3 s | 0.00–0.20 | Camera rushes inward (fast early). The **outer stars fade + swoosh** in (prograde). The lensed starfield begins to streak. |
| 1.3–3.4 s | 0.20–0.52 | The **inner planets fade + swoosh the opposite way** (retrograde) — the two-direction choreography. |
| 5–6.5 s | 0.80–1.00 | Camera **eases to rest** at home; the disk is fully formed; the inner edge **sparkles** (Doppler-beamed turbulence). Control hands back to the user. |

## Tuning log & targets

- **[done · v0.17.1] No black void at the cut + pre-warm.** The dust drifts
  gaseously and fades *through* the crossfade (a constant per-particle angular
  drift means nothing is ever momentarily static), so space stays populated as the
  engine's stars take over; the live disk is revealed slightly earlier over a
  gentler 0.45 s fade so it overlaps the expanding splash rings; the heavy raymarch
  WGSL is `compileAsync`-compiled under the splash. **[open]** ring-orientation
  match at the cut (splash rings head-on vs the disk's near-edge-on band).
- **[done · v0.17] Mobile first-paint + overlap.** Splash animations start on the
  first painted frame (`--go`), fixing "the splash doesn't play on mobile"; the
  warm gas/dust ring forms early and holds to bridge to the real disk.
- **[done · v0.16] Warm, neon, shorter.** Orbs → warm white-gold + amber (no
  pink/blue); neon moved into the hue-shifted shock rings + new streaks; merger
  compressed to ~0.6 s; dust spirals from the first frame; Replay shows the splash
  instantly (no fade-in over the old scene). See the CHANGELOG.
- **[done · v0.15] Instant load splash + fast ignition.** A JS-free CSS splash
  (bodies spiralling in → forming hole) paints before the shader compiles and
  crossfades out on the first real frame; the disk now ignites by ~0.6 s so the
  handoff lands on a lit hole.
- **[done · v0.13] More early company.** Default scene seeded with 3 stars + 3
  planets (was 2 + 2) and the entrance pulled earlier (stars in by ~1.3 s,
  planets start ~1.3 s) — addressing "the first body only appears ~0:05–0:06."
- **[open] Sparkles earlier.** The inner-edge counter-clockwise sparkle reads
  late (≈0:21 in the v0.12 recording — really a steady-state effect). To pull it
  into the intro window: a steeper early `formationCurve` (disk bright sooner), a
  brief intro boost to `rotationSpeed`, and/or a closer camera arrival so the
  inner edge is legible earlier. **Wants a video pass to dial in.**
- **[open] Distance vs. visibility.** Bodies *appear* early but stay small/far
  until the camera arrives (~5 s). Lowering `FAR_FACTOR` or reshaping the dolly
  ease would surface them sooner without changing the choreography.

## How to grab frames for tuning

The Portka Tools `video-bug-analyzer` plugin does this; the same effect by hand:

```bash
# overview contact sheet (1 fps, timestamped)
ffmpeg -i intro.mov -vf "fps=1,scale=210:-1,drawtext=text='%{eif\:t\:d}s':x=4:y=4:fontcolor=yellow,tile=6x5" -frames:v 1 overview.png
# zoom the centre during a moment of interest
ffmpeg -ss 20 -t 3 -i intro.mov -vf "crop=320:320:(iw-320)/2:(ih-320)/2,fps=3,scale=300:-1,tile=3x3" -frames:v 1 detail.png
```
