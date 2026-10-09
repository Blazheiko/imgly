---
id: T8
title: "Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments"
layer: "app"
deps: ["T1"]
blocks: ["T6", "T7", "T9", "T10", "T12"]
acs: ["AC-11", "AC-17", "AC-20"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/editor/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 54 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments

## Place in the sequence

- **Blocked by:** T1 — Add the Adjustments to the Work: type, fixed key order, ranges, NEUTRAL_ADJUSTMENTS, isNeutral and adjustmentsEquals.
- **Blocks:** T6 — Add PreviewRenderer.sampleCrop(geometry, maxSide) into a temporary framebuffer and the editor store's sampleWork() · T7 — Send the applied Adjustments to the export worker, set them as uniforms, and reduce smaller adjusted Exports in two passes · T9 — Make PreviewCanvas draw previewAdjustments ?? work.adjustments, and give the e2e hooks setAdjustments and an adjusted previewAt100 · T10 — Make the export refusal name the open tool and make 'Crop and rotate' and C hint 'apply or cancel the open tool first' while Adjust is open · T12 — Add the adjust store: Draft and values at open, set / commit typed fields, reset one or all, apply and cancel.
- **Wave:** 2 — alongside T2, T3.
- **Lane:** shares `src/features/editor/store.test.ts`, `src/features/editor/store.ts` with T6 — serialized.

## Why (user story)

> **US-05: Change my mind without losing anything**
>
> **As a** Editor  
> **I want** to cancel my changes, reset one slider or all of them, and come back later to change applied values  
> **So that** trying a look never costs me the original photo
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It is the one edit entry point for the Adjustments and keeps the Draft from ever counting as Unsaved edits.

## Inlined context

> - `ToolId` `'adjust'` next to `'crop-rotate'`. `openTool` already refuses during an export, under the export panel, during the replace confirmation and while another tool is open (AC-15, AC-18, AC-21)
> - the slot's crop-rotate side effects become per tool. Today `openTool` always sets `previewGeometry` and fits the View, `closeTool` fits it again, and `PreviewCanvas` draws the whole turned image whenever `previewGeometry` is set. For `'crop-rotate'` this stays as it is (crop-rotate AC-19). For `'adjust'`, `openTool` and `closeTool` leave `previewGeometry` null and the View untouched, so the Preview keeps showing the Work's Crop at the current zoom and pan (AC-20, AC-08, AC-12). Store tests cover both tools
> - `previewAdjustments` (the Draft, or neutral while Compare is held; null when the adjust tool is closed) and `applyAdjustments(next)`, which raises the revision only when the values differ (AC-11)
> - …
> - `closeTool()` already runs on a successful replace of the Work, so the Draft is dropped with the old Work (AC-17)
>
> — `sad.md §5, Cross-feature changes, editor store bullets, abridged` · full text: [sad.md](../sad.md)

> **Apply goes through `editor.applyAdjustments(next)`.** It stores the values and raises the revision through `withEdit()` only when `adjustmentsEquals(next, current)` is false, where `current` is the Work's value from when the tool opened, because nothing else can change it while the tool is open (AC-11).
>
> — `sad.md §4, decided inline, verbatim` · full text: [sad.md](../sad.md)

> `ExportSnapshot` and `ExportRequest` gain `adjustments`. …
>
> — `adr/0001 §Decision outcome, How it works bullet 3, abridged` · full text: [adr/0001](../adr/0001-model-the-adjustments-as-seven-integer-fields-on-the-work.md)

> The `editor` store keeps growing (466 lines before this feature) … Extract the tool slot and its previews into a `src/features/editor/tool-slot.ts` module before the drawing layer (step 6) adds a third tool, or as soon as the store passes 600 lines
>
> — `sad.md §11, editor store risk, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts`. May import `core`, `infra`, `render`, `shared`. Features never import each other. They coordinate through the `editor` store … Like crop-rotate, its only cross-feature import is `useEditorStore` from `@/features/editor`.
>
> — `CLAUDE.md §Module boundaries + sad.md §5 intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

Mirror `applyGeometry` (no-op during an export; `withEdit` only when changed). `setPreviewAdjustments(a | null)` is accepted only while `activeTool === 'adjust'`. The replace path that nulls `previewGeometry` also nulls `previewAdjustments`. `applyGeometry` keeps `adjustments` (spread) — add a test (AC-18's "any Geometry … keeps the Adjustments"). `ExportSnapshot` is constructed only in `beginExport`; T7 adds the matching `ExportRequest` field.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`ToolId = 'crop-rotate' | 'adjust'`, `previewAdjustments`, `setPreviewAdjustments(a | null)`, `applyAdjustments(next)`, `ExportSnapshot.adjustments`.)

## Acceptance criteria

### AC-11 — cross-context

> **Given** an image is open
> **When** the Editor applies the "Adjust" tool
> **Then** the Work has Unsaved edits only when the applied Adjustments differ from the ones the Work had when the tool was opened. The seven values are compared one by one, not by the pixels they produce, and an Apply with no change, or with values changed and then changed back by hand in the same tool, leaves the Unsaved edits as they were. The comparison is only with the values from when the tool was opened: after an Export, changing a value in one Apply and changing it back in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — cross-context

> **Given** the "Adjust" tool is open with a Draft that is not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with neutral Adjustments. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-20 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor opens the "Adjust" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** opening the tool does not change the View, zoom and pan keep working inside the tool, and none of them changes the Draft or counts as an edit. After Apply or Cancel the View stays as it was
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `ToolId` union; `openTool`/`closeTool` set `previewGeometry` and fit only for `'crop-rotate'` — `src/features/editor/store.ts`
- [ ] `previewAdjustments` shallowRef + `setPreviewAdjustments`; cleared by `closeTool` and on replace — `src/features/editor/store.ts`
- [ ] `applyAdjustments(next)` with `adjustmentsEquals` + `withEdit` — `src/features/editor/store.ts`
- [ ] `ExportSnapshot.adjustments` from `beginExport` — `src/features/editor/store.ts`
- [ ] Store tests for both tools: View/`previewGeometry` untouched for adjust; revision rules; replace clears; export snapshot — `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Apply with the values from open | revision unchanged, Unsaved edits as before |
| Change, Export (clean), then change back in a later Apply | revision raised: Unsaved edits (compared with the values at open, not the save point) |
| `openTool('adjust')` while zoomed and panned | View unchanged, `previewGeometry` stays null |
| `closeTool()` after adjust | View unchanged, `previewAdjustments` null |
| `applyAdjustments` during an export | ignored |
| `setPreviewAdjustments` while crop-rotate or no tool is open | ignored |
| Successful replace while adjust is open | tool closes, `previewAdjustments` null, new Work neutral |

## Definition of Done

- [ ] Store tests prove AC-11's revision rules, AC-20's untouched View for adjust (crop-rotate's fit behaviour unchanged), AC-17's clear on replace, and the snapshot's Adjustments
- [ ] Store stays under 600 lines, or the tool slot is extracted per the §11 risk
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
