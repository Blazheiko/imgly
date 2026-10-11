---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-11"
feature_size: "S"
ticket: "roadmap step 7 — undo-redo"
---

# 0004 — Run the history rules in core, own the history in the editor store, and add an undo-redo feature for the controls

- **Status:** Accepted
- **Date:** 2026-10-11
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth)

## Context

Features never import each other, and they coordinate through the `editor` store (repo ADR 0002). Every Step starts in one of the store's actions: `applyGeometry`, `applyAdjustments` or `applyDrawing`. The store is already the hub at 495 lines, and the tool slot was moved out of it into the `tool-slot.ts` composable before draw added the third tool (architecture map, Constraints). The Undo and Redo controls are top-bar actions like the tools' buttons, mounted from `App.vue`.

## Decision drivers

- repo ADR 0002: `core` is pure and features don't import each other; `infra` and `render` don't import features
- sad.md §1 quality goal 1: the history rules must be easy to test exhaustively (AC-03, AC-04, AC-09, AC-11)
- spec AC-14: two buttons in the top bar plus shortcuts that work from anywhere in the editor except a text or number field
- architecture map: the editor store is the hub and grows with every feature

## Considered options

1. **Pure `core/history`, a composable in the editor store, and a new `undo-redo` feature for the controls.**
2. **Everything inside the `editor` feature.** The history is an array in `store.ts`, and the buttons and shortcuts go in `editor/components`.

## Decision outcome

**Chosen:** Option 1. The rules (record, discard, trim, budget, labels) are pure functions in `core`, tested without Vue. The store gains only the wiring, through a composable as `tool-slot.ts` set the precedent. The controls follow the same pattern as every other top-bar action. Option 2 has fewer files, but it grows the hub further and mixes the undo controls into the shell. It also tests the history rules only through a Pinia store.

How it works:

- `src/core/history/` (`history.ts`, `budget.ts`, `index.ts`) is exported through `src/core/index.ts`. It is generic over the Step label and knows no tool names (ADR-0001, ADR-0002).
- `src/features/editor/edit-history.ts` is composed by the store like `createToolSlot`. It holds the history (`shallowRef`, because states refer to `OffscreenCanvas` layers) and the revision high-water mark (ADR-0003). `record(tool, work)` is called by the three `apply*` actions when they count as an edit. `undo()` and `redo()` set the Work with `withState`, fit the View when the image's size changed (AC-12), and refuse when a tool is open, an export runs or the replace dialog is open. `clear(work)` is called by `replace()`. It releases evicted layers (ADR-0002).
- The store exposes `canUndo`, `canRedo`, `undoTool`, `redoTool`, `undo` and `redo`. The three tool features don't change.
- `src/features/undo-redo/` has `UndoRedoActions.vue` (two `BaseButton`s in the `top-bar-actions` slot, placed first), `shortcuts.ts` (a window `keydown` handler), `messages.ts` and `index.ts`. It reads and calls only the editor store's public API, through `@/features/editor`.
- `isTextTarget` moves to `src/shared/keyboard.ts`, so the new feature can skip text and number fields (AC-08, AC-14) without importing another feature. The existing copies in `adjust`, `crop-rotate` and `draw` stay until they are next touched (sad.md §11).

## Consequences

**Positive**
- The history rules have full unit coverage in `core`, and the store's tests cover only the wiring.
- The tools need no change, and the controls follow the top-bar pattern a reader already knows.

**Negative**
- The editor store still grows: three `record` calls, `undo`, `redo` and five getters.
- One more feature folder, and one more entry in the top-bar slot.

**Neutral**
- Moving the controls into the editor feature later is a file move, because the store API stays the same.

## Links

- Spec: [[../spec.md]] AC-01, AC-07, AC-08, AC-10, AC-12, AC-14
- SAD: [[../sad.md]] §4, §5
- Related ADR: [[0001-record-the-edit-history-as-snapshots-of-the-works-edited-state]], [[0002-keep-whole-layers-by-reference-and-bound-the-history-by-50-steps-and-512-mb]], [[0003-make-the-revision-a-never-reused-state-id-that-undo-and-redo-restore]]; crop-rotate ADR-0003 (tool slot); repo ADR 0002
