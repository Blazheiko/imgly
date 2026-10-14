---
id: T4
title: "Add storeWork to the works repository: evict and store in one read-write transaction over four stores, retry with one more eviction on a full quota, write the persistence marker on the first save"
layer: "infra"
deps: ["T1", "T3"]
blocks: ["T5", "T11"]
acs: ["AC-09", "AC-10", "AC-14", "AC-19", "AC-21"]
files_hint: ["src/infra/db/works-repository.ts", "src/infra/db/works-repository.test.ts", "src/infra/db/testing.ts", "src/infra/db/index.ts"]
owner: "Blazheiko"
estimate: "L"
context_budget: "M"   # measured: 82 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Add storeWork to the works repository: evict and store in one read-write transaction over four stores, retry with one more eviction on a full quota, write the persistence marker on the first save

## Place in the sequence

- **Blocked by:** T1 — Add core/gallery rules and the error codes (`evictionCandidates`, `STORAGE_FAILED`) · T3 — Promote migration 0002-gallery (the v2 stores and fixtures).
- **Blocks:** T5 — Add listWorks, loadWork and deleteWork · T11 — Compose autosave.ts.
- **Wave:** 2.
- **Lane:** shares `src/infra/db/works-repository.ts` with T5 and T18, `testing.ts` with T3 and T18, and `index.ts` with T3, T5 and T6, so they run one after the other.

## Why (user story)

> **As an** Editor
> **I want** every change I apply to be kept in this browser without my asking
> **So that** a reload, a closed tab, a crash or opening another image never costs me the edits I applied
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task adds the single atomic write that makes a Work either fully stored or absent, and that makes room for it without ever removing the open Work.

## Inlined context

> - **Store**: `storeWork(entry, blobs, { keep, damaged, extra })` in the `works` repository opens one read-write transaction over `works`, `originals`, `layers` and `meta`. Inside it, the repository:
>   - reads the `works` records (at most 21 small records);
>   - asks a pure `core` rule (`src/core/gallery/`) for the eviction list. …
>   - deletes every evicted Work from all three Work stores;
>   - writes this Work's record, its Original when the store doesn't hold it (a first save, or a Work another tab evicted, AC-21), its layer when it changed or is missing, and the persistent-storage marker at the first save (AC-14);
>   - waits for the commit and returns the evicted Works' Source names.
> - **Quota**: a `QuotaExceededError` aborts the whole transaction, so nothing changed. The save retries with `extra + 1`. When the next attempt would leave only this Work, and it still doesn't fit, the save returns `STORAGE_QUOTA` and **nothing is evicted**. The earlier stored state of the open Work, if any, stays …
> - **Notices** are raised only after the commit resolves … A save that fails for another reason returns `STORAGE_FAILED` …
>
> — `adr/0004 §Decision outcome, Store / Quota / Notices bullets, abridged` · full text: [adr/0004](../adr/0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota.md)

> - A transaction also commits on its own as soon as no request is pending, so any slow preparation (encoding, reading pixels) must finish before the transaction opens.
>
> — `sad.md §2, Browser behaviour bullet 2, verbatim` · full text: [sad.md](../sad.md)

> **Access patterns:** the save transaction reads `persistenceRequested`. When it is absent, the app calls `navigator.storage.persist()` and writes the marker in the same transaction (AC-14).
>
> — `data-model.md §Standalone: meta, verbatim` · full text: [data-model.md](../data-model.md)

> | AC-19 invariant | a save interrupted at any point leaves every Work committed or absent | integration | aborting the transaction after the evictions, the record, the Original or the layer leaves the database exactly as before the save; a first save leaves the Work absent; no eviction remains |
> | AC-21 cross-context | the last save wins when both pages store the same Work | integration | two connections save the same id in turn; the stored record is the later one |
>
> — `test-plan.md §AC coverage, AC-19 + AC-21 integration rows, verbatim` · full text: [test-plan.md](../test-plan.md)

> **The datastore is never mocked.** … Faults are injected by a wrapper that fails a chosen write.
>
> — `test-plan.md §Decisions, datastore bullet, abridged` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** only `src/infra/db/*` touches IndexedDB, through repository functions that return `Result`. Store images as `Blob`s, never as data URLs.
>
> — `CLAUDE.md §Conventions, Persistence, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or the code contradicts it, read the named file in full ([adr/0004](../adr/0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota.md) · [data-model.md](../data-model.md) · [sad.md](../sad.md) §6 Flow 1 and Flow 7) and follow it. Do not guess.

## Data delta

| Store | Read | Write | Delete |
|---|---|---|---|
| `works` | every record (≤ 21) | this Work's record | evicted ids |
| `originals` | `getKey(workId)` | `{ workId, png }` when the key is missing | evicted ids |
| `layers` | — | `{ workId, png }` when the layer changed or is missing | evicted ids; this id when `layerId` became `null` |
| `meta` | `get('persistenceRequested')` | the marker when absent | — |

— `data-model.md §Indexes + §Entities, abridged` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface. The signature below is the breakdown-time refinement of ADR-0004's `storeWork(entry, blobs, { keep, damaged, extra })`:

```ts
storeWork(db, record: WorkRecord, blobs: { original: Blob; layer: Blob | null; layerChanged: boolean },
  opts: { keep: string; damaged: ReadonlySet<string>; onFirstSave?: () => void })
  → Promise<Result<{ evicted: string[] /* Source names */; firstSave: boolean }, AppError>>
