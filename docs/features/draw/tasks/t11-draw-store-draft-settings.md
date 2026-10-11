---
id: T11
title: "Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace"
layer: "app"
deps: ["T2", "T4", "T7"]
blocks: ["T12", "T13", "T14"]
acs: ["AC-01", "AC-02", "AC-03", "AC-05", "AC-06", "AC-12", "AC-13"]
files_hint: ["src/features/draw/store.ts", "src/features/draw/store.test.ts", "src/features/draw/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 76 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace

## Place in the sequence

- **Blocked by:** T2 — Add src/core/draw: palette and defaults, parseWidth and stepWidth, Catmull–Rom segments, segment bounds and footprintReachesCrop · T4 — Add Work.drawing (DrawingLayer | null) and the render/drawing layer module: create, copy, release with ledger counts, readRect and hasAnyMark · T7 — Give the tool slot the 'draw' tool: keep Crop and View on open, previewLayer and setPreviewLayer, layerChanged, applyDrawing with the change flag, ExportSnapshot.drawing and the export refusal text.
- **Blocks:** T12 — Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released · T13 — Add the 'Draw' toolbar action with its hints, the D shortcut and the message catalog, mounted after 'Adjust' · T14 — Add an optional swatch to SegmentedControl, register it, and build DrawControls: mode, palette, custom colour, width slider and field, Clear, Cancel and Apply.
- **Wave:** 3 — alongside T8, T10.
- **Lane:** shares `src/features/draw/store.test.ts`, `src/features/draw/store.ts` with T12; shares `src/features/draw/index.ts` with T13; shares `src/features/draw/index.ts` with T16 — serialized.

## Why (user story)

> **US-04: Change my mind about a drawing session**
>
> **As a** Editor  
> **I want** to keep what I drew with Apply or throw it all away with Cancel  
> **So that** trying something out never spoils what I had before
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It owns the Draft, so Apply keeps what was drawn and Cancel throws it all away without touching the Work.

## Inlined context

> **Open.** `editor.openTool('draw')` keeps the Crop and the View, as for "Adjust". The `draw` store makes its Draft a copy of `work.drawing` (one `drawImage` into a new W₀×H₀ canvas), or `null` when the Work has no layer. It then calls `editor.setPreviewLayer(draft)` …
> **Paint and Clear.** Strokes paint the Draft (ADR-0002), and Clear releases it and sets it to `null` (ADR-0001). The store keeps a `changed` flag for AC-12 …
> **Cancel, Escape, replacing the Work.** The Draft is released and the tool slot closes, so the Preview shows `work.drawing` again. … `editor.replace()` closes the tool and releases the Draft with the old Work (AC-13) …
> **Tool settings.** The colour and the width live in the `draw` store outside the Draft. They are kept on Apply, Cancel and a new image until reload, and they are never edits (AC-02). The mode is reset to the Brush on every open (AC-01).
>
> — `adr/0004 §Decision outcome, How it works, abridged` · full text: [adr/0004](../adr/0004-hold-the-draft-as-a-full-copy-of-the-layer-and-hand-it-to-the-work-on-apply.md)

> a Clear of a Draft whose bitmap had some pixel with alpha above 0, judged by one scan of the bitmap.
> Drawing a mark and erasing it again therefore still counts (AC-12). `editor.applyDrawing` raises the revision only when the flag is true.
>
> — `sad.md §4, decided inline, change flag bullet 3 + follow-up, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
> `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder — May import: `core`, `shared`
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, table rows + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

The only cross-feature import is `useEditorStore` from `@/features/editor` (as in `src/features/adjust/store.ts`, which watches `editor.activeTool` at L29 to notice an external close — do the same to release the Draft on replace). The Draft bitmap is held in a plain (non-reactive) field; expose a reactive `hasDraft`/`mode`/`colour`/`width` for the UI. The Stroke session (T12) is not in this task — leave a `strokeActive` flag (false) that T12 sets, so Apply can wait for it. Width-field text uses T2's `parseWidth`; `[`/`]` use `stepWidth`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (`useDrawStore`: `open()`, `mode`, `colour`, `width`, `setMode`, `setColour`, `setWidth`, `commitWidthText`, `stepWidth`, `clear()`, `apply()`, `cancel()`.)

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

### AC-03 — error

> **Given** the "Draw" tool is open
> **When** the Editor types a width that is outside 1 to 200, fractional, empty or not a number
> **Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound (1 or 200), a fractional value rounds to the nearest whole number with an exact half rounding up (2.5 becomes 3), and an empty or non-numeric value returns to the previous width. A value is a number under the same rule as crop-rotate AC-07 and adjust AC-05: plain decimal notation with an optional sign and one decimal point or decimal comma, however long; scientific notation such as `1e2` is not a number. A trailing "px" is accepted in any letter case and with or without spaces before it, so "20px", "20 px" and "20PX" all mean 20. Nothing is checked while the Editor is still typing, and pressing Enter in the field only applies the value and does not apply the tool
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

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

### AC-12 — cross-context

> **Given** an image is open
> **When** the Editor applies the "Draw" tool
> **Then** the Work has Unsaved edits when the applied Draft contains at least one change: a Brush Stroke with any painted part inside the Crop, or an Eraser Stroke or a Clear that removed any mark. The layer is not compared pixel by pixel, so drawing a mark and erasing it again in the same Draft still counts as a change. An Apply with no Stroke, with Brush Strokes only outside the Crop, with an Eraser Stroke only where nothing was drawn, or with a Clear of an already empty Drawing layer leaves the Unsaved edits as they were, as an Apply with no change does in crop-rotate AC-13 and adjust AC-11. The comparison is only with the Drawing layer from when the tool was opened: after an Export, drawing a mark in one Apply and erasing it in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — cross-context

> **Given** the "Draw" tool is open with a Draft that is not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with an empty Drawing layer. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] State + open (copy or null, setPreviewLayer, mode Brush) — `src/features/draw/store.ts`
- [ ] Settings kept across Apply/Cancel/new image; never touch the revision — `src/features/draw/store.ts`
- [ ] `clear()` (hasAnyMark → flag, releaseLayer, Draft null, setPreviewLayer(null)); `apply()`; `cancel()`; watch external close → release — `src/features/draw/store.ts`
- [ ] Tests with a real editor store and fake layer factory — `src/features/draw/store.test.ts`; barrel — `src/features/draw/index.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| first open in the session | Brush, #E53935, 12 px |
| open after Cancel with Blue / 40 px chosen | Brush, Blue, 40 px |
| Clear on a null Draft | flag unchanged; Apply leaves Unsaved edits as they were |
| Clear, then a new Stroke, then Apply | Draft has the new Stroke only; applied marks gone |
| Apply with no change | applyDrawing(draft, false); revision unchanged |
| Cancel after Clear | Work keeps its layer; Draft released (ledger balanced) |
| replace confirmed while open | Draft released, tool closed; declined → Draft kept |

## Definition of Done

- [ ] store tests cover each Edge case row and each AC above
- [ ] ledger: after Apply or Cancel exactly one or zero layers retained
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
