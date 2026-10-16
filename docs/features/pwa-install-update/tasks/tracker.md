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
| T11 | ReloadDialog (SCR-06) | ui | Blazheiko | S | T9 | done |
| T12 | Prompt mode + app shell wiring + hooks | wiring | Blazheiko | M | T9, T10, T11 | done |
| T13 | Two-build e2e: single-window update flows | tests | Blazheiko | L | T12 | done |
| T14 | e2e: install, offline, two windows | tests | Blazheiko | M | T12 | done |
| T15 | Reopen in an outdated window asks to reload (R1) | app | Blazheiko | S | — | done |
| T16 | Lock the editor while confirming or leaving; re-gate on confirm (R2) | app | Blazheiko | M | T15 | done |
| T17 | Marker taken first, dropped without a switch; unreadable copy; evicted test (R3–R5) | app | Blazheiko | M | T16 | done |
| T18 | Idle export panel; edits stored before versionchange (R6, R10) | app | Blazheiko | S | T17 | done |
| T19 | Activate any waiting worker; start check waits for registration (R7, R8) | app | Blazheiko | S | T18 | done |
| T20 | Install app hides while prompting (R9) | infra | Blazheiko | S | T19 | done |
| T21 | Busy label once; focus returns to Reload (R11, R12) | ui | Blazheiko | S | T20 | done |
| T22 | e2e positive start-up signal; SW allowed by default (R13, R14) | tests | Blazheiko | M | T21 | done |
| T23 | Hold every editor entry point while leaving; cancelled unload releases lock (N1) | app | Blazheiko | M | T22 | done |
| T24 | Focus returns to Reload in every browser (N2) | ui | Blazheiko | S | T23 | done |
| T25 | sad + ADR-0003 amendment; SCR refs on T15/T17/T21 (N3, N4) | docs | Blazheiko | S | — | todo |
| T26 | e2e: no sleeps before negatives; Firefox click settles (N5, N6) | tests | Blazheiko | S | T24 | todo |
| T27 | Harness immediate watch; reopened-id assertion (N7, N8) | tests | Blazheiko | S | — | done |

**Total:** 27 tasks (T15–T22 from review 2026-10-15, T23–T27 from review 2026-10-16), ~17.5 person-days (S = 0.5, M = 0.75, L = 1).
