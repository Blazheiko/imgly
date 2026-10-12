---
id: T5
title: "Expose undo, redo, canUndo, canRedo, undoTool, redoTool and historyStats on the editor store, with the refusals and the View fit"
layer: "app"
deps: ["T4"]
blocks: ["T8", "T9"]
acs: ["AC-03", "AC-07", "AC-08", "AC-12"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/editor/edit-history.ts", "src/features/editor/index.ts", "src/features/export/ExportPanel.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 57 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Expose undo, redo, canUndo, canRedo, undoTool, redoTool and historyStats on the editor store, with the refusals and the View fit

## Place in the sequence

- **Blocked by:** T4 — Add the edit-history composable, record a Step on every counting Apply, make withEdit take the revision, and move layer release to one path.
- **Blocks:** T8 — Build UndoRedoActions (two ghost BaseButtons with hints) and mount it first in the top bar with the shortcuts; T9 — Expose the editor store's historyStats through window.__imglyTest for the e2e memory checks.
- **Wave:** 5.
- **Lane:** shares `src/features/editor/edit-history.ts`, `src/features/editor/store.test.ts`, `src/features/editor/store.ts` with T4 — serialized.

## Why (user story)

> **US-05: Keep a long session safe**
>
> **As an** Editor  
> **I want** undo to stay reliable while a tool is open, while an export runs, and through a long session  
> **So that** undoing never mixes with an unapplied tool, never changes a file being saved and never makes the app run out of memory
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It turns the history into the store's public Undo/Redo API, refusing it whenever it could mix with an open tool or a running export.

## Inlined context

> The store exposes five getters, `canUndo`, `canRedo`, `undoTool`, `redoTool` and `historyStats` (`{ heldBytes, steps }`, read by `src/app/test-hooks.ts` through `@/features/editor` for the e2e memory checks), and two actions, `undo` and `redo`. The three tool features don't change.
> […] `undo()` and `redo()` set the Work with `withState`, fit the View when the image's size changed (AC-12), and refuse when a tool is open, an export runs or the replace dialog is open.
>
> — `adr/0004 §Decision outcome, How it works bullets 2–3, abridged` · full text: [adr/0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature.md](../adr/0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature.md)

> **When Undo and Redo are available:** a Work is open, no tool is open (AC-08), no export is running (AC-07) and the replace dialog is closed. They stay available while an image is being read and under the open export panel. The panel's size field already follows the Work through a `computed` (AC-14 "from anywhere in the editor").
> **View:** an Undo or Redo that changes the image's size fits the View, as a "Crop and rotate" Apply does. Any other Undo or Redo keeps the View (AC-06, AC-12).
>
> — `sad.md §4, tactical rules, availability + View, verbatim` · full text: [sad.md](../sad.md)

> Undo under the open export panel (ledger L7): an Undo that changes the image's size can leave the panel's chosen size above the restored Work's long side — Mitigation: `ExportPanel` already derives `workSize` from `editor.work` through a `computed` and normalizes the long side against it. A component test in `tasks` covers an Undo of a size-changing Crop under the open panel
>
> — `sad.md §11, export panel row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, features row + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Code facts: `phase` is `'idle' | 'reading' | 'confirming' | 'exporting'` (`store.ts` ~L136); `fitIfSized()` at ~L268; `activeTool` comes from the tool slot. `undoTool`/`redoTool` are the history's `undoLabel`/`redoLabel` (`ToolId | null`). `historyStats` = `{ heldBytes: heldLayerBytes(history), steps: entries.length - 1 }`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-03 (US-03) — domain invariant

> **Given** the Editor has opened an image, then applied a Crop, Adjustments and a drawing in that order
> **When** the Editor chooses Undo three times, and then Redo three times
> **Then** after the three Undos the Work is exactly the Work as it was opened, and after the three Redos it is exactly the Work as it was after the drawing: a full-size Export at each point is identical, pixel for pixel, to an Export of that same state made before any Undo. Undo and redo never approximate a state; they restore it
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-07 (US-05) — authorization

> **Given** an export is in progress (export AC-11)
> **When** the Editor tries to Undo or Redo, by the buttons or by the shortcuts
> **Then** the request is refused, not queued: both buttons are visibly unavailable and the shortcuts only show a hint that an export is in progress, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export. When the export ends, Undo and Redo become available again with the same Edit history
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 (US-05) — cross-context

> **Given** "Crop and rotate", "Adjust" or "Draw" is open
> **When** the Editor tries to Undo or Redo, by the buttons or by the shortcuts
> **Then** the Work does not change and the open tool keeps its unapplied changes: Undo and Redo are unavailable with a hint to apply or cancel the open tool first, and the shortcuts show the same hint. While a text or number field has focus, the shortcuts keep their usual meaning inside that field and do not touch the Edit history. After Apply or Cancel, Undo and Redo work on the Edit history, which now includes that tool's Step if its Apply counted as an edit
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-03) — cross-context

> **Given** the Editor has applied a Crop or a Rotation that changed the image's size, and then zoomed in
> **When** the Editor undoes that Step
> **Then** the View fits the restored image, as it does after an Apply in "Crop and rotate" that changes the image's size. Undoing or redoing a Step that keeps the image's size, such as Adjustments, a drawing or a Crop of the same size, keeps the View as it was
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add refusal guard to the composable's `undo`/`redo` (no Work, `activeTool`, `phase` `exporting` or `confirming` → return false, no change); `reading` is allowed — `src/features/editor/edit-history.ts`
- [ ] Fit the View after `undo`/`redo` only when `workSize` changed — `src/features/editor/edit-history.ts`
- [ ] Expose `canUndo`, `canRedo`, `undoTool`, `redoTool`, `historyStats`, `undo`, `redo` from the store (getters false/null when refused or no Work) — `src/features/editor/store.ts`
- [ ] Re-export any new types (`HistoryStats`) through `src/features/editor/index.ts`
- [ ] Store tests: AC-03 sequence with `toBe` identity, AC-07/AC-08 refusals, AC-12 fit vs keep, AC-09 at store level (`openImage` → `replaced` after Undo to the save point) — `src/features/editor/store.test.ts`
- [ ] Component test: open export panel, Undo a size-changing Crop, size field normalized to the restored long side — `src/features/export/ExportPanel.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `undo` while a tool is open | returns false; Work, Draft and history unchanged (AC-08) |
| `undo` during `exporting` (incl. File ready) | returns false; refused, not queued (AC-07) |
| `undo` while the replace dialog is open (`confirming`) | returns false (ledger L7) |
| `undo` while `reading` a new image | allowed |
| Undo of an Adjust or Draw Step, or a same-size Crop | View kept exactly (zoom, pan, autoFit) |
| no Work open | `canUndo` and `canRedo` false, `undoTool`/`redoTool` null (AC-05) |

## Definition of Done

- [ ] Store tests cover each Edge case row and the AC-03 sequence
- [ ] `ExportPanel.test.ts` covers the size-changing Undo under the open panel
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
