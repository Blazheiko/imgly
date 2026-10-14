---
id: T3
title: "Promote migration 0002-gallery (works reshaped, originals, layers and meta stores), widen schema.ts to v2, untype Migration.upgrade, and add the db test fixtures"
layer: "migration"
deps: []
blocks: ["T4", "T6"]
acs: ["AC-18"]
files_hint: ["docs/features/gallery/migrations/01_reshape_works_add_blob_stores.up.ts", "docs/features/gallery/migrations/01_reshape_works_add_blob_stores.test.ts", "src/infra/db/migrations/0002-gallery.ts", "src/infra/db/migrations/index.ts", "src/infra/db/schema.ts", "src/infra/db/open-db.ts", "src/infra/db/migrations.test.ts", "src/infra/db/testing.ts", "src/infra/db/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 51 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Promote migration 0002-gallery (works reshaped, originals, layers and meta stores), widen schema.ts to v2, untype Migration.upgrade, and add the db test fixtures

## Place in the sequence

- **Blocked by:** nothing.
- **Blocks:** T4 — Add storeWork to the works repository · T6 — Open the Gallery database as a Result and add storage-persistence.
- **Wave:** 1. It is the only migration, and every repository task needs the v2 stores.
- **Lane:** shares `src/infra/db/open-db.ts` with T6, `src/infra/db/testing.ts` with T4 and T18, and `src/infra/db/index.ts` with T4, T5 and T6, so they run one after the other. Migrations are always serialized.

## Why (user story)

> **As an** Editor
> **I want** to reopen a recent Work and find its Crop, Adjustments and drawing exactly as I left them
> **So that** I can change any of them separately later instead of starting again from the source file
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task gives the database the v2 shape that a Work is stored in, using a forward-only step that later versions keep running.

## Inlined context

> Schema version: **v1 → v2**. Step `0002-gallery` reshapes `works` and adds `originals`, `layers` and `meta`.
>
> — `data-model.md` intro, verbatim · full text: [data-model.md](../data-model.md)

> **Required type change in `migrations/index.ts`:** `Migration.upgrade` must take the **untyped** `IDBPDatabase` and `IDBPTransaction<unknown, string[], 'versionchange'>`, and `open-db.ts` passes the typed handles through a cast. Without that change, the released `0001-init` step stops compiling: `idb` types `createIndex` against the *current* schema's index names, and `'updatedAt'` is no longer one of them. The change keeps 0001's body untouched, so "never edit a released step" still holds, and every later step stays free to name stores and indexes that the latest schema has dropped.
>
> — `data-model.md §schema.ts after v2, Required type change, verbatim` · full text: [data-model.md](../data-model.md)

> **Removed in v2:** the v1 fields `name` and `updatedAt` and the `updatedAt` index. Nothing ever wrote them (architecture map, Datastores). `createdAt` is deliberately **not** stored …
>
> — `data-model.md §Entities, works "Removed in v2", abridged` · full text: [data-model.md](../data-model.md)

> - `workRecordFixture(overrides?)` builds a valid `WorkRecord`: a `newId()` id, `sourceName: 'test-photo'`, `sourceFormat: 'jpeg'`, a 4 × 3 size, `identityGeometry`, `NEUTRAL_ADJUSTMENTS`, `layerId: null`, a tiny PNG `thumbnail`, `formatVersion: 1` and `touchedAt` from the test clock.
> - `storedWorkFixture(overrides?)` builds `{ record, original, layer }`, with matching `workId`s and tiny valid PNG Blobs at the record's size, so the codec's size check passes. With `layer: null`, `layerId` is set to `null`.
> - `damagedWorkFixture(kind)` returns a stored Work broken in one way: `'missing-original'`, `'layer-without-record-id'`, `'size-mismatch'`, `'bad-geometry'` or `'unknown-format-version'` (AC-08 and `validateStoredWork` cases).
>
> The fixtures contain no real-looking personal data: the Source names are `test-photo` or `''`.
>
> — `data-model.md §Test fixtures, verbatim` · full text: [data-model.md](../data-model.md)

> **Hard rule (Migrations):** add forward-only steps as `src/infra/db/migrations/NNNN-<name>.ts`, each exporting `{ version, upgrade(db, tx) }`, and append them to `migrations` in `migrations/index.ts`. Never edit a released step. A "down" is a new forward step. Cover each step with a `fake-indexeddb/auto` test.
>
> — `CLAUDE.md §Conventions, Migrations, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or the code contradicts it, read the named file in full ([data-model.md](../data-model.md) · [audit](../_audit/data-model-2026-10-13.md) · [adr/0002](../adr/0002-store-each-work-as-a-small-record-plus-separate-original-and-layer-blob-stores.md)) and follow it. Do not guess.

## Data delta

| Store | keyPath | Index | Change |
|---|---|---|---|
| `works` | `id` | `touchedAt` (was `updatedAt`) | reshaped: fields per `WorkRecord` below; v1 records cleared |
| `originals` | `workId` | — | added: `{ workId, png: Blob }` |
| `layers` | `workId` | — | added: `{ workId, png: Blob }` |
| `meta` | `key` | — | added: `{ key: 'persistenceRequested' }` |

`WorkRecord` v2 has `id`, `sourceName`, `sourceFormat`, `touchedAt`, `width`, `height`, `hasTransparency`, `geometry`, `adjustments`, `layerId`, `thumbnail` and `formatVersion`. `WorkBlobRecord` is `{ workId, png }` and `MetaRecord` is `{ key: 'persistenceRequested' }`. `ImglyDb` declares the four stores, and `works` has `indexes: { touchedAt: number }`.

— `data-model.md §schema.ts after v2, abridged` · full text: [data-model.md](../data-model.md)

**Staged pair to promote:**

- `docs/features/gallery/migrations/01_reshape_works_add_blob_stores.up.ts` → `src/infra/db/migrations/0002-gallery.ts`, exporting `gallery: Migration` with `version: 2`. It deletes the `updatedAt` index, creates `touchedAt`, clears `works`, and creates `originals`, `layers` and `meta`.
- `docs/features/gallery/migrations/01_reshape_works_add_blob_stores.test.ts` → merged into `src/infra/db/migrations.test.ts`. The v1-only cases there ("updatedAt" index, the `{ id, name, createdAt, updatedAt }` record) are replaced deliberately.
- `01_reshape_works_add_blob_stores.down.ts` is a **rollback recipe and is NOT promoted**. IndexedDB can't downgrade. It ships only as a new forward step if the Gallery is ever withdrawn.

## API contract

Internal — no API surface. This task exports `WorkRecord`, `WorkBlobRecord`, `MetaRecord` and `ImglyDb` from `src/infra/db/index.ts` for T4 to T6.

## Acceptance criteria

### AC-18 (US-02) — cross-context

> **Given** the Gallery holds Works stored by an earlier version of the app
> **When** the app updates to a new version and the Editor reopens one of them
> **Then** the Work opens with exactly the stored data: the same Original pixels, Source name, Source format, Geometry, Adjustments and Drawing layer. When the update did not change how a Work is drawn, a full-size Export of it is identical to the Export the earlier version made. An update never empties the Gallery or loses a Work
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

**Note:** v1 holds no Work. Nothing ever wrote a v1 record, and a v1 record has no Original, so it could never be a valid Work. Clearing `works` in 0002 therefore loses no Work. AC-18's "older records migrated forward" first applies to the v2 → v3 step.

## Checklist

- [ ] Change `Migration.upgrade` to take the untyped `IDBPDatabase` and `IDBPTransaction<unknown, string[], 'versionchange'>` (`src/infra/db/migrations/index.ts`). Leave `0001-init.ts` untouched.
- [ ] Cast the typed handles in `open-db.ts`'s `upgrade` callback.
- [ ] Promote the staged `.up.ts` to `src/infra/db/migrations/0002-gallery.ts` and drop its "STAGED" header comment. Append `gallery` to `migrations`, so `LATEST_VERSION` becomes 2.
- [ ] Rewrite `src/infra/db/schema.ts` to the v2 shape and import `Adjustments`, `Geometry` and `ImageFormat` types from core.
- [ ] Promote the staged test into `src/infra/db/migrations.test.ts`, replacing the v1-only cases.
- [ ] Add `workRecordFixture`, `storedWorkFixture` and `damagedWorkFixture(kind)` to `src/infra/db/testing.ts`. The tiny PNGs must be real PNG bytes at the record's size, so T7's size check passes.
- [ ] Update the type exports in `src/infra/db/index.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| fresh database (no v1) | both steps run, ending at v2 with four stores and the `touchedAt` index only |
| v1 database with a stray record | upgraded to v2 and `works` cleared (`count === 0`) |
| `0001-init.ts` after the `Migration` type change | compiles with its body unchanged |
| `damagedWorkFixture('size-mismatch')` | the record says 4 × 3, and the PNG decodes to another size |

## Definition of Done

- [ ] The staged migration is promoted to the live `src/infra/db/migrations/0002-gallery.ts`, appended to `migrations`, and its promoted `fake-indexeddb` test passes. The test covers a fresh v2, an upgrade from v1, and every part plus the marker stored and read back.
- [ ] `git diff` shows `src/infra/db/migrations/0001-init.ts` unchanged.
- [ ] The three fixtures exist and type-check against `WorkRecord`.
- [ ] Every Hard Rule inlined above still holds.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean.
