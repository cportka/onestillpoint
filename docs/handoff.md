# Handoff — current state for the next session

A short, living "you are here" for whoever picks this up next. Pairs with the durable docs:
[`CLAUDE.md`](../.claude/CLAUDE.md) (how we work), [`CHANGELOG.md`](../CHANGELOG.md) (what happened),
[`future-improvements.md`](future-improvements.md) (what's next). **Update this when you finish a
session.**

_As of v0.41.1 (2026-07)._

## Where things stand

- **Roadmap #1 got its first real measurement — and the measured stalls are fixed.** A Firefox/Mac
  cold-load recording + `osp.perf` were analyzed frame-by-frame (Portka `video-bug-analyzer`) — the
  full evidence, options weighed, and verdict live in
  [`perf-recording-2026-07-01.md`](perf-recording-2026-07-01.md). Headline: the pre-warm works (532ms
  compile fully covered), the splash plays smoothly, but the reveal froze ~800ms on **two main-thread
  JS stalls** — the control panel mounting mid-reveal and a dismiss-moment scaler resize — both fixed
  in **v0.40.3** (panel mounts at formation-settle; scaler ceiling pinned while covered). Also found:
  Firefox's macOS WebGPU paces at ~26ms (~38fps) — an upstream ceiling app dials can't raise; a
  Chrome comparison run on the same Mac is the next measurement.
- **The feel pass shipped (v0.41.0).** The − plunge no longer spin-kicks — it winds from the body's
  own captured rate (retrograde stays retrograde) and quickens Kepler-style as it falls; + adds now
  prefer the widest open orbital gap (stable orbits); the torn-stream is brighter/wispier
  (`STREAM_EMIT 0.17` / `STREAM_EXT 0.21`) — **all three tuned blind, verify on the next recording.**
- **The two-scripts policy is now standing** — [`physical-script.md`](physical-script.md) (the
  reality: what's honest physics vs phenomenological vs theatre) rides alongside the art-directed
  [`intro-script.md`](intro-script.md), and codifies the **reversibility covenant**: irreversible
  physics is allowed **during the intro window only**; the settled sim stays bit-exact reversible
  (Step-back / DVR). This unlocks #6's inspiral as an intro set piece or user-staged event.
- **The committed path for #1**: if the post-v0.40.3 recording still shows discrete stalls — or as
  the 1.0 gate regardless — **finish the OffscreenCanvas worker migration (option B, steps 3–6)**;
  the user has signed off on that commitment. "A little more masking" (option C) is authorized only
  if the next recording shows GPU-bound strain (moving-but-slow), not stalls.
- **Earlier this arc:** `osp.perf` instrumentation (v0.39.3), dust-ramp + lit-disk pre-warm masking
  (v0.39.4), intro timing (v0.39.6), #7 precession (v0.40.0), #6 mass-scaled ripple (v0.40.1).
- **The big in-flight project** is the **OffscreenCanvas + Worker render path** — see
  [`offscreen-canvas.md`](offscreen-canvas.md). Steps 1–2 done; **next is step 3 (input + resize to
  the worker)**, then Controls/HUD/timeline (4), Share/clip worker-side (5), and the flip (6).

## ⚠️ Open caveats — read before touching these

- **Share (v0.39.1) needs a real-device check.** This remote environment's headless GPU (swiftshader)
  **cannot read the WebGPU canvas by any method** — `drawImage` *and* `captureStream` both deliver
  zero frames — so neither the original PNG bug nor the new `captureStream` fallback could be
  exercised in CI (only the fallback mechanism over a 2D canvas, which works). On the actual Mac + a
  phone, confirm Share produces a **clip**, not a PNG. If it still falls back, open the console and
  read **`osp.clip.status`** (exposed for exactly this) — it says why (no encoder / no avcC / no
  frames). Files: `src/ui/recordClip.ts`, `src/ui/clipRecorder.ts`, `src/main.ts` (`captureShare`).
- **Roadmap #1 is now about the *first compile*, not the cadence.** Don't re-chase the periodic
  stutter (fixed). A fresh screen capture should target the **first reveal only** — and now there are
  **numbers** to pair with it: read `osp.perf.report()` (v0.39.3) on the target device.
- **The reveal masking wins (v0.39.4) want a real-device feel-check.** The dust-march ramp
  (`REVEAL_VOLUME_STEP_BOOST = 0.6` in `quality.ts`) and the pre-warm lit-disk prime are masked by the
  warm haze and revert to steady state at `fuzz = 0`, so they're low-risk — but their *benefit* (and
  whether `+60 %` is the right coarsening) can only be felt on real hardware. Confirm the reveal still
  reads clean (no visible dust banding under the haze) on the Mac + a phone, and tune the one dial
  from the `osp.perf` before/after on the same device.

## Blocked / out of session scope

- **Update Portka Tools to 1.2.0 / clone `cportka/claude-plugins`.** The marketplace repo
  `cportka/claude-plugins` is **outside this session's authorized scope** — the git proxy 403s it, the
  GitHub MCP is scoped to `cportka/onestillpoint` only, and the `list_repos` / `add_repo` tools aren't
  present this session, so scope can't be widened from inside. Fix is environment-side: add
  `cportka/claude-plugins` to the session's repo scope (Claude Code web/app), then it clones normally.

## How we work here (the essentials)

- **Portka SOP** (from `CLAUDE.md`): for every change — sync `main`, branch, update tests + keep CI
  green, open a PR, **merge on green**, hand back a short PR link. Never commit to `main` directly.
- **SemVer triplet, enforced.** `package.json` `version` ↔ `src/version.ts` `VERSION` ↔ a
  `**MAJOR.MINOR.PATCH**` `CHANGELOG.md` entry must agree — `src/version.test.ts` fails the build
  otherwise. Bump every change (MAJOR breaking / MINOR feature / PATCH fix+docs).
- **CI.** `ci.yml` (`check`: lint · typecheck · test) runs on every PR. `validate-physics.yml`
  (`validate`: the geodesic/disk/orbit/lensing maths) runs **only** when `src/physics/**`,
  `src/render/tsl/**`, `src/scene/**`, or `scripts/validate-*.mjs` change — so UI/docs PRs skip it.
- **Verifying in a real browser (headless).** Playwright + the pre-installed Chromium can boot the
  app; `window.osp` exposes `{ renderer, scene, physics, history, timeline, events, clip, … }` for
  inspection (the sim runs even though the headless render is black). Caveat above: the WebGPU canvas
  isn't *capturable* here. Verify scripts live in `scripts/` (`verify:intro`, `capture:*`).

## Map of the docs

- [`CLAUDE.md`](../.claude/CLAUDE.md) — standing workflow + versioning conventions.
- [`future-improvements.md`](future-improvements.md) — the roadmap to 1.0.0 (top = next).
- [`offscreen-canvas.md`](offscreen-canvas.md) — the in-flight worker migration (scope + 6-step plan).
- [`intro-script.md`](intro-script.md) — the load-intro beats + tuning log.
- [`perf-frame-rate.md`](perf-frame-rate.md) · [`archive.md`](archive.md) — perf notes + shipped history.
