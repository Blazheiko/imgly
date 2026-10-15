## Summary

Adds a **Gallery** of recent Works, kept in this browser. Autosave stores the Work when an image
opens and after every Apply, Undo and Redo, with no Save step. After a reload, a closed tab or a
crash, the Work reopens from the start screen or from the **Gallery** button in the top bar.
Reopening is exact: the reopened Work's Export is pixel-identical to the one made before, and every
part stays editable. The Gallery holds at most 20 Works, never evicts the open one, and names every
Work it removes. Replacing the Work asks for confirmation only when its edits aren't stored. This is
roadmap step 8, and it closes roadmap decision D2. See the [spec](docs/features/gallery/spec.md) and
the [changelog](docs/features/gallery/_ship/changelog.md).

## Acceptance criteria

- AC-01: Autosave stores the Work on open and after each Apply, without interrupting editing. After a reload it is listed first, with all edits ✓
- AC-02: only applied state is stored: no unapplied Draft, no View and no Edit history ✓
- AC-03: the Gallery lists every Work, newest first, with a thumbnail, its name, its last-opened-or-changed time, "Open" and "N of 20 places used" ✓
- AC-04: a reopened Work exports pixel-identically, each part stays editable, and it starts with an empty history and no Unsaved edits ✓
- AC-05: a first visit shows the empty-Gallery text next to "Open image", and nothing reopens on its own ✓
- AC-06: Delete asks for confirmation and removes the Work at once. Cancel keeps it ✓
- AC-07: the open Work can't be deleted or evicted in this tab, and its entry shows a hint ✓
- AC-08: a damaged Work is marked, never replaces the open Work, offers Delete and is evicted first ✓
- AC-09: a 21st Work evicts the least recently opened or changed Work that isn't open, with a notice ✓
- AC-10: when storage is full, the oldest Works are evicted until the open Work fits, in one all-or-nothing transaction, with one notice ✓
- AC-11: other save failures show one notice and never stop editing. The next Step retries, and a success withdraws the notice ✓
- AC-12: with storage blocked, the Gallery says it is unavailable and why, and open, edit and export still work ✓
- AC-13: the storage line follows the browser's persistence answer ✓
- AC-14: persistent storage is requested once, at the first save ✓
- AC-15: reopening is unavailable during an export or a pending confirmation ✓
- AC-16: stored edits replace without confirmation, after waiting for a save that is still running ✓
- AC-17: edits that aren't stored ask for confirmation before they are lost ✓
- AC-18: Works stored by an earlier version reopen unchanged, and an update never empties the Gallery ✓
- AC-19: an interrupted save leaves each Work in its last whole state or absent, never half stored ✓
- AC-20: the browser's leave warning shows only while a save is running ✓
- AC-21: a Work evicted by another tab is stored again by this tab's next save ✓

## Design

- Spec: `docs/features/gallery/spec.md`
- Architecture: `docs/features/gallery/sad.md`
- Decisions: `docs/features/gallery/adr/`
  - [ADR-0001](docs/features/gallery/adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md): Autosave and reopen live in the editor store, and the `gallery` feature is UI only
  - [ADR-0002](docs/features/gallery/adr/0002-store-each-work-as-a-small-record-plus-separate-original-and-layer-blob-stores.md): a small `works` record plus separate `originals` and `layers` Blob stores
  - [ADR-0003](docs/features/gallery/adr/0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker.md): lossless PNG, encoded in a fresh worker
  - [ADR-0004](docs/features/gallery/adr/0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota.md): evict and store in one transaction, and retry on a full quota
  - [ADR-0005](docs/features/gallery/adr/0005-render-the-gallery-thumbnail-with-the-preview-renderer.md): thumbnails rendered by the Preview renderer
  - [ADR-0006](docs/features/gallery/adr/0006-close-an-older-tabs-database-connection-when-a-newer-version-upgrades-it.md): an older tab closes its connection when a newer version upgrades the database
- UX: `docs/features/gallery/ux-flows.md` and `docs/features/gallery/screens.md`
- Test plan: `docs/features/gallery/test-plan.md`
- Data model and migration: `docs/features/gallery/data-model.md`, step `src/infra/db/migrations/0002-gallery.ts` (schema v1 → v2)
- API: none (client-only)

## Tasks

These commits carry `SDD-Task` and `SDD-AC` trailers. Their task ids come from `docs/features/gallery/tasks/tracker.md`.

