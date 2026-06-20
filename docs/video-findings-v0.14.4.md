# Recording findings — v0.14.4 session (≈70 s)

Analysis of the v0.14.4 screen recording (`OneStillPointAppIntroV0.14.4`, 640×564,
69.6 s), grabbed with the Portka Tools `video-bug-analyzer` workflow (ffmpeg
contact sheets + `blackdetect` + a per-frame luminance trace over the render
region with the control panel cropped out).

## 1. The all-black-screen bug (confirmed, root-caused, fixed in v0.14.5)

**Signature.** The render is healthy (luminance mean ≈ 177, peak 255 — a bright,
zoomed-in disk + photon ring) through **53.8 s**, then drops to mean ≈ 2 at
**54.0 s** and stays there for the remaining ~15 s. Only the lil-gui panel (a DOM
overlay, not the canvas) survives — even the photon ring vanishes. `blackdetect`
at 85–95% missed it precisely *because* the panel keeps ~3% of pixels lit; the
blackout is in the WebGL/WebGPU canvas. The transition is **instant and never
recovers**.

**State at the failure (panel OCR, frame 53.8 s):** Filter Physical · Background
Stars · **Speed ×1** · **Stars 4, Planets 1, Black holes 1** · camera zoomed in
tight on the shadow · cursor on the **Black holes +** button.

**Root cause.** A permanent, whole-frame blackout (ring included) at *normal*
speed is the signature of a **non-finite (NaN/Inf) body position poisoning the
shared uniforms**. With a black hole present, `lensingActive = 1`, so every ray
adds the secondary-deflection term `secAccel += d · lensMass · −2 / |d|³` for each
slot; one NaN slot position makes `secAccel` NaN → the geodesic integrates to NaN
→ radiance NaN → the whole image reads black (the ring too). `sceneRadius` is
likewise `Math.max(…, NaN) = NaN`. It is **permanent** because `prune` only freed
bodies at `r ≥ 300`, and `NaN ≥ 300` is `false`, so the poisoned body is never
removed. A close-encounter integration blow-up (most likely amid the crowded,
repeatedly add/removed scene) is the trigger.

**Fix (v0.14.5).** Defensive guards so a non-finite body can never reach the
shader: `updateBodyUniforms` treats a non-finite slot as empty for the frame, and
`prune` drops any body whose position is non-finite. Net: no blackout regardless
of the trigger, and the bad body is cleaned up next frame.

**Follow-up (not yet done).** Harden the integrator itself against the blow-up —
e.g. clamp per-substep displacement, or sub-divide a step when two bodies are
within a few softening lengths — so bodies aren't silently lost in the first
place. Worth a dedicated pass.

## 2. Collision / absorption animation — observations & next steps

Before the blackout the recording shows lots of healthy add/remove + merge
activity. The v0.14.4 absorption fade (shrink + redshift in place) reads well but
is brief. Building on the v0.14.5 **plunge-on-remove** (a removed body now
accelerates into the centre over ~1.5 s, absorbing over its inner half):

- **Tidal stretch (spaghettification).** Elongate the body radially as it nears
  the hole (scale up along the radius, down across it) before it shrinks — the
  single most "scientifically beautiful" upgrade.
- **Disk-crossing flash.** When a companion punches through the accretion-disk
  plane, pulse a local brightening / ripple at the crossing point.
- **Merge ring.** A faint expanding ring or brightness bump in the inner disk at
  the moment of absorption (a stand-in for the energy deposited).
- **Lensing-aware trail.** The plunge already lenses for free (it's raymarched in
  curved space); a short emissive trail would sell the in-fall.

## 3. Camera ↔ gravity "wobble" (note for a future feature)

The user zooms in/out (OrbitControls) and notices a slight **camera wobble that
tracks the gravity** — and likes it. Worth recording precisely: the camera is
**purely an input device** (`CameraRig` = OrbitControls + damping); it has **no
physics coupling**. The wobble is *emergent gravitational lensing* — as massive
companions (the holes especially) drift across the sightline, the lensed
background and disk visibly swim, which reads as camera sway.

**Potential feature (opt-in).** Make it intentional and tunable: sample the same
N-body acceleration at the camera position and feed a small, damped offset into
the camera target (or position) — a "felt gravity" sway, strongest when a massive
body passes near the line of sight. Scientifically motivated (tidal / frame
sway), and a natural Quality/Animation slider. Flagged as *adjustable*, per the
request — not built yet.
