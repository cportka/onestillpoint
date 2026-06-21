# The intro — visual script

A living storyboard of the formation intro, so we can tune timing deliberately.
The intro is driven by `src/core/FormationSequence.ts` (camera dolly + the
`formation` ignition factor), `src/render/tsl/raymarch.ts` (the dust fades in
with `u.formation`), and the per-body `appearFor` curve in
`src/render/bodyUniforms.ts` (the staggered swoosh).

**Defaults today:** a **load splash** (≈0–0.5 s, JS-free CSS — see below) hands
off to the WebGPU formation, whose duration is **6.5 s** (2.6 s under reduced
motion): camera dollies from **2.6× the home distance → home** on an
ease-out-cubic, the disk now **ignites fast** (formed by ~0.6 s, over the first
~10% — `formationCurve`) and then holds with a gentle late bloom while the camera
settles, and the default scene seeds **3 stars (prograde, outer) + 3 planets
(retrograde, inner)**.

## The opening half-second (Phase 15)

Goal: *something beautiful on screen instantly*, before the heavy raymarch shader
compiles, smoothly blending into the real scene.

| time (≈) | what you see | how |
| --- | --- | --- |
| 0–~0.4 s | **Two big orbs** (a cool + a warm twin) **twirl together** — an accelerating inspiral — while a cluster (a few much-bigger bodies + small) and ~130 dust **spiral inward**. Colourful. | Static `#osp-splash` markup (orbs/shock/plume/jet/flash/core) + a tiny **inline script** that generates the cluster + dust synchronously, so it all paints on first paint; **no module bundle / no GPU**, so it can't be late. |
| ~0.4–0.5 s | **Merger**: a white-cyan **flash**, a tilted **jet**, and **colour plumes** burst from the centre. | `.osp-splash__flash` / `__jet` / `__plume`, transform/opacity-only. |
| ~0.45–0.9 s | **Reverberating shock rings** (magenta · orange · cyan · pink, staggered, tilted) expand outward, and the dark **event horizon** then **grows back outward** (overshoot → settle) to the final circle + a cool photon ring (`--core-d ≈ 28vmin`, to match the real shadow). | `.osp-splash__shock` (staggered `--sd`/`--rc`) + `.osp-splash__core` (grows late). |
| ~0.8 s+ | **Crossfade** to the live scene — the hole is lit (fast `formationCurve`) — then the **usual script** (camera dolly + settle) plays out. | 0.45 s opacity crossfade; the formation continues to `t = 1`. |

*"Go crazy with colour" lives here (the rest of the app stays tasteful). Fuzzy by
design — dial against a recording. Levers: orb twirl/timing and shock-ring colours
(`index.html` + `style.css`), `--core-d` (final circle size), the splash min time
(`main.ts`, 820 ms) and crossfade (0.45 s); ignition speed (`t/0.1`) and
`FAR_FACTOR` for how "formed"/close the hole is at the handoff.*

## Timeline — the settle (progress = elapsed / duration)

| time (≈) | progress | what you see |
| --- | --- | --- |
| 0.0 s | 0.00 | (Under the splash.) Camera far back; ignition beginning. |
| 0.0–0.6 s | 0.00–0.10 | The **disk ignites** to formed (masked by / blending with the splash); the photon ring forms. |
| 0.0–1.3 s | 0.00–0.20 | Camera rushes inward (fast early). The **outer stars fade + swoosh** in (prograde). The lensed starfield begins to streak. |
| 1.3–3.4 s | 0.20–0.52 | The **inner planets fade + swoosh the opposite way** (retrograde) — the two-direction choreography. |
| 5–6.5 s | 0.80–1.00 | Camera **eases to rest** at home; the disk is fully formed; the inner edge **sparkles** (Doppler-beamed turbulence). Control hands back to the user. |

## Tuning log & targets

- **[new · v0.15] Instant load splash + fast ignition.** A JS-free CSS splash
  (bodies spiralling in → forming hole) paints before the shader compiles and
  crossfades out on the first real frame; the disk now ignites by ~0.6 s so the
  handoff lands on a lit hole. **Wants a video pass** to tune the blend (splash
  duration, crossfade, ignition speed, FAR_FACTOR).
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
