---
id: T18
title: "Add the Gallery e2e hooks to window.__imglyTest: stored records, write a v1-shaped Work, damage a part, byte budget, hold a transaction, fail the next save, ask for the next DB version, count persist() calls"
layer: "wiring"
deps: ["T5", "T6", "T12"]
blocks: ["T19", "T20", "T21", "T22"]
acs: ["AC-08", "AC-10", "AC-11", "AC-14", "AC-18", "AC-19"]
files_hint: ["src/app/test-hooks.ts", "src/app/test-hooks.test.ts", "e2e/test-hooks.d.ts", "src/infra/db/works-repository.ts", "src/infra/db/testing.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 82 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T18 — Add the Gallery e2e hooks to window.__imglyTest: stored records, write a v1-shaped Work, damage a part, byte budget, hold a transaction, fail the next save, ask for the next DB version, count persist() calls

## Place in the sequence

- **Blocked by:** T5 — Add listWorks, loadWork and deleteWork to the works repository; T6 — Open the Gallery database as a Result with the versionchange hand-off, and add storage-persistence; T12 — Wire Autosave into the editor store.
- **Blocks:** T19 — e2e save and reopen; T20 — e2e manage and limits; T21 — e2e gate and lifecycle; T22 — @perf e2e.
- **Wave:** 5 — runs alongside the UI chain (T13–T17), so the hooks are ready when the e2e tasks start.
- **Lane:** shares `src/infra/db/works-repository.ts` and `src/infra/db/testing.ts` with T4/T5 — serialized (both are upstream).

## Why (user story)

> **US-05: Know how safe my Works are**
>
> **As an** Editor  
> **I want** the app to tell me plainly where my Works are kept, whether the browser may clear them, and when a Work was removed or could not be saved  
> **So that** I export what I must not lose and am never surprised by a missing Work
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It gives the e2e suites the seams to provoke a full quota, a failed save, a damaged Work, an interrupted save and an upgrade in a real browser, and to read back what was stored.

## Inlined context

> | E2E-through-UI | The `ux-flows.md` flows in a real browser on Chromium, Firefox and WebKit: real IndexedDB, real reloads and closed pages, real Exports decoded back to pixels, two pages in one context, offline mode, the browser's own leave warning. | The app's own hooks-enabled build. New `__imglyTest` Gallery hooks: read the stored records, write a record in an earlier shape, damage a stored part, set a byte budget, hold a transaction, ask for the next database version, count persistence requests. Each test gets a fresh browser context, so storage starts empty. |
>
> — `test-plan.md §Levels, E2E-through-UI row, verbatim` · full text: [test-plan.md](../test-plan.md)

> - **A full quota is tested at three depths (owner, 2026-10-14).**
>   2. e2e-through-UI on all three engines: a test hook sets a byte budget in the repository, so the real UI gets a real-shaped refusal.
> - **Interrupted saves are held by a hook (owner, 2026-10-14).** A test hook can hold the `storeWork` transaction open at a chosen point: after the evictions, after the record, after the Original, or after the layer. The test then reloads the page.
> - **"Storage blocked" uses blocked site data, not a private window** […] storage access is denied for the browser context where the engine allows it, otherwise a test hook fails `openDb` before it runs.
> - **Two tabs are two pages in one browser context**, so they share the real store (AC-21, ADR-0006). The version-upgrade row opens the second page with a test hook that asks for the next database version, so the first page gets a real `versionchange`.
>
> — `test-plan.md §Decisions taken in this plan, quota / interrupted / blocked / two tabs bullets, abridged` · full text: [test-plan.md](../test-plan.md)

> In DEV and e2e builds, `window.__imglyTest` exposes the stored records and the bitmap and layer ledger, so the tests can assert that no part of a deleted Work remains and that no bitmap leaks (spec §6.1, §2)
>
> — `sad.md §7, Monitoring bullet 3, verbatim` · full text: [sad.md](../sad.md)

> | Logging and observability | None at runtime, as elsewhere in the repo. The e2e hooks expose the stored records and the ledger in DEV and e2e builds only | `src/app/test-hooks.ts` |
>
> — `sad.md §8, Logging and observability row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** only `src/infra/db/*` touches IndexedDB, through repository functions that return `Result`.
>
> — `CLAUDE.md §Conventions, Persistence, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

The hooks therefore never open IndexedDB from `src/app/` themselves: they call test seams that `src/infra/db/` exports (e.g. from `testing.ts`) and that are only installed when `VITE_E2E_HOOKS` is set, like the existing hooks in `installTestHooks(pinia)`.

**Note on "write a v1-shaped Work":** migration `0002-gallery` clears the DB-v1 `works` store, because a v1 record can never be a valid Work (`migrations/01_reshape_works_add_blob_stores.up.ts`). So the AC-18 hook writes a Work in the **record layout `formatVersion: 1`** directly into the stores (bypassing Autosave), as an earlier app version would have stored it; the page then reloads into the current build. If T19 needs a true DB-v1 database, raise it with the owner — do not invent a v1 Work layout.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [test-plan.md](../test-plan.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The hooks read and write the existing `works`, `originals`, `layers` and `meta` stores only through seams exported by `src/infra/db/`.

## API contract

Internal — no API surface. The hooks added to `window.__imglyTest` (breakdown-time names, derived from the test-plan hook list; rename freely, keep the meaning):

- `galleryRecords(): Promise<{ works: WorkRecordSummary[]; originals: string[]; layers: string[]; meta: string[] }>` — every stored key per store (records without Blob bytes).
- `galleryWriteStored(input: { sourceName; sourceFormat; geometry; adjustments; touchedAt; originalPng: Blob-as-bytes; layerPng?: bytes }): Promise<string>` — writes one Work in the `formatVersion: 1` layout, returns its id.
- `galleryDamage(id: string, part: 'original' | 'layer' | 'thumbnail' | 'record'): Promise<void>`.
- `gallerySetByteBudget(bytes: number | null): void` — writes over budget fail as a quota error.
- `galleryHoldSave(point: 'evictions' | 'record' | 'original' | 'layer' | null): void` — the next `storeWork` transaction stays open at that point.
- `galleryFailNextSave(): void` — the next save fails with a non-quota error.
- `galleryOpenNextVersion(): Promise<void>` — opens the database at `LATEST_VERSION + 1` from this page.
- `galleryPersistCalls(): number` — `navigator.storage.persist()` calls since load.
- `galleryFailOpen(): void` — makes the next page load's `openDb` refuse (for engines that can't deny storage).

## Acceptance criteria

### AC-08 (US-02) — error

> **Given** a Work in the Gallery can no longer be read back, because its stored data is damaged or incomplete
> **When** the Editor chooses it, or the Gallery tries to show its thumbnail
> **Then** the open Work stays exactly as it was. Listing the Gallery checks only what the entry shows (its thumbnail and details), and choosing a Work checks all of it. The entry is marked as damaged instead of failing silently, and choosing it shows a notice that names the Work, says it cannot be opened and offers to delete it. Every other Work in the Gallery lists, opens and deletes normally. A damaged Work still counts toward the 20 places and is the first to be evicted when room is needed, with the usual notice naming it
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-10 (US-05) — error

> **Given** the browser reports that the app's storage space is full when Autosave stores the open Work
> **When** Autosave runs after an image opens or after a Step, Undo or Redo
> **Then** the app evicts the least recently opened or changed Works that are not open in this tab, one at a time, until the open Work fits, and one notice names every Work it removed. If the open Work still does not fit once it is the only Work left, a notice says it could not be saved to the Gallery and to export it to keep a copy. The Work stays open and editable either way, and the Gallery keeps the earlier stored state of the open Work if there was one
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 (US-05) — error

> **Given** the Gallery was available when the page loaded, and an Autosave later fails for a reason other than full storage
> **When** the failure happens
> **Then** one notice says the Work could not be saved to the Gallery and to export it to keep a copy, and editing continues. The next Step, Undo or Redo tries again without a new notice. Once a save succeeds, the notice is withdrawn, and a later failure shows it again. While the latest applied state is not stored, replacing the Work follows AC-17
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

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

### AC-19 (US-01) — domain invariant

> **Given** the Editor opens an image and the app reloads or crashes while Autosave is storing it
> **When** the Editor reopens the Gallery
> **Then** every Work in it is either in its last fully stored state or absent, never half stored. A Work whose first save was interrupted is simply not listed, and a Work whose later save was interrupted reopens in its previous stored state. Evicting to make room and storing the new state happen as one step, so an interrupted save also removes no Work, and no Work ever leaves the Gallery without its notice
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add the test seams to the repository, inert unless installed: byte budget (quota-shaped error), hold point inside `storeWork`'s transaction (keep a request pending at the point), one-shot failure — `src/infra/db/works-repository.ts`
- [ ] Add the raw helpers the hooks need: read every key per store, write a `formatVersion: 1` Work, damage a part, open at the next version — `src/infra/db/testing.ts`
- [ ] Count `navigator.storage.persist()` calls by wrapping it when hooks are installed; add `galleryFailOpen` via a `sessionStorage` flag read before `openDb` — `src/app/test-hooks.ts`
- [ ] Register every hook in `installTestHooks(pinia)` — `src/app/test-hooks.ts`
- [ ] Type them — `e2e/test-hooks.d.ts`
- [ ] Unit tests on fake-indexeddb for each hook — `src/app/test-hooks.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Build without `VITE_E2E_HOOKS` | no hook exists; the repository seams are no-ops |
| Hold point after the evictions, then reload | the transaction never commits; database as before the save (AC-19) |
| Byte budget smaller than one Work | every attempt refused as a quota error; repository returns `STORAGE_QUOTA`, nothing evicted |
| `galleryFailNextSave` then a successful save | one failure, then normal |
| `galleryDamage(id, 'original')` | the Work lists normally and fails only when chosen (AC-08) |
| `galleryDamage(id, 'thumbnail')` | the entry lists as damaged |
| Hook writes a Work whose PNG size differs from the record | allowed — that is how `size-mismatch` damage is made |

## Definition of Done

- [ ] `test-hooks.test.ts` proves each new hook exists only in the hooks-enabled build and drives its seam: records read back per store, a Work written in the `formatVersion: 1` layout, one stored part damaged, budget refusal as a quota error, a hold that keeps `storeWork`'s transaction open at each of the four points, a one-shot save failure, a failing `openDb` on the next page load, a next-version open, a `persist()` counter
- [ ] `e2e/test-hooks.d.ts` types every hook and `pnpm typecheck` passes
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