| Task | Commit | Subject |
|---|---|---|
| T1 | 99b3b88 | feat(gallery): core gallery rules and the storage error codes |
| T3 | ef18659 | feat(gallery): promote migration 0002-gallery, schema v2, db fixtures |
| T8 | e28bdeb | feat(gallery): renderThumbnail in the Preview renderer |
| T9 | 69f127b | feat(gallery): toast action, returned notice ids, --gallery-tile-size |
| T10 | 6cf9539 | feat(gallery): Autosave save queue, single flight and latest wins |
| T23 | add7030 | docs(gallery): align spec AC-10/AC-12, open-and-view note, CONTEXT terms, map |
| T2 | 85744c6 | feat(gallery): stored-Work rules — format, toStoredFields, validation |
| T4 | 1bbe918 | feat(gallery): storeWork — evict and store in one transaction, quota retry |
| T6 | 92ddeef | feat(gallery): openGalleryDb as a Result, storage-persistence |
| T7 | db6f014 | feat(gallery): work-codec — PNG encode and decode in a fresh worker |
| T5 | bab47f1 | feat(gallery): listWorks, loadWork and deleteWork |
| T11 | 12f74c5 | feat(gallery): Autosave pipeline — prepare, store, persistence, notices |
| T12 | 1ecd7a3 | feat(gallery): editor store — Autosave triggers and the narrowed replace gate |
| T13 | 6b183a6 | feat(gallery): reopenWork — load, validate, decode, then the replace gate |
| T14 | 31d2bfc | feat(gallery): EditorView slots, leave warning, ReplaceDialog wording |
| T15 | de209f0 | feat(gallery): gallery store and message catalog |
| T16 | 281a65c | feat(gallery): GalleryEntry, GalleryList and DeleteWorkDialog |
| T5 | e2d0a2d | fix(gallery): loadWork refuses a Work whose thumbnail can't be shown |
| T17 | 4a7a6e9 | feat(gallery): GalleryStart, GalleryAction, GalleryOverlay and App wiring |
| T18 | 937eac1 | feat(gallery): e2e test hooks for the Gallery |
| T7 | c289bcf | fix(gallery): write the stored PNG from straight pixels, not the canvas encoder |
| T11 | 3ac6735 | fix(gallery): Autosave waits out a lost WebGL context before the thumbnail |
| T19 | 2400171 | test(gallery): e2e save, reopen, exactness, start screen, v1 Work |
| T16 | a5ce69e | fix(gallery): mount the delete confirmation in GalleryList |
| T20 | 69adf21 | test(gallery): e2e delete, damaged, 25 images, quota, failures, line, persist |
| T21 | 0fffc88 | test(gallery): e2e gate, blocked storage, leave warning, 50 reloads, two pages, offline |
| T22 | 56d53f3 | test(gallery): @perf suite for the five spec §6 timing targets |
| T24 | 360ede6 | fix(gallery): store the layer by the stored layerId, refuse a layerId with no layer, name evicted damaged Works safely |
| T25 | fab1feb | fix(gallery): list every stored record and evict damaged ones first without the caller's help |
| T26 | d24ecd5 | fix(gallery): remember damaged Works for the page and evict them first |
| T27 | 1f26b03 | fix(gallery): close the overlay after a confirmed reopen, keep it on a dialog's Esc, cover the status bar |
| T33 | e28024a | fix(gallery): only the newest refresh assigns the list, and a stale thumbnail error marks nothing |
| T28 | baad911 | fix(gallery): nothing reaches the Work under the open Gallery |
| T29 | 6e31515 | fix(gallery): no false unavailable reason before the database connects, and store the Work opened meanwhile |
| T30 | 0d1249b | fix(gallery): the damaged notice's Delete always confirms, and the storage-full notice stays until dismissed |
| T31 | dbd3ac6 | test(gallery): persistence is asked again after the Gallery is cleared, and a Work survives a version bump whole |
| T32 | b2980b4 | docs(gallery): test-plan says migration 0002 clears v1 records, lists the review follow-up tests, and the review records its resolution |
| T34 | a8eab73 | fix(gallery): a record with no usable touchedAt lists Damaged instead of stopping the Gallery |
| T35 | 509d888 | fix(gallery): the damaged mark ends when a Work reopens or stores whole, and the open Work lists Open |
| T36 | 28ef653 | test(gallery): Autosave hands the page's damaged set to the save, so a damaged Work is evicted first |
| T37 | e56b30d | fix(gallery): while the database connects, the Gallery shows no count, empty state or storage line |
| T38 | 48ffef4 | fix(gallery): the delete confirmation over the Editor holds keys and drops, and its Esc leaves an open tool alone |
| T39 | f23556b | test(gallery): e2e — a thumbnail typed PNG whose bytes will not decode lists Damaged on every engine |
| T40 | 79b72f5 | test(gallery): the commit-quota fault aborts every save, not only a first one |
| T41 | caf53d9 | docs(gallery): test-plan lists the round-2 review tests, and the round-2 review records its resolution |
| T42 | 3661f45 | fix(gallery): a touchedAt outside the date range lists Damaged instead of stopping the Gallery |
| T43 | 9cdb791 | fix(gallery): a thumbnail that will not decode leaves the open Work's entry Open |
| T44 | 254b76d | fix(gallery): a reopen whose storage read fails says so, without marking the Work Damaged or offering Delete |
| T45 | 35336cb | fix(gallery): a listing that fails keeps what the Gallery showed and says so, never a false empty Gallery |
| T46 | 8cb1587 | fix(gallery): closing the standby delete dialog puts focus on the Gallery button, not the page body |
| T47 | 27ce143 | test(gallery): under the standby delete dialog, Ctrl+O opens no picker and a drop opens no file |
| T48 | 5c404f0 | test(gallery): the overlapping-refresh test waits for its reads, not a fixed delay |
| T49 | 621e825 | docs(gallery): test-plan lists the round-3 review tests, and the round-3 review records its resolution |
| T50 | 2de8d44 | fix(gallery): when the last list leaves the screen its thumbnail URLs go with it, so a failed listing marks nothing Damaged |
| T51 | 7a6e311 | fix(gallery): a delete that commits drops its entry even when the listing after it fails |
| T52 | 97677dd | fix(gallery): the couldn't-be-read notice shows once while listings fail and goes when one succeeds |
| T53 | 5a1906d | fix(gallery): Cancel on a Delete asked from the damaged notice puts focus on that entry's Delete |
| T54 | 8752a74 | fix(gallery): a touchedAt outside the date range sorts as the oldest, like every other unusable time |
| T55 | 4fd05f5 | docs(gallery): test-plan lists the round-4 review tests, and the round-4 review records its resolution |

