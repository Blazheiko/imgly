---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-06"
feature_size: "M"
ticket: "roadmap step 4 — crop-rotate"
---

# 0004 — Check for transparency inside the Crop on the GPU with the export shader

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth, accepted assumption)

## Context

The export panel shows a hint that transparent areas become white when JPEG is chosen (export AC-15). Today it reads `original.hasTransparency`, a flag the decode worker sets once per open. With a Geometry, the hint must appear only when a pixel inside the Crop is not fully opaque (AC-14): cropping away the only transparent corner must remove the hint. With a Straighten angle, the pixels inside the Crop are bilinear samples (ADR-0002), so the honest answer is what the Export will actually produce.

## Decision drivers

- spec AC-14: the transparency hint only when a pixel inside the Crop is not fully opaque
- spec §6: opaque images stay 100% opaque after any Straighten angle
- spec §6: memory after 50 applied Geometry changes ≤ 110% of memory after the first Apply
- sad.md §1 quality goal 1; export ADR-0002 (the export worker renders with the Preview's shader)

## Considered options

1. **GPU check in the export worker, on demand, cached per revision** — the export feature asks the worker to render the Work's alpha at full size with the shared shader and report whether any pixel is below fully opaque.
2. **CPU check in a worker on every Apply** — the crop-rotate feature draws the Crop's source region with Canvas 2D (`drawImage` with the Geometry's transform) and scans the alpha bytes after each Apply.

## Decision outcome

**Chosen:** Option 1. It judges exactly the pixels the Export will hold, with the same shader and filters, so the hint never disagrees with the file. It runs only when it can matter: when the Original has a transparent pixel and the Work's Geometry is not the identity. Otherwise the answer is the Original's flag. It runs when the export panel needs it, not on every Apply. Option 2 samples tilted edges with Canvas 2D's own filtering, which can differ from WebGL's at exactly the pixels the hint is about. It would also run on every Apply, even when no one opens the panel.

How it works:

- `src/render/export/`: the worker message union gains `{ kind: 'alpha', request: { bitmap, geometry } }`. The handler renders at `workSize` with the export path, reads the alpha channel back and answers `Result<boolean>`. The window fallback (export ADR-0003) runs the same code. The bitmap copy is closed in every branch, as for an export.
- `src/features/export/store.ts`: `transparencyHint` uses `original.hasTransparency` when it is false or the Geometry is the identity. Otherwise it uses the check's result, cached by `(work id, revision)` (amended below: now `(work id, Geometry)`). While the check runs, the hint stays hidden. If the check fails, the hint is shown, because showing it is the safe side.

**Amended by adjust (2026-10-09, review R3):** the cache key is `(work id, Geometry)`, not
`(work id, revision)`. Adjustments raise the revision but never change alpha (adjust AC-06), so
keying on the revision re-ran the GPU check after every Apply of Adjustments. A new Work gets a new
id and a Geometry change gets a new key, so the answer can't go stale.

## Consequences

**Positive**
- The hint is exact for every Rotation, Flip, Crop and Straighten angle, including AC-14's "cropped the transparent area away".
- An opaque Original never pays anything; most photos are opaque.

**Negative**
- For a transparent Original with a Geometry, opening the panel with JPEG selected shows the hint a moment late, after a full-size render (tens of milliseconds on the reference machine).
- The readback briefly holds a full-size pixel buffer in the worker (up to about 64 MB), released when the worker ends.

**Neutral**
- An occlusion query (a GPU counter of the pixels that pass a test), with the fragment shader discarding opaque pixels, could replace the readback later without changing the message. That is a tactical choice for `tasks`.

## Links

- Spec: [[../spec.md]] AC-14, §6; export spec AC-15
- SAD: [[../sad.md]] §4 (choice 4), §5, §8
- Related ADR: [[0002-render-the-geometry-in-the-shared-shader-in-one-pass]]; export ADR-0002, ADR-0003
