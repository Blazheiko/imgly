---
id: T4
title: "Add the edit-history composable, record a Step on every counting Apply, make withEdit take the revision, and move layer release to one path"
layer: "app"
deps: ["T1", "T3"]
blocks: ["T5"]
acs: ["AC-04", "AC-06", "AC-09", "AC-10"]
files_hint: ["src/features/editor/edit-history.ts", "src/features/editor/edit-history.test.ts", "src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/core/document.ts", "src/core/document.test.ts"]
owner: "Blazheiko"
estimate: "L"
context_budget: "M"   # measured: 62 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Add the edit-history composable, record a Step on every counting Apply, make withEdit take the revision, and move layer release to one path

## Place in the sequence

- **Blocked by:** T1 — Add WorkState, editStateOf and withState to core/document; T3 — Bound the history: budget.ts with 50 Steps and 512 000 000 B, heldLayerBytes, and the oldest-first trim inside record.
- **Blocks:** T5 — Expose undo, redo, canUndo, canRedo, undoTool, redoTool and historyStats on the editor store, with the refusals and the View fit.
- **Wave:** 4.
- **Lane:** shares `src/core/document.test.ts`, `src/core/document.ts` with T1; shares `src/features/editor/edit-history.ts`, `src/features/editor/store.test.ts`, `src/features/editor/store.ts` with T5 — serialized.

## Why (user story)

> **US-04: Know whether my work is saved after undoing**
>
> **As an** Editor  
> **I want** the app to know when undoing has brought the image back to what I last exported or opened  
> **So that** I am asked to confirm replacing the image only when I would really lose something
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It makes Unsaved edits honest under undo: every state carries a never-reused revision, so returning to the save point clears them and a new Step after Undo never looks saved.

## Inlined context

> `withEdit(work, revision, now)` takes the new revision instead of computing `revision + 1`. The `edit-history` composable keeps the high-water mark, the highest revision ever issued for the open Work. It starts at the opened Work's revision (0), and each new Step takes the mark plus one. A number is never issued twice, even after Undo discards the states that used it.
> Undo and Redo use `withState(work, state)` (ADR-0001), which restores `state.revision` and leaves `cleanRevision` as it is. They issue no revision.
> `applyEdit()`, the test-only edit that raises the revision without changing the image, takes a fresh revision the same way. It records no Step and updates the current entry's revision in place, so a later Undo and Redo return to it.
> The AC-09 sequence: open (rev 0, clean 0) → Step A (1) → Step B (2) → Export (clean 2) → Step C (3, unsaved) → Undo (2, clean) → Undo (1, unsaved) → Redo (2, clean). Undoing every Step of a never-exported Work reaches rev 0 = clean 0. After an Export at 2, undoing to 0 leaves Unsaved edits.
> The bug this prevents: with `revision + 1`, the sequence Export at rev 1 → Undo to 0 → new Step would issue rev 1 again and report a changed Work as saved.
>
> — `adr/0003 §Decision outcome, How it works bullets 1, 2, 4, 5, 6, abridged` · full text: [adr/0003-make-the-revision-a-never-reused-state-id-that-undo-and-redo-restore.md](../adr/0003-make-the-revision-a-never-reused-state-id-that-undo-and-redo-restore.md)

> `src/features/editor/edit-history.ts` is composed by the store like `createToolSlot`. It holds the history (`shallowRef`, because states refer to `OffscreenCanvas` layers) and the revision high-water mark (ADR-0003). `record(tool, work)` is called by the three `apply*` actions when they count as an edit. […] `clear(work)` is called by `replace()`. It releases evicted layers (ADR-0002).
>
> — `adr/0004 §Decision outcome, How it works bullet 2, abridged` · full text: [adr/0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature.md](../adr/0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature.md)

> **One release path:** a layer leaves memory only when no kept state refers to it, and the `edit-history` composable is where that is decided. `applyDrawing` stops releasing the previous layer itself. An Apply of "Draw" with no change keeps the Work's current layer and releases the Draft, which has the same content, so no kept state ever refers to a released layer.
>
> — `sad.md §4, tactical rules, One release path, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule (High risk):** Brownfield: `applyDrawing` releases the previous layer as soon as a new one is applied (`src/features/editor/store.ts:249`), and `replace()` releases the Work's layer (`:395`). Once the history keeps earlier layers, a release on either path would leave a kept entry pointing at a 0×0 canvas, and an Undo would silently show no marks — Mitigation: One release path (ADR-0002): the first editor task changes `applyDrawing` and `replace()` together with the composable, in the same PR. In DEV the composable asserts that no kept entry's layer has been released.
>
> — `sad.md §11, brownfield applyDrawing row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, features row + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Code facts at breakdown time (`src/features/editor/store.ts`): `applyAdjustments` L209, `applyDrawing` L242 (releases `previous` at L249), `applyGeometry` L257, `replace` L376 (releases `oldLayer` at L395), `applyEdit` L403, `finishExport` L431 (sets `cleanRevision = snapshot.revision`, unchanged). `withEdit` is also called in `src/core/document.test.ts`. Compile-coupled: the `withEdit` signature change lands in this task together with every caller.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-04 (US-02) — domain invariant

