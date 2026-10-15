# Tracker — pwa-install-update

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Pure update-check schedule `nextCheckDue` | domain | Blazheiko | S | — | done |
| T2 | Lasting, slotted, keep-open, busy notices | ui | Blazheiko | M | — | done |
| T3 | Service-worker client and reload marker | infra | Blazheiko | M | — | done |
| T4 | Install-prompt client + `INSTALL_FAILED` | infra | Blazheiko | S | — | done |
| T5 | `APP_PART_UNAVAILABLE` in worker clients | infra | Blazheiko | M | — | done |
| T6 | Reload gate `editor.requestReload()` | app | Blazheiko | M | — | done |
| T7 | Autosave raises `storageSuperseded` | app | Blazheiko | S | T5, T6 | done |
| T8 | Feature store update lifecycle | app | Blazheiko | M | T1, T2, T3, T7 | done |
| T9 | Reload action and resume after update | app | Blazheiko | M | T6, T8 | done |
| T10 | InstallAction and install-offer state | ui | Blazheiko | S | T4, T8 | done |
| T11 | ReloadDialog (SCR-06) | ui | Blazheiko | S | T9 | todo |
| T12 | Prompt mode + app shell wiring + hooks | wiring | Blazheiko | M | T9, T10, T11 | todo |
| T13 | Two-build e2e: single-window update flows | tests | Blazheiko | L | T12 | todo |
| T14 | e2e: install, offline, two windows | tests | Blazheiko | M | T12 | todo |

**Total:** 14 tasks, ~9.5 person-days (S = 0.5, M = 0.75, L = 1).
