---
id: T5
title: "Derive the one transform: cropToOriginalUv, turnedImageToOriginalUv, turnedBounds and the overlay's screen maths"
layer: "domain"
deps: ["T1"]
blocks: ["T6", "T8", "T15"]
acs: ["AC-12", "AC-14", "AC-19"]
files_hint: ["src/core/geometry/transform.ts", "src/core/geometry/overlay.ts", "src/core/geometry/transform.test.ts", "src/core/geometry/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 51 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Derive the one transform: cropToOriginalUv, turnedImageToOriginalUv, turnedBounds and the overlay's screen maths

## Place in the sequence

- **Blocked by:** T1 — Add the Geometry to the Work: type, identity, geometryEquals, workSize, rotateQuarter and flipOnScreen.
- **Blocks:** T6 — Render the Geometry in the shared shader (u_geometry) and give the Preview renderer setGeometry(g, 'crop' | 'whole') · T8 — Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View · T15 — Build CropOverlay: dimmed outside, frame with 8 focusable handles, both grids, pointer drags and arrow keys.
- **Wave:** 2 — alongside T2.
- **Lane:** shares `src/core/geometry/index.ts` with T1; shares `src/core/geometry/index.ts` with T2; shares `src/core/geometry/index.ts` with T3; shares `src/core/geometry/index.ts` with T4 — serialized.

Independent of T2–T4: it only needs the Geometry type and the coordinate frame from T1, so it can run beside them (it shares only `src/core/geometry/index.ts`).

## Why (user story)

> **US-08: Export what I see after cropping**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Geometry I applied  
> **So that** the saved file, its size and the warnings I get match the cropped and rotated image
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It is the single matrix every renderer and the overlay use, so the Preview, the Export and the frame on screen cannot disagree about where a pixel lands.

## Inlined context

> `cropToOriginalUv(g, original): mat3`, the transform from a Crop pixel to an Original texture coordinate, with `turnedImageToOriginalUv(g, original)` and `turnedBounds(g)` as its whole-turned-image counterpart for the tool's view (ADR-0003).
> - Everything outside `core` reads the Work's size through `workSize(work)` and renders through `cropToOriginalUv`; no other module composes Flip, Rotation or Straighten itself.
>
> — `adr/0001 §Decision outcome, How it works, abridged` · full text: [adr/0001](../adr/0001-model-the-geometry-as-integer-parameters-with-one-core-transform.md)

> The unit quad now stands for the Crop: `u_transform` places it on screen (the View, sized by `workSize`) or on the whole canvas (export's `FULL_QUAD`), and `u_geometry = cropToOriginalUv(g, original)` from `core` (ADR-0001). The identity Geometry gives the identity mapping, so today's rendering is unchanged.
>
> — `adr/0002 §How it works, bullet 1, abridged` · full text: [adr/0002](../adr/0002-render-the-geometry-in-the-shared-shader-in-one-pass.md)

> Exact pixel mapping for Rotation and Flip relies on sampling at texel centres in float32. A mapping that lands on a texel edge can pick the neighbour on one engine and fail QG-1a — Mitigation: `cropToOriginalUv` maps output pixel centres (p + 0.5) to texel centres. Unit tests assert it for all 16 combinations, and the 16-combination e2e catches any engine difference
>
> — `sad.md §11, risk row 2, verbatim` · full text: [sad.md](../sad.md)

> `CropOverlay.vue` … Its positions come from the View and the draft Geometry through `core/geometry`'s overlay maths: the Crop's corners in screen pixels. They are computed with the same View and size the renderer uses, so the frame sits on the pixels the shader draws. … Each move turns the screen delta into image pixels with the same maths
>
> — `adr/0005 §How it works, abridged` · full text: [adr/0005](../adr/0005-draw-the-crop-frame-as-a-dom-overlay-over-the-preview.md)

> *QG-1c* … Unit tests of `cropToOriginalUv` assert that every Crop pixel centre maps inside the Crop's source area.
>
> — `sad.md §10, QG-1c How verify, abridged` · full text: [sad.md](../sad.md)

Existing code: `src/render/view-transform.ts` `viewToTransform(view, image, canvas)` builds today's View `mat3`; the overlay maths must use the same convention (column-major, unit quad `a_position` in 0…1). Keep `core` free of `Float32Array`-only APIs that a pure test can't build — a plain 9-number array is fine.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-12 — domain invariant

> **Given** a Crop was applied earlier to the open Work
> **When** the Editor opens the "Crop and rotate" tool again
> **Then** the tool shows the whole image with the current Rotation, Flip and Straighten angle, and the crop frame where the Crop is, so the Editor can widen it. Widening the frame back to the whole image and applying gives exactly the pixels the Work had before the Crop, because the Geometry never removes pixels from the Original. Reset in the tool returns to no Geometry (no Rotation, no Flip, a Straighten angle of 0° and the Crop covering the whole image), sets the proportion to Free, and takes effect only on Apply
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** a Geometry has been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry, matching the Preview (§6 Fidelity), and no pixel from outside the Crop. The Work's full size in the export panel is the Crop's size in pixels; the size presets and the long-side field of export AC-05 and AC-06 count from it, and a remembered size larger than the new Work snaps to it. Snapping does not replace the remembered size: a remembered long side in pixels comes back, up to the Work's full size, when the Crop is widened again. The transparency hint of export AC-15 is shown only when a pixel inside the Crop is not fully opaque. The size shown for the Work in the status bar is the Crop's size, with the Original's dimensions next to it as in AC-01
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — cross-context

> **Given** an image is open
> **When** the Editor opens the "Crop and rotate" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** on opening, the View fits the whole image with its current Rotation, Flip and Straighten angle, so every edge of the frame can be reached. Zoom and pan keep working inside the tool, and they never change the Geometry or count as an edit. After Apply or Cancel, the View fits the Work
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

This task delivers the pure part: AC-12's whole-turned-image mapping, AC-14's "no pixel from outside the Crop" at the matrix level, and AC-19's turned bounds for fit-View. The pixels on screen and in files are T6/T7/T18.

## Checklist

- [ ] `cropToOriginalUv(g, original)`: unit quad (0…1 over the Crop) → Original UV, composing Crop offset, Straighten turn around the turned image's centre, Rotation and Flip — `src/core/geometry/transform.ts`
- [ ] `turnedBounds(g, original)`: the axis-aligned bounding box of the whole turned image in Crop-frame pixels; `turnedImageToOriginalUv(g, original)`: the same mapping over that box — `src/core/geometry/transform.ts`
- [ ] Overlay maths: `cropCornersOnScreen(g, view, canvas, shown)` and `screenDeltaToImage(dx, dy, view)` using `viewToTransform`'s convention — `src/core/geometry/overlay.ts`
- [ ] Export from `src/core/geometry/index.ts`; tests in `src/core/geometry/transform.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Identity Geometry | identity mapping, so today's Preview and Export are unchanged |
| Rotation 90 + flipH, 1-pixel-wide Crop at the right edge | each output pixel centre lands on the expected Original texel centre (never a texel edge) |
| Straighten ±45°, Crop at its largest | every Crop pixel centre maps inside the Original (0…1 UV) |
| `turnedBounds` at straighten 0 | equals the turned image W×H at origin 0,0 |
| Overlay at zoom 8 (800%) | screen corners land on device-pixel boundaries of the shown image |

## Definition of Done

- [ ] Vitest proves the texel-centre mapping for all 16 Rotation × Flip combinations, with and without a Crop, computed independently of the implementation
- [ ] Vitest proves every Crop pixel centre maps inside the Crop's source area at −45°, −0.1°, +1°, +45° (QG-1c unit half)
- [ ] Vitest proves `turnedBounds` / `turnedImageToOriginalUv` and the overlay screen ↔ image round trip
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
