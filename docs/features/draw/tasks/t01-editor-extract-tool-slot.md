---
id: T1
title: "Extract the tool slot from the editor store into tool-slot.ts, with the store's public API and its tests unchanged"
layer: "app"
deps: []
blocks: ["T7"]
acs: ["AC-16"]
files_hint: ["src/features/editor/tool-slot.ts", "src/features/editor/tool-slot.test.ts", "src/features/editor/store.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "S"   # measured: 36 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Extract the tool slot from the editor store into tool-slot.ts, with the store's public API and its tests unchanged

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** T7 — Give the tool slot the 'draw' tool: keep Crop and View on open, previewLayer and setPreviewLayer, layerChanged, applyDrawing with the change flag, ExportSnapshot.drawing and the export refusal text.
- **Wave:** 1 — alongside T2, T3, T4.
- **Lane:** shares `src/features/editor/store.ts`, `src/features/editor/tool-slot.test.ts`, `src/features/editor/tool-slot.ts` with T7 — serialized.

## Why (user story)

> **US-07: Draw on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the draw tool and its controls by mouse or keyboard without instructions  
> **So that** I can judge the drawing tool in the open, edit and save flow
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It makes room for the third tool, so "only one of the three tools can be open at a time" lives in one small module instead of a 515-line store.

## Inlined context

> **The tool slot is extracted from the `editor` store before the third tool lands** (decided inline; it answers adjust sad.md §11's risk, due before this step's `tasks`). The store is 515 lines today and draw adds the layer preview, `applyDrawing` and the snapshot's layer. One refactoring task moves `activeTool`, `openTool`, `closeTool`, the per-tool previews (`previewGeometry`, `previewAdjustments`, `previewLayer`) and their setters into `src/features/editor/tool-slot.ts`, which the store composes. The store's public API stays as it is, and its existing tests must pass unchanged before any draw code is added.
>
> — `sad.md §5, tool slot extraction, verbatim` · full text: [sad.md](../sad.md)

> Tools open in the `editor` store's `activeTool` slot, with their Draft in the tool's own store (crop-rotate ADR-0003 …). `ToolId` is `'crop-rotate' | 'adjust'` today. "Crop and rotate" shows the whole turned image (`previewGeometry`, mode `whole`), and "Adjust" keeps the Work's Crop and the View
>
> — `sad.md §2, Technical, tool slot bullet, abridged (link text only)` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
> `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder — May import: `core`, `shared`
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, table rows + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

This is a pure refactor: `previewLayer` is **not** added here (T7 adds it). Today `openTool` refuses with `no-work`, `exporting`, `tool-open`, `panel-open`, `confirming` in that order, sets `previewGeometry` and fits only for `crop-rotate`, and `closeTool` clears `previewGeometry` + `previewAdjustments` and re-fits after crop-rotate (`src/features/editor/store.ts` ~L203–L250). `tool-slot.ts` takes what it needs (the `work`, `phase`, `activePanel` refs and `fitIfSized`) as arguments — a plain composable, not a second Pinia store, so `useEditorStore()`'s returned shape is unchanged.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (`useEditorStore()` returns exactly the same members before and after.)

## Acceptance criteria

### AC-16 — cross-context

> **Given** an image is open
> **When** the Editor tries to open one of the "Crop and rotate", "Adjust" and "Draw" tools while another of them is open
> **Then** only one of the three tools can be open at a time: while one is open, the other two buttons are unavailable with a hint to apply or cancel the open tool first, and their keyboard shortcuts show the same hint, except while a text field has focus, when the shortcuts do nothing. This extends the one-tool rule of adjust AC-18 and the shortcut behaviour of crop-rotate AC-20 (the C key) and adjust AC-21 (the A key) to the "Draw" tool
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Create `createToolSlot(deps)` holding `activeTool`, `previewGeometry`, `previewAdjustments`, `openTool`, `closeTool`, `setPreviewGeometry`, `setPreviewAdjustments` — `src/features/editor/tool-slot.ts`
- [ ] Compose it in the store and re-export the same names; move `ToolId`/`ToolRefusal` there and re-export from `store.ts` so `@/features/editor` imports still resolve — `src/features/editor/store.ts`
- [ ] Add focused unit tests for the slot (refusal order, one tool at a time, per-tool side effects) — `src/features/editor/tool-slot.test.ts`
- [ ] Run the whole suite with no edits to any existing `*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| openTool while another tool is open | refused with `tool-open`, slot unchanged (AC-16) |
| openTool during an export | refused with `exporting`, not queued |
| closeTool with no tool open | no-op |
| crop-rotate close | View re-fits, exactly as before the refactor |

## Definition of Done

- [ ] `tool-slot.test.ts` covers refusal order and one-tool-at-a-time
- [ ] every pre-existing test passes with zero changes to test files
- [ ] `src/features/editor/store.ts` shrinks by the moved code; its public API is identical (typecheck proves every consumer still compiles)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