> **Given** the Editor has undone one or more Steps
> **When** the Editor applies a new change with any of the three tools
> **Then** the new change becomes the last Step, the Steps that could have been redone are discarded, and Redo becomes unavailable with a hint that there is nothing to redo. The Edit history is one line: there is never more than one way forward
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-06 (US-01) — domain invariant

> **Given** an image is open and the Editor has applied at least one Step
> **When** the Editor zooms or pans the View, opens a tool and cancels it, applies a tool without changing anything, or exports the image, and then chooses Undo
> **Then** none of those actions was a Step: Undo takes back the last applied change to the Work, and the View stays as the Editor left it unless that change altered the image's size (AC-12). Only an Apply that counts as an edit makes a Step, the same rule that decides Unsaved edits
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-09 (US-04) — cross-context

> **Given** the Editor has applied two Steps, exported the image successfully, and then applied a third Step, so the Work has Unsaved edits
> **When** the Editor undoes the third Step, then undoes once more, then redoes once
> **Then** after the first Undo the Work is back at the exported state and has no Unsaved edits, so opening another image replaces the Work without asking for confirmation; after the second Undo it has Unsaved edits again; after the Redo it has none. Likewise, undoing every Step of a Work that was never exported brings it back to the state it was opened in, with no Unsaved edits. After an Export, undoing past the save point back to the opened state leaves Unsaved edits, because the save point is now the Export. A cancelled or failed export never sets the save point (export AC-09, AC-10)
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 (US-05) — cross-context

> **Given** the Editor has an Edit history for the open Work
> **When** another image replaces the Work, after the confirmation when there are Unsaved edits
> **Then** the new Work starts with an empty Edit history: Undo and Redo are unavailable, and no Step of the previous Work can be undone or redone any more. If the Editor cancels the replacement, the Work and its Edit history stay exactly as they were
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Change `withEdit(work, revision, now = Date.now())`; update `src/core/document.test.ts` callers — `src/core/document.ts`
- [ ] Create `createEditHistory({ work })`: `shallowRef<EditHistory<ToolId>>`, `highWater`, `record(tool, work)` (takes `highWater + 1`), `nextRevision()`, `undo()`/`redo()` putting `withState` into `work` (no refusals here — T5), `clear(work)`, and a private `release(entries)` that calls `releaseLayer()` only for layers no kept entry or the Work refers to — `src/features/editor/edit-history.ts`
- [ ] DEV-only assertion that no kept entry's layer has been released — `src/features/editor/edit-history.ts`
- [ ] Wire `applyGeometry`, `applyAdjustments`, `applyDrawing` to `record` only when they count as an edit; `applyDrawing` no longer releases `previous`; an unchanged Draw Apply keeps the Work's current layer and releases the Draft — `src/features/editor/store.ts`
- [ ] `replace()` calls `clear(newWork)`, which releases every layer of the old history (drop the direct `releaseLayer(oldLayer)`); `applyEdit()` takes a fresh revision and updates the current entry's revision in place — `src/features/editor/store.ts`
- [ ] Tests: AC-09 and reused-revision sequences, AC-06 non-edits, AC-04 discard release, AC-10 replace/cancel, ledger counts — `src/features/editor/edit-history.test.ts`, `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Draw Apply with `changed === false` | no Step; the Work keeps its current layer; the Draft is released (no leaked layer) |
| Draw Apply where the Draft is the same canvas as the Work's layer | nothing released |
| Export at rev 1 → Undo to 0 → new Step | the new Step gets rev 2 (never 1); `hasUnsavedEdits` true |
| save point's state discarded (AC-04) or dropped (AC-11) | no state carries `cleanRevision`; Unsaved edits stay until the next Export |
| `replace` cancelled at the confirmation | history and Work unchanged (AC-10) |
| `releaseLayer` called twice on one layer (replace after discard) | no-op on the second call |

## Definition of Done

- [ ] AC-09 sequence and the reused-revision sequence pass in `edit-history.test.ts`
- [ ] Store tests show `record` only on counting Applies and empty history after `replace()`
- [ ] Bitmap-ledger assertions: 0 retained layers after a discard and after `replace()`
- [ ] Every pre-existing test passes; `vue-tsc` proves no caller still uses the old `withEdit` signature
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
