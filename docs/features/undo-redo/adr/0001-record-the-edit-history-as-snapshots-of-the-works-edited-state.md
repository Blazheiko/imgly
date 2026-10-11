---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-11"
feature_size: "S"
ticket: "roadmap step 7 — undo-redo"
---

# 0001 — Record the Edit history as snapshots of the Work's edited state

- **Status:** Accepted
- **Date:** 2026-10-11
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth)

## Context

Every Apply of "Crop and rotate", "Adjust" or "Draw" that counts as an edit is one Step (spec §1, draw ADR-0005). Undo must bring the Work back to precisely the state it had, so that a full-size Export after Undo is identical, pixel for pixel, to the Export of that state made before (AC-03). The editor store already treats the Work as an immutable value: each Apply builds a new Work through `withEdit()` (open-and-view ADR-0005). An applied Drawing layer is never painted again, because every tool session paints a fresh copy (draw ADR-0004). This decision fixes what the Edit history keeps for each Step, and so the shape every later decision in this feature builds on (sad.md §4).

## Decision drivers

- spec AC-03 and §6 Exactness: a difference of 0 per channel after Undo or Redo, for Steps of each tool, on all three engines
- spec AC-01 and AC-13: only the part the Step changed returns, and the Drawing layer returns together with the Geometry it was applied under
- spec AC-01: the button hints name the tool of the Step that Undo or Redo would take back or restore next
- draw ADR-0004: applied layers are immutable, so an earlier layer can be kept by reference
- sad.md §1 quality goals 1 and 3; repo ADR 0002 (`core` is pure TypeScript)

## Considered options

1. **Snapshots of the Work's edited state.** The history keeps `{ geometry, adjustments, drawing, revision }` for each state, plus the tool that made each Step. Undo and Redo put a kept state back into the Work.
2. **A delta of the changed part only.** A Step is `{ tool, field, before, after }`, and Undo writes `before` into the current Work.
3. **Commands with an inverse operation.** Each tool registers `do()` and `undo()`, and Undo computes the earlier state again.

## Decision outcome

**Chosen:** Option 1. The restored Geometry, Adjustments and Drawing layer are the same values and the same layer objects that the Preview and the Export used before. Exactness therefore holds by construction, with nothing recomputed and no per-tool code. In a linear history, Option 2 keeps exactly the same data, since a drawing Step needs the whole earlier layer either way, and only adds a per-field apply path. Option 3 has no inverse for a drawing without keeping the earlier layer. Recomputing a state risks the exactness AC-03 demands, and each of the three tools would need its own inverse.

How it works:

- `src/core/document.ts` adds `WorkState = { geometry, adjustments, drawing, revision }`. `editStateOf(work)` reads it, and `withState(work, state)` returns the Work with that state and everything else kept: `id`, the Original, the source, `cleanRevision`, plus a new `updatedAt`.
- `src/core/history/history.ts` holds `EditHistory<L> = { entries: { state: WorkState; label: L | null }[]; cursor: number }`. `entries[0]` is the state at open (label `null`), and `entries[cursor]` is always the Work's current edited state. The label is the tool whose Apply produced that state: the editor passes its `ToolId`, and `core` stays generic.
- `record(history, label, state)` discards the entries after `cursor` (AC-04), appends the new one, moves `cursor` to it and trims to the bound (ADR-0002). It returns the new history and the evicted entries, so the caller can release their layers. `undo` and `redo` move `cursor` by one and return the state to restore. `undoLabel` is `entries[cursor].label`, and `redoLabel` is `entries[cursor + 1].label`.
- An Apply that does not count as an edit records nothing. The Work's edited state stays value-equal to `entries[cursor]`: Geometry and Adjustments compare equal, and an unchanged "Draw" Apply keeps the Work's current layer (sad.md §4).
- Replacing the Work starts a new history whose only entry is the new Work's state at open (AC-10).

## Consequences

**Positive**
- Exactness needs no per-tool proof: a restored state is the earlier state itself.
- The rules are pure functions over plain data, unit-tested in `core` without Vue, WebGL or Canvas.
- The three tools do not change. Their Apply already produces a new immutable Work, and the editor store records it.

**Negative**
- A drawing Step keeps a whole layer even when the Apply changed only a few pixels. ADR-0002 bounds the cost.
- Correctness depends on draw ADR-0004's rule that an applied layer is never painted again. If a future change painted an applied layer in place, the history would silently show the new marks on an older state.

**Neutral**
- Per-Stroke undo inside the draw tool (draw ADR-0005 Neutral) would stay inside the `draw` store and would not change this model.

## Links

- Spec: [[../spec.md]] AC-01, AC-03, AC-04, AC-10, AC-13, §6
- SAD: [[../sad.md]] §4, §5
- Related ADR: [[0002-keep-whole-layers-by-reference-and-bound-the-history-by-50-steps-and-512-mb]], [[0003-make-the-revision-a-never-reused-state-id-that-undo-and-redo-restore]], [[0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature]]; draw ADR-0004, ADR-0005; open-and-view ADR-0005
