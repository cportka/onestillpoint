# Recording findings — v0.14.5 session

Analysis of the v0.14.5 recording (`OneStillPointAppIntroV0.14.5`, 640×384,
31 s) for the report "adding sometimes makes the body count drop quickly, with no
visible disappearance." The good news first: the **v0.14.4 black-screen blackout
is gone** — the render stays healthy the whole clip.

## The "adding drops the count" bug — root cause (fixed in v0.14.6)

Frame analysis alone couldn't crack this one: the symptom is a one-digit change in
a small panel readout, and the bodies that leave do so **off-screen**, so there is
nothing to see in the pixels. So it was reproduced **headlessly** — driving the
real `add → step → prune` loop in a throwaway harness and classifying every body
that left (escape / merge / non-finite).

Two real defects, both on the **GPU physics path (the default on WebGPU)**:

1. **Velocities were never read back.** `GPUPhysicsEngine.applyReadback` copied
   only **positions** from the GPU to the CPU bodies; `body.velocity` kept its
   *original launch value* forever. Every add/remove calls `setBodies` →
   `buildInitialState`, which re-seeds the GPU from the CPU bodies — i.e. from the
   **current position but the stale launch velocity**. So each add quietly kicked
   *every* body onto a wrong orbit; some then escaped (off-screen → count drops,
   no animation) or fell in. **Fix:** read velocities back too, each frame.

2. **Readback ↔ rebuild race.** `setBodies` disposes the kernels mid-flight while
   a readback is still awaiting, so stale/short data (or a rejected read) could be
   copied into the new, larger body array → a NaN position → pruned by the v0.14.5
   guard → an instant count drop on add. **Fix:** capture the kernels, discard the
   result if they changed during the await, validate length + finiteness, and
   swallow a disposed-buffer rejection.

Also added **adaptive substeps** (cap each integration substep's `dt`) to both
engines, so very high Speed can't let a single step blow a close encounter up.

## Real physics, not a bug: crowded multi-hole ejection

A crammed system — say 5 stars + 5 planets + 3 black holes in the r≈22–49 band —
**genuinely ejects bodies** via gravitational slingshots. Verified: a near-perfect
integrator (dt ≤ 0.08) still ejected ~188/15 trials at high Speed vs ~206 with the
default step, so it is the dynamics, not the integrator. High Speed just
fast-forwards through that chaotic future. A *realistic* Speed-×1 session (a few
bodies + one hole) is stable (≈4 escapes / 20 trials). Take-away: keep added holes
modest and well-separated; the losses you *do* see are mostly physical, and inward
ones now animate (the plunge/absorption).

## Notes carried forward

- **Visualising outward exits.** Inward merges animate; an *escape* flies past the
  camera and is pruned far off-screen, so there is nothing left to animate by the
  time it leaves the count. If desired, a brief "receding streak / fade" as a body
  crosses the camera shell would give escapes a sendoff too.
- **Camera/gravity wobble** (from v0.14.4 notes) still stands as a fun opt-in
  feature: a small damped camera sway driven by the local N-body acceleration.
