# Tracker — undo-redo

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | [Add WorkState, editStateOf and withState to core/document](./t01-core-work-state.md) | domain | Blazheiko | S | — | done |
| T2 | [Add core/history: EditHistory with createHistory, record, undo, redo, canUndo/canRedo and undo/redo labels](./t02-core-history-record-undo-redo.md) | domain | Blazheiko | M | T1 | done |
| T3 | [Bound the history: budget.ts with 50 Steps and 512 000 000 B, heldLayerBytes, and the oldest-first trim inside record](./t03-core-history-budget-and-trim.md) | domain | Blazheiko | S | T2 | done |
| T4 | [Add the edit-history composable, record a Step on every counting Apply, make withEdit take the revision, and move layer release to one path](./t04-editor-edit-history-record-and-release.md) | app | Blazheiko | L | T1, T3 | done |
| T5 | [Expose undo, redo, canUndo, canRedo, undoTool, redoTool and historyStats on the editor store, with the refusals and the View fit](./t05-editor-store-undo-redo-api.md) | app | Blazheiko | M | T4 | done |
| T6 | [Move isTextTarget to src/shared/keyboard.ts so undo-redo can skip text and number fields](./t06-shared-keyboard-is-text-target.md) | ui | Blazheiko | S | — | done |
| T7 | [Add the undo-redo feature's messages and the pure shortcut handler for Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y](./t07-undo-redo-shortcuts-and-messages.md) | ui | Blazheiko | S | T6 | done |
| T8 | [Build UndoRedoActions (two ghost BaseButtons with hints) and mount it first in the top bar with the shortcuts](./t08-undo-redo-actions-top-bar.md) | ui | Blazheiko | M | T5, T7 | done |
| T9 | [Expose the editor store's historyStats through window.__imglyTest for the e2e memory checks](./t09-test-hooks-history-stats.md) | wiring | Blazheiko | S | T5 | done |
| T10 | [e2e (Chromium): the 512 MB budget, Steps kept and layer release after replace, discard and drop](./t10-e2e-memory-and-release.md) | tests | Blazheiko | M | T8, T9 | done |
| T11 | [e2e (Chromium, Firefox, WebKit): pixel-exact Undo and Redo for each tool, View fit, marks follow Geometry, shortcuts per engine](./t11-e2e-exactness-view-and-shortcuts.md) | tests | Blazheiko | M | T10 | done |
| T12 | [@perf e2e: Undo and Redo p95 ≤ 150 ms for a Step of each tool with a full-image drawing](./t12-perf-undo-redo-latency.md) | tests | Blazheiko | S | T8, T9 | done |
| T13 | [Record what undo-redo supersedes in open-and-view ADR-0005, draw spec §6 and sad §11, and tick export §8 and crop-rotate §8](./t13-docs-cross-feature-updates.md) | docs | Blazheiko | S | — | done |
| T14 | [Bound the Edit history at every cursor position, so Undo can never take it over 512 000 000 B](./t14-fix-budget-at-every-cursor.md) | domain | Blazheiko | S | — | done |
| T15 | [Match Ctrl/Cmd+Z and Ctrl+Y by key position on non-Latin layouts](./t15-fix-shortcuts-non-latin-layouts.md) | ui | Blazheiko | S | — | done |
| T16 | [Release the old history's layers when follow() restarts the Edit history](./t16-fix-follow-releases-orphaned-layers.md) | app | Blazheiko | S | — | done |
| T17 | [Add the test plan's missing component and integration cases](./t17-tests-missing-component-and-integration-cases.md) | tests | Blazheiko | S | T14 | done |
| T18 | [Strengthen the memory e2e: held bytes after every Apply and Undo; AC-04 discards 10 Steps](./t18-e2e-memory-strengthen.md) | tests | Blazheiko | S | T14 | done |
| T19 | [e2e-through-UI: the AC-06, AC-07, AC-08 and AC-09 flows from the test plan](./t19-e2e-missing-flows.md) | tests | Blazheiko | S | T15 | done |
| T20 | [Record the new modules in the architecture map](./t20-docs-architecture-map.md) | docs | Blazheiko | S | T15 | done |

**Total:** 20 tasks: 13 original, ~9.5 person-days, plus 7 review follow-ups (T14–T20, from `_review/review-2026-10-12.md`).
