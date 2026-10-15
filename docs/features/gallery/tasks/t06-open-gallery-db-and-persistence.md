---
id: T6
title: "Open the Gallery database as a Result (refused, held by an older tab, closed for a newer version) with the versionchange hand-off, and add storage-persistence over navigator.storage"
layer: "infra"
deps: ["T1", "T3"]
blocks: ["T11", "T15", "T18"]
acs: ["AC-12", "AC-13", "AC-14", "AC-18"]
files_hint: ["src/infra/db/open-db.ts", "src/infra/db/open-db.test.ts", "src/infra/db/index.ts", "src/infra/platform/storage-persistence.ts", "src/infra/platform/storage-persistence.test.ts", "src/infra/platform/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 65 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Open the Gallery database as a Result (refused, held by an older tab, closed for a newer version) with the versionchange hand-off, and add storage-persistence over navigator.storage

## Place in the sequence

- **Blocked by:** T1 — Add core/gallery rules and the error codes (`STORAGE_UNAVAILABLE`) · T3 — Promote migration 0002-gallery.
- **Blocks:** T11 — Compose autosave.ts · T15 — Add the gallery feature's store and messages · T18 — Add the Gallery e2e hooks.
- **Wave:** 2.
- **Lane:** shares `src/infra/db/open-db.ts` with T3, and `src/infra/db/index.ts` with T3, T4 and T5, so they run one after the other.

## Why (user story)

> **As an** Editor
> **I want** the app to tell me plainly where my Works are kept, whether the browser may clear them, and when a Work was removed or could not be saved
> **So that** I export what I must not lose and am never surprised by a missing Work
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task adds the two edges where the browser answers for the app: whether storage opens at all, and whether it is persistent.

## Inlined context

> - `openDb()` in `src/infra/db/open-db.ts` installs a `versionchange` handler on the connection it returns. Autosave (ADR-0001) handles it:
>   - it waits for the save that is running, whose transaction completes, then drops the pending save;
>   - it closes the connection, sets `galleryAvailable` to false for the rest of the page's life, and raises one info notice that a newer version is open in another tab and to reload to keep saving.
> - The upgrading tab treats `blocked` as a short wait. If the database is still not open after a bounded wait, for example because an older version without this handler holds it, the Gallery is unavailable for that page load with a reason, as AC-12 says.
>
> — `adr/0006 §Decision outcome, How it works bullets 1 and 3, verbatim` · full text: [adr/0006](../adr/0006-close-an-older-tabs-database-connection-when-a-newer-version-upgrades-it.md)

> alt storage cannot be opened (blocked site data, refused, still blocked by an older tab)
>     D-->>S: refused
>     S-->>UI: Gallery unavailable for this page load, with the reason
>
> — `sad.md §6, Flow 3 first alt, verbatim` · full text: [sad.md](../sad.md)

> | Persistent storage | Requested once, at the first save, when the `meta` marker is absent. The marker is written in that save's transaction (AC-14). The storage line reads `persisted()` each time the Gallery shows (AC-13). Where the API is missing, the line uses its non-persistent wording | `src/infra/platform/storage-persistence.ts` |
>
> — `sad.md §8, row Persistent storage, verbatim` · full text: [sad.md](../sad.md)

> │   └── platform/storage-persistence.ts  NEW  requestPersistence() / isPersisted() over navigator.storage
>
> — `sad.md §5, Internal decomposition, platform line, verbatim` · full text: [sad.md](../sad.md)

> | body | unavailable: storage refused or blocked | AC-12 | … |
> | body | unavailable: held by an older tab | AC-12, ADR-0006 | … |
> | body | unavailable: closed for a newer version | AC-12, ADR-0006 | … |
>
> — `screens.md §Message catalog, unavailable reasons, abridged (copy dropped — owned by T15)` · full text: [screens.md](../screens.md)

> **Hard rule:** `src/infra/platform/` — File open/save, clipboard, drag and drop, `launchQueue` — May import: `core` (types and pure functions), `shared`. … `src/infra/import-rules.test.ts` and ESLint enforce it.
>
> — `CLAUDE.md §Module boundaries, infra/platform row + note, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or the code contradicts it, read the named file in full ([adr/0006](../adr/0006-close-an-older-tabs-database-connection-when-a-newer-version-upgrades-it.md) · [sad.md](../sad.md) §6 Flow 7, §7 · [test-plan.md](../test-plan.md)) and follow it. Do not guess.

## Data delta

No DB changes. This task opens the v2 schema that T3 defines.

## API contract

Internal — no API surface. The signatures are a breakdown-time choice, and this is how the database handle reaches its callers:

- `openGalleryDb(opts?: { name?, blockedWaitMs?: number, onVersionChange?: (db) => void }) → Promise<Result<IDBPDatabase<ImglyDb>, AppError>>`. A failure is `STORAGE_UNAVAILABLE` with `details.reason: 'refused' | 'held'`. The third reason, `'newer-version'`, is set by Autosave (T11) when it closes on `versionchange`.
- `requestPersistence() → Promise<boolean>` and `isPersisted() → Promise<boolean | undefined>`. `undefined` (or `false` from `requestPersistence`) means the API is missing.

## Acceptance criteria

### AC-12 (US-05) — authorization

> **Given** storage cannot be opened for this app when the page loads, for example in a private window or with site data blocked for the site
> **When** the Editor opens an image and edits it
> **Then** opening, editing and exporting work as before. The Gallery shows that it is unavailable in this browser window and why in plain words, nothing is stored, and the app does not try to store anything again until the page is next loaded. Replacing the Work asks for confirmation whenever the open Work has Unsaved edits, as open-and-view AC-15 always did
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md) · **Design override:** a private window is not a reliable example (`sad.md §1, Decision overrides bullet 2`), so tests use blocked site data.

### AC-13 (US-05) — happy path

> **Given** the Gallery is showing
> **When** the Editor looks at it, empty or full
> **Then** one line always says where the Works are kept. The line follows the browser's current answer. When the browser has agreed to keep the app's storage, it reads that Works are kept in this browser and to export one to keep a copy elsewhere. Otherwise it reads that Works are saved in this browser only, that the browser may clear them when space runs low, and to export to keep a copy
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-14 (US-05) — authorization

> **Given** the app has never asked the browser to keep its storage
> **When** Autosave stores a Work for the first time
> **Then** the app asks the browser once to keep its storage persistent. Where the browser asks the person, the request appears at that moment and not when the app starts. Whatever the answer, saving carries on and the storage line of AC-13 shows the result: declining only changes that line to its non-persistent wording, and the Gallery keeps working. The app does not ask again while the Gallery's stored data exists; if the browser clears the Gallery, the app asks once more at the next first save
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-18 (US-02) — cross-context

> **Given** the Gallery holds Works stored by an earlier version of the app
> **When** the app updates to a new version and the Editor reopens one of them
> **Then** the Work opens with exactly the stored data: the same Original pixels, Source name, Source format, Geometry, Adjustments and Drawing layer. When the update did not change how a Work is drawn, a full-size Export of it is identical to the Export the earlier version made. An update never empties the Gallery or loses a Work
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `openGalleryDb` around the existing `openDb` (`src/infra/db/open-db.ts`):
  - wrap `openDB` and pass a `blocked` callback that starts the bounded wait (default `blockedWaitMs` 3000, a breakdown-time choice);
  - when the wait elapses, resolve `STORAGE_UNAVAILABLE`/`'held'`;
  - when the open rejects (`SecurityError`, `InvalidStateError`, `UnknownError`), resolve `'refused'`;
  - on success, install `db.addEventListener('versionchange', () => opts.onVersionChange?.(db))`.
  Keep `openDb` as it is for the migration tests.
- [ ] Add `src/infra/db/open-db.test.ts` on `fake-indexeddb`:
  - a refused open, by stubbing `indexedDB.open` to throw;
  - a second connection at `LATEST_VERSION + 1` firing `onVersionChange` on the first, which closes, and the upgrade then completing;
  - a held connection that never closes, giving `'held'` after the wait (fake timers).
- [ ] Add `src/infra/platform/storage-persistence.ts`. `requestPersistence` returns `navigator.storage?.persist?.() ?? false`, and `isPersisted` returns `navigator.storage?.persisted?.()`, with `undefined` when the API is missing. Both catch a rejection, which `requestPersistence` turns into `false`.
- [ ] Write `storage-persistence.test.ts` with a recording stub for granted, declined and missing.
- [ ] Export from `src/infra/db/index.ts` and `src/infra/platform/index.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| site data blocked, so `indexedDB.open` throws or rejects | `STORAGE_UNAVAILABLE`, `reason: 'refused'` |
| an older connection without a handler holds the database | `'held'` after the bounded wait |
| a newer version opens elsewhere | `onVersionChange(db)` fires once on this connection |
| `navigator.storage` missing | `isPersisted()` → `undefined`, `requestPersistence()` → `false` |
| `persist()` rejects | `false`, and saving carries on (AC-14) |

## Definition of Done

- [ ] `open-db.test.ts` proves the `'refused'` and `'held'` reasons, and that the `versionchange` callback lets the newer connection upgrade.
- [ ] `storage-persistence.test.ts` proves the browser's answer is passed through, and `false`/`undefined` when the API is missing.
- [ ] Every Hard Rule inlined above still holds (`import-rules.test.ts` is green).
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean.
