---
id: T15
title: "Build DrawOverlay: pointer capture with coalesced positions into the Stroke session, the width circle at width × zoom, the hidden cursor over the image, Space-drag pass-through and a second touch"
layer: "ui"
deps: ["T12"]
blocks: ["T16"]
acs: ["AC-01", "AC-02", "AC-09", "AC-18"]
files_hint: ["src/features/draw/DrawOverlay.vue", "src/features/draw/DrawOverlay.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 53 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T15 — Build DrawOverlay: pointer capture with coalesced positions into the Stroke session, the width circle at width × zoom, the hidden cursor over the image, Space-drag pass-through and a second touch

## Place in the sequence

- **Blocked by:** T12 — Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released.
- **Blocks:** T16 — Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark.
- **Wave:** 6 — alone.
- **Lane:** own lane.

## Why (user story)

> **US-01: Draw freehand on the photo**
>
> **As a** Editor  
> **I want** to draw on the image with a brush by dragging across it and see the line appear under the pointer  
> **So that** I can circle, underline or write on the photo without another program
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It is the surface the Editor draws on, with the width circle that shows exactly what a Stroke will cover.

## Inlined context

> **Pointer over the image** (SCR-03): over the shown image the system cursor is hidden and a **width circle** follows the pointer. It is a ring whose diameter is the width at the current zoom (width × zoom device pixels), drawn as a 1 px `--color-text` ring inside a 1 px `--color-surface` ring so it shows on light and dark photos. The ring never takes the pointer and never draws itself. It follows the zoom live. Outside the shown image, over the canvas surround, the normal cursor shows and no ring is drawn (AC-02). A press there still starts a Stroke, which is clipped to the Crop (AC-09).
>
> — `screens.md §Shell changes, Pointer over the image, verbatim` · full text: [screens.md](../screens.md)

> Pointer events with pointer capture on the draw overlay, coalesced positions where the engine offers them. Each position maps with the View current at that event. A Stroke ends on release, pointer cancel, window blur or a second pointer, and keeps what was drawn (AC-18). Key, colour, width and Space changes during a Stroke apply from the next Stroke. Escape cancels at once
>
> — `sad.md §8, Input, verbatim` · full text: [sad.md](../sad.md)

> | Brownfield: `PreviewCanvas.vue` pans on any main-button drag over the canvas, and the draw overlay must take that drag instead (AC-18) | Low | The overlay sits above the canvas in the `tool-canvas` slot and lets drags through only while `editor.spacePan` is set, the mechanism crop-rotate's frame already uses. …
>
> — `sad.md §11, overlay drag risk, abridged` · full text: [sad.md](../sad.md)

> | `getCoalescedEvents()` is missing on some engine versions … | Low | Feature-detect it and fall back to the event itself. …
>
> — `sad.md §11, coalesced events risk, abridged` · full text: [sad.md](../sad.md)

Mirror `src/features/crop-rotate/CropOverlay.vue` for the slot geometry, pointer capture and the `editor.spacePan` pass-through (`pointer-events: none` while it is set). Wheel and pinch are not handled here — they bubble to the editor as today. While a Stroke is active, Space must not start a pan: tell the store and let the editor's Space handler check `drawStore.strokeActive` via the editor store (no cross-feature import).

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

## Checklist

- [ ] Pointer down/move/up/cancel with capture; coalesced points in device pixels → store — `src/features/draw/DrawOverlay.vue`
- [ ] Width circle element (tokens only), hidden outside the shown image; cursor none over it — `DrawOverlay.vue`
- [ ] Blur and second pointer end the Stroke; Space pass-through — `DrawOverlay.vue`
- [ ] Tests with synthetic PointerEvents — `src/features/draw/DrawOverlay.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| right or middle button | no Stroke |
| no getCoalescedEvents | the event itself is the one point |
| second touch during a Stroke | Stroke ends and is kept; pinch zoom proceeds |
| Space held, then drag | pan, no Stroke |
| press over the surround | Stroke starts (clipped later) |
| zoom changes | circle diameter updates live |

## Definition of Done

- [ ] overlay tests cover each Edge case row
- [ ] no colour literal in the overlay CSS
- [ ] real drag-vs-pan proven in T18
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
