# Tracker — gallery

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Core gallery rules and the three error codes | domain | Blazheiko | M | — | done |
| T2 | Stored-Work rules: STORED_WORK_FORMAT, toStoredFields, validateStoredWork | domain | Blazheiko | M | T1 | done |
| T3 | Promote migration 0002-gallery, schema v2, db fixtures | migration | Blazheiko | S | — | done |
| T4 | storeWork: evict and store in one transaction, quota retry, marker | infra | Blazheiko | L | T1, T3 | done |
| T5 | listWorks, loadWork, deleteWork | infra | Blazheiko | M | T2, T4 | done |
| T6 | openGalleryDb as a Result with versionchange, storage-persistence | infra | Blazheiko | M | T1, T3 | done |
| T7 | work-codec: PNG encode and decode in a fresh worker | infra | Blazheiko | M | T1 | done |
| T8 | renderThumbnail in the Preview renderer | infra | Blazheiko | M | — | done |
| T9 | Toast action, returned notice ids, --gallery-tile-size | ui | Blazheiko | S | — | done |
| T10 | Autosave save queue: single flight, latest wins | app | Blazheiko | S | — | done |
| T11 | autosave.ts: prepare, store, persistence, versionchange, notices | app | Blazheiko | L | T4, T6, T7, T8, T9, T10 | done |
| T12 | Editor store: Autosave triggers and the narrowed replace gate | app | Blazheiko | M | T11 | done |
| T13 | reopenWork(id) | app | Blazheiko | M | T2, T5, T7, T12 | done |
| T14 | EditorView slots, leave warning, ReplaceDialog wording | ui | Blazheiko | S | T12 | done |
| T15 | Gallery store and messages | ui | Blazheiko | M | T1, T5, T6, T9, T13 | done |
| T16 | GalleryEntry, GalleryList, DeleteWorkDialog | ui | Blazheiko | M | T9, T15 | done |
| T17 | GalleryStart, GalleryAction, GalleryOverlay, App wiring | ui | Blazheiko | M | T14, T16 | done |
| T18 | Gallery e2e hooks | wiring | Blazheiko | M | T5, T6, T12 | done |
| T19 | e2e: save, reopen, exactness, start screen, v1 Work | tests | Blazheiko | L | T17, T18 | done |
| T20 | e2e: delete, damaged, 25 images, quota, failures, line, persist | tests | Blazheiko | L | T17, T18 | done |
| T21 | e2e: gate, blocked storage, leave warning, 50 reloads, two pages, offline | tests | Blazheiko | L | T17, T18 | done |
| T22 | @perf: the five spec §6 timing targets | tests | Blazheiko | M | T17, T18 | done |
| T23 | Spec wording, open-and-view note, CONTEXT terms, architecture map | docs | Blazheiko | S | — | done |
| T24 | Repository write side: layer by stored layerId, layerId without layer, evicted name, quota at commit | infra | Blazheiko | S | — | done |
| T25 | Index-hidden records listed; damaged-first eviction inside the save | infra | Blazheiko | M | T24 | done |
| T26 | Page damaged set into Autosave; mark survives refresh; thumbnail decode error | app | Blazheiko | M | T25 | done |
| T27 | Overlay closes after confirmed reopen; Esc in dialogs; covers status bar | ui | Blazheiko | M | T26 | done |
| T28 | Nothing reaches the Work under the open Gallery | wiring | Blazheiko | S | T33 | done |
| T29 | Connecting state on SCR-01; save the Work opened before connect | app | Blazheiko | S | T28 | done |
| T30 | Damaged notice Delete, storage-full notice kept | ui | Blazheiko | M | T29 | done |
| T31 | AC-14 re-ask and AC-18 survival tests | tests | Blazheiko | S | T30 | done |
| T32 | Test-plan: migration 0002 clears v1; new rows | docs | Blazheiko | S | T31 | done |
| T33 | Regression from T26: latest refresh wins, URLs revoked after render (S2-6) | ui | Blazheiko | S | T27 | done |
| T34 | Non-numeric touchedAt lists Damaged, never stops listing (R2-1) | core | Blazheiko | S | — | done |
| T35 | Damaged mark clears on reopen or save; open wins (R2-2) | app | Blazheiko | M | T34 | done |
| T36 | Autosave → storeWork damagedIds hand-off test (R2-5) | tests | Blazheiko | S | T35 | done |
| T37 | Connecting state: no false empty Gallery (R2-3) | ui | Blazheiko | S | T35 | done |
| T38 | Standby delete dialog holds the keyboard (R2-4) | wiring | Blazheiko | M | T37 | done |
| T39 | e2e: undecodable thumbnail bytes list Damaged (R2-6) | tests | Blazheiko | S | T38 | done |
| T40 | Commit-quota fault aborts every save (R2-7) | tests | Blazheiko | S | T39 | done |
| T41 | Test-plan rows and round-2 resolution | docs | Blazheiko | S | T40 | done |
| T42 | Out-of-range touchedAt lists Damaged (R3-1) | core | Blazheiko | S | — | done |
| T43 | Image error leaves the open Work Open (R3-3) | app | Blazheiko | S | T42 | done |
| T44 | STORAGE_FAILED reopen: no Damaged, no Delete (R3-2) | app | Blazheiko | S | T43 | done |
| T45 | Failed listing keeps the list, no false empty (R3-4) | app | Blazheiko | S | T44 | done |
| T46 | Standby dialog close: focus not on body (R3-5) | ui | Blazheiko | S | — | done |
| T47 | Standby-dialog test covers Ctrl+O and drop (R3-6) | tests | Blazheiko | S | T46 | done |
| T48 | Refresh-race test waits for its reads (R3-8) | tests | Blazheiko | S | T45 | done |
| T49 | Test-plan rows and round-3 resolution | docs | Blazheiko | S | T42, T43, T44, T45, T46, T47, T48 | todo |

**Total:** 49 tasks, ~31 person-days (S ≈ 0.5, M ≈ 0.75, L ≈ 1).
