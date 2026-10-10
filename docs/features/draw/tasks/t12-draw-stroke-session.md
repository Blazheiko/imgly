---
id: T12
title: "Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released"
layer: "app"
deps: ["T3", "T5", "T9", "T11"]
blocks: ["T15"]
acs: ["AC-01", "AC-04", "AC-09", "AC-12", "AC-18"]
files_hint: ["src/features/draw/stroke-session.ts", "src/features/draw/stroke-session.test.ts", "src/features/draw/store.ts", "src/features/draw/store.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 59 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released

## Place in the sequence

- **Blocked by:** T3 — Add frameToOriginal to the Geometry transform and deviceToFrame to the View, both unit-tested against the existing UV transform · T5 — Add the painter: paintSegment and paintDot with Brush source-over and Eraser destination-out under setTransform(frameToOriginal) and clip(crop), the dirty rectangle and the alpha-lowered check · T9 — Spike the hot path: a @perf e2e that paints scripted Strokes through the hooks at 1 px and 200 px, at Fit and at 100%, and records the frame interval and the pointer-to-frame latency · T11 — Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace.
- **Blocks:** T15 — Build DrawOverlay: pointer capture with coalesced positions into the Stroke session, the width circle at width × zoom, the hidden cursor over the image, Space-drag pass-through and a second touch.
- **Wave:** 5 — alone.
- **Lane:** shares `src/features/draw/store.test.ts`, `src/features/draw/store.ts` with T11 — serialized.

## Why (user story)

> **US-01: Draw freehand on the photo**
>
> **As a** Editor  
> **I want** to draw on the image with a brush by dragging across it and see the line appear under the pointer  
> **So that** I can circle, underline or write on the photo without another program
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It turns the pointer into the live line: under the pointer, through every reported position, and identical after release.

## Inlined context

> A press starts a Stroke with the colour and width chosen at that moment. On an empty Draft, the first Brush Stroke creates the bitmap. Each pointer event's positions, coalesced ones included, are mapped with the View current at that event. They are joined by a curve that passes through every one, painted with round ends and clipped to the Crop by painted area (AC-01, AC-09). The change flag turns on when the footprint reaches inside the Crop (AC-12). Once per frame only the changed rectangle reaches the Preview (§6 timing). A zoom or pan during the Stroke does not break it. A key, a colour or width change, or Space waits for the Stroke to end, and Space does not pan (AC-18). Release paints the last segment without changing what was drawn. A click without moving paints one round dot. A pointer cancel, losing focus or a second touch ends the Stroke and keeps it (AC-01, AC-18).
>
> — `sad.md §6, F2 prose, verbatim` · full text: [sad.md](../sad.md)

> The Eraser removes marks along its path at the shared width, clipped to the Crop. It works on the layer only, so where nothing is drawn it changes nothing. … The change flag turns on once a segment actually lowered some layer pixel's alpha (AC-12).
>
> — `sad.md §6, F4 prose, abridged` · full text: [sad.md](../sad.md)

> The first Brush Stroke on a `null` Draft creates a transparent bitmap, and an Eraser Stroke on a `null` Draft changes nothing (AC-04).
>
> — `adr/0001 §Decision outcome, How it works «When it exists», abridged` · full text: [adr/0001](../adr/0001-hold-the-drawing-layer-as-one-bitmap-in-the-original-pixel-space-created-on-the-first-mark.md)

> The hot path does not go through Vue reactivity. A pointer event goes to the `draw` store's Stroke session, which calls the painter. Once per frame the dirty rectangle goes to `editor.layerChanged(rect)` and on to the renderer. The bitmap handle sits in a plain field, so a pointer move triggers no reactive update.
>
> — `sad.md §5, intro, abridged` · full text: [sad.md](../sad.md)

Apply whatever fallback T9 recorded in `_epic.md` §Risks (mipmaps every other frame below 100%, one coalesced batch per frame, …). The session is a plain class (`begin(points, view, crop)`, `move(points, view)`, `end()`, `abort()`); the overlay (T15) only feeds it. Escape is `store.cancel()` which calls `abort()` then releases — the partial Stroke goes with the Draft. Deferred input: the store applies pending mode/colour/width at `end()`; `apply()` while `strokeActive` sets `applyAfterRelease`.

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

### AC-18 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor opens the "Draw" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** opening the tool does not change the View. Inside the tool a drag with the main mouse button draws instead of panning, while the other View controls keep working: Ctrl/Cmd+wheel and pinch zoom, the plain wheel and Shift+wheel pan, a drag with Space held pans, and the zoom keys and controls work as in open-and-view. While a button in the tool has focus, Space presses that button and does not pan, as Space-drag does outside the Compare button in the "Adjust" tool; while a text field has focus, Space types. None of them makes a Stroke, changes the Draft or counts as an edit, and a Stroke in progress is not broken by a zoom. While a Stroke is in progress (the pointer is still pressed), input waits for it to finish: a colour, mode or width change (by control or by B, E, [ or ]) applies from the next Stroke, Space does not start a pan, and Enter applies the tool only after the pointer is released. Escape cancels the tool at once, the partial Stroke included (AC-06). A pointer cancel, the window losing focus or a second touch (for example the start of a pinch) ends the Stroke where it is and keeps what was drawn so far. After Apply or Cancel the View stays as it was
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Session: point buffer, deviceToFrame per event, catmullRomSegments, paint i−1→i when i+1 arrives, last on end, dot on click — `src/features/draw/stroke-session.ts`
- [ ] Flag: footprintReachesCrop for Brush; alphaLowered (snapshot rect before) for Eraser until set — `stroke-session.ts`
- [ ] rAF flush: union dirty rect → `editor.layerChanged` once per frame (+ T9 fallback) — `stroke-session.ts`
- [ ] Store integration: begin/move/end/abort, deferred settings, Enter waits, Escape aborts — `src/features/draw/store.ts`
- [ ] Tests with fake painter, fake rAF and a real editor store — `stroke-session.test.ts`, `store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| zoom between two moves | later points map with the new View; earlier paint unchanged |
| Eraser on a null Draft | no layer created, flag unchanged |
| Brush entirely outside the Crop (beyond width/2) | nothing painted, flag stays false (AC-12) |
| colour change mid-Stroke | current Stroke keeps its colour; next Stroke uses the new one |
| Enter mid-Stroke | Apply runs right after release |
| Escape mid-Stroke | tool cancels at once, partial Stroke discarded |
| pointercancel / blur / second pointer | Stroke ends where it is, kept |
| two flushes in one frame | one layerChanged call with the union rect |

## Definition of Done

- [ ] session and store tests cover each Edge case row
- [ ] no Vue reactivity on the pointer path (no reactive write per move)
- [ ] real line shape proven in T18
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
