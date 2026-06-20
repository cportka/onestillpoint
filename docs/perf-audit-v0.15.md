# Performance audit — v0.15

A smoothness/framerate pass. The codebase was already reasonably tuned (adaptive
resolution, DPR cap, gated shader branches), so the wins are targeted.

## Changes made

1. **N-body sim defaults to the CPU again (headline).** The GPU compute path was
   auto-enabled on WebGPU, but for this app's body counts (≤14) it is *pure
   overhead*: `GPUPhysicsEngine.applyReadback` calls `getArrayBufferAsync` to pull
   positions **and** velocities back every frame, which forces a CPU↔GPU
   synchronisation and stalls the render pipeline (the velocity read-back, added
   in v0.14.6 for correctness, doubled it). The exact CPU velocity-Verlet is
   ~800 floating-point ops/frame for 14 bodies — far cheaper than one buffer map,
   and it keeps `body.velocity` current natively. It also removes a per-*add*
   hitch (the GPU path disposed + rebuilt all storage buffers on every add). The
   GPU kernel stays a one-click *Advanced → GPU physics* option: the scaling
   foundation for many bodies, not a win for a handful.

2. **Removed a per-frame allocation.** `updateBodyUniforms` (run every frame) used
   the `scene.companions` getter, which `.filter()`s a fresh array each call. It
   now iterates `scene.bodies` directly and skips the fixed primary — same slot
   order, zero allocation.

3. **GPU read-back temp reuse.** The two `Vector3` temps in `applyReadback` are
   now reused class fields rather than allocated per frame (matters only on the
   opt-in GPU path).

(Adaptive substeps — bounding each integration step's `dt` — already shipped in
v0.14.6 and also help smoothness at very high Speed.)

## Verified clean (no change needed)

- `updateBodyUniforms` writes into pre-allocated uniform vectors (`.set` / `.copy`).
- `CameraRig.publish`, `ResolutionScaler.update`, `FormationSequence.update` —
  math only, no per-frame allocation.
- `Scene.prune` runs every frame but the `gone` predicate only double-evaluates on
  the rare frames a body is actually freed (the `.some` short-circuits and returns
  before the `.filter` otherwise) — no per-frame waste.
- `TimeController.tick` allocates one small result object/frame — negligible.
- `hud.update` rebuilds its string only every ~0.5 s, not every frame.
- No leaks: GPU buffers are disposed before each rebuild; with the CPU default no
  physics storage buffers are allocated at all; Three.js resources are created
  once.

## Levers left alone (look-sensitive — tune deliberately, ideally against a recording)

- **Bloom** (`PostPipeline`): `radius 0.85, threshold 0.0` — the second-biggest GPU
  cost after the raymarch. Raising the **threshold** (only bright areas bloom)
  would both cut work *and* reduce highlight wash — a future look+perf win, but a
  visible change, so not done here.
- **Raymarch** (`raymarch.ts`): `MAX_STEPS = 512` and the `volSamples ≤ 64` cap are
  worst-case bounds (most rays exit far earlier via the capture/escape/
  transmittance early-outs). Lowering them risks photon-ring / disk-banding
  artifacts; left as-is.
