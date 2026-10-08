---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-06"
feature_size: "M"
ticket: "roadmap step 4 — crop-rotate"
---

# 0003 — Open tools in an activeTool slot on the editor store, with the draft in the tool's own store

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The "Crop and rotate" tool edits a draft Geometry that is held apart from the Work until Apply (AC-11, AC-13, AC-17); ux-flows asks design where that draft lives. While the tool is open, Export and Ctrl/Cmd+S must refuse with a hint (AC-16), opening another image must still work and close the tool only on a confirmed replace (AC-17), the tool cannot open during an export (AC-15) or with no image (AC-18), and the Preview must show the draft, not the Work. The `editor` store today has one `phase` (`idle`, `reading`, `confirming`, `exporting`) and no notion of a tool. Features never import each other and coordinate through the `editor` store (repo ADR 0002). Adjustments (step 5) and drawing (step 6) are tools too, so this sets the pattern.

## Decision drivers

- spec AC-11, AC-13, AC-17: unapplied changes never count as Unsaved edits and are discarded with the old Work
- spec AC-15, AC-16, AC-18: refusals in both directions between the tool and export
- repo ADR 0002 and `CLAUDE.md` §Module boundaries: features coordinate only through the `editor` store
- sad.md §1 quality goal 2

## Considered options

1. **An `activeTool` slot on the `editor` store, separate from the phase; the draft in the tool's feature store** — the editor knows only which tool is open and what Geometry to preview; the tool owns its draft and rules.
2. **The draft inside the `editor` store** — the editor store holds the draft Geometry, the proportion and the field values; the crop-rotate folder holds only components.
3. **The tool as a new editor phase** — `phase: 'tool'` makes the tool exclusive, like `exporting`.

## Decision outcome

**Chosen:** Option 1. It keeps the `editor` store a coordinator that every tool uses the same way, while each tool's internals stay in its own folder. Because the slot is separate from the phase, AC-17's open, read, confirm and replace sequence runs through its normal phases with the tool still open. Option 2 grows the editor store with one tool's internals, and steps 5 and 6 would add theirs. Option 3 cannot express "tool open" and "reading a new image" at the same time, which AC-17 requires.

How it works:

- **`editor` store** (`src/features/editor/store.ts`):
  - `activeTool: ToolId | null`, where `ToolId = 'crop-rotate'` for now.
  - `openTool(id)` refuses when there is no Work (AC-18), when the phase is `exporting` (AC-15) or when a tool is already open, and returns the refusal reason for the hint.
  - `closeTool()` clears the slot and the preview override.
  - `previewGeometry: Geometry | null` is what the Preview draws while a tool is open, instead of `work.geometry`. It is drawn in whole-turned-image mode (`core/geometry`'s `turnedImageToOriginalUv` and `turnedBounds`), not cropped, so the Editor sees the whole turned image and the overlay draws the Crop over it (AC-12, AC-19).
  - `applyGeometry(next)` stores the Geometry and raises the revision through `applyEdit()` only when `geometryEquals` is false (AC-13).
  - `beginExport()` also refuses while `activeTool` is set (AC-16).
  - A successful replace of the Work closes the tool (AC-17).
  - fit-View measures the turned, uncropped image while a tool is open, and `workSize` otherwise (AC-19).
- **`crop-rotate` store** (`src/features/crop-rotate/store.ts`): on open, it copies `work.geometry` as the draft and the Geometry to return to. Every change goes through `core/geometry` and is pushed to `editor.previewGeometry`. Apply calls `editor.applyGeometry(draft)` then `closeTool()`, Cancel calls only `closeTool()`, and Reset changes only the draft (AC-12). It remembers the proportion per Work id until the Work is replaced (AC-08). It watches `activeTool` and drops the draft when the editor closes the tool.
- **export** reads `editor.activeTool` to disable Export and to turn Ctrl/Cmd+S into the "apply or cancel the crop first" hint (AC-16); it never imports the crop-rotate feature.

## Consequences

**Positive**
- One flag answers "is a tool open?" for export, the shortcuts and the open flow; steps 5 and 6 add a `ToolId` and their own store.
- Unapplied changes never touch the Work, so they can never raise the revision (AC-17).
- The crop-rotate store is unit-tested against a real `editor` store without a GPU.

**Negative**
- Two stores must stay in step: the tool store's watcher on `activeTool` is the only thing that discards a draft after a replace, and a missed watcher shows a stale draft on the next open. A store test covers it.
- `previewGeometry` is a second source the Preview must read correctly; drawing the Work while the tool is open would show the Crop instead of the whole image (AC-12).

**Neutral**
- Two tools can never be open at once; if a later tool needs to stack on another, `activeTool` becomes a small stack. That change stays inside the `editor` store.

## Links

- Spec: [[../spec.md]] AC-11, AC-12, AC-13, AC-15, AC-16, AC-17, AC-18, AC-19
- SAD: [[../sad.md]] §4 (choice 3), §5, §6
- Related ADR: [[0001-model-the-geometry-as-integer-parameters-with-one-core-transform]]; open-and-view ADR-0005 (revision counter); export §5 (exporting phase)
