---
id: T1
title: "Add the Geometry to the Work: type, identity, geometryEquals, workSize, rotateQuarter and flipOnScreen"
layer: "domain"
deps: []
blocks: ["T2", "T5", "T8"]
acs: ["AC-03", "AC-04", "AC-13"]
files_hint: ["src/core/geometry/types.ts", "src/core/geometry/equality.ts", "src/core/geometry/turn.ts", "src/core/geometry/geometry.test.ts", "src/core/geometry/index.ts", "src/core/document.ts", "src/core/document.test.ts", "src/core/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 60 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Add the Geometry to the Work: type, identity, geometryEquals, workSize, rotateQuarter and flipOnScreen

## Place in the sequence

- **Blocked by:** — (none).
- **Blocks:** T2 — Keep the Crop inside the turned image: clampCrop, whole-pixel rounding, move and resize by edge or corner · T5 — Derive the one transform: cropToOriginalUv, turnedImageToOriginalUv, turnedBounds and the overlay's screen maths · T8 — Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View.
- **Wave:** 1 — alongside T12.
- **Lane:** shares `src/core/geometry/index.ts` with T2; shares `src/core/geometry/index.ts` with T3; shares `src/core/geometry/index.ts` with T4; shares `src/core/geometry/index.ts` with T5 — serialized.

The `Work` shape change (a new required `geometry` field) is folded in here with its only constructor, `createWork`, so the task commits green on its own (no compile-coupled pair).

## Why (user story)

> **US-02: Turn the image upright**
>
> **As a** Editor  
> **I want** to rotate the image in 90° steps in either direction  
> **So that** a sideways or upside-down photo is the right way up
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

> **US-03: Mirror the image**
>
> **As a** Editor  
> **I want** to flip the image horizontally or vertically  
> **So that** a mirrored selfie or scan reads the right way round
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It creates the Geometry every later task edits, renders and compares, and the two lossless operations: a quarter turn and an on-screen flip.

## Inlined context

> **The Geometry is integer parameters on the Work, with every rule and the one transform in `core`** — `Geometry = { flipH, flipV, rotation, straighten, crop }`: `rotation` is 0, 90, 180 or 270; `straighten` is an integer number of tenths of a degree from −450 to 450; `crop` is whole pixels in the image as it stands after its Flip, Rotation and Straighten angle (CONTEXT "Crop"). Integers make AC-13's field-by-field comparison exact, and the parameters are what repo ADR 0003 will persist in step 8.
>
> — `sad.md §4, Top strategic choice 1, abridged` · full text: [sad.md](../sad.md)

> - `src/core/document.ts`: `Work` gains `geometry: Geometry`; `createWork` sets the identity Geometry (no Flip, rotation 0, straighten 0, Crop covering the whole Original).
> - `Geometry = { flipH: boolean, flipV: boolean, rotation: 0 | 90 | 180 | 270, straighten: number /* integer tenths of a degree, −450…450 */, crop: { x, y, width, height } /* integers */ }`.
> - **Coordinate frame of the Crop.** The image after its Flip and Rotation is W×H pixels (the Original's size, swapped for 90° and 270°). The Straighten angle turns it clockwise around its centre (W/2, H/2). The Crop is an axis-aligned rectangle in that frame, so with no Straighten angle it is plain pixel coordinates of the turned image; with one, `x` or `y` can be negative, and the invariant is that the rectangle lies fully inside the turned image (CONTEXT invariant).
> - `identityGeometry(original)`, `geometryEquals(a, b)` (AC-13), `workSize(work)` (the Crop's size), `rotateQuarter(g, dir)` (AC-03, the frame turns with the image), `flipOnScreen(g, axis)` (AC-04: a screen-horizontal flip is a stored vertical Flip at 90° and 270°, the Crop is mirrored, the angle changes sign) …
> - Everything outside `core` reads the Work's size through `workSize(work)` and renders through `cropToOriginalUv`; no other module composes Flip, Rotation or Straighten itself.
>
> — `adr/0001 §Decision outcome, How it works, abridged` · full text: [adr/0001](../adr/0001-model-the-geometry-as-integer-parameters-with-one-core-transform.md)

> - **The Work's size is `workSize(work)`**, the Crop's width and height, read by the status bar (AC-01, AC-14), the export panel's full size and presets (AC-14), and fit-View after Apply or Cancel (AC-19). Nothing outside `core/geometry` reads `original.width` or `original.height` as the Work's size any more.
>
> — `sad.md §4, Decided inline bullet 1, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/core/` — Pure TS domain … nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this). `core` and `infra` return `Result<T, AppError>` … Throw only for programmer errors. No new `AppError` code: the field rules never fail (they snap or revert).
>
> — `CLAUDE.md §Module boundaries + §Conventions; sad.md §5 last paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

> **Hard rule (QG-2):** AC-13 and the invariants of AC-02, AC-03, AC-04 and AC-06 as `core/geometry` unit tests, including property tests over random Geometries: the Crop is always whole pixels inside the turned image, and turning four times or flipping twice gives back an equal Geometry.
>
> — `sad.md §10, QG-2 How verify, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Geometry lives in session memory only; persisting it is roadmap step 8 — `sad.md` §8 Persistence.)

## API contract

Internal — no API surface. (No server and no `contracts/` — `target_surfaces: [web-frontend]`.)

## Acceptance criteria

### AC-03 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor chooses rotate clockwise or rotate counter-clockwise
> **Then** the image turns by exactly 90° in that direction, and the crop frame turns with it, so the same part of the photo stays inside the frame. The width and height of the image and of the frame swap, and a locked proportion turns with it (4:3 becomes 3:4). Four turns in the same direction, or one turn each way, give back the Geometry from before. A Rotation keeps every pixel: nothing is resampled or lost
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the "Crop and rotate" tool is open, with any Rotation
> **When** the Editor chooses flip horizontal or flip vertical
> **Then** the image is mirrored as it is currently shown on screen, so flip horizontal always swaps left and right as the Editor sees them, whatever the Rotation, and the crop frame is mirrored with it, keeping the same part of the photo inside. A Flip also changes the sign of the Straighten angle, so a level horizon stays level: an image straightened by +5° shows −5° on the slider after a Flip. Flipping twice the same way gives back the Geometry from before, and a Flip keeps every pixel
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — cross-context

> **Given** an image is open
> **When** the Editor applies the "Crop and rotate" tool
> **Then** the Work has Unsaved edits only when the applied Geometry differs from the Geometry the Work had when the tool was opened. Two Geometries are compared field by field (horizontal Flip, vertical Flip, Rotation, Straighten angle and Crop), not by the pixels they produce, so a horizontal and a vertical Flip applied to a Work that had a 180° Rotation count as a change. Four quarter turns, flipping twice, or an Apply with no change leave the Unsaved edits as they were. The comparison is only with the Geometry from when the tool was opened: after an Export, changing the Geometry and then changing it back by hand in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

Only the pure-core half of each AC is this task's: the field changes and equalities. The rendered pixels are T6/T7/T18; the Unsaved-edits rule on Apply is T8.

## Checklist

- [ ] `Geometry`, `Rotation`, `CropRect`, `identityGeometry(original)` — `src/core/geometry/types.ts`
- [ ] `geometryEquals(a, b)` comparing flipH, flipV, rotation, straighten and crop field by field; `workSize(work)` — `src/core/geometry/equality.ts`
- [ ] `rotateQuarter(g, 'cw' | 'ccw')`: rotation steps, the Crop re-expressed in the new turned frame (width and height swap) so the same Original content stays inside; `flipOnScreen(g, 'horizontal' | 'vertical')`: map the screen axis to the stored Flip for the current Rotation, mirror the Crop in the turned frame, negate `straighten` — `src/core/geometry/turn.ts`
- [ ] `Work.geometry` set by `createWork` to the identity — `src/core/document.ts` (+ `document.test.ts`)
- [ ] Public surface — `src/core/geometry/index.ts`, re-exported from `src/core/index.ts`
- [ ] Vitest incl. property tests over random Geometries — `src/core/geometry/geometry.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Four `cw` turns, or `cw` then `ccw` | `geometryEquals` with the start is true, Crop included |
| Two equal `flipOnScreen` calls | equal to the start, `straighten` back to its sign |
| flipH + flipV on a Work with rotation 180 | `geometryEquals` with the start is **false** (fields differ although pixels match) — AC-13 |
| `flipOnScreen('horizontal')` at rotation 90 or 270 | toggles the stored `flipV`, not `flipH` |
| `straighten` = +50 then a flip | `straighten` = −50 |
| Crop with an odd width centred | left/top round down (AC-02 rule; T2 owns the general clamp) |
| `rotateQuarter` on a Crop with negative `x`/`y` (straightened) | still re-expressed exactly; result stays integer |

## Definition of Done

- [ ] Vitest proves AC-03's and AC-04's round trips and frame-follows-image rules as exact equalities, including property tests over random Geometries
- [ ] Vitest proves AC-13's field-by-field comparison, including the H+V-Flip-on-180° case
- [ ] `createWork` returns the identity Geometry; existing open-and-view and export tests still pass
- [ ] every Hard Rule inlined above still holds (no Vue/DOM in `core`)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
