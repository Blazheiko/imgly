---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-13"
feature_size: "M"
ticket: "roadmap step 8 — gallery"
---

# 0004 — Evict and store in one IndexedDB transaction, and retry on a full quota

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Blazheiko (owner), design Socratic walk (medium depth)

## Context

A save may have to make room in two ways: because a 21st Work arrives (AC-09), or because the browser reports that the app's storage is full (AC-10). A reload or crash in the middle of a save must leave every Work either in its last fully stored state or absent. Evicting and storing must happen as one step, so an interrupted save removes no Work (AC-19, spec §6: 0 damaged or mixed Works in 50 forced reloads). The Work open in this tab is never evicted (AC-07), and no Work leaves the Gallery without a notice naming it (AC-09, AC-10). An IndexedDB transaction is atomic, but it commits on its own once no request is pending, so it can't wait for a worker (§2). `navigator.storage.estimate()` is deliberately approximate, because engines round or pad it for privacy.

## Decision drivers

- sad.md §1 quality goal 1: fully stored or absent, never half stored; the open Work never evicted; no Work leaves without a notice
- spec AC-09, AC-10, AC-19, §6 (50 forced reloads, cap of 20)
- spec AC-08: a damaged Work counts toward the 20 places and is evicted first
- §2: IndexedDB transactions are atomic and auto-commit; the quota estimate is not exact

## Considered options

1. **Prepare everything first, then evict and store in one read-write transaction; on `QuotaExceededError` retry with one more Work evicted.**
2. **Estimate the free space first** with `navigator.storage.estimate()`, evict as many Works as the estimate says, then evict and store in one transaction.
3. **Store first, then evict** in a second transaction.

## Decision outcome

**Chosen:** Option 1. Atomicity comes from the browser's own transaction rather than from an approximate number. Option 2 still needs the retry, because the estimate can be wrong in either direction, and a too-high estimate would evict Works that didn't need to go. Option 3 breaks AC-19: a crash between the two transactions leaves 21 Works, and on a full disk the first write fails anyway.

How it works:

- **Prepare** outside any transaction: the Original's PNG at the first save, the layer's PNG when its id changed (ADR-0003), and the thumbnail (sad.md §5).
- **Store**: `storeWork(entry, blobs, { keep, damaged, extra })` in the `works` repository opens one read-write transaction over `works`, `originals`, `layers` and `meta`. Inside it, the repository:
  - reads the `works` records (at most 21 small records);
  - asks a pure `core` rule (`src/core/gallery/`) for the eviction list. The list is empty when there is room. Otherwise it takes the Works that are not `keep` (the Work open in this tab), damaged Works first, then the least recently `touchedAt`, enough to hold at most 20 Works, plus `extra` more;
  - deletes every evicted Work from all three Work stores;
  - writes this Work's record, its Original when the store doesn't hold it (a first save, or a Work another tab evicted, AC-21), its layer when it changed or is missing, and the persistent-storage marker at the first save (AC-14);
  - waits for the commit and returns the evicted Works' Source names.
- **Quota**: a `QuotaExceededError` aborts the whole transaction, so nothing changed. The save retries with `extra + 1`. When the next attempt would leave only this Work, and it still doesn't fit, the save returns `STORAGE_QUOTA` and **nothing is evicted**. The earlier stored state of the open Work, if any, stays, and one notice says the Work could not be saved and to export it (AC-10). The owner chose this refinement of AC-10's wording on 2026-10-13: removing 19 Works that can't make room helps no one (sad.md §11).
- **Notices** are raised only after the commit resolves: one notice names every evicted Work. A save that fails for another reason returns `STORAGE_FAILED` and is handled as AC-11 says.
- **Deleting** a Work by hand (AC-06) uses the same repository in one transaction over the three Work stores.

## Consequences

**Positive**
- Every interruption, whether a reload, a crash or a quota error, leaves the database as it was before the save started.
- The eviction rule is a pure function with unit tests for the cap, the open Work, damaged Works and ties.

**Negative**
- On a full disk a save may take several attempts, and each one writes the record again (and the Original when it is new) before it aborts. This is bounded by 20 attempts.
- A notice is raised after the commit, so a crash in the instant between the commit and the notice would lose that notice. This is accepted (sad.md §11).

**Neutral**
- Two tabs may save at the same time. IndexedDB runs their transactions one after the other, so the last save wins, as spec §8 accepts.

## Links

- Spec: [[../spec.md]] AC-06, AC-07, AC-08, AC-09, AC-10, AC-11, AC-14, AC-19, AC-21, §6
- SAD: [[../sad.md]] §4, §6, §8, §11
- Related ADR: [[0002-store-each-work-as-a-small-record-plus-separate-original-and-layer-blob-stores]], [[0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker]], [[0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui]]
