# Frame-rate evaluation — a 24 fps "cinematic" target

*Prompted by: "would a lower target FPS of 24 give more flexibility and smoothness
while keeping a cinema feel?" Short answer: **the headroom benefit is real and
worth shipping as an option; a hard 24 fps cap is a lovely look but not a safe
default** — on the 60 Hz displays most people have, 24 can't be both exactly-24
and judder-free. Details below.*

## How the frame rate works today

The render loop runs on `requestAnimationFrame` — i.e. at the **display refresh**
(60 Hz, or 120 Hz on many phones/laptops). It does **not** cap the rate. Instead,
**auto-resolution** (`ResolutionScaler`, `targetFps` default 50) trades *sharpness*
for *smoothness*: if frames run slower than the target it lowers the
drawing-buffer scale; with headroom it raises it. So "Target FPS" today means
"the rate auto-resolution fights to hold", not a cap.

There are therefore **two independent levers**, and the request touches both:

1. **Lower the auto-resolution target** (e.g. 50 → 24). Effect: the scaler almost
   never downscales, so the image stays **full resolution / sharp**; motion still
   runs at the display rate (no cap, no judder). This is "more flexibility" — the
   app stops sacrificing pixels to chase 50 fps.
2. **Hard-cap the render rate** (e.g. to 24). Effect: the **cinematic feel** —
   plus a big budget bonus (16 ms → 41 ms per frame) that lets the GPU hold full
   resolution and run cooler. This is where the nuance lives.

## The catch with a hard cap: refresh divisors & judder

You can only *skip* whole animation frames, so a cap locks the achieved rate to a
**divisor of the refresh**. 24 is not a divisor of 60:

| display | clean caps (even pacing) | a "24" request becomes |
| ------- | ------------------------ | ---------------------- |
| **60 Hz** | 60 · 30 · 20 · 15 | ~20 fps (every 3rd frame, smooth) **or** 24 with 2-3-2-3 *telecine judder* |
| **120 Hz** | 120 · 60 · 40 · 30 · **24** · 20 | exactly 24 fps, evenly paced ✓ |

So on a 120 Hz screen, "24" is perfect. On a 60 Hz screen, you must choose between
**smooth-but-20** and **exactly-24-but-juddery**. Our cap takes the smooth path
(locks to the nearest divisor), so "24" reads as ~20 fps on 60 Hz — calm and even,
just not literally 24. **30 fps is the sweet spot on 60 Hz**: an exact half,
perfectly paced, half the GPU work.

## Costs of a low cap (be honest)

- **Interaction latency.** Orbit-drag / pinch-zoom feel less responsive at 24–30
  fps than at 60. For this app that's mild — the camera mostly drifts slowly — but
  it's real.
- **Splash/creation mismatch.** The CSS intro beats run at the display rate
  (they're not in the render loop), so capping only affects the live scene.
- **Not "smoother" on a strong device.** 60 fps *is* smoother motion than 30. The
  cap's win is **consistency** (a weak device pinned at a steady 24/30 beats a
  variable 35–55) and **headroom** (full resolution), not raw smoothness.

## Why it nonetheless suits *this* app

One Still Point is a slow, meditative thing — orbits, drifting dust, a gentle
camera. Fast motion (where low-fps judder bites) is rare, and a calmer cadence fits
the mood. A cinematic 24/30 with full resolution and a cool, quiet GPU is a genuine
aesthetic option here in a way it wouldn't be for a twitchy game.

## What shipped (v0.19.1) & the recommendation

- **Target FPS** slider now goes down to **24** (was 30). Lowered *without* the cap
  → keeps the image sharp at the display rate (lever 1).
- **Cap frame rate** toggle (Advanced → Quality) → a hard cinematic cap at the
  Target FPS, locking to the nearest refresh divisor for even pacing (lever 2).
- Both persist. **Default: off** (display rate, Target 50) — no regression.

**Recommendation:** leave the default uncapped; offer the cap. For a cinematic
feel, **30 fps** is the safe, smooth choice on 60 Hz; **24** is gorgeous on 120 Hz
(and fine on 60 Hz if you accept ~20 fps). If you just want a sharper, calmer image
without touching motion, **lower Target FPS (uncapped) to ~30–36**. A future
refinement worth considering: auto-pick the cap from `screen`'s refresh (24 on
120 Hz, 30 on 60 Hz).
