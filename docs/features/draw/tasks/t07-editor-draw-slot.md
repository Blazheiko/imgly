---
id: T7
title: "Give the tool slot the 'draw' tool: keep Crop and View on open, previewLayer and setPreviewLayer, layerChanged, applyDrawing with the change flag, ExportSnapshot.drawing and the export refusal text"
layer: "app"
deps: ["T1", "T4"]
blocks: ["T8", "T10", "T11"]
acs: ["AC-12", "AC-13", "AC-15", "AC-18"]
files_hint: ["src/features/editor/tool-slot.ts", "src/features/editor/tool-slot.test.ts", "src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/editor/index.ts", "src/features/export/messages.ts", "src/features/export/messages.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 57 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Give the tool slot the 'draw' tool: keep Crop and View on open, previewLayer and setPreviewLayer, layerChanged, applyDrawing with the change flag, ExportSnapshot.drawing and the export refusal text

## Place in the sequence

- **Blocked by:** T1 — Extract the tool slot from the editor store into tool-slot.ts, with the store's public API and its tests unchanged · T4 — Add Work.drawing (DrawingLayer | null) and the render/drawing layer module: create, copy, release with ledger counts, readRect and hasAnyMark.
- **Blocks:** T8 — Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger · T10 — Send the applied layer to the export worker and its window fallback, render it in one or two passes, and make the crop-transparency check include the layer · T11 — Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace.
- **Wave:** 2 — alongside T5, T6.
- **Lane:** shares `src/features/editor/store.ts`, `src/features/editor/tool-slot.test.ts`, `src/features/editor/tool-slot.ts` with T1 — serialized.

## Why (user story)

> **US-04: Change my mind about a drawing session**
>
> **As a** Editor  
> **I want** to keep what I drew with Apply or throw it all away with Cancel  
> **So that** trying something out never spoils what I had before
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It is the one edit entry point for the Drawing layer: Apply reaches the Work only through it, and a Draft never counts as Unsaved edits on its own.

## Inlined context

> - **editor** (`store.ts`, `tool-slot.ts`): `ToolId` gains `'draw'`. `openTool('draw')` keeps the Crop and the View, as for `'adjust'`. New: `previewLayer` with `setPreviewLayer(layer | null)` (only while the "Draw" tool is open; `null` there means an empty Draft, for example after Clear, not "show the Work's layer"), `layerChanged(rect)`, which forwards to the renderer, and `applyDrawing(layer, changed)`, which is refused while exporting and raises the revision only when `changed` is true (§4). `closeTool()` clears `previewLayer`. `replace()` closes the tool, and the `draw` store releases its Draft when its tool is closed this way (AC-13). `ExportSnapshot` gains `drawing`, the applied layer or `null`.
>
> — `sad.md §5, Cross-feature changes, editor bullet, verbatim` · full text: [sad.md](../sad.md)

> **Apply.** `editor.applyDrawing(draft, changed)` stores the Draft as the Work's layer with a new id, raises the revision through `withEdit()` only when `changed` is true, and releases the previous applied layer. The renderer keys its texture on the bitmap, which Apply hands over unchanged, so Apply uploads nothing (ADR-0003).
>
> — `adr/0004 §Decision outcome, How it works «Apply», verbatim` · full text: [adr/0004](../adr/0004-hold-the-draft-as-a-full-copy-of-the-layer-and-hand-it-to-the-work-on-apply.md)

> - **export** (`store.ts`, `messages.ts`): … `infoToolOpen('draw')` says "Apply or cancel the drawing first, then export." for the action and Ctrl/Cmd+S (AC-15).
>
> — `sad.md §5, Cross-feature changes, export bullet, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
> `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder — May import: `core`, `shared`
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, table rows + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Compile-coupled (folded in):** `TOOL_OPEN: Record<ToolId, string>` in `src/features/export/messages.ts` stops compiling once `ToolId` gains `'draw'` — add the draw text here. `ExportSnapshot.drawing` is constructed only in `beginExport`. `applyDrawing(layer, changed)` takes the Draft (`DrawingLayer` without a fresh id, or `null`) and assigns `id: newId()`; it must not release the incoming bitmap, only the one it replaces, and only when that one is a different canvas. `layerChanged(rect)` calls `renderer?.updateLayer(rect)` on the held renderer (the store already holds it for `sampleWork`, L167–L172). On a successful `replace()` the old Work's applied layer is released (`releaseLayer`) — the draw store releases its own Draft (T11).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (`ToolId = 'crop-rotate' | 'adjust' | 'draw'`, `previewLayer`, `setPreviewLayer`, `layerChanged`, `applyDrawing`, `ExportSnapshot.drawing`.)

## Acceptance criteria

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

### AC-15 — cross-context

> **Given** the "Draw" tool is open
> **When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
> **Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the drawing first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page"
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor opens the "Draw" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** opening the tool does not change the View. Inside the tool a drag with the main mouse button draws instead of panning, while the other View controls keep working: Ctrl/Cmd+wheel and pinch zoom, the plain wheel and Shift+wheel pan, a drag with Space held pans, and the zoom keys and controls work as in open-and-view. While a button in the tool has focus, Space presses that button and does not pan, as Space-drag does outside the Compare button in the "Adjust" tool; while a text field has focus, Space types. None of them makes a Stroke, changes the Draft or counts as an edit, and a Stroke in progress is not broken by a zoom. While a Stroke is in progress (the pointer is still pressed), input waits for it to finish: a colour, mode or width change (by control or by B, E, [ or ]) applies from the next Stroke, Space does not start a pan, and Enter applies the tool only after the pointer is released. Escape cancels the tool at once, the partial Stroke included (AC-06). A pointer cancel, the window losing focus or a second touch (for example the start of a pinch) ends the Stroke where it is and keeps what was drawn so far. After Apply or Cancel the View stays as it was
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `ToolId` adds `'draw'`; `openTool('draw')` sets no `previewGeometry` and does not fit; `previewLayer` + `setPreviewLayer`; `closeTool` clears it — `src/features/editor/tool-slot.ts`
- [ ] `layerChanged`, `applyDrawing` (newId, withEdit only when changed, release replaced, refused while exporting), release the old layer on replace, `ExportSnapshot.drawing` — `src/features/editor/store.ts`
- [ ] Re-export new types — `src/features/editor/index.ts`
- [ ] `TOOL_OPEN.draw = 'Apply or cancel the drawing first, then export.'` + test — `src/features/export/messages.ts`, `messages.test.ts`
- [ ] Store/slot tests — `src/features/editor/store.test.ts`, `tool-slot.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| applyDrawing(layer, false) | layer stored, revision unchanged (AC-12) |
| applyDrawing(null, true) (Clear of a layer with marks) | work.drawing null, revision raised |
| applyDrawing during an export | ignored |
| applyDrawing with the same canvas the Work already has | nothing released |
| setPreviewLayer while 'adjust' or no tool is open | ignored |
| openTool('draw') while zoomed and panned | View unchanged (AC-18) |
| successful replace while draw is open | tool closes, previewLayer null, new Work drawing null, old layer released (AC-13) |

## Definition of Done

- [ ] store and slot tests cover each Edge case row
- [ ] export messages test covers the draw text (AC-15)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
