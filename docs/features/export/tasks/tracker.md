# Tracker — export

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | [Add the export error codes and the pure file-name rules (Source name, suggested name, extension match)](t01-core-file-name-and-error-codes.md) | domain | Blazheiko | S | — | done |
| T2 | [Add the pure size, quality and default-format rules (presets, long side, half-up rounding, snapping)](t02-core-size-quality-default-format.md) | domain | Blazheiko | S | — | done |
| T3 | [Carry Source name, Source format and the transparency fact on the Work from every open](t03-work-source-name-format-transparency.md) | domain | Blazheiko | M | T1 | done |
| T4 | [Add the editor store's exclusive exporting phase, beginExport/finishExport and the save point](t04-editor-exporting-phase-and-save-point.md) | app | Blazheiko | M | T3 | done |
| T5 | [Extract the shared shader module and build the export worker that renders, flattens, encodes and verifies one export](t05-shared-shaders-and-export-worker.md) | infra | Blazheiko | M | T1 | todo |
| T6 | [Add the once-per-session format check and the main-thread export client (worker spawn, transfer, terminate)](t06-format-check-and-export-client.md) | infra | Blazheiko | S | T5 | todo |
| T7 | [Add the platform save path: Save as… dialog, verified write, empty-target removal and the download hand-off](t07-platform-save-file.md) | infra | Blazheiko | M | T1 | todo |
| T8 | [Create the export store: panel state, defaults, session memory, format availability and the messages catalog](t08-export-store-panel-state-and-memory.md) | app | Blazheiko | M | T2, T3, T6 | todo |
| T9 | [Orchestrate the export in the export store: snapshot, encode, Save as… or download, refusals, File ready, save point](t09-export-store-run-export.md) | app | Blazheiko | M | T4, T7, T8 | todo |
| T10 | [Add the Popover and SegmentedControl shared primitives and register them in the design system](t10-popover-and-segmented-control.md) | ui | Blazheiko | S | — | done |
| T11 | [Add the NumberField and SliderField shared primitives (apply on blur and Enter, apply-now) and register them](t11-number-field-and-slider-field.md) | ui | Blazheiko | S | — | done |
| T12 | [Build the export panel (SCR-03) in every state on the export store and the new primitives](t12-export-panel.md) | ui | Blazheiko | M | T9, T10, T11 | todo |
| T13 | [Mount the Export action in the editor top bar with its states, the Ctrl/Cmd+S shortcut and the exporting lock](t13-export-action-shortcut-and-mount.md) | wiring | Blazheiko | M | T12 | todo |
| T14 | [Precache the export worker and prove export works offline after the first load](t14-offline-export-precache.md) | wiring | Blazheiko | S | T15 | todo |
| T15 | [Write the functional e2e suite: format honesty, fidelity, quality and size, naming, metadata, downloads and Save as…](t15-e2e-export-functional-suite.md) | tests | Blazheiko | M | T13 | todo |
| T16 | [Write the @perf export suite: export time p95, longest freeze and memory after 10 exports](t16-perf-export-suite.md) | tests | Blazheiko | S | T15 | todo |

**Total:** 16 tasks, ~12.5 person-days (S ≈ ½ day, M ≈ 1 day).
