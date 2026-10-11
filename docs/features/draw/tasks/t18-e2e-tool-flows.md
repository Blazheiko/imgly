---
id: T18
title: "Add the e2e tool-flow suite: the live line through every position, a dot, the Eraser, Clear, Apply and Cancel, the clip at the Crop, drag vs pan and zoom in the tool, the keyboard path and the layer ledger"
layer: "tests"
deps: ["T16"]
blocks: ["T20"]
acs: ["AC-01", "AC-02", "AC-04", "AC-05", "AC-06", "AC-09", "AC-18", "AC-19"]
files_hint: ["e2e/draw/tool.spec.ts", "e2e/draw/helpers.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 73 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T18 — Add the e2e tool-flow suite: the live line through every position, a dot, the Eraser, Clear, Apply and Cancel, the clip at the Crop, drag vs pan and zoom in the tool, the keyboard path and the layer ledger

## Place in the sequence

- **Blocked by:** T16 — Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark.
- **Blocks:** T20 — Complete the @perf suite: drawing frame interval and latency through the real overlay, tool-ready, Apply / Cancel / Clear and Crop-and-rotate Apply over a full layer, export time with a full layer, and memory after 50 Applies.
- **Wave:** 8 — alongside T19.
- **Lane:** shares `e2e/draw/helpers.ts` with T17; shares `e2e/draw/helpers.ts` with T19 — serialized.

## Why (user story)

> **US-01: Draw freehand on the photo**
>
> **As a** Editor  
> **I want** to draw on the image with a brush by dragging across it and see the line appear under the pointer  
> **So that** I can circle, underline or write on the photo without another program
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It exercises the tool the way the Editor and the Portfolio reviewer use it, in real browsers.

## Inlined context

> AC-01's path rules (through every reported position, a round dot for a click, unchanged after release) are e2e checks on Chromium. They compare the Preview read during the Stroke with the Preview after release, and the curve's control points are covered by `core/draw` units.
> Spec §7's "≤ 3 actions" KPI is the e2e tool flow of AC-19.
> The bitmap ledger assertion (§7) runs in every e2e build, so a missed release fails CI before the memory row does.
>
> — `sad.md §10, QG-3 How verify bullets, abridged` · full text: [sad.md](../sad.md)

> An e2e test checks that drag draws, Space-drag pans, and the wheel zooms in the tool
>
> — `sad.md §11, overlay drag risk mitigation, verbatim` · full text: [sad.md](../sad.md)

Lane: shares `e2e/draw/helpers.ts` with T17 and T19. Use `page.mouse` with `steps` for scripted Strokes; read pixels with `previewAt100` or a canvas readback hook. Assert the ledger with `__imglyTest.layerLedger()` after Apply, Cancel, Escape and replace.

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

### AC-02 — happy path

> **Given** the "Draw" tool is open
> **When** the Editor picks a colour from the palette or from the custom colour picker, or sets the width with its slider or number field
> **Then** every Stroke made afterwards uses that colour and width, and Strokes already made keep theirs. The palette shows 10 preset colours in this order: black #000000, white #FFFFFF, red #E53935 (the first-time colour), orange #FB8C00, yellow #FDD835, green #43A047, cyan #00ACC1, blue #1E88E5, purple #8E24AA and pink #D81B60. The chosen colour is marked when it is one of them, and the custom picker offers any fully opaque colour. The width is a whole number of image pixels from 1 to 200, so a Stroke looks thicker when the Editor zooms in and has exactly that width in a full-size Export. Over the image the pointer shows a circle outline of the current width at the current zoom. The Brush and the Eraser share the width. The colour and the width are remembered as soon as they are chosen, whether the tool is then applied or cancelled, until the app is reloaded, also when another image is opened. They are tool settings, not edits, and never count as Unsaved edits. The mode is not remembered: the tool always opens on the Brush (AC-01)
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the "Draw" tool is open on a Work whose Drawing layer has marks, applied earlier or drawn in this Draft
> **When** the Editor selects the Eraser and drags across some of the marks, or clicks on one
> **Then** the marks under the Eraser's path, at the current width, disappear, and inside that path the image shows exactly as it does where nothing was ever drawn. A click without moving erases one round dot of the current width, as a Brush click paints one; it never removes a whole Stroke, because Strokes drawn in this Draft merge into the layer just as applied ones do. The Eraser has smooth edges like the Brush, so at the edge of its path a mark may keep a partly transparent fringe up to 1 px wide. Where nothing is drawn the Eraser changes nothing: it never removes, lightens or makes transparent any pixel of the image itself. The change takes effect on Apply like any other Stroke
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — happy path

> **Given** the "Draw" tool is open on a Work whose Drawing layer has marks
> **When** the Editor chooses Clear
> **Then** every mark disappears from the Preview at once, without a confirmation. Clear empties the whole Drawing layer: the marks applied earlier and the marks hidden outside a narrower Crop (AC-08) are removed too, so widening the Crop after Clear and Apply shows no mark. Clear changes only the Draft: Apply makes the empty Drawing layer the Work's, and Cancel brings back the marks applied before the tool was opened. Strokes drawn after Clear in the same Draft are kept
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — happy path

> **Given** the Editor has drawn, erased or cleared in the open "Draw" tool
> **When** the Editor chooses Cancel or presses Escape
> **Then** the tool closes and the Work keeps the Drawing layer it had before the tool was opened, with its Unsaved edits unchanged
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — domain invariant

> **Given** the "Draw" tool is open
> **When** a Stroke starts, passes or ends outside the Work's Crop, for example in the area around the image
> **Then** the Stroke is drawn at its full width along the whole pointer path and then clipped to the Crop: only the painted area that lies inside the Crop is painted or erased, and the rest leaves no mark. So a wide Stroke whose pointer path runs just outside a Crop edge paints the band of it that reaches inside, as the width circle shows, and a press just outside paints the part of its round dot that lies inside. Widening the Crop later shows no mark from the parts that were outside
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor opens the "Draw" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** opening the tool does not change the View. Inside the tool a drag with the main mouse button draws instead of panning, while the other View controls keep working: Ctrl/Cmd+wheel and pinch zoom, the plain wheel and Shift+wheel pan, a drag with Space held pans, and the zoom keys and controls work as in open-and-view. While a button in the tool has focus, Space presses that button and does not pan, as Space-drag does outside the Compare button in the "Adjust" tool; while a text field has focus, Space types. None of them makes a Stroke, changes the Draft or counts as an edit, and a Stroke in progress is not broken by a zoom. While a Stroke is in progress (the pointer is still pressed), input waits for it to finish: a colour, mode or width change (by control or by B, E, [ or ]) applies from the next Stroke, Space does not start a pan, and Enter applies the tool only after the pointer is released. Escape cancels the tool at once, the partial Stroke included (AC-06). A pointer cancel, the window losing focus or a second touch (for example the start of a pinch) ends the Stroke where it is and keeps what was drawn so far. After Apply or Cancel the View stays as it was
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to draw on it
> **Then** a "Draw" action is visible in the toolbar next to "Adjust". It can be reached with Tab and activated with Enter or Space, and the D key opens it as well, under the same rule as the A key for "Adjust": the letter d, or the D key itself on a layout that types no Latin letter there. The D key does nothing while the export panel is open, while the "Draw" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab; B selects the Brush and E selects the Eraser under the same letter-first rule, silent in a text field. [ and ] make the width 1 smaller or larger, and 10 with Shift held. Each is recognised by the character it types ([ or ]) or, on a layout that does not type that character there, by its key position (the two keys right of P), so Shift+[ works although it types "{" and the German ü and + keys work too. Holding the key repeats the change, the result stays within 1 to 200 (195 plus 10 gives 200), and both are silent in a text field. Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-03). Escape cancels the tool from anywhere in it, including a field. Drawing a mark itself needs a mouse, a pen or a finger. Circling something and keeping it takes three actions: open the tool, draw, Apply
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Path, dot, Eraser, Clear, Apply/Cancel/Escape, clip, drag-vs-pan-vs-zoom, keyboard-only, ledger — `e2e/draw/tool.spec.ts`
- [ ] Shared helpers additions — `e2e/draw/helpers.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| fast curve | no gaps or corners; passes every position |
| Escape mid-Stroke | tool closed, layer as before |
| colour change mid-Stroke via B/E/[ | applies from the next Stroke |
| Clear then Cancel | applied marks back |

## Definition of Done

- [ ] suite green on Chromium, Firefox and WebKit (path rules on Chromium)
- [ ] circle-and-keep in three actions demonstrated (spec §7 KPI)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
