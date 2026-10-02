---
status: Accepted
owner: "Blazheiko"
reviewers: []
updated_at: "2026-10-02"
feature_size: "foundation"
ticket: ""
---

# 0003 — Persist works in IndexedDB (via idb) as original + params + drawing layer, with versioned upgrade steps and UUIDv7 IDs

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** Blazheiko (owner), survey foundation session

## Context

The brief requires works to survive between sessions and to be re-editable without loss: reopen
yesterday's crop or brightness under an existing drawing. It caps the gallery at about 20 recent
works with the oldest evicted. There is no server, so storage is in the browser.

## Decision drivers

- Non-destructive re-editing (brief §7): store inputs, not a flattened result.
- Binary blobs up to ~4096 px images, offline.
- The schema will evolve (new adjustments), so stored data needs a migration path.
- "Recent works" ordering and evict-oldest.

## Considered options

1. **IndexedDB via `idb`, one `works` store**: original Blob + `AdjustParams` JSON + crop/rotation + drawing-layer Blob + thumbnail. Ordered upgrade steps in `src/infra/db/migrations/`.
2. **OPFS files + an IndexedDB index**: faster for large binaries, but two stores to keep consistent.
3. **localStorage with data URLs**: ~5 MB cap and synchronous. Not viable.

## Decision outcome

**Chosen:** Option 1. Each schema change is a file `NNNN-<name>.ts` exporting `{ version, upgrade }`,
applied in order by `openDb()`. Steps are forward-only because IndexedDB cannot downgrade. IDs are
app-generated **UUIDv7**, so ID order is creation order. Only `src/infra/db/` touches IndexedDB.

## Consequences

**Positive**
- Non-destructive: any step of the pipeline can be re-edited from stored inputs.
- Migrations are versioned and unit-testable with `fake-indexeddb`.

**Negative**
- Storage cost is about the original + layer + thumbnail per work, which is why the gallery is capped.
- The browser may evict the data. The UI must say so, and export is the durable save.
- No rollback migrations. A bad step is fixed by a new forward step.

**Neutral**
- Moving the blobs to OPFS later is a new upgrade step plus repository internals. Callers are unaffected.

## Links

- Brief: [[../idea-brief.md]] §5, §6, §8
- Map: [[../architecture-map.md]] §Datastores, §Conventions (Migrations, IDs)
- Related ADR: [[0002-organize-code-as-functional-core-with-feature-folders]]
