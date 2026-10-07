---
id: T2
title: "Keep the Crop inside the turned image: clampCrop, whole-pixel rounding, move and resize by edge or corner"
layer: "domain"
deps: ["T1"]
blocks: ["T3", "T4"]
acs: ["AC-02"]
files_hint: ["src/core/geometry/crop.ts", "src/core/geometry/crop.test.ts", "src/core/geometry/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "S"   # measured: 39 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Keep the Crop inside the turned image: clampCrop, whole-pixel rounding, move and resize by edge or corner

## Place in the sequence

- **Blocked by:** T1 — Add the Geometry to the Work: type, identity, geometryEquals, workSize, rotateQuarter and flipOnScreen.
- **Blocks:** T3 — Add the Straighten angle rules: setStraighten around the frame's centre and fitCropInside with no empty corner · T4 — Add proportions, typed crop sizes and the field input rules (parseAngle, parseCropSize, plain decimal only).
- **Wave:** 2 — alongside T5.
- **Lane:** shares `src/core/geometry/index.ts` with T1; shares `src/core/geometry/index.ts` with T3; shares `src/core/geometry/index.ts` with T4; shares `src/core/geometry/index.ts` with T5 — serialized.

## Why (user story)

> **US-01: Cut away what I don't want**
>
> **As a** Editor  
> **I want** to drag a crop frame over the image and apply it  
> **So that** the Work keeps only the part of the photo I care about
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It is the invariant every drag, arrow key and typed size relies on: the frame can never leave the image or become empty.

## Inlined context

> `fitCropInside(g)` … `clampCrop` and the rounding rules of AC-02, the proportion and size maths of AC-08 and AC-09 …
> - **Coordinate frame of the Crop.** The image after its Flip and Rotation is W×H pixels (the Original's size, swapped for 90° and 270°). The Straighten angle turns it clockwise around its centre (W/2, H/2). The Crop is an axis-aligned rectangle in that frame, so with no Straighten angle it is plain pixel coordinates of the turned image; with one, `x` or `y` can be negative, and the invariant is that the rectangle lies fully inside the turned image (CONTEXT invariant).
>
> — `adr/0001 §Decision outcome, How it works, abridged` · full text: [adr/0001](../adr/0001-model-the-geometry-as-integer-parameters-with-one-core-transform.md)

> S->>S: applies the locked proportion, if any
> alt past the image edge, past the opposite edge, or below 1 x 1 px — S->>S: stops the frame at the edge, keeps at least 1 x 1 px, never inside out
> else inside the Turned image — S->>S: keeps the new frame
> S->>S: rounds to whole pixels, left and top round down when centring leaves an odd pixel
> Postcondition: the Crop lies fully inside the Turned image, in whole pixels, at least 1 x 1 px
>
> — `sad.md §6, F2 steps 4–8, abridged` · full text: [sad.md](../sad.md)

> AC-06's maths (largest frame of the same proportion inside the turned image, re-anchoring around the frame's centre, whole-pixel rounding) has edge cases: ±45°, a centre that falls outside, a 1×1 Crop, very thin frames — Mitigation: Pure functions in `core/geometry` with property tests: the result is always inside, whole pixels, at least 1×1, with the proportion kept within 0.5 px (AC-08)
>
> — `sad.md §11, risk row 4, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Only `core/geometry` converts between [screen pixels, the Crop's frame and the Original's texture coordinates]: the shader's `u_geometry`, the overlay's positions and drag deltas all come from it.
>
> — `sad.md §8, Coordinate spaces, abridged` · full text: [sad.md](../sad.md)

This task takes deltas already in image pixels (the overlay converts screen → image in T15 through T5's maths). Keep the "inside the turned image" test general (the turned image is a rotated rectangle when `straighten ≠ 0`), so T3 reuses it. Proportion-locked resizing is added by T4 on top of these functions.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — domain invariant

> **Given** the "Crop and rotate" tool is open
> **When** the Editor drags the crop frame, an edge or a corner past the edge of the image, or drags an edge past the opposite edge
> **Then** the frame stops at the edge of the image and never extends beyond it, and it never becomes smaller than 1×1 px of the image or turns inside out, because a Crop always lies fully inside the image and is never empty. The Crop's width, height and position are always whole numbers of pixels of the image as it stands after its Flip, Rotation and Straighten angle. When centring or resizing around a centre leaves an odd pixel, the frame's left and top edges round down, so the extra pixel goes to the right or the bottom
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `isInsideTurned(rect, g, original)` — the four corners of the rect lie inside the turned image (rotated rectangle when `straighten ≠ 0`) — `src/core/geometry/crop.ts`
- [ ] `clampCrop(g, original)`: integer rect, ≥1×1, inside — `src/core/geometry/crop.ts`
- [ ] `moveCrop(g, dx, dy, original)`: translate, stop at the edge, size unchanged — `src/core/geometry/crop.ts`
- [ ] `resizeCrop(g, handle, dx, dy, original)` for `'n'|'e'|'s'|'w'|'ne'|'nw'|'se'|'sw'`: the opposite edge stays put, the moving edge stops at the image edge and at 1 px before the opposite edge — `src/core/geometry/crop.ts`
- [ ] `centreRect(cx, cy, w, h)` helper with the odd-pixel rule (left/top round down) — `src/core/geometry/crop.ts`
- [ ] Export from `src/core/geometry/index.ts`; property tests in `src/core/geometry/crop.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Move far past the left edge | `x` stops at the edge, width unchanged |
| Drag the right edge past the left edge | width stops at 1 px; never negative, never swaps sides |
| Corner drag past two edges at once | each axis stops independently |
| 1×1 Crop moved by arrow-sized deltas | stays 1×1, stays inside |
| Centring a 101 px wide frame in 200 px | `x` = 49 (round down), extra pixel on the right |
| Straightened image (rotated rectangle), move into a corner | stops where a frame corner meets the turned image's edge |

## Definition of Done

- [ ] Property tests (random Geometries, handles and deltas) prove every result is integer, ≥1×1, not inside out and inside the turned image (AC-02)
- [ ] Unit tests prove the odd-pixel rule and the stop-at-edge behaviour per handle
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
