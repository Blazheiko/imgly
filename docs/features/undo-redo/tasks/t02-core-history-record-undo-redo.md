---
id: T2
title: "Add core/history: EditHistory with createHistory, record, undo, redo, canUndo/canRedo and undo/redo labels"
layer: "domain"
deps: ["T1"]
blocks: ["T3"]
acs: ["AC-01", "AC-02", "AC-04", "AC-05"]
files_hint: ["src/core/history/history.ts", "src/core/history/history.test.ts", "src/core/history/index.ts", "src/core/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 58 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Add core/history: EditHistory with createHistory, record, undo, redo, canUndo/canRedo and undo/redo labels

## Place in the sequence

- **Blocked by:** T1 — Add WorkState, editStateOf and withState to core/document.
- **Blocks:** T3 — Bound the history: budget.ts with 50 Steps and 512 000 000 B, heldLayerBytes, and the oldest-first trim inside record.
- **Wave:** 2 — alongside T7.
- **Lane:** shares `src/core/history/history.ts`, `src/core/history/index.ts` with T3 — serialized.

## Why (user story)

> **US-02: Bring back what I undid**
>
> **As an** Editor  
> **I want** to redo a change I just undid  
> **So that** I can compare before and after, and change my mind again without losing work
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It is the pure rule set behind Undo, Redo and "a new Step discards what could be redone", testable without Vue.

## Inlined context

> `src/core/history/history.ts` holds `EditHistory<L> = { entries: { state: WorkState; label: L | null }[]; cursor: number }`. `entries[0]` is the state at open (label `null`), and `entries[cursor]` is always the Work's current edited state. The label is the tool whose Apply produced that state: the editor passes its `ToolId`, and `core` stays generic.
> `record(history, label, state)` discards the entries after `cursor` (AC-04), appends the new one, moves `cursor` to it and trims to the bound (ADR-0002). It returns the new history and the evicted entries, so the caller can release their layers. `undo` and `redo` move `cursor` by one and return the state to restore. `undoLabel` is `entries[cursor].label`, and `redoLabel` is `entries[cursor + 1].label`.
>
> — `adr/0001 §Decision outcome, How it works bullets 2–3, verbatim` · full text: [adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md](../adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md)

> Replacing the Work starts a new history whose only entry is the new Work's state at open (AC-10).
>
> — `adr/0001 §Decision outcome, How it works bullet 5, verbatim` · full text: [adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md](../adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md)

> history/                pure, generic over the Step label (the editor passes ToolId)
> ├── history.ts          EditHistory<L>: entries [{ state, label }], cursor; createHistory(base),
> │                       record() → { history, evicted }, undo(), redo(), canUndo/canRedo,
> │                       undoLabel/redoLabel
>
> — `sad.md §5, internal decomposition, src/core/history, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
>
> — `CLAUDE.md §Module boundaries, src/core row, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Scope note: the trim to 50 Steps / 512 MB is T3. Here `evicted` holds only the discarded redoable entries (AC-04); T3 adds the dropped oldest entries to the same list. The history is immutable: every function returns a new value.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** an image is open and the Editor has applied at least one Step with "Crop and rotate", "Adjust" or "Draw"
> **When** the Editor chooses Undo, by its button in the top bar or by Ctrl+Z (Cmd+Z on a Mac)
> **Then** the Preview shows the Work as it was before the last Step: the Geometry, the Adjustments or the Drawing layer that Step changed returns to its earlier value, and nothing else changes. Redo becomes available, and the Undo and Redo buttons' hints name the tool of the Step each would take back or restore next, for example "Undo Adjust" and "Redo Crop and rotate"
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 (US-02) — happy path

> **Given** the Editor has undone one or more Steps and has applied nothing since
> **When** the Editor chooses Redo, by its button or by Shift+Ctrl+Z (Shift+Cmd+Z on a Mac), or Ctrl+Y on Windows and Linux
> **Then** the Preview shows the Work with the most recently undone Step applied again, exactly as it was before that Undo, and Redo stays available while undone Steps remain
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-04 (US-02) — domain invariant

> **Given** the Editor has undone one or more Steps
> **When** the Editor applies a new change with any of the three tools
> **Then** the new change becomes the last Step, the Steps that could have been redone are discarded, and Redo becomes unavailable with a hint that there is nothing to redo. The Edit history is one line: there is never more than one way forward
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 (US-01) — error

> **Given** an image has just been opened, or the Editor has undone every kept Step
> **When** the Editor chooses Undo, by its button or its shortcut
> **Then** nothing changes: the Undo button is visibly unavailable with a hint that there is nothing to undo, and the shortcut does nothing. In the same way, when nothing has been undone, Redo is unavailable with a hint that there is nothing to redo. With no image open, both buttons are unavailable
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Define `HistoryEntry<L>`, `EditHistory<L>`, `createHistory(base: WorkState)` — `src/core/history/history.ts`
- [ ] Implement `record(history, label, state) → { history, evicted }`: drop entries after `cursor` into `evicted`, append, move `cursor` — `src/core/history/history.ts`
- [ ] Implement `undo`/`redo` returning `{ history, state } | null` (null at the ends), `canUndo`, `canRedo`, `undoLabel`, `redoLabel` — `src/core/history/history.ts`
- [ ] Barrel `src/core/history/index.ts`; add `export * from './history'` to `src/core/index.ts`
- [ ] Unit tests per Edge case below — `src/core/history/history.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| undo at `cursor === 0` (just opened, or every Step undone) | `canUndo` false, `undo` returns null, history unchanged (AC-05) |
| redo with nothing undone | `canRedo` false, `redo` returns null (AC-05) |
| record after two undos | the two redoable entries are returned in `evicted`, `canRedo` false, `undoLabel` is the new label (AC-04) |
| undo then redo | returns the very state object that was recorded (AC-02, exactness) |
| `undoLabel` / `redoLabel` at the ends | `null` |

## Definition of Done

- [ ] `history.test.ts` covers every Edge case row
- [ ] `src/core/history` imports nothing outside `core` (ESLint boundary passes)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