T1–T23 are the planned breakdown. T24–T55 come from the five review rounds. The branch also
carries the spec, design, sequences, screens, data-model and tasks commits, plus `02046c0` (the
roadmap link to undo-redo's PR #9).

## Verification

Verified at `6c2a4bf` on 2026-10-15 (Apple M1 Pro, latest Playwright browsers).

- Unit: `pnpm test` passes 2380 of 2380 (110 files).
- Lint and vet: `pnpm lint` and `pnpm typecheck` are clean.
- Build: `pnpm build` is clean, and the production `dist/` has no `__imglyTest` hooks.
- e2e: `pnpm test:e2e` on Chromium, Firefox and WebKit has 1020 passing, 39 skipped and none failing (8.9 min). The run covers every suite, so open-and-view, export, crop-rotate, adjust, draw and undo-redo still pass next to the new gallery suites. The skips are conditional: `@perf` without `PERF=1`, Chromium-only checks on Firefox and WebKit, and the earlier features' engine-specific skips.
- Perf (`PERF=1`, Chromium, reference Work 4096 × 3072, 20 runs after 2 warm-ups). Every row passes the spec §6 target:
  - First store: p95 336 ms (target ≤ 3 s). Longest task 0 ms (target ≤ 200 ms).
  - Store after a Step, Crop or Adjust: Apply, Undo and Redo p95 between 56 and 75 ms (target ≤ 300 ms).
  - Store after a drawing Step: Apply 307 ms, Undo 292 ms, Redo 314 ms (target ≤ 1.5 s). Longest task 77 ms.
  - Reopen to the first Preview: p95 207 ms (target ≤ 1.5 s).
  - Gallery with 20 Works, until every thumbnail is painted: p95 63 ms (target ≤ 500 ms).
- Ran the feature by hand. A separate Playwright script drove the **production** `dist/` through the UI only, with no test hooks, on Chromium with `photo.png` (320 × 240) and `ref.png`. It observed:
  - AC-05 and AC-13: a first visit shows "Works you open will appear here." with "Open image", and the storage line uses the non-persistent wording.
  - AC-01 and AC-05: after Brightness 40 and Grayscale 60 were applied and the page was reloaded, the start screen lists "photo, Just now", with "1 of 20 places used" and a loaded thumbnail. No canvas is shown and every tool is off, so nothing reopened on its own.
  - AC-04: after choosing the entry, a full-size PNG Export is identical to the Export made before the reload (max channel difference 0). Adjust shows Brightness 40 and Grayscale 60, and Undo is unavailable.
  - AC-16: after another applied Adjust was stored, opening `ref.png` replaced the Work with no confirmation.
  - AC-03: the overlay lists "ref, Open" then "photo, Just now", with "2 of 20 places used".
  - AC-07: the open entry's Delete has `aria-disabled` set, with the hint "The open Work can't be deleted. Open another image first."
  - AC-06: Delete “photo” asks "Delete “photo”? It can't be brought back. An Export is the only copy kept outside this browser." Cancel keeps the count at 2, and Delete brings it to 1.
  - AC-12: with `indexedDB.open` refused, the Gallery reads "The Gallery is unavailable in this window." with the reason, and an image still opens.
  - No page errors.
- Not verified here:
  - The perf numbers come from an M1 Pro, not the M1 MacBook Air that the spec names as the reference machine.
  - Firefox and WebKit perf rows weren't run (they are report-only).
  - **The security review that spec §6.1 requires isn't recorded yet.**
- Review: five rounds on 2026-10-14 and 2026-10-15. The findings were resolved as T24–T55, and round 5 (`docs/features/gallery/_review/review-2026-10-15-r5.md`) returned **PASS**. R3-7 stays deferred in spec §8 (owner Blazheiko, due 2026-11-14).

## Operational notes

- Migration: IndexedDB step `0002-gallery` (v1 → v2) runs in each user's browser on the first load
  of the new version. There's nothing to run on deploy. Rollback is to revert the merge and redeploy
  GitHub Pages. The app on `main` never opens the database, so it runs unaffected next to a v2
  database.
- Feature flag or config: none. The app bundle changed, so clients pick up the new precache on
  their next service-worker update.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
