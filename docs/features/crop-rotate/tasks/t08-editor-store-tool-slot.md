---
id: T8
title: "Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View"
layer: "app"
deps: ["T1", "T5"]
blocks: ["T9", "T10", "T11", "T13"]
acs: ["AC-13", "AC-15", "AC-17", "AC-18", "AC-19"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/editor/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 68 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View

## Place in the sequence

- **Blocked by:** T1 — Add the Geometry to the Work: type, identity, geometryEquals, workSize, rotateQuarter and flipOnScreen · T5 — Derive the one transform: cropToOriginalUv, turnedImageToOriginalUv, turnedBounds and the overlay's screen maths.
- **Blocks:** T9 — Make the Preview and the status bar follow the Geometry, and add the setGeometry test hook · T10 — Size the export from workSize, send the Geometry, and base the transparency hint on the GPU check · T11 — Refuse Export and Ctrl/Cmd+S while a tool is open with the 'apply or cancel the crop first' hint, and report the open panel · T13 — Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset.
- **Wave:** 3 — alongside T3, T6.
- **Lane:** own lane.

## Why (user story)

> **US-07: Change my mind without losing pixels**
>
> **As a** Editor  
> **I want** to cancel, reset or widen a crop I applied earlier  
> **So that** trying a frame never costs me part of the photo for good
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It is the coordinator every tool uses: one slot that says a tool is open, one entry point that applies a Geometry, and the refusals in both directions with export.

## Inlined context

> - **`editor` store** (`src/features/editor/store.ts`):
>   - `activeTool: ToolId | null`, where `ToolId = 'crop-rotate'` for now.
>   - `openTool(id)` refuses when there is no Work (AC-18), when the phase is `exporting` (AC-15) or when a tool is already open, and returns the refusal reason for the hint.
>   - `closeTool()` clears the slot and the preview override.
>   - `previewGeometry: Geometry | null` is what the Preview draws while a tool is open, instead of `work.geometry`. It is drawn in whole-turned-image mode (`core/geometry`'s `turnedImageToOriginalUv` and `turnedBounds`), not cropped, so the Editor sees the whole turned image and the overlay draws the Crop over it (AC-12, AC-19).
>   - `applyGeometry(next)` stores the Geometry and raises the revision through `applyEdit()` only when `geometryEquals` is false (AC-13).
>   - `beginExport()` also refuses while `activeTool` is set (AC-16).
>   - A successful replace of the Work closes the tool (AC-17).
>   - fit-View measures the turned, uncropped image while a tool is open, and `workSize` otherwise (AC-19).
>
> — `adr/0003 §How it works, editor store, verbatim` · full text: [adr/0003](../adr/0003-open-tools-in-an-active-tool-slot-with-the-draft-in-the-feature-store.md)

> It also gains `activePanel: 'export' | null`, which the export feature sets when its panel opens and closes, so the C key can stay silent while the panel is open (AC-20) without crop-rotate importing export.
>
> — `sad.md §5, Cross-feature changes bullet 2, last sub-bullet, verbatim` · full text: [sad.md](../sad.md)

> | Edit entry point | Every change to the Work goes through the `editor` store. The tool calls `applyGeometry(next)`, which stores it and raises the revision through `applyEdit()` only when the Geometry differs field by field (AC-13). The tool never writes the Work directly | open-and-view ADR-0005; ADR-0003 |
> | Tool state | One tool at a time in `editor.activeTool`, separate from the editor's phase. The draft lives in the tool's own Pinia setup store and reaches the Preview only through `editor.previewGeometry` | ADR-0003 |
>
> — `sad.md §8, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Features never import each other. They coordinate through the `editor` store … and there is no event bus.
>
> — `CLAUDE.md §Module boundaries, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Today: `phase` is `idle | reading | confirming | exporting` (`store.ts:111`); `applyEdit()` at line 285 uses `withEdit`; `beginExport()` at 293 refuses unless `idle`; `replace()` at 262; `context()` at 152 builds the fit-View image size from `original.width/height` — this task moves it to `turnedBounds` / `workSize`. The Preview reading `previewGeometry` is T9; the crop-rotate store calling these is T13.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Store surface added: `activeTool`, `openTool`, `closeTool`, `previewGeometry`, `setPreviewGeometry`, `applyGeometry`, `activePanel`, `setActivePanel`.)

## Acceptance criteria

### AC-13 — cross-context

> **Given** an image is open
> **When** the Editor applies the "Crop and rotate" tool
> **Then** the Work has Unsaved edits only when the applied Geometry differs from the Geometry the Work had when the tool was opened. Two Geometries are compared field by field (horizontal Flip, vertical Flip, Rotation, Straighten angle and Crop), not by the pixels they produce, so a horizontal and a vertical Flip applied to a Work that had a 180° Rotation count as a change. Four quarter turns, flipping twice, or an Apply with no change leave the Unsaved edits as they were. The comparison is only with the Geometry from when the tool was opened: after an Export, changing the Geometry and then changing it back by hand in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — authorization

> **Given** an export is in progress (export AC-11)
> **When** the Editor tries to open the "Crop and rotate" tool, by its button or by its keyboard shortcut
> **Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — cross-context

> **Given** the "Crop and rotate" tool is open with changes that are not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its changes until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its changes that were not applied are discarded with the old Work. If the new image cannot be opened or the replacement is declined, the tool stays open with its changes. Changes in the open tool that are not applied never count as Unsaved edits on their own
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — error

> **Given** no image is open
> **When** the Editor looks for the "Crop and rotate" tool or presses its keyboard shortcut
> **Then** the tool is unavailable, its hint says to open an image first, and the shortcut shows the same hint
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — cross-context

> **Given** an image is open
> **When** the Editor opens the "Crop and rotate" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** on opening, the View fits the whole image with its current Rotation, Flip and Straighten angle, so every edge of the frame can be reached. Zoom and pan keep working inside the tool, and they never change the Geometry or count as an edit. After Apply or Cancel, the View fits the Work
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

This task owns the store half of each: the refusal reasons (AC-15, AC-18), the field-equal Apply (AC-13), the replace closing the slot (AC-17) and fit-View per mode (AC-19). Hints, keys and UI are T11/T14/T17.

## Checklist

- [ ] `ToolId`, `activeTool`, `openTool(id): { ok: true } | { ok: false, reason: 'no-work' | 'exporting' | 'tool-open' }`, `closeTool()` — `src/features/editor/store.ts`
- [ ] `previewGeometry` + `setPreviewGeometry(g)` (only while a tool is open) — `src/features/editor/store.ts`
- [ ] `applyGeometry(next)`: refuse while exporting; store; `applyEdit()` only when `!geometryEquals(next, work.geometry)` — `src/features/editor/store.ts`
- [ ] `beginExport()` refuses while `activeTool` is set; `replace()` closes the tool; a refused read or `cancelReplace()` leaves it — `src/features/editor/store.ts`
- [ ] `context()` image size: `turnedBounds(previewGeometry)` while a tool is open, else `workSize(work)`; fit after `openTool` and `closeTool` — `src/features/editor/store.ts`
- [ ] `activePanel` + `setActivePanel` — `src/features/editor/store.ts`
- [ ] Export the new types from `src/features/editor/index.ts`; tests in `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `openTool` with no Work | refused, reason `no-work` |
| `openTool` while `exporting` | refused, reason `exporting`, nothing queued |
| `openTool` while `reading` or `confirming` | allowed only if no tool is open (AC-17 keeps an open tool through these phases) |
| `applyGeometry` with an equal Geometry | stored, revision unchanged |
| Apply A, export (clean), Apply back to the pre-A Geometry | revision raised — compared only with the Geometry at open |
| Drop while the tool is open, read fails | tool stays open, `previewGeometry` kept |
| Replace confirmed or no Unsaved edits | `activeTool` null, `previewGeometry` null |
| Zoom or pan while the tool is open | View changes; Geometry and revision untouched |

## Definition of Done

- [ ] Vitest proves each `openTool` refusal and its reason (AC-15, AC-18)
- [ ] Vitest proves AC-13's revision rule on `applyGeometry`, including the after-export case
- [ ] Vitest proves AC-17's replace / failed read / declined replace outcomes for the slot, and `beginExport()` refusing while a tool is open
- [ ] Vitest proves fit-View uses `turnedBounds` with a tool open and `workSize` otherwise (AC-19)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
