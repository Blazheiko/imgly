# Changelog — undo-redo

## undo-redo — take back any applied change, and bring it back, exactly

**What:** The editor now has **Undo** and **Redo**. Two buttons sit in the top bar, and the usual
shortcuts work from anywhere in the editor: Ctrl+Z (Cmd+Z on a Mac) undoes, and Shift+Ctrl+Z
(Shift+Cmd+Z) or Ctrl+Y on Windows and Linux redoes. The shortcuts match by key position too, so
they work on non-Latin keyboard layouts.

- **One Step is one Apply.** Every Apply of "Crop and rotate", "Adjust" or "Draw" that changes the
  Work is one Step. Strokes and slider moves inside an open tool are not Steps. Inside a tool,
  Cancel, Reset, the Eraser and Clear are still the ways back.
- **Exact.** Undo and Redo bring back the Work's state as it was, so the Preview and every Export
  match it pixel for pixel. A Drawing layer always comes back together with the Geometry it was
  applied under.
- **Hints that say what will happen.** Each button's hint names the tool of the Step it would take
  back or restore, for example "Undo Adjust (Ctrl/Cmd+Z)" or "Redo Crop and rotate". When there is
  nothing to undo or redo, the button is visibly unavailable and its hint says so.
- **One line of history.** A new Step after an Undo discards the Steps that could have been redone.
- **The View stays put** unless the Step changed the image's size. Undoing a Crop or Rotation that
  changed the size fits the View to the restored image, as an Apply in "Crop and rotate" does.
- **Refusals.** While a tool is open, Undo and Redo are unavailable and the shortcuts show "Apply or
  cancel the open tool first." During an export they are refused, not queued. In a focused text or
  number field, Ctrl/Cmd+Z keeps its usual meaning inside that field.
- **Honest saving.** The last successful Export is the save point. Undoing or redoing back to it
  clears Unsaved edits, so opening another image then replaces the Work without asking. Undoing
  every Step of a Work that was never exported also leaves no Unsaved edits. A cancelled or failed
  export never moves the save point.
- **Bounded.** The Edit history keeps up to 50 Steps within 512 MB of image data and silently drops
  the oldest first. On the 4096 × 3072 reference Work at least the last 10 Steps are always kept,
  even when each one is a drawing over the whole image. It lasts only while the Work is open:
  replacing the Work clears it, and it is never saved.

**Why:** Until now an applied change could only be taken back by hand: widen the Crop again, drag
seven sliders back, or erase marks one by one. A wrong Apply could cost the whole session's work,
and a reviewer who presses Ctrl/Cmd+Z and sees nothing happen judges the app for it
([spec](../spec.md) §1–§2). This is roadmap step 7. It also closes three open questions from
earlier specs: export §8 and crop-rotate §8 (the save point, AC-09) and draw §8 (the unit of a
Step, draw ADR-0005). Key decisions:

- Record the Edit history as snapshots of the Work's edited state (Geometry, Adjustments, the
  Drawing layer reference and the revision), not as inverse commands. Undo restores the very same
  objects, which makes it exact by construction
  ([ADR-0001](../adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md)).
- Keep whole applied Drawing layers by reference, and bound the history by 50 Steps and
  512 000 000 B, with one release path for layers that leave the history
  ([ADR-0002](../adr/0002-keep-whole-layers-by-reference-and-bound-the-history-by-50-steps-and-512-mb.md)).
  This resolves draw `sad.md` §11's undo-memory risk.
- Make the revision a never-reused state id that Undo and Redo restore, so "no Unsaved edits" means
  exactly "back at the save point"
  ([ADR-0003](../adr/0003-make-the-revision-a-never-reused-state-id-that-undo-and-redo-restore.md)).
  This partly supersedes open-and-view ADR-0005.
- Run the history rules in pure `core/history`, own the history in the editor store, and add an
  `undo-redo` feature for the buttons and shortcuts
  ([ADR-0004](../adr/0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature.md)).

**How to use:** Open an image and apply a change with any tool. Click **Undo** in the top bar, or
press Ctrl/Cmd+Z, to take it back. Click **Redo**, or press Shift+Ctrl/Cmd+Z (Ctrl+Y on Windows and
Linux), to bring it back. Hover a button to see which tool's Step it would take or restore.

**Operational notes:**

- Migration: none. The Edit history lives in session memory only, and IndexedDB isn't touched.
- Feature flag / config: none. The new test hook (`historyStats` on `window.__imglyTest`) exists
  only in the e2e build (`dist-e2e/`). The production `dist/` was checked and has no
  `__imglyTest`.
- Service worker: the app bundle changed, so a deploy changes the precache manifest. Clients pick
  it up on their next service-worker update.
- Rollback: revert the merge and redeploy GitHub Pages. No stored state needs undoing.
- Cross-feature changes: draw `spec.md` §6's row "memory after 50 Applies ≤ 110% of the first" is
  replaced by this spec's §6 memory rows, because the Edit history now keeps earlier layers on
  purpose. open-and-view ADR-0005 and draw `sad.md` carry notes pointing here. The one-tool rule
  (draw AC-15, AC-16) now covers Undo and Redo as well.
- Review: four rounds on 2026-10-12. The first round's findings F1–F8 became tasks T14–T20, the
  re-review's two e2e gaps became T21–T22, and the second re-review's S1–S2 became T23–T24. The
  third re-review (`_review/review-2026-10-12.md`) returned **PASS** with nothing open.
- Known follow-ups:
  - A small mark costs a whole layer in the history, so far fewer than 50 drawing Steps fit, and a
    4096 × 4096 Work keeps only 7 drawing Steps (accepted debt, ADR-0002). Storing differences
    between layers stays possible inside `core/history` and `render/drawing`.
  - `isTextTarget` is now shared in `src/shared/keyboard.ts`, but `adjust`, `crop-rotate` and
    `draw` still have their own copies. They switch over when those features are next touched.
  - Draw spec §8's question (one Stroke or one Apply per undo Step) is answered by draw ADR-0005
    and this feature, but its checkbox is left for the owner to tick.
  - The `@perf` rows were measured on an M1 Pro, not on the M1 Air that the spec names as the
    reference machine.

**Acceptance criteria delivered:** AC-01 – AC-14:

- Undo and Redo from the top bar and the shortcuts, with hints that name the tool of the next Step
  (AC-01, AC-02, AC-14).
- Exact restore of every state, a Drawing layer that comes back with its Geometry, and one line of
  history (AC-03, AC-04, AC-13).
- Unavailable buttons and silent shortcuts when there is nothing to undo or redo, or no image
  (AC-05).
- Only an Apply that counts as an edit makes a Step, and the View moves only when the image's size
  changes (AC-06, AC-12).
- Refused during an export and while a tool is open, with text fields keeping their own undo
  (AC-07, AC-08).
- The last successful Export as the save point, and a fresh Edit history for each new Work
  (AC-09, AC-10).
- Up to 50 Steps within 512 MB, oldest dropped first, at least 10 drawing Steps on the reference
  Work (AC-11).
