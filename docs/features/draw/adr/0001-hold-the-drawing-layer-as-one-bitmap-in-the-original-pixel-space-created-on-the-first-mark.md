---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-09"
feature_size: "M"
ticket: "roadmap step 6 — draw"
---

# 0001 — Hold the Drawing layer as one bitmap in the Original's pixel space, created on the first mark

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The Work so far is its Original, its Geometry and its Adjustments (`src/core/document.ts`). draw adds the third part that repo ADR 0003 plans, a separate drawing layer, and repo ADR 0004 fixes that it is a Canvas 2D bitmap composited over the adjusted image. The spec and the root glossary fix the rest of its shape. It is one layer as large as the Original and attached to it, so every later Flip, Rotation, Straighten angle and Crop moves it together with the image (roadmap D3, AC-08). Applied Strokes merge into it and cannot be selected one by one. It is empty for a newly opened Work. Memory must not grow with the number of Strokes (spec §6.1). What is still open is the pixel grid the bitmap lives on and when it exists.

## Decision drivers

- spec AC-08 and §6: four quarter turns, or two Flips in the same direction, give a full-size PNG Export with a difference of 0 per channel; a mark outside a narrower Crop is hidden, not removed, and shows again when the Crop is widened
- spec AC-07 and §6: an empty Drawing layer changes nothing — a difference of 0 between an Export after Clear and Apply and one made before anything was drawn
- spec AC-02: the width is in image pixels, so a Stroke has exactly that width in a full-size Export
- spec §6.1 and §6: the layer is one layer the size of the Original, so memory does not grow with the number of Strokes; memory after 50 Applies ≤ 110% of memory after the first
- spec §6: from choosing "Draw" to the tool being ready, p95 ≤ 150 ms; opening an image is not slowed (open-and-view §6)
- sad.md §1 quality goals 1, 2 and 3

## Considered options

1. **One bitmap on the Original's pixel grid, created on the first mark** — `null` until a Brush first paints in a Draft; Clear makes it `null` again.
2. **One bitmap on the Original's pixel grid, always present** — every Work gets a transparent W₀×H₀ bitmap when it is opened.

## Decision outcome

**Chosen:** Option 1. Both options put the marks on the Original's own pixel grid, which is what makes AC-08 hold by construction: the bitmap is never resampled when the Geometry changes, so the shader samples the Original and the layer through the same `u_geometry` and gets the same texels back after any round trip. Option 1 adds that a Work nobody draws on costs nothing. With the largest Original (4096×4096) a layer is 64 MB in memory and about 85 MB on the GPU with its mipmaps, and opening an image allocates neither. An empty Drawing layer is then exactly today's render, because the shader skips the layer as it skips neutral Adjustments (ADR-0003).

How it works:

- **core.** `Work` gains `drawing: DrawingLayer | null`, `null` in `createWork`. `DrawingLayer` holds the layer's `width` and `height` (always the Original's), an `id` from `newId()` that is new for every applied layer, and its `pixels`, which `core` never reads, as with `Original.pixels`. The id lets the renderer and the export's alpha check tell layers apart without comparing pixels.
- **render.** `src/render/drawing/` owns the bitmap: an `OffscreenCanvas` of W₀×H₀ with a `2d` context created with `willReadFrequently: true`, so painting and the small read-backs of ADR-0002 and ADR-0003 stay on the CPU. It exposes create, copy, paint (ADR-0002), clear, read a rectangle, and release. Release sets the canvas to 0×0, so the 64 MB backing store is freed at once rather than at the next garbage collection, and it is counted in the bitmap ledger next to `closeBitmap()`.
- **When it exists.** A Draft starts as a copy of the Work's layer, or as `null` (ADR-0004). The first Brush Stroke on a `null` Draft creates a transparent bitmap, and an Eraser Stroke on a `null` Draft changes nothing (AC-04). Clear sets the Draft to `null`. Apply stores the Draft as it stands, so an applied empty layer is `null`. A layer that the Eraser has emptied by hand stays a transparent bitmap, which composites to exactly the same pixels (ADR-0003).
- **Width.** Every Geometry step keeps lengths (§2), so one pixel in the Crop's frame is one Original pixel, and a Stroke of width *w* in the frame is a Stroke of width *w* on the layer, whatever the Rotation, Flip or Straighten angle.

## Consequences

**Positive**
- Geometry round trips and hidden marks under a narrower Crop are exact by construction, with no layer transform to maintain.
- A Work with no drawing costs no memory and no per-frame work, and opening an image is unchanged.
- The layer's shape is exactly what repo ADR 0003 will persist in step 8: one image the size of the Original, stored as a PNG Blob.

**Negative**
- Every renderer has two cases, a layer and none, and the tests cover both.
- A layer is a full-resolution bitmap even for one small mark. Memory stays bounded by the Original's size, not by the drawing.
- A layer emptied with the Eraser keeps its memory until Clear or the next Work.

**Neutral**
- Persisting the layer (step 8) is a PNG encode of this bitmap plus a forward migration. An empty layer stays `null` and stores nothing.

## Links

- Spec: [[../spec.md]] AC-02, AC-07, AC-08, §6, §6.1
- SAD: [[../sad.md]] §4
- Related ADR: [[0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates]], [[0003-composite-the-drawing-layer-in-the-shared-fragment-shader-after-the-adjustments]], [[0004-hold-the-draft-as-a-full-copy-of-the-layer-and-hand-it-to-the-work-on-apply]]; repo ADR 0003 and 0004
