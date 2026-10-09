---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-09"
feature_size: "M"
ticket: "roadmap step 6 — draw"
---

# 0002 — Paint each Stroke segment straight into the Draft in Original coordinates, through the Geometry's transform and clipped to the Crop

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The Editor drags across the Preview, which shows the Work's Crop with its Geometry at the current View. The marks belong on the layer of ADR-0001, which lies on the Original's pixel grid, under whatever Rotation, Flip and Straighten angle the Work has. Repo ADR 0004 fixes Canvas 2D as the painter and `destination-out` as the Eraser. The spec makes the live line strict. It must pass through every position the browser reports, coalesced ones included, joined smoothly with no visible corner on a fast curve and no stabiliser. It must not change after the pointer is released. A Stroke is clipped by painted area to the Crop (AC-09), and zooming mid-Stroke must not break it (AC-18). All of this must keep up with a 4096×3072 Work at 1 px and 200 px.

## Decision drivers

- spec AC-01: one continuous line through every reported position, round ends, smooth edges, no gaps or corners on a fast curve, unchanged after release; a click paints one round dot
- spec AC-04 and AC-09: the Eraser removes marks only; a Stroke is drawn at full width and then clipped to the Crop by painted area
- spec AC-18: a zoom does not break a Stroke in progress; a pointer cancel, losing focus or a second touch ends it and keeps what was drawn
- spec §6: p95 frame interval ≤ 33 ms while drawing and p95 ≤ 50 ms from a pointer move to the frame that shows it, at 1 px and 200 px, at Fit and at 100%
- sad.md §1 quality goals 1 and 3; repo ADR 0004

## Considered options

1. **Paint each segment straight into the Draft bitmap in Original coordinates** — the live line is the final line.
2. **A screen-space overlay canvas for the Stroke in progress, rasterised into the layer on release** — the lowest latency, but the line is drawn twice in two pixel grids.
3. **A separate full-size bitmap for the Stroke in progress, repainted whole every frame and merged on release** — no joints between segments, at the cost of a second 64 MB bitmap and a frame cost that grows with the Stroke's length.

## Decision outcome

**Chosen:** Option 1. It is the only option where what the Editor sees while drawing is, pixel for pixel, what Apply stores and what the Export holds. Option 2 shows a line antialiased on the screen grid and then replaces it with one antialiased on the Original's grid, so the line visibly shifts on release at any zoom other than 100% or with a Straighten angle, which AC-01 forbids. It also cannot show the Eraser uncovering the image without compositing twice. Option 3 keeps the line exact, but a long 200 px Stroke across the whole image would repaint its whole path every frame and miss the 33 ms budget.

How it works:

- **Pointer to frame.** A `DrawOverlay` over the Preview (the `tool-canvas` slot, as crop-rotate ADR-0005's frame) takes pointer events with pointer capture. For every event it reads `getCoalescedEvents()`, or the event itself where the engine has none, and maps each position with the View at that moment into the Crop's frame: `frame = crop.origin + (devicePoint − round(pan)) / zoom`. A zoom mid-Stroke therefore changes only how later positions map, never what was painted (AC-18).
- **Frame to Original.** `src/core/draw/` exports `frameToOriginal(g, original)`, the pixel-unit form of the transform that `cropToOriginalUv` already composes (crop-rotate ADR-0001). The painter sets it once per segment with `ctx.setTransform`, so the path, the width, the round caps and the clip are all given in frame coordinates. Canvas 2D carries them onto the Original's grid, including the turn of a Straighten angle.
- **Clip.** Each segment is painted inside `ctx.save()`/`clip(crop rect)`/`restore()`, so only the part of the round-capped Stroke that lies inside the Crop is painted or erased (AC-09). The width circle shows the same footprint.
- **Curve.** Consecutive points are joined by centripetal Catmull–Rom segments converted to cubic Béziers (`bezierCurveTo`). A Catmull–Rom curve passes exactly through every point, so the line goes through every reported position with no stabiliser. The segment from point *i−1* to *i* is painted when point *i+1* arrives, and the last segment is painted on release. The line therefore trails the newest position by one input event (about 8 ms at 120 Hz), and release only adds the final segment, never changes painted ones. A press without movement paints one filled circle of the width. The pure parts (point mapping, the control points, the width rules of AC-02 and AC-03) live in `src/core/draw/` and are unit-tested. The Canvas calls live in `src/render/drawing/`.
- **Modes.** The Brush paints with `source-over` in the chosen opaque colour, with `lineCap` and `lineJoin` set to `round`. The Eraser paints the same path with `destination-out` on the layer only (repo ADR 0004), so the image is never touched (AC-04, AC-07). Colour and width are read at the Stroke's start, so a change during a Stroke applies from the next one (AC-18).
- **To the screen.** Each painted segment widens a dirty rectangle (its control points' bounds plus half the width plus 2 px, mapped to the Original's grid and clamped to it). Once per animation frame, the painter reads that rectangle back with `getImageData` and hands it to the renderer, which updates only that part of the layer texture (ADR-0003). One frame therefore costs at most one readback and one upload of the area drawn since the last frame, whatever the Stroke's length.

## Consequences

**Positive**
- The live line, the applied layer and the Export are the same pixels, so AC-01's "does not change after release" and quality goal 1 need no extra mechanism.
- Rotation, Flip, Straighten angle, zoom and pan are handled by one matrix per segment, and the hard rules (mapping, Catmull–Rom, width) are pure and unit-testable.
- A frame's cost follows the newly painted area, not the Stroke's length or the image's size.

**Negative**
- Segments overlap at their joints, so an antialiased edge is painted twice there and becomes slightly stronger. With fully opaque marks this is not visible, but it rules out brush opacity later (spec §3 has none).
- The line trails the pointer by one input event, inside the 50 ms budget.
- Engines without `getCoalescedEvents()` give only the per-frame positions, so a very fast curve has fewer points. The Catmull–Rom joins keep it smooth, and §11 tracks it.

**Neutral**
- Moving the painter into a worker later is possible behind the same `render/drawing` interface: the canvas is an `OffscreenCanvas` and the painter has no DOM.

## Links

- Spec: [[../spec.md]] AC-01, AC-04, AC-07, AC-09, AC-18, §6
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-hold-the-drawing-layer-as-one-bitmap-in-the-original-pixel-space-created-on-the-first-mark]], [[0003-composite-the-drawing-layer-in-the-shared-fragment-shader-after-the-adjustments]]; repo ADR 0004; crop-rotate ADR-0001 and ADR-0005
