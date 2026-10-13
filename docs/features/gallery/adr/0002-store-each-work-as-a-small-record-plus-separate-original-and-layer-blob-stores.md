---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-13"
feature_size: "M"
ticket: "roadmap step 8 — gallery"
---

# 0002 — Store each Work as a small record plus separate Original and layer blob stores

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Blazheiko (owner), design Socratic walk (medium depth)

## Context

Repo ADR 0003 decided to keep a Work in IndexedDB as its Original, its parameters and its Drawing layer. It also described the option chosen there as "one `works` store", and left the schema at v1 (`{id, name, createdAt, updatedAt}`, which nothing has written). The parts of a Work differ in size by five orders of magnitude:
- The Original, encoded as PNG (ADR-0003), is about 15–30 MB for the 4096 × 3072 reference Work.
- The Drawing layer is up to a few MB.
- The Geometry, Adjustments, Source name and format are a few hundred bytes.

Each part also changes at a different rate. The Original never changes after open, the layer changes only on a drawing Step, and the parameters change on every Crop or Adjust Step. The Gallery must paint 20 thumbnails within 500 ms. Listing checks only what an entry shows, while choosing a Work checks all of it (AC-08). Deleting or evicting must leave no stored part behind (spec §6.1).

## Decision drivers

- spec §6: Gallery painted within p95 ≤ 500 ms with 20 reference Works stored; a Crop or Adjustment Step stored within p95 ≤ 300 ms
- spec AC-08: listing reads only what an entry shows, and a damaged Work still lists and can be deleted
- spec §6.1: delete and evict remove every stored part of a Work, and nothing beyond §6.1's list is stored
- sad.md §1 quality goal 1: every Work is either fully stored or absent (with ADR-0004's single transaction)
- repo ADR 0003: IndexedDB through `idb`, forward-only migrations, Blobs never data URLs

## Considered options

1. **A small `works` record plus separate `originals`, `layers` and `meta` stores.**
2. **One `works` record per Work holding every Blob**, as ADR 0003's wording reads literally.

## Decision outcome

**Chosen:** Option 1. A Crop or Adjust Step rewrites only a record of a few hundred bytes plus a small thumbnail. Listing never touches the multi-megabyte Blobs. Engines commonly copy a Blob's bytes again when a record holding it is put a second time, so Option 2 risks rewriting tens of megabytes for one slider change and missing the 300 ms target on the reference Work. Option 2's real advantage, that no part can be forgotten on delete, is kept by writing and deleting all four stores in one transaction (ADR-0004) and by an e2e check that no part of a deleted Work remains (spec §6.1).

How it works (the exact field list is fixed by the `data-model` stage):

- Migration step `0002` (`src/infra/db/migrations/0002-gallery.ts`) adds the `originals`, `layers` and `meta` stores and reshapes `works`. It drops the unused `name` and `updatedAt` fields and the `updatedAt` index, and adds an index on `touchedAt`. No browser holds a v1 record, so no data is converted.
- A `works` record holds:
  - the Work's id, Source name, Source format, `createdAt`, and `touchedAt` (when it was last opened or changed, which orders the Gallery and decides eviction, AC-03, AC-09);
  - the Original's width, height and `hasTransparency`;
  - the Geometry and Adjustments;
  - the id of the stored layer, or null;
  - the thumbnail as a `Blob`;
  - a `formatVersion` number for later migrations (AC-18).
- `originals` maps a Work id to its PNG Blob, written once per Work. `layers` maps a Work id to its layer's PNG Blob, rewritten only when the applied layer's id differs from the stored one. `meta` holds the app-wide "asked for persistent storage" marker (AC-14). Because the marker lives in the same database, it disappears whenever the browser clears the Gallery, so the app asks again at the next first save.
- Invariants, kept by ADR-0004's single transaction: a `works` record exists exactly when its `originals` entry exists, and a `layers` entry exists exactly when the record names a layer.
- Only `src/infra/db/` touches these stores, through a `works` repository whose functions return `Result` (store, list, load, delete, read and write the marker).

## Consequences

**Positive**
- The cost of a save follows what changed: a few hundred bytes for a Crop or Adjust Step, the layer for a drawing Step, and the Original once per Work.
- Listing reads 20 small records, and a damaged Blob can't stop the Gallery from listing.

**Negative**
- Four stores must stay consistent, so every write and delete must span all of them. A bug that skips one would leave an orphan, which is why the e2e test checks every store after a delete.
- The design departs from ADR 0003's "one `works` store" wording while keeping its decision. sad.md §1 ¶4 records this as a Decision override.

**Neutral**
- ADR 0003's escape hatch still holds: moving the Blob stores to OPFS later is a new migration step plus repository internals, and the record shape stays.

## Links

- Spec: [[../spec.md]] AC-03, AC-08, AC-09, AC-14, AC-18, §6, §6.1
- SAD: [[../sad.md]] §4, §5, §8
- Related ADR: [[0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker]], [[0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota]]; repo ADR 0003 (refined, not superseded)
