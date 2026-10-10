---
id: T2
title: "Add src/core/draw: palette and defaults, parseWidth and stepWidth, Catmull–Rom segments, segment bounds and footprintReachesCrop"
layer: "domain"
deps: []
blocks: ["T5", "T11"]
acs: ["AC-02", "AC-03", "AC-09", "AC-12", "AC-19"]
files_hint: ["src/core/draw/settings.ts", "src/core/draw/width.ts", "src/core/draw/stroke.ts", "src/core/draw/draw.test.ts", "src/core/draw/index.ts", "src/core/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 70 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Add src/core/draw: palette and defaults, parseWidth and stepWidth, Catmull–Rom segments, segment bounds and footprintReachesCrop

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** T5 — Add the painter: paintSegment and paintDot with Brush source-over and Eraser destination-out under setTransform(frameToOriginal) and clip(crop), the dirty rectangle and the alpha-lowered check · T11 — Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace.
- **Wave:** 1 — alongside T1, T3, T4.
- **Lane:** own lane.

## Why (user story)

> **US-02: Pick the colour and width**
>
> **As a** Editor  
> **I want** to choose the brush colour from a palette or any colour I like, and set the line width  
> **So that** my marks stand out on the photo and are as thick or thin as I need
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It holds every pure rule the tool uses: the colours, the width rules, the curve the line follows and the test for whether a Stroke changed anything.

## Inlined context

> src/core/draw/                 pure rules, no DOM
> ├── settings.ts                PALETTE (10 colours, AC-02), DEFAULT_COLOUR #E53935, DEFAULT_WIDTH 12, MIN/MAX_WIDTH 1…200
> ├── width.ts                   parseWidth (AC-03 field rules, "px" suffix), stepWidth ([ ] ±1, ±10 with Shift, clamped; AC-19)
> ├── stroke.ts                  catmullRomSegments (points → Bézier control points), segmentBounds, footprintReachesCrop (AC-12)
> └── index.ts
>
> — `sad.md §5, Internal decomposition, src/core/draw, verbatim` · full text: [sad.md](../sad.md)

> **Curve.** Consecutive points are joined by centripetal Catmull–Rom segments converted to cubic Béziers (`bezierCurveTo`). A Catmull–Rom curve passes exactly through every point, so the line goes through every reported position with no stabiliser. The segment from point *i−1* to *i* is painted when point *i+1* arrives, and the last segment is painted on release. … A press without movement paints one filled circle of the width.
>
> — `adr/0002 §Decision outcome, How it works «Curve», abridged` · full text: [adr/0002](../adr/0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates.md)

> Each painted segment widens a dirty rectangle (its control points' bounds plus half the width plus 2 px, mapped to the Original's grid and clamped to it).
>
> — `adr/0002 §Decision outcome, How it works «To the screen», abridged` · full text: [adr/0002](../adr/0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates.md)

> a Brush Stroke whose footprint (its path widened by half the width, with round ends) reaches inside the Crop, judged geometrically by a pure `core/draw` function;
>
> — `sad.md §4, decided inline, change flag bullet 1, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
> `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder — May import: `core`, `shared`
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, table rows + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Mirror the plain-decimal rule of `src/core/adjust` (`parseAdjustmentField`) and `src/core/geometry/parse.ts` — read one of them and reuse its number regex rather than inventing a new one. All inputs and outputs are in the Crop's frame (image pixels); the curve end segments use the point itself as the missing neighbour. `footprintReachesCrop(segments, width, crop)` is geometric (distance from the Crop rectangle to the curve ≤ width/2, a dot is a circle) — no pixels.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (Exports: `PALETTE`, `DEFAULT_COLOUR`, `DEFAULT_WIDTH`, `MIN_WIDTH`, `MAX_WIDTH`, `parseWidth(text, previous)`, `stepWidth(width, delta)`, `catmullRomSegments(points)`, `segmentBounds(segment, width)`, `footprintReachesCrop(...)`.)

## Acceptance criteria

### AC-02 — happy path

> **Given** the "Draw" tool is open
> **When** the Editor picks a colour from the palette or from the custom colour picker, or sets the width with its slider or number field
> **Then** every Stroke made afterwards uses that colour and width, and Strokes already made keep theirs. The palette shows 10 preset colours in this order: black #000000, white #FFFFFF, red #E53935 (the first-time colour), orange #FB8C00, yellow #FDD835, green #43A047, cyan #00ACC1, blue #1E88E5, purple #8E24AA and pink #D81B60. The chosen colour is marked when it is one of them, and the custom picker offers any fully opaque colour. The width is a whole number of image pixels from 1 to 200, so a Stroke looks thicker when the Editor zooms in and has exactly that width in a full-size Export. Over the image the pointer shows a circle outline of the current width at the current zoom. The Brush and the Eraser share the width. The colour and the width are remembered as soon as they are chosen, whether the tool is then applied or cancelled, until the app is reloaded, also when another image is opened. They are tool settings, not edits, and never count as Unsaved edits. The mode is not remembered: the tool always opens on the Brush (AC-01)
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — error

> **Given** the "Draw" tool is open
> **When** the Editor types a width that is outside 1 to 200, fractional, empty or not a number
> **Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound (1 or 200), a fractional value rounds to the nearest whole number with an exact half rounding up (2.5 becomes 3), and an empty or non-numeric value returns to the previous width. A value is a number under the same rule as crop-rotate AC-07 and adjust AC-05: plain decimal notation with an optional sign and one decimal point or decimal comma, however long; scientific notation such as `1e2` is not a number. A trailing "px" is accepted in any letter case and with or without spaces before it, so "20px", "20 px" and "20PX" all mean 20. Nothing is checked while the Editor is still typing, and pressing Enter in the field only applies the value and does not apply the tool
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — domain invariant

> **Given** the "Draw" tool is open
> **When** a Stroke starts, passes or ends outside the Work's Crop, for example in the area around the image
> **Then** the Stroke is drawn at its full width along the whole pointer path and then clipped to the Crop: only the painted area that lies inside the Crop is painted or erased, and the rest leaves no mark. So a wide Stroke whose pointer path runs just outside a Crop edge paints the band of it that reaches inside, as the width circle shows, and a press just outside paints the part of its round dot that lies inside. Widening the Crop later shows no mark from the parts that were outside
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — cross-context

> **Given** an image is open
> **When** the Editor applies the "Draw" tool
> **Then** the Work has Unsaved edits when the applied Draft contains at least one change: a Brush Stroke with any painted part inside the Crop, or an Eraser Stroke or a Clear that removed any mark. The layer is not compared pixel by pixel, so drawing a mark and erasing it again in the same Draft still counts as a change. An Apply with no Stroke, with Brush Strokes only outside the Crop, with an Eraser Stroke only where nothing was drawn, or with a Clear of an already empty Drawing layer leaves the Unsaved edits as they were, as an Apply with no change does in crop-rotate AC-13 and adjust AC-11. The comparison is only with the Drawing layer from when the tool was opened: after an Export, drawing a mark in one Apply and erasing it in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to draw on it
> **Then** a "Draw" action is visible in the toolbar next to "Adjust". It can be reached with Tab and activated with Enter or Space, and the D key opens it as well, under the same rule as the A key for "Adjust": the letter d, or the D key itself on a layout that types no Latin letter there. The D key does nothing while the export panel is open, while the "Draw" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab; B selects the Brush and E selects the Eraser under the same letter-first rule, silent in a text field. [ and ] make the width 1 smaller or larger, and 10 with Shift held. Each is recognised by the character it types ([ or ]) or, on a layout that does not type that character there, by its key position (the two keys right of P), so Shift+[ works although it types "{" and the German ü and + keys work too. Holding the key repeats the change, the result stays within 1 to 200 (195 plus 10 gives 200), and both are silent in a text field. Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-03). Escape cancels the tool from anywhere in it, including a field. Drawing a mark itself needs a mouse, a pen or a finger. Circling something and keeping it takes three actions: open the tool, draw, Apply
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] PALETTE in AC-02 order with English names (Black … Pink), defaults #E53935 / 12, bounds 1…200 — `src/core/draw/settings.ts`
- [ ] `parseWidth(text, previous)`: plain decimal, sign, one point or comma, optional "px" any case/spaces, snap, round half up, revert — `src/core/draw/width.ts`
- [ ] `stepWidth(width, delta)` clamped to 1…200 — `src/core/draw/width.ts`
- [ ] `catmullRomSegments` (centripetal, α = 0.5), `segmentBounds`, `footprintReachesCrop` — `src/core/draw/stroke.ts`
- [ ] Barrel + `src/core/index.ts` export; table-driven tests — `src/core/draw/draw.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| "2.5" | 3 (half rounds up) |
| "0", "-4", "1e2" | 1, 1, previous width (scientific notation is not a number) |
| "20px", "20 px", "20PX", "20,4" | 20 |
| "", "abc" | previous width |
| "999999999999999999999" | 200 |
| stepWidth(195, +10) / stepWidth(3, -10) | 200 / 1 |
| two identical consecutive points | a degenerate segment, no NaN in the control points |
| path entirely outside the Crop but within width/2 of an edge | footprintReachesCrop is true (AC-09 band) |
| path farther than width/2 outside | false |

## Definition of Done

- [ ] `src/core/draw/draw.test.ts` covers each Edge case row
- [ ] control points of every segment start and end exactly at the input points
- [ ] `core` stays pure — ESLint boundary rule passes
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
