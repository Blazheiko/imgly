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
| T7 | [Add the undo-redo feature's messages and the pure shortcut handler for Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y](./t07-undo-redo-shortcuts-and-messages.md) | ui | Blazheiko | S | T6 | todo |
| T8 | [Build UndoRedoActions (two ghost BaseButtons with hints) and mount it first in the top bar with the shortcuts](./t08-undo-redo-actions-top-bar.md) | ui | Blazheiko | M | T5, T7 | todo |
| T9 | [Expose the editor store's historyStats through window.__imglyTest for the e2e memory checks](./t09-test-hooks-history-stats.md) | wiring | Blazheiko | S | T5 | todo |
| T10 | [e2e (Chromium): the 512 MB budget, Steps kept and layer release after replace, discard and drop](./t10-e2e-memory-and-release.md) | tests | Blazheiko | M | T8, T9 | todo |
| T11 | [e2e (Chromium, Firefox, WebKit): pixel-exact Undo and Redo for each tool, View fit, marks follow Geometry, shortcuts per engine](./t11-e2e-exactness-view-and-shortcuts.md) | tests | Blazheiko | M | T10 | todo |
| T12 | [@perf e2e: Undo and Redo p95 ≤ 150 ms for a Step of each tool with a full-image drawing](./t12-perf-undo-redo-latency.md) | tests | Blazheiko | S | T8, T9 | todo |
| T13 | [Record what undo-redo supersedes in open-and-view ADR-0005, draw spec §6 and sad §11, and tick export §8 and crop-rotate §8](./t13-docs-cross-feature-updates.md) | docs | Blazheiko | S | — | todo |

**Total:** 13 tasks, ~9.5 person-days.
