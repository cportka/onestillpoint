# Handoff — current state for the next session

A short, living "you are here" for whoever picks this up next. Pairs with the durable docs:
[`CLAUDE.md`](../.claude/CLAUDE.md) (how we work), [`CHANGELOG.md`](../CHANGELOG.md) (what happened),
[`future-improvements.md`](future-improvements.md) (what's next). **Update this when you finish a
session.**

_As of v0.39.4 (2026-06)._

## Where things stand

- **Recently shipped — the cold reveal got measured *and* masked (this session).** Roadmap #1's
  splash→engine reveal is now **instrumented**: `osp.perf` exposes the real timings — span durations
  (`rendererInit` / `compile` / `bootToLoop` / `loopToReveal`), the **unclamped** inter-frame interval
  over the first 120 live frames (mean / p50 / p95 / max / jank), and the reveal-window scaler-resize
  count — because the headless CI GPU can't render or capture the canvas, so these numbers only exist
  on a real device (v0.39.3, `src/core/RevealProfiler.ts`). On top of that, two **haze-masked masking
  wins** shipped (v0.39.4): a **dust-march ramp** (`revealVolumeStep` in `quality.ts` — a coarser
  `volumeStep` at the reveal, easing back on the same `fuzz` clock as the haze, the march-space
  companion to the screen-space `introScale` cut) and a **pre-warm fix** that primes the *lit* disk
  under the splash (the covered renders were warming a *dark* disk at `formation = 0`, so the first
  lit-volume draw was landing on the first visible frame). Earlier: history-bar refinements
  (v0.38.0 / v0.39.0), Share live-clip fallback (v0.39.1), OffscreenCanvas step 2 (v0.37.0).
- **The one active problem** is still roadmap **#1 — the cold first-load reveal** on a cold pipeline.
  The dial-tuning is now broad (resolution cut + dust ramp + warm haze, all converging on one clock)
  **but still unmeasured on the target device.** The immediate next step is concrete: **capture
  `osp.perf.report()` on the real Mac + a phone after a cold load** (open the console; the loop also
  logs it once the 120-frame window fills) and let the numbers decide the next lever — if the residual
  hitch is **compile / pipeline-bound**, push the pre-warm / OffscreenCanvas direction; if it's
  **ALU-bound**, push the dust ramp (`REVEAL_VOLUME_STEP_BOOST`) harder or add a true raymarch step
  budget. The real, permanent fix remains finishing the OffscreenCanvas migration.
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