```

`extra` is internal to the retry loop. `onFirstSave` is the synchronous hook through which T11 calls `persist()`, without awaiting it inside the transaction. Errors are `STORAGE_QUOTA` (doesn't fit alone) and `STORAGE_FAILED` (anything else).

## Acceptance criteria

### AC-09 (US-05) — domain invariant

> **Given** the Gallery holds 20 Works, with or without one of them open in this tab
> **When** the Editor opens a new image and it replaces the open Work
> **Then** the new image enters the Gallery only once it has replaced the open Work, as a new Work even if the same file was opened before, and the least recently opened or changed Work that is not open in this tab is evicted, so the Gallery still holds 20 Works. The Work just replaced has been opened or changed more recently than the others, so it is not the one evicted unless it is the only candidate. A notice names the evicted Work and says it was removed to make room. If the replacement is cancelled or the image cannot be read, nothing is stored and nothing is evicted
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 (US-05) — error

> **Given** the browser reports that the app's storage space is full when Autosave stores the open Work
> **When** Autosave runs after an image opens or after a Step, Undo or Redo
> **Then** the app evicts the least recently opened or changed Works that are not open in this tab, one at a time, until the open Work fits, and one notice names every Work it removed. If the open Work still does not fit once it is the only Work left, a notice says it could not be saved to the Gallery and to export it to keep a copy. The Work stays open and editable either way, and the Gallery keeps the earlier stored state of the open Work if there was one
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md) · **Design override:** nothing is evicted when the Work can't fit alone (`sad.md §1, Decision overrides bullet 1`; ADR-0004).

### AC-14 (US-05) — authorization

> **Given** the app has never asked the browser to keep its storage
> **When** Autosave stores a Work for the first time
> **Then** the app asks the browser once to keep its storage persistent. Where the browser asks the person, the request appears at that moment and not when the app starts. Whatever the answer, saving carries on and the storage line of AC-13 shows the result: declining only changes that line to its non-persistent wording, and the Gallery keeps working. The app does not ask again while the Gallery's stored data exists; if the browser clears the Gallery, the app asks once more at the next first save
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-19 (US-01) — domain invariant

> **Given** the Editor opens an image and the app reloads or crashes while Autosave is storing it
> **When** the Editor reopens the Gallery
> **Then** every Work in it is either in its last fully stored state or absent, never half stored. A Work whose first save was interrupted is simply not listed, and a Work whose later save was interrupted reopens in its previous stored state. Evicting to make room and storing the new state happen as one step, so an interrupted save also removes no Work, and no Work ever leaves the Gallery without its notice
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

### AC-21 (US-01) — cross-context

> **Given** the same Work is open in two tabs, and the Gallery in the other tab has evicted it to make room
> **When** the Editor applies a Step, Undo or Redo in this tab
> **Then** Autosave adds the Work back to the Gallery as the most recently opened or changed Work, evicting the least recently opened or changed Work that is not open in this tab, with the usual notice. The Work open in this tab is never lost. When both tabs store the same Work, the last save wins (§8)
>
> — `spec.md §5, AC-21, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `storeWork` to `src/infra/db/works-repository.ts`:
  1. Open one `readwrite` transaction over `['works', 'originals', 'layers', 'meta']`.
  2. `getAll` from `works` and compute `evictionCandidates(records, { keep, damaged, extra })`.
  3. Delete each evicted id from `works`, `originals` and `layers`.
  4. `put` the record.
  5. If `originals.getKey(id)` is missing, `put` the Original.
  6. If `layerChanged` or the layer key is missing, `put` the layer. If `record.layerId === null`, delete the layer.
  7. If the `meta` marker is absent, call `onFirstSave` and `put` the marker.
  8. Await `tx.done`.
- [ ] Classify errors. A `QuotaExceededError` (by `name`, also when wrapped as `AbortError` on `tx.error`) triggers a retry with `extra + 1`. Stop when the candidates no longer grow, that is, only `keep` would be left, and return `STORAGE_QUOTA`. Anything else returns `STORAGE_FAILED`.
- [ ] Never await anything but IndexedDB requests inside the transaction. Every Blob is prepared by the caller.
- [ ] Add a fault wrapper to `src/infra/db/testing.ts`: `withFaults(db, { failPut?: (store, n) => 'quota' | 'other' | null, abortAfter?: 'evictions' | 'record' | 'original' | 'layer' })`, wrapping the database the repository receives. T18 reuses it.
- [ ] Export `storeWork` from `src/infra/db/index.ts`.
- [ ] Write `works-repository.test.ts` on `fake-indexeddb/auto` with fresh database names, one case per Edge case row.

## Edge cases

| Case | Behaviour |
|---|---|
| 19 stored, first save of a new Work | no eviction; 20 stored; `firstSave` per marker |
| 20 stored incl. `keep`, first save of a new Work | oldest non-`keep` evicted in the same commit; its name returned |
| quota on attempts 1 and 2 | attempt 3 evicts two and commits; both names returned once |
| quota on every attempt | `STORAGE_QUOTA`; nothing evicted; earlier record, Original and layer of this id unchanged |
| abort after evictions / record / Original / layer | database byte-for-byte as before; first save leaves the Work absent |
| Work missing (evicted by another connection) | record, Original and layer written back from `blobs` (AC-21) |
| same id saved by two connections in turn | the later record is stored (last save wins) |
| marker present | `onFirstSave` not called |
| `layerId` became `null` (Undo of the only drawing) | `layers` entry deleted |
| non-quota error | `STORAGE_FAILED`; nothing changed |

## Definition of Done

- [ ] Integration tests on `fake-indexeddb` with the fault wrapper pass for every Edge case row: eviction at 20, the quota retry, quota-alone keeping the earlier state, aborts at all four points leaving the database unchanged, the write-back, last save wins, and the marker only when absent.
- [ ] Every Hard Rule inlined above still holds, and nothing outside `src/infra/db` touches IndexedDB.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean.
