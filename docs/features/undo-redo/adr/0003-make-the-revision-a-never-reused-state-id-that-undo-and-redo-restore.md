---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-11"
feature_size: "S"
ticket: "roadmap step 7 — undo-redo"
---

# 0003 — Make the revision a never-reused state id that Undo and Redo restore

- **Status:** Accepted
- **Date:** 2026-10-11
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth)

## Context

The Work carries `revision` and `cleanRevision`, and it has Unsaved edits exactly when they differ (open-and-view ADR-0005). Every edit raises the revision by one through `withEdit()`, and a successful Export sets `cleanRevision` to the exported snapshot's revision (export AC-09). Open-and-view ADR-0005 planned for undo and redo to raise the revision too, and accepted that a full undo would still count as Unsaved edits. This spec decides the opposite. The save point is the last successful Export, or the state at open, and undoing or redoing back to it clears Unsaved edits. A change taken back by hand still counts as an edit (AC-09, spec §2, CONTEXT: Unsaved edits).

## Decision drivers

- spec AC-09: Unsaved edits clear exactly at the save point, reached by Undo or Redo, and a cancelled or failed export never sets it
- spec §2: a change taken back by hand still counts as an edit (crop-rotate AC-13, draw AC-12)
- spec AC-10 and open-and-view AC-15: replacing the Work asks for confirmation only when there are Unsaved edits
- open-and-view ADR-0005 Neutral: switching the rule is local to `hasUnsavedEdits` and the undo and redo code
- Gallery (roadmap step 8) will set the save point after a write, so the rule must not depend on undo-redo's internals

## Considered options

1. **The revision is a never-reused state id.** Each new Step takes a fresh revision from a high-water mark, Undo and Redo bring back the state's own revision, and `hasUnsavedEdits` stays `revision !== cleanRevision`.
2. **The save point is a position in the history.** The history records the index of the saved state, and Unsaved edits are `cursor !== saveIndex`.

## Decision outcome

**Chosen:** Option 1. The Export store, the replace confirmation, `hasUnsavedEdits` and the Gallery's future save keep working on the Work alone, exactly as now. AC-09 follows from the state being identified by its revision. Option 2 moves Unsaved edits out of the Work into the history. Every discard and every dropped entry would have to shift or cancel the saved index, and the Export store and the Gallery would have to call into the history.

How it works:

- `withEdit(work, revision, now)` takes the new revision instead of computing `revision + 1`. The `edit-history` composable keeps the high-water mark, the highest revision ever issued for the open Work. It starts at the opened Work's revision (0), and each new Step takes the mark plus one. A number is never issued twice, even after Undo discards the states that used it.
- Undo and Redo use `withState(work, state)` (ADR-0001), which restores `state.revision` and leaves `cleanRevision` as it is. They issue no revision.
- `finishExport` is unchanged: a finished hand-off sets `cleanRevision = snapshot.revision`. Because no Step can be applied and no Undo or Redo can run during an export (AC-07), the snapshot's revision is the current state's revision.
- `applyEdit()`, the test-only edit that raises the revision without changing the image, takes a fresh revision the same way. It records no Step and updates the current entry's revision in place, so a later Undo and Redo return to it.
- The AC-09 sequence: open (rev 0, clean 0) → Step A (1) → Step B (2) → Export (clean 2) → Step C (3, unsaved) → Undo (2, clean) → Undo (1, unsaved) → Redo (2, clean). Undoing every Step of a never-exported Work reaches rev 0 = clean 0. After an Export at 2, undoing to 0 leaves Unsaved edits.
- The bug this prevents: with `revision + 1`, the sequence Export at rev 1 → Undo to 0 → new Step would issue rev 1 again and report a changed Work as saved.
- If the save point's state is discarded (AC-04) or dropped by the bound (AC-11), no state carries `cleanRevision` any more and the Work keeps Unsaved edits until the next Export, which is correct.

## Consequences

**Positive**
- `hasUnsavedEdits`, the replace confirmation and the Export store do not change, and the Gallery inherits the same rule.
- AC-09 is a unit test of the revision rule, with no UI in the loop.

**Negative**
- This replaces open-and-view ADR-0005's clause that undo and redo raise the revision, and its accepted negative consequence (a full undo still asks for confirmation) no longer holds. That ADR is not edited here; sad.md §11 lists the note to add.
- Every edit path must take its revision from the high-water mark. A path that computes `revision + 1` on its own reintroduces the bug, so `withEdit`'s new signature makes the revision a required argument.

**Neutral**
- The revision stays a number, so test hooks and existing tests that compare revisions keep working.

## Links

- Spec: [[../spec.md]] AC-09, AC-10, §2
- SAD: [[../sad.md]] §4, §8, §11
- Related ADR: [[0001-record-the-edit-history-as-snapshots-of-the-works-edited-state]]; open-and-view ADR-0005; export AC-09, AC-10
