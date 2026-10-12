## Summary

Adds **Undo** and **Redo**. Two buttons sit in the top bar, and Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and
Ctrl+Y work from anywhere in the editor. One Step is one Apply of "Crop and rotate", "Adjust" or
"Draw" that changes the Work. Undo and Redo are exact: the Preview and every Export match the
restored state pixel for pixel, and a Drawing layer comes back with the Geometry it was applied
under. The last successful Export is the save point, and undoing back to it clears Unsaved edits.
The Edit history keeps up to 50 Steps within 512 MB, lasts only while the Work is open, and is
never saved. This is roadmap step 7. See the [spec](docs/features/undo-redo/spec.md) and the
[changelog](docs/features/undo-redo/_ship/changelog.md).

## Acceptance criteria

- AC-01: Undo by the button or Ctrl/Cmd+Z takes back the last Step and nothing else, and the hints name the tool of the next Step ("Undo Adjust", "Redo Crop and rotate") ✓
- AC-02: Redo by the button, Shift+Ctrl/Cmd+Z or Ctrl+Y restores the most recently undone Step exactly ✓
- AC-03: Three Undos give back the opened Work, and three Redos give back the drawn Work, each identical pixel for pixel to an Export made before ✓
- AC-04: A new Step after an Undo discards the redoable Steps, and Redo says there is nothing to redo ✓
- AC-05: With nothing to undo or redo, or no image, the buttons are visibly unavailable and the shortcuts do nothing ✓
- AC-06: Zoom, pan, a cancelled tool, an Apply that changes nothing and an Export are not Steps ✓
- AC-07: Undo and Redo are refused during an export, not queued, and work again afterwards with the same history ✓
- AC-08: While a tool is open, Undo and Redo are unavailable with a hint, and a focused text field keeps its own undo ✓
- AC-09: The last successful Export is the save point. Undoing or redoing back to it clears Unsaved edits, and a cancelled or failed export never sets it ✓
- AC-10: Replacing the Work starts an empty Edit history. A cancelled replacement keeps the Work and its history ✓
- AC-11: Up to 50 Steps within 512 MB, oldest dropped first, and at least the last 10 drawing Steps on the reference Work ✓
- AC-12: Undoing a size-changing Crop or Rotation fits the View, and a same-size Step keeps it ✓
- AC-13: The Drawing layer always returns together with the Geometry it was applied under ✓
- AC-14: Two keyboard-reachable buttons in the top bar with hints that name the action and shortcut ✓

## Design

- Spec: `docs/features/undo-redo/spec.md`
- Architecture: `docs/features/undo-redo/sad.md`
- Decisions: `docs/features/undo-redo/adr/`
  - [ADR-0001](docs/features/undo-redo/adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md): the history is snapshots of the Work's edited state, not inverse commands
  - [ADR-0002](docs/features/undo-redo/adr/0002-keep-whole-layers-by-reference-and-bound-the-history-by-50-steps-and-512-mb.md): whole layers kept by reference, bounded by 50 Steps and 512 000 000 B, with one release path
  - [ADR-0003](docs/features/undo-redo/adr/0003-make-the-revision-a-never-reused-state-id-that-undo-and-redo-restore.md): the revision is a never-reused state id that Undo and Redo restore (partly supersedes open-and-view ADR-0005)
  - [ADR-0004](docs/features/undo-redo/adr/0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature.md): rules in `core/history`, the history owned by the editor store, controls in a new `undo-redo` feature
- UX: `docs/features/undo-redo/ux-flows.md` and `docs/features/undo-redo/screens.md`
- Test plan: inline in `docs/features/undo-redo/spec.md` (size S)
- Data model and migration: none, because the Edit history is in session memory only
- API: none (client-only)

## Tasks

These commits carry `SDD-Task` and `SDD-AC` trailers. Their task ids come from `docs/features/undo-redo/tasks/tracker.md`.

| Task | Commit | Subject |
|---|---|---|
| T1 | c10a638 | feat(undo-redo): add WorkState, editStateOf and withState to core/document |
| T2 | e9389c2 | feat(undo-redo): add core/history with record, undo, redo and labels |
| T3 | 42075f5 | feat(undo-redo): bound the history by 50 Steps and 512 000 000 B |
| T4 | a1b862f | feat(undo-redo): record a Step on every counting Apply with one release path |
| T5 | a20f9db | feat(undo-redo): expose undo, redo and their availability on the editor store |
| T6 | 9c58d30 | feat(undo-redo): share isTextTarget in src/shared/keyboard |
| T7 | 2a64cc4 | feat(undo-redo): add the message catalog and the Undo/Redo shortcut handler |
| T8 | 6bc21e0 | feat(undo-redo): add Undo and Redo buttons to the top bar |
| T9 | 7088e16 | test(undo-redo): expose historyStats through window.__imglyTest |
| T10 | 2ec1035 | test(undo-redo): e2e memory budget, Steps kept and layer release on Chromium |
| T11 | c5f1356 | test(undo-redo): e2e exactness, View fit and shortcuts on all three engines |
| T12 | 74e66e5 | test(undo-redo): @perf Undo and Redo latency for a Step of each tool |
| T13 | f6325b4 | docs(undo-redo): record what undo-redo supersedes in other features' docs |
| T4 | 393646d | test(undo-redo): update draw's layer-ledger e2e to the Edit history's rule |
| T14 | e1d4d79 | fix(undo-redo): bound the Edit history at every cursor position |
| T15 | 2a7fd9e | fix(undo-redo): match Ctrl/Cmd+Z and Ctrl+Y by key position on non-Latin layouts |
| T16 | c1e0018 | fix(undo-redo): release the old history's layers when follow() starts afresh |
| T17 | edd3632 | test(undo-redo): add the test plan's missing component and integration cases |
| T18 | a74fefd | test(undo-redo): check the budget after every Apply and Undo, and discard all 10 Steps |
| T19 | ff5d078 | test(undo-redo): e2e for no-Step actions, refusals during export and Draw, and the save point |
| T20 | 41dbfc3 | docs(undo-redo): record the Edit history and the undo-redo feature in the architecture map |
| T21 | a2a2d31 | test(undo-redo): e2e Ctrl/Cmd+Z on a freshly opened image changes nothing and shows no notice |
| T22 | 1d534bb | test(undo-redo): e2e asserts the buttons after an Undo and after a replace |
| T24 | a5177ce | test(undo-redo): pin that an empty-history shortcut still takes the key |
| T23 | 19a5aee | test(undo-redo): reduce the AC-08 Draw-open e2e's alpha readbacks in the page |

