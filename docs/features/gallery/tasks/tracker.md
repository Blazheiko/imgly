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
| T28 | Nothing reaches the Work under the open Gallery | wiring | Blazheiko | S | T27 | todo |
| T29 | Connecting state on SCR-01; save the Work opened before connect | app | Blazheiko | S | T28 | todo |
| T30 | Damaged notice Delete, storage-full notice kept, refresh race | ui | Blazheiko | M | T29 | todo |
| T31 | AC-14 re-ask and AC-18 survival tests | tests | Blazheiko | S | T30 | todo |
| T32 | Test-plan: migration 0002 clears v1; new rows | docs | Blazheiko | S | T31 | todo |

**Total:** 32 tasks, ~22.5 person-days (S ≈ 0.5, M ≈ 0.75, L ≈ 1).
