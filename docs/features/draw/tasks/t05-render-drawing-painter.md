---
id: T5
title: "Add the painter: paintSegment and paintDot with Brush source-over and Eraser destination-out under setTransform(frameToOriginal) and clip(crop), the dirty rectangle and the alpha-lowered check"
layer: "infra"
deps: ["T2", "T3", "T4"]
blocks: ["T8", "T12"]
acs: ["AC-01", "AC-04", "AC-07", "AC-09"]
files_hint: ["src/render/drawing/painter.ts", "src/render/drawing/painter.test.ts", "src/render/drawing/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 55 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Add the painter: paintSegment and paintDot with Brush source-over and Eraser destination-out under setTransform(frameToOriginal) and clip(crop), the dirty rectangle and the alpha-lowered check

## Place in the sequence

- **Blocked by:** T2 — Add src/core/draw: palette and defaults, parseWidth and stepWidth, Catmull–Rom segments, segment bounds and footprintReachesCrop · T3 — Add frameToOriginal to the Geometry transform and deviceToFrame to the View, both unit-tested against the existing UV transform · T4 — Add Work.drawing (DrawingLayer | null) and the render/drawing layer module: create, copy, release with ledger counts, readRect and hasAnyMark.
- **Blocks:** T8 — Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger · T12 — Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released.
- **Wave:** 2 — alongside T6, T7.
- **Lane:** shares `src/render/drawing/index.ts` with T4 — serialized.

## Why (user story)

> **US-01: Draw freehand on the photo**
>
> **As a** Editor  
> **I want** to draw on the image with a brush by dragging across it and see the line appear under the pointer  
> **So that** I can circle, underline or write on the photo without another program
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It paints and erases every Stroke on the Original's grid, so the live line is exactly the applied and exported line.

## Inlined context

> **Clip.** Each segment is painted inside `ctx.save()`/`clip(crop rect)`/`restore()`, so only the part of the round-capped Stroke that lies inside the Crop is painted or erased (AC-09).
> **Modes.** The Brush paints with `source-over` in the chosen opaque colour, with `lineCap` and `lineJoin` set to `round`. The Eraser paints the same path with `destination-out` on the layer only (repo ADR 0004), so the image is never touched (AC-04, AC-07). Colour and width are read at the Stroke's start, so a change during a Stroke applies from the next one (AC-18).
> **To the screen.** Each painted segment widens a dirty rectangle (its control points' bounds plus half the width plus 2 px, mapped to the Original's grid and clamped to it). Once per animation frame, the painter reads that rectangle back with `getImageData` and hands it to the renderer
>
> — `adr/0002 §Decision outcome, How it works, abridged` · full text: [adr/0002](../adr/0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates.md)

> The painter sets it once per segment with `ctx.setTransform`, so the path, the width, the round caps and the clip are all given in frame coordinates. Canvas 2D carries them onto the Original's grid, including the turn of a Straighten angle.
>
> — `adr/0002 §Decision outcome, How it works «Frame to Original», verbatim` · full text: [adr/0002](../adr/0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates.md)

> an Eraser segment that lowered the alpha of some layer pixel, judged by comparing the segment's dirty rectangle before and after painting, and only until the flag is true;
>
> — `sad.md §4, decided inline, change flag bullet 2, verbatim` · full text: [sad.md](../sad.md)

> | A Straighten angle makes the Crop's edges diagonal on the Original's grid. Canvas `clip()` antialiases them, so a pixel straddling the edge can keep up to a 1 px partly transparent fringe … | Low | Without a Straighten angle, the Crop's edges fall on pixel boundaries of the layer, so no fringe exists. With one, the fringe is at most 1 px …
>
> — `sad.md §11, Straighten clip fringe risk, abridged` · full text: [sad.md](../sad.md)

Signature sketch: `paintSegment(layer, seg, { mode, colour, width }, geometry, original): Rect` and `paintDot(layer, point, style, geometry, original): Rect`, returning the dirty rect on the Original grid; `alphaLowered(before: ImageData, after: ImageData): boolean`. The caller (T12) decides when to snapshot `before` (only while the flag is false). Use T2's `segmentBounds` and T3's `frameToOriginal`; the crop rect for `clip` is in frame coordinates (`0,0,crop.w,crop.h` once the transform includes the crop origin — stay consistent with T3).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Draw" tool, drags across the image with the Brush and chooses Apply
> **Then** while the pointer moves, the Stroke appears under it at least 30 times per second (§6) as one continuous line of the chosen colour and width, with round ends and smooth edges and no visible gaps or corners on a fast curve. The line passes through every pointer position the browser reports, including the coalesced positions between frames, joined smoothly; no stabiliser moves it away from those positions, and it does not change after the pointer is released. A click without moving paints one round dot of that width. On Apply the tool closes and the Preview keeps showing the Stroke over the image. The tool always opens with the Brush selected, with the colour and width last chosen in this session (red #E53935 and 12 px the first time), and with the Work's applied Drawing layer, which is empty for a newly opened Work. After Apply the Work has Unsaved edits (AC-12)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the "Draw" tool is open on a Work whose Drawing layer has marks, applied earlier or drawn in this Draft
> **When** the Editor selects the Eraser and drags across some of the marks, or clicks on one
> **Then** the marks under the Eraser's path, at the current width, disappear, and inside that path the image shows exactly as it does where nothing was ever drawn. A click without moving erases one round dot of the current width, as a Brush click paints one; it never removes a whole Stroke, because Strokes drawn in this Draft merge into the layer just as applied ones do. The Eraser has smooth edges like the Brush, so at the edge of its path a mark may keep a partly transparent fringe up to 1 px wide. Where nothing is drawn the Eraser changes nothing: it never removes, lightens or makes transparent any pixel of the image itself. The change takes effect on Apply like any other Stroke
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — domain invariant

> **Given** an image is open, with or without transparent pixels
> **When** the Editor applies any mix of Brush Strokes, Eraser Strokes and Clear
> **Then** the image's own pixels never change: everywhere no mark lies, the Preview and a full-size PNG Export show exactly the pixels the Work has with an empty Drawing layer, and after Clear and Apply a full-size PNG Export is identical to one made before anything was drawn. Brush marks are fully opaque, so inside a mark every pixel has the mark's colour, and only its smooth edge blends with the image beneath. Where a mark lies over a transparent part of the image, the Preview and the Export show the mark's colour there; everywhere else the image keeps exactly its own transparency. These exact guarantees apply to the Preview and to a full-size PNG Export. A JPEG or WebP Export, or one at a smaller size, is that full-size result encoded or reduced as the export spec defines, so pixels next to a mark may change there
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — domain invariant

> **Given** the "Draw" tool is open
> **When** a Stroke starts, passes or ends outside the Work's Crop, for example in the area around the image
> **Then** the Stroke is drawn at its full width along the whole pointer path and then clipped to the Crop: only the painted area that lies inside the Crop is painted or erased, and the rest leaves no mark. So a wide Stroke whose pointer path runs just outside a Crop edge paints the band of it that reaches inside, as the width circle shows, and a press just outside paints the part of its round dot that lies inside. Widening the Crop later shows no mark from the parts that were outside
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `paintSegment`, `paintDot` with save → setTransform → clip → composite op → stroke/fill → restore — `src/render/drawing/painter.ts`
- [ ] Dirty rect: transform the segment bounds' corners, take the AABB, pad, clamp, union — `src/render/drawing/painter.ts`
- [ ] `alphaLowered(before, after)` — `src/render/drawing/painter.ts`
- [ ] Recording-context tests — `src/render/drawing/painter.test.ts`; export from `src/render/drawing/index.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Eraser segment | `globalCompositeOperation = "destination-out"`, restored to `source-over` after |
| dot near a Crop edge | only the part of the circle inside the clip is filled (AC-09) |
| segment entirely outside the layer | dirty rect clamps to empty; nothing to upload |
| alphaLowered when only colour changed (Brush over Brush) | false |
| alphaLowered when one pixel went 255 → 254 | true |

## Definition of Done

- [ ] painter tests cover each Edge case row
- [ ] the painter never receives or touches the Original's bitmap (AC-07: the layer only)
- [ ] real pixels are proven in T17
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
