---
id: T5
title: "Add listWorks, loadWork and deleteWork to the works repository: list newest first checking only shape and thumbnail, load every part, delete all parts in one transaction and refuse the open Work"
layer: "infra"
deps: ["T2", "T4"]
blocks: ["T13", "T15", "T18"]
acs: ["AC-06", "AC-07", "AC-08"]
files_hint: ["src/infra/db/works-repository.ts", "src/infra/db/works-repository.test.ts", "src/infra/db/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 63 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Add listWorks, loadWork and deleteWork to the works repository: list newest first checking only shape and thumbnail, load every part, delete all parts in one transaction and refuse the open Work

## Place in the sequence

- **Blocked by:** T2 — Add core/gallery stored-Work rules (`validateRecordShape`) · T4 — Add storeWork to the works repository.
- **Blocks:** T13 — Add reopenWork(id) to the editor store · T15 — Add the gallery feature's store and messages · T18 — Add the Gallery e2e hooks.
- **Wave:** 3.
- **Lane:** shares `src/infra/db/works-repository.ts` and its test with T4 and T18, and `index.ts` with T3, T4 and T6, so they run one after the other.

## Why (user story)

> **As an** Editor
> **I want** to delete a Work from the Gallery
> **So that** I can free space and stop keeping a photo I no longer want stored in this browser
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task adds the three reads and deletes that the Gallery list, reopen and delete flows call, each kept to the stores it needs.

## Inlined context

> UI->>D: list the small records, most recently touched first
> D-->>UI: up to 20 records with thumbnails, no Original or layer read
> UI->>UI: check each record's shape and decode its thumbnail
>
> — `sad.md §6, Flow 3 steps 5–7, verbatim` · full text: [sad.md](../sad.md)

> UI->>D: delete the record, the Original and the layer in one transaction
> Note over UI,D: removes every stored part of the Work (works, originals, layers)
> … else storage failure — D-->>UI: failed, nothing changed
>
> — `sad.md §6, Flow 4, confirm branch, abridged` · full text: [sad.md](../sad.md)

> | PK `id` | `works` · `id` | Reopen `loadWork(id)` (Flow 2), the delete transaction (Flow 4) … |
> | `touchedAt` | `works` · `touchedAt` | Listing newest first: `getAllFromIndex('works', 'touchedAt')`, reversed (Flow 3, AC-03) |
> | PK `workId` | `originals` · `workId` | Reopen load (Flow 2) … delete and evict (Flow 1, Flow 4) |
> | PK `workId` | `layers` · `workId` | Reopen load when `layerId` is set (Flow 2) … delete and evict (Flow 1, Flow 4) |
>
> — `data-model.md §Indexes, abridged` · full text: [data-model.md](../data-model.md)

> | AC-08 error | listing checks only the shape and the thumbnail, choosing checks everything | integration | a Work with a damaged Original lists normally and fails only when chosen; a Work with a damaged thumbnail lists as damaged; the other Works list normally |
> | AC-07 invariant | the repository refuses to delete the Work open in this tab | integration | `deleteWork` with the open Work's id is refused and removes nothing |
>
> — `test-plan.md §AC coverage, AC-08 + AC-07 integration rows, verbatim` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** only `src/infra/db/*` touches IndexedDB, through repository functions that return `Result`. … `infra` may call pure, side-effect-free `core` functions … never Vue, Pinia, a feature or the app shell
>
> — `CLAUDE.md §Conventions, Persistence + §Module boundaries, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or the code contradicts it, read the named file in full ([sad.md](../sad.md) §6 Flows 2–4 · [data-model.md](../data-model.md) · [adr/0002](../adr/0002-store-each-work-as-a-small-record-plus-separate-original-and-layer-blob-stores.md)) and follow it. Do not guess.

## Data delta

| Store | listWorks | loadWork | deleteWork |
|---|---|---|---|
| `works` | `getAllFromIndex('touchedAt')`, reversed | `get(id)` | `delete(id)` |
| `originals` | — | `get(id)` | `delete(id)` |
| `layers` | — | `get(id)` when `layerId !== null` (and checks absence otherwise) | `delete(id)` |

— `data-model.md §Indexes, abridged` · full text: [data-model.md](../data-model.md)

## API contract

Internal — no API surface. The signatures are a breakdown-time choice:

- `listWorks(db) → Promise<Result<ListedWork[], AppError>>`, where `ListedWork = { id, record: WorkRecord | null, sourceName: string, touchedAt: number, damaged: boolean }`. `damaged` is true when the shape check fails or the thumbnail isn't a PNG `Blob`.
- `loadWork(db, id) → Promise<Result<{ record: WorkRecord; original: Blob; layer: Blob | null }, AppError>>`. A missing part or a `layerId`/layer mismatch returns `WORK_DAMAGED`.
- `deleteWork(db, id, { keep }) → Promise<Result<void, AppError>>`. It returns `STORAGE_FAILED` on a failure, and refuses `keep` without touching the database.

## Acceptance criteria

### AC-06 (US-04) — happy path

> **Given** the Gallery holds a Work that is not open
> **When** the Editor chooses to delete it
> **Then** the app asks for confirmation, naming the Work and saying it cannot be brought back and that an Export is the only copy kept outside this browser. Confirming removes the Work from the Gallery and from this browser at once, and the count of used places goes down by one. Cancelling keeps the Work exactly as it was
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 (US-04) — domain invariant

> **Given** the Gallery is showing and one of its Works is open
> **When** the Editor tries to delete the open Work's entry
> **Then** deleting is unavailable for that entry, and its hint says that the open Work cannot be deleted and to open another image first. The Gallery never deletes or evicts the Work open in this tab; a Work open only in another tab can be evicted there (AC-21)
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 (US-02) — error

> **Given** a Work in the Gallery can no longer be read back, because its stored data is damaged or incomplete
> **When** the Editor chooses it, or the Gallery tries to show its thumbnail
> **Then** the open Work stays exactly as it was. Listing the Gallery checks only what the entry shows (its thumbnail and details), and choosing a Work checks all of it. The entry is marked as damaged instead of failing silently, and choosing it shows a notice that names the Work, says it cannot be opened and offers to delete it. Every other Work in the Gallery lists, opens and deletes normally. A damaged Work still counts toward the 20 places and is the first to be evicted when room is needed, with the usual notice naming it
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `listWorks`: read the `touchedAt` index, reverse it, and use the id for a stable tie order. Mark each record `damaged` when `validateRecordShape` fails or `thumbnail` isn't a `Blob` of type `image/png`. Keep `sourceName` only when it is a string, else `''` (`src/infra/db/works-repository.ts`).
- [ ] `loadWork`: in one read-only transaction, get the record, the Original and the layer. Return `WORK_DAMAGED` for a missing record or Original, or a `layerId`/layer mismatch. Full validation (`validateStoredWork`) and PNG decoding stay with the caller (T13).
- [ ] `deleteWork`: refuse `id === keep`. Otherwise use one `readwrite` transaction over `works`, `originals` and `layers`. Any failure returns `STORAGE_FAILED` with nothing removed.
- [ ] Export from `src/infra/db/index.ts`.
- [ ] Extend `works-repository.test.ts` using `storedWorkFixture`, `damagedWorkFixture` and the `withFaults` wrapper from T4.

## Edge cases

| Case | Behaviour |
|---|---|
| a damaged Original | listed normally; `loadWork` → `WORK_DAMAGED` |
| missing or non-PNG thumbnail, or a bad shape | listed with `damaged: true`, others normal |
| `sourceName` is not a string | `''` (shown as "Untitled" by T15) |
| equal `touchedAt` | stable order by id |
| `deleteWork(keep)` | refused; nothing removed |
| a delete fault injected | `STORAGE_FAILED`; all three parts still present |
| deleting a damaged Work | removes whatever parts exist |
| `loadWork` of an unknown id | `WORK_DAMAGED` (the Work vanished, e.g. evicted by another tab) |

## Definition of Done

- [ ] Integration tests prove the newest-first order with the id tie-break.
- [ ] Shape and thumbnail damage flag only that entry.
- [ ] A damaged Original lists normally but fails `loadWork`.
- [ ] `loadWork` returns all parts, or `WORK_DAMAGED` for a missing part or a layer mismatch.
- [ ] `deleteWork` removes the id from all three stores in one transaction, leaves other Works untouched, returns `STORAGE_FAILED` on a fault with nothing removed, and refuses `keep`.
- [ ] Every Hard Rule inlined above still holds.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean.
