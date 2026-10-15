# Changelog — gallery

## gallery — every Work is kept in the browser and reopens exactly as it was left

**What:** The editor now keeps a **Gallery** of recent Works in this browser. Nothing has to be
saved by hand: Autosave stores the Work when an image opens and again after every Apply, Undo and
Redo. After a reload, a closed tab or a crash, the Work can be reopened and edited further.

- **Where to find it.** The start screen lists the Gallery next to the "Open image" drop zone. The
  **Gallery** button in the top bar opens the same list over the editor. Each entry shows a
  thumbnail with all edits, the Source name and when it was last opened or changed ("Just now",
  "N minutes ago", …). The newest is first, and the open Work is marked "Open".
- **Exact reopen.** The Original is stored losslessly, so a reopened Work is pixel-identical to the
  one stored, and its Export matches the Export made before the reload. Each part stays editable:
  "Crop and rotate" shows the stored frame, "Adjust" shows the stored slider values, and "Draw"
  shows the stored Drawing layer. A reopened Work starts with an empty Edit history and no Unsaved
  edits. Nothing reopens on its own when the app starts.
- **Fewer needless dialogs.** Opening, dropping or reopening another image no longer asks for
  confirmation when the open Work's edits are already stored. The confirmation stays when they are
  not, which happens when a save failed or the Gallery is unavailable. A replacement that starts
  while a save is still running waits for that save first.
- **Bounded.** The Gallery holds at most 20 Works ("N of 20 places used"). Opening a 21st evicts the
  least recently opened or changed Work, never the one open in this tab. When the browser reports
  that storage is full, older Works are evicted until the open Work fits. A notice always names
  every Work that was removed.
- **Delete.** Each entry can be deleted after a confirmation, which says that this can't be undone
  and that an Export is the only copy outside the browser. The open Work can't be deleted.
- **Honest about storage.** A line in the Gallery says where Works are kept, and whether the
  browser may clear them when space runs low. At the first save, the app asks the browser once to
  keep its storage persistent. If site data is blocked, the Gallery says it is unavailable in this
  window and why, and opening, editing and exporting work as before.
- **Robust.** A save and its evictions commit together or not at all, so a reload mid-save never
  leaves a half-stored Work. While a save is running, leaving the page triggers the browser's own
  warning. A damaged Work is marked as damaged: choosing it offers to delete it, it never replaces
  the open Work, and every other Work keeps working. The Gallery works offline.

**Why:** Until now, every edit lived only in the open tab. A reload, a closed tab or opening another
image threw the Work away, and the only durable copy was an Export ([spec](../spec.md) §1–§2). This
is roadmap step 8, and it closes roadmap decision D2: the Gallery is capped by count (20 Works), and
it also evicts the oldest Works when storage is full. Key decisions:

- Autosave and reopen live in the editor store. The new `gallery` feature only provides the UI, so
  no feature imports another
  ([ADR-0001](../adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md)).
- Each Work is stored as a small `works` record, plus its Original and its Drawing layer as Blobs in
  separate stores, so the Gallery can be listed without loading any image
  ([ADR-0002](../adr/0002-store-each-work-as-a-small-record-plus-separate-original-and-layer-blob-stores.md)).
- The Original and the Drawing layer are encoded as lossless PNG in a fresh worker each time, which
  keeps the main thread responsive
  ([ADR-0003](../adr/0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker.md)).
- The evictions and the save are one IndexedDB transaction, which is retried after evicting more
  when the quota is full
  ([ADR-0004](../adr/0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota.md)).
- The thumbnail is rendered by the Preview renderer, so it shows exactly what the Work looks like
  ([ADR-0005](../adr/0005-render-the-gallery-thumbnail-with-the-preview-renderer.md)).
- A tab running an older version closes its database connection when a newer version upgrades the
  database, so the upgrade is never blocked
  ([ADR-0006](../adr/0006-close-an-older-tabs-database-connection-when-a-newer-version-upgrades-it.md)).

**How to use:** Open an image and edit it. There's no Save step. Reload the page, and the start
screen lists the Work. Click it to continue where you left off. While editing, click **Gallery** in
the top bar to see every stored Work, reopen another one, or delete one you no longer need. Export
anything you want to keep outside this browser.

**Operational notes:**

- Migration: adds IndexedDB step `src/infra/db/migrations/0002-gallery.ts`, which moves the schema
  from v1 to v2. It replaces the `updatedAt` index on `works` with `touchedAt`, and it adds the
  `originals`, `layers` and `meta` stores. It also clears `works`, which is safe because no released
  version ever wrote a v1 record. The step runs in each user's browser at the first load of the new
  version. There's nothing to run on deploy.
- Rollback: revert the merge and redeploy GitHub Pages. The step is forward-only, but the app
  before this change never opens IndexedDB (`openDb` has no caller on `main`), so it runs
  unaffected next to a v2 database. Works stored meanwhile stay in the browser and show up again
  when the Gallery is redeployed. A later rollback, to a version that does open the database, must
  never ship a lower schema version, because the open would fail with a `VersionError`.
- Feature flag / config: none. The e2e test hooks for the Gallery exist only in the e2e build
  (`dist-e2e/`). The production `dist/` was checked and has no `__imglyTest`.
- Service worker: the app bundle changed, so a deploy changes the precache manifest. Clients pick
  it up on their next service-worker update.
- Cross-feature changes: open-and-view AC-15's replace confirmation is narrowed to Unsaved edits
  that aren't stored in the Gallery (AC-16, AC-17). Reopening from the Gallery is a new way to
  replace the Work, with the same rules as opening a file. The root `CONTEXT.md` invariant and its
  "Unsaved edits" entry are refined to match.
- Review: five rounds on 2026-10-14 and 2026-10-15. The findings became tasks T24–T55, and round 5
  (`_review/review-2026-10-15-r5.md`) returned **PASS**.
- Known follow-ups:
  - Spec §8 (R3-7): a page's damaged mark ends only when this tab reopens the Work or completes a
    save of it, not when another tab repairs it. Owner Blazheiko, due 2026-11-14.
  - Spec §6.1 requires a security review of the data at rest: what is stored, that delete and
    eviction leave nothing behind, and damaged-data handling. None is recorded yet.
  - Two tabs editing the same Work don't coordinate: the last save wins, with no warning (spec §8,
    closed with that default).

**Acceptance criteria delivered:** AC-01 – AC-21:

- Autosave after an image opens and after every Apply, Undo and Redo. Only applied state is stored:
  no Draft, View or Edit history (AC-01, AC-02).
- A Gallery listing ordered by the time each Work was last opened or changed, with thumbnails, an
  "Open" marker and the count of used places (AC-03), plus the start-screen Gallery and its
  first-visit text, with nothing reopened on start (AC-05).
- Exact, still-editable reopen (AC-04), refused during an export or a pending confirmation (AC-15).
  Works stored by an earlier version reopen unchanged (AC-18).
- Delete with confirmation, and the open Work can't be deleted (AC-06, AC-07). Damaged Works are
  marked, never replace the open Work, and are evicted first (AC-08).
- A cap of 20 Works, eviction when storage is full, one notice naming every removed Work, and save
  failures that never stop editing (AC-09, AC-10, AC-11).
- Blocked storage that is reported plainly, a storage line that follows the browser's answer, and
  persistent storage requested once at the first save (AC-12, AC-13, AC-14).
- A replace gate that asks only when edits aren't stored, and waits for a running save
  (AC-16, AC-17).
- All-or-nothing saves, a leave warning only while a save runs, and a Work evicted by another tab
  that is stored again by this tab's next save (AC-19, AC-20, AC-21).
