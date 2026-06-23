# The intro — visual description (reality)

The companion to [`intro-script.md`](./intro-script.md): that file is the *ideal*
we're aiming for, this one is the *reality* — what the load intro actually looks
like in a given build, transcribed from a screen recording. Re-generate it
whenever the intro changes substantially, and always record the version.

> **Generated from:** `v0.16.5` desktop recording (MacBook **Firefox**, 1920×1148)
> + an iOS **Safari** recording (1170×2532), default scene / **Stars** / **Physical**.
> Analysed with the Portka `video-bug-analysis` workflow (contact sheets).

## What actually happens — the moment of creation (~0–0.18 s)

0. **A full-screen burst** (beat 0, v0.19.0): a white-hot flash, neon beams
   sweeping to the edges, and reverberating white → cyan → pink shock rings. It's a
   separate, deliberately cheap pure-CSS mechanism (no canvas) so it's instant and
   identical on every device, and it overlaps the splash from ~0.1 s.

## What actually happens — the splash (~0.1–0.75 s)

1. **Two warm orbs** (a white-gold + an amber twin) twirl together in an
   accelerating inspiral, surrounded by **warm dust** already spiralling inward and
   a few brighter bodies falling in. The colourway reads warm and elegant — no
   pink/blue.
2. **Merger (~0.3 s).** A warm flash; the dark **event horizon** appears; **neon
   streaks** fire radially from behind it and **reverberating neon rings** expand,
   their hue shifting through the spectrum. A **warm accretion ring** sits around
   the hole.
3. **Settle + crossfade (~0.5–0.7 s).** The rings reverberate outward and fade as
   the warm ring holds; the splash **crossfades** into the live scene, the splash's
   warm hole lining up with the real one.

## What actually happens — the formation (~0.7–7 s)

4. **The dolly (~1–4 s).** The camera slides inward — quick at first, then easing.
   The background stars **stretch into curved arcs** sweeping around the centre.
5. **Company arrives (~2–4 s).** A handful of **warm-orange and cool-blue points**
   (prograde outer stars) fade up and slide across; the dimmer inner planets follow,
   drifting the *other* way.
6. **Ignition.** A faint glow swells into a **bright white-grey accretion disk**
   wrapped around the dark shadow; the **photon ring** sharpens at the rim.
7. **Rest (~6.5 s onward).** The camera settles just above the disk plane. Control
   returns to the user.

## Honest notes (reality vs. the script's ideal)

- **Mobile: the splash was skipped (fixed in v0.17).** In the iOS Safari recording
  the page went from the URL bar **straight to the formed hole** — no orbs, no
  merger. Cause: the CSS animations ran on a timeline from *parse*, but mobile
  Safari defers the first paint past the (now ~0.6 s) splash, so it elapsed unseen.
  Fixed by starting the choreography on the first painted frame (`--go`) and holding
  the crossfade `MIN_SPLASH_MS` past it. Desktop Firefox already played it in full.
- **Black void at the cut (fixed in v0.17.1).** An untrimmed recording showed the
  splash rings expand away and the dust vanish, leaving the hole on **empty black**
  for ~0.2 s before the engine's stars faded in. Fixed: the dust now drifts and
  fades *through* the crossfade, and the live (pre-warmed) disk + stars are revealed
  a touch earlier under a gentler fade, so the field stays populated.
- **Fresh-load stutter.** The fresh load dropped frames while the WebGPU shader
  compiled (~24 fps avg vs 60). v0.17.1 `compileAsync`-compiles the raymarch WGSL
  under the splash; worth a fresh recording to confirm the dip is gone (see
  [`future-improvements.md`](./future-improvements.md)).
- **The gas/dust ring forms earlier** (v0.17) and holds, so the splash ends on a
  warm hole-plus-ring that rhymes with the engine's igniting disk at the crossfade.
- The disk still reads **near-white** (15000 K + bloom washes the colour out);
  bodies stay small until the camera arrives (~5 s); the inner-edge sparkle is a
  late, steady-state effect. (Open targets in the script.)