T1–T13 are the planned breakdown. T14–T24 come from the review rounds. The branch also carries the
spec, design, sequences, screens and tasks commits, plus `eb13a50` (an architecture-map survey) and
`847be46` (the roadmap note that draw merged).

## Verification

Verified at `11d585d` on 2026-10-12 (Apple M1 Pro, latest Playwright browsers).

- Unit: `pnpm test` passes 1893 of 1893 (89 files).
- Lint and vet: `pnpm lint` and `pnpm typecheck` are clean.
- Build: `pnpm build` is clean, and the production `dist/` has no `__imglyTest` hooks.
- e2e: `pnpm test:e2e` on Chromium, Firefox and WebKit has 912 passing, 33 skipped and none failing (7.0 min). The run covers every suite, so open-and-view, export, crop-rotate, adjust and draw still pass next to the new undo-redo suites. The skips are conditional: `@perf` without `PERF=1`, Chromium-only checks (the memory ledger and pixel reads) on Firefox and WebKit, and the earlier features' engine-specific skips. The undo-redo memory rows (≤ 512 MB held, at least 10 drawing Steps kept, and 0 retained layers after a replace, a discard and a trim) ran and passed on Chromium.
- Perf (`PERF=1`, Chromium, 4096 × 3072 Work with a full drawing, 20 runs after 2 warm-ups). All six rows pass the spec §6 target of p95 ≤ 150 ms:
  - Crop and rotate Step: Undo 31 ms, Redo 32 ms.
  - Adjust Step: Undo 31 ms, Redo 31 ms.
  - Draw Step: Undo 47 ms, Redo 52 ms.
  - Whole-page memory after 100 whole-image drawing Applies: 106% of the memory after the 10th (target ≤ 110%).
- Ran the feature by hand. A separate Playwright script drove the **production** `dist/` with no test hooks, through the UI only, on Chromium with `photo.png` (320 × 240). It observed:
  - AC-05: with no image, and right after opening, both buttons have `aria-disabled` set, with the hints "Nothing to undo" and "Nothing to redo".
  - AC-01: after Rotate right, Grayscale 100 and a drawing, the hint reads "Undo Draw (Ctrl/Cmd+Z)". After one Cmd+Z it reads "Undo Adjust", and Redo reads "Redo Draw (Shift+Ctrl/Cmd+Z)".
  - AC-03: full-size PNG Exports after each of three Undos (Cmd+Z, Cmd+Z, button) are identical, pixel for pixel, to the Exports made after the drawing, Adjust and Rotate Steps were applied, ending at the opened 320 × 240 state. Three Redos (Shift+Cmd+Z, Ctrl+Y, button) give back the rotate, adjust and draw Exports exactly.
  - AC-05: a further Cmd+Z with everything undone leaves the Export unchanged, and Undo reads "Nothing to undo".
  - AC-08 and AC-06: with Draw open, Cmd+Z shows "Apply or cancel the open tool first." Escape then leaves the Export identical, with the same hints as before.
  - AC-04: after one Undo, a new Brightness Apply makes Redo read "Nothing to redo" and Undo read "Undo Adjust", and undoing it gives back the earlier Export exactly.
  - AC-09 and AC-10: two Applies, an Export, a third Apply and then two Undos (past the save point). Dropping another image asks for confirmation. Escape keeps the history, with both Undo and Redo available. One Redo returns to the save point, and dropping the image then replaces the Work without asking and leaves both buttons on "Nothing to …".
  - AC-12: after a Rotate right and a zoom to 200%, undoing the rotation re-fits the View to 100% (Fit) at 320 × 240. After a zoom to 150% and an Adjust, undoing the Adjust keeps 150%.
  - No page errors.
- Not verified here: the spec's reference machine is an M1 MacBook Air. The perf numbers come from an M1 Pro.
- Review: four rounds on 2026-10-12. The findings were resolved as T14–T24, and the third re-review (`docs/features/undo-redo/_review/review-2026-10-12.md`) returned **PASS** with nothing open.

## Operational notes

- Migration: none, because IndexedDB isn't touched. Rollback is to revert the merge and redeploy
  GitHub Pages.
- Feature flag or config: none. The app bundle changed, so clients pick up the new precache on
  their next service-worker update.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
