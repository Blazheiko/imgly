# Audit — data-model gallery (2026-10-13)

**The migrations are staged. They are not in the live `src/infra/db/migrations/` tree yet, and
`implement` promotes them.**

## Conventions derived (from the architecture, corroborated by the repo)

| Topic | Source | Followed |
|---|---|---|
| Engine and tool | repo ADR 0003, architecture map `migration_tool: idb versioned upgrades` | IndexedDB through `idb`. Steps are TS `{ version, upgrade(db, tx) }`, not SQL |
| Naming | `0001-init.ts`, `schema.ts` | camelCase stores and fields, inline `keyPath` |
| PK | repo ADR 0003, `src/shared/ids.ts` | UUIDv7 `id`. Child stores use the parent's id as their PK (`workId`) |
| Audit fields | v1 `createdAt`/`updatedAt` (never written) | Replaced by a single `touchedAt`, which the spec defines. `createdAt` dropped (see deviations) |
| Delete strategy | spec AC-06, §6.1 | Hard delete across all three Work stores in one transaction |
| Constraints | none in the DB (IndexedDB) | Enforced by the repository transaction (write) and `validateStoredWork` (read) |
| Reversibility | CLAUDE.md §Migrations: "A 'down' is a new forward step" | The `.down` file is a forward revert step, not a downgrade |
| Idempotency | IndexedDB semantics | The `versionchange` transaction is atomic and runs once per version, so no `IF NOT EXISTS` guards are needed (0001 has none either) |

## Staged files

| Staged path | Promotes to | Notes |
|---|---|---|
| `docs/features/gallery/migrations/01_reshape_works_add_blob_stores.up.ts` | `src/infra/db/migrations/0002-gallery.ts`, appended to `migrations` in `index.ts` | `version: 2` |
| `docs/features/gallery/migrations/01_reshape_works_add_blob_stores.test.ts` | merged into `src/infra/db/migrations.test.ts` | Replaces the v1-shaped cases (see below) |
| `docs/features/gallery/migrations/01_reshape_works_add_blob_stores.down.ts` | **not promoted with the feature**. Only if the Gallery is withdrawn: `NNNN-remove-gallery.ts` at `LATEST_VERSION + 1` | A rollback recipe that deletes every stored Work |

**Promote-time hint:** the repo numbers steps sequentially, and the next one is `0002` with
`version: 2`. No other in-flight feature has a staged step. `implement` confirms the number at
promotion.

Both steps were checked against `fake-indexeddb` + `idb` from a scratch script: v1 (with one v1
record) → v2 gives four stores, the `touchedAt` index only and an empty `works`, and a write and an
indexed read succeed. v2 → v3 (revert) gives `works` only, the `updatedAt` index and an empty store.

## Changes `implement` must make alongside the promotion

1. **`migrations/index.ts`: make `Migration.upgrade` untyped** (`IDBPDatabase`,
   `IDBPTransaction<unknown, string[], 'versionchange'>`), with a cast in `open-db.ts`. Otherwise
   `0001-init`'s `createIndex('updatedAt', …)` fails `vue-tsc`, because `idb` checks index names
   against the current schema. 0001's body stays unedited.
2. **`schema.ts`:** the v2 types exactly as in `data-model.md` §"`schema.ts` after v2".
3. **`migrations.test.ts`:** the existing cases "fresh database … index `updatedAt`" and "stores and
   reads a work record" (`{ id, name, createdAt, updatedAt }`) assert the v1 shape and will fail.
   Replace them with the staged cases deliberately. Don't loosen them.
4. **`src/core/gallery/`:** `STORED_WORK_FORMAT = 1`, read by `validateStoredWork`.

## Deviations from upstream (flagged, deliberate)

- **`createdAt` is not stored, although ADR-0002 lists it.** Spec §6.1 enumerates what may be
  stored, and nothing reads `Work.createdAt`. Owner decision, 2026-10-13. ADR-0002's
  "How it works" list should get a one-line note saying `data-model` fixed the list without
  `createdAt`, or be left as is with this audit as the record. Owner: Blazheiko.
- **`meta` holds presence only** (`{ key: 'persistenceRequested' }`), with no timestamp, for the same
  §6.1 reason.
- **v1 records are cleared, not converted.** ADR-0002 says no browser holds one, and a v1 record has
  no Original, so it could never be a valid Work. Without clearing, it would show up as a damaged
  entry.

## Drift (domain `Work` in `src/core/document.ts` ↔ `WorkRecord` v2)

| Kind | Domain field / record field | Verdict |
|---|---|---|
| (v1, current) type and name mismatch | `Work.sourceName` ↔ v1 `WorkRecord.name`, and every other Work field missing | **Resolved by the staged step**. No `_drift/` fix needed |
| field-without-column | `Work.createdAt`, `Work.updatedAt` | Intentional. Set from `touchedAt` on reopen. `updatedAt` has no reader in `src/` |
| field-without-column | `Work.revision`, `Work.cleanRevision` | Intentional. The Edit history is never stored, and reopen starts at revision 0 and clean (AC-04) |
| field-without-column | `Original.pixels`, `DrawingLayer.pixels`, `DrawingLayer.width/height` | Stored encoded in `originals.png` / `layers.png`. The layer size equals the Original's by invariant (draw ADR-0001) |
| column-without-field | `touchedAt`, `thumbnail`, `formatVersion`, `layerId` | Persistence-only. `layerId` mirrors `drawing.id` of the layer whose PNG is stored |

No `_drift/*.ts` fix steps were proposed.

## Breaking-change decompositions

None needed. Nothing in the reshaped `works` store has ever been written by a running app (the
architecture map's Datastores table and the spec §1), so no expand → backfill → contract applies.
Cross-version tabs are covered by ADR-0006 (an older tab closes its connection on `versionchange`).

## Self-check (4 mandatory)

| Check | Result |
|---|---|
| Naming matches the repo convention | ✅ camelCase, inline keyPaths, `NNNN-<name>.ts` at promotion |
| Down reversibility | ✅ every `createObjectStore` has a `deleteObjectStore` in the revert step, `createIndex('touchedAt')` ↔ `deleteIndex('touchedAt')`, and `deleteIndex('updatedAt')` ↔ `createIndex('updatedAt')`. Data is not recoverable, which the file header states |
| FK indexes | ✅ `originals.workId` and `layers.workId` are primary keys |
| Convention adherence | ✅ with the three deviations flagged above |

ER `erDiagram` rendered with `mmdc` without errors.

## Open `<!-- TBD -->`

None.

## Seeds

None (no bootstrap or lookup data). The fixtures are documented in `data-model.md` §Test fixtures and
contain no real-looking personal data.

## Next stage

`screens gallery`. `api` is N/A: the app is client-only (`target_surfaces: [web-frontend]`) and the
feature exposes no external interface (no endpoint, event, CLI command or library API). The new
store and repository functions are internal module APIs, and they are fixed by sad.md §5 and
ADR-0001/0004. No earlier feature in this repo has a `contracts/` folder either.
