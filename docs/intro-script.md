# The intro — visual script

A living storyboard of the formation intro, so we can tune timing deliberately.
The intro is driven by `src/core/FormationSequence.ts` (camera dolly + the
`formation` ignition factor), `src/render/tsl/raymarch.ts` (the dust fades in
with `u.formation`), and the per-body `appearFor` curve in
`src/render/bodyUniforms.ts` (the staggered swoosh).

**Defaults today:** duration **6.5 s** (2.6 s under reduced motion), camera
dollies from **2.6× the home distance → home** on an ease-out-cubic, the disk
ignites on a slow-build-then-bloom curve, and the default scene seeds **3 stars
(prograde, outer) + 3 planets (retrograde, inner)**.

## Timeline (progress = elapsed / duration)

| time (≈) | progress | what you see |
| --- | --- | --- |
| 0.0 s | 0.00 | Black void over the chosen background. Camera far back; the disk is unignited (`formation ≈ 0`). |
| 0.0–1.3 s | 0.00–0.20 | Camera rushes inward (fast early). The **outer stars fade + swoosh** in (prograde). The lensed starfield begins to streak. |
| 1.3–3.4 s | 0.20–0.52 | The **inner planets fade + swoosh the opposite way** (retrograde) — the two-direction choreography. |
| 2–5 s | 0.30–0.80 | The **disk ignites**: dust density/brightness rise, condensing into a glowing disk; the hot inner edge sharpens and the photon ring forms. |
| 5–6.5 s | 0.80–1.00 | Camera **eases to rest** at home; the disk is fully formed; the inner edge **sparkles** (Doppler-beamed turbulence rotating counter-clockwise). Control hands back to the user. |

## Tuning log & targets

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
