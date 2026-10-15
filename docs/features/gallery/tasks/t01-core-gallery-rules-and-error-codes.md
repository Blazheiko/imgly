---
id: T1
title: "Add core/gallery rules (cap of 20, evictionCandidates, entryName, touchedLabel, storageLine) and the STORAGE_UNAVAILABLE, STORAGE_FAILED and WORK_DAMAGED error codes"
layer: "domain"
deps: []
blocks: ["T2", "T4", "T6", "T7", "T15"]
acs: ["AC-03", "AC-07", "AC-09", "AC-13"]
files_hint: ["src/core/gallery/rules.ts", "src/core/gallery/rules.test.ts", "src/core/gallery/index.ts", "src/core/index.ts", "src/core/result.ts", "src/core/result.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 68 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Add core/gallery rules (cap of 20, evictionCandidates, entryName, touchedLabel, storageLine) and the STORAGE_UNAVAILABLE, STORAGE_FAILED and WORK_DAMAGED error codes

## Place in the sequence

- **Blocked by:** nothing.
- **Blocks:** T2 — Add core/gallery stored-Work rules · T4 — Add storeWork to the works repository · T6 — Open the Gallery database as a Result and add storage-persistence · T7 — Add infra/work-codec · T15 — Add the gallery feature's store and messages.
- **Wave:** 1. These are pure rules and error codes, and almost every later task depends on them.
- **Lane:** shares `src/core/gallery/index.ts` and `src/core/index.ts` with T2, so the two run one after the other.

## Why (user story)

> **US-05: Know how safe my Works are**
>
> **As an** Editor
> **I want** the app to tell me plainly where my Works are kept, whether the browser may clear them, and when a Work was removed or could not be saved
> **So that** I export what I must not lose and am never surprised by a missing Work
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task adds the pure rules that decide which Work leaves the Gallery, how an entry is labelled and which storage line shows. It also adds the error codes every later layer returns.

## Inlined context

> │   ├── gallery/              NEW  cap (20), evictionCandidates, validateStoredWork, touchedLabel ("Just now"…), storageLine, entryName ("Untitled")
> │   └── result.ts             + STORAGE_UNAVAILABLE, STORAGE_FAILED, WORK_DAMAGED (STORAGE_QUOTA exists)
>
> — `sad.md §5, Internal decomposition, core lines, verbatim` · full text: [sad.md](../sad.md)

> asks a pure `core` rule (`src/core/gallery/`) for the eviction list. The list is empty when there is room. Otherwise it takes the Works that are not `keep` (the Work open in this tab), damaged Works first, then the least recently `touchedAt`, enough to hold at most 20 Works, plus `extra` more;
>
> — `adr/0004 §Decision outcome, Store bullet 2, verbatim` · full text: [adr/0004](../adr/0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota.md)

> | Error handling | `core` and `infra` return `Result<T, AppError>`. New codes: `STORAGE_UNAVAILABLE` (the database can't be opened, or is closed for a newer version, AC-12, ADR-0006), `STORAGE_FAILED` (a save or delete fails for another reason, AC-11) and `WORK_DAMAGED` (a stored Work can't be read in full, AC-08). The existing `STORAGE_QUOTA` means the Work doesn't fit even alone (AC-10, ADR-0004). Texts live in `src/features/editor/messages.ts` (Autosave and reopen) and `src/features/gallery/messages.ts` (list and delete) |
> | Time | `touchedAt` is `Date.now()` taken when the Work is opened, reopened or changed, through a clock the tests can inject. `core/gallery` turns it into "Just now", "N minutes ago" or "N hours ago", and otherwise into the date through `Intl.DateTimeFormat` in the browser's language (AC-03) |
> | Persistent storage | … The storage line reads `persisted()` each time the Gallery shows (AC-13). Where the API is missing, the line uses its non-persistent wording |
>
> — `sad.md §8, rows Error handling / Time / Persistent storage, abridged` · full text: [sad.md](../sad.md)

> | label | touched | AC-03 | Just now · 1 minute ago / {n} minutes ago · 1 hour ago / {n} hours ago · otherwise the date, `Intl.DateTimeFormat` in the browser's language with `dateStyle: 'medium'` |
> | label | nameless Work | AC-03 | Untitled |
>
> — `screens.md §Message catalog, touched + nameless rows, verbatim` · full text: [screens.md](../screens.md)

> - Two Works with the same `touchedAt` → the order is stable (the id breaks the tie), in both the list and the eviction choice.
> - 20 Works and all of them damaged except the open one → the damaged ones go first, oldest first.
>
> — `test-plan.md §Edge cases / error paths, bullets 2–3, verbatim` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** `src/core/` — Pure TS domain … May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
>
> — `CLAUDE.md §Module boundaries, src/core row, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or the code contradicts it, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [test-plan.md](../test-plan.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. This task exposes the following signatures to T4, T15 and later tasks (the shapes are a breakdown-time choice):

- `GALLERY_CAP = 20`
- `evictionCandidates(records: { id, touchedAt }[], { keep, damaged, extra }): string[]`. `keep` is the open Work's id or null, `damaged` is a set of ids, and `extra` ≥ 0. The rule is sized for the incoming Work: the result keeps at most 20 after the new Work is written.
- `entryName(sourceName: string): string`
- `touchedLabel(touchedAt: number, now: number, locale?: string): string`
- `storageLine(persisted: boolean | undefined): 'persisted' | 'not-persisted'`

## Acceptance criteria

### AC-03 (US-03) — happy path

> **Given** the Gallery holds several Works, one of which is open
> **When** the Editor chooses "Gallery" in the top bar
> **Then** the Gallery lists every stored Work, most recently opened or changed first. Each entry shows a thumbnail of the Work with all its edits, its Source name ("Untitled" when the Work has none) and when it was last opened or changed: "Just now" under a minute, "N minutes ago" under an hour, "N hours ago" under a day, and otherwise the date in the browser's language. The open Work's entry is marked "Open", and the Gallery shows how many of the 20 places are used. The Gallery can be closed again without changing anything
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-07 (US-04) — domain invariant

> **Given** the Gallery is showing and one of its Works is open
> **When** the Editor tries to delete the open Work's entry
> **Then** deleting is unavailable for that entry, and its hint says that the open Work cannot be deleted and to open another image first. The Gallery never deletes or evicts the Work open in this tab; a Work open only in another tab can be evicted there (AC-21)
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-09 (US-05) — domain invariant

> **Given** the Gallery holds 20 Works, with or without one of them open in this tab
> **When** the Editor opens a new image and it replaces the open Work
> **Then** the new image enters the Gallery only once it has replaced the open Work, as a new Work even if the same file was opened before, and the least recently opened or changed Work that is not open in this tab is evicted, so the Gallery still holds 20 Works. The Work just replaced has been opened or changed more recently than the others, so it is not the one evicted unless it is the only candidate. A notice names the evicted Work and says it was removed to make room. If the replacement is cancelled or the image cannot be read, nothing is stored and nothing is evicted
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-13 (US-05) — happy path

> **Given** the Gallery is showing
> **When** the Editor looks at it, empty or full
> **Then** one line always says where the Works are kept. The line follows the browser's current answer. When the browser has agreed to keep the app's storage, it reads that Works are kept in this browser and to export one to keep a copy elsewhere. Otherwise it reads that Works are saved in this browser only, that the browser may clear them when space runs low, and to export to keep a copy
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `STORAGE_UNAVAILABLE`, `STORAGE_FAILED` and `WORK_DAMAGED` to `AppErrorCode` and its exhaustive map, each with a doc comment naming its AC (`src/core/result.ts`). Cover them in `src/core/result.test.ts`.
- [ ] Add `GALLERY_CAP` and `evictionCandidates` (`src/core/gallery/rules.ts`). Never return `keep`. Pick damaged Works first, then the oldest `touchedAt`, with the id breaking ties. Return enough Works that the store holds at most `GALLERY_CAP` once the incoming Work is written (when the incoming id is already stored, it is not counted twice), plus `extra` more, and never more than there are candidates.
- [ ] Add `entryName`: `''` gives `'Untitled'`, and any other name is returned unchanged (`rules.ts`).
- [ ] Add `touchedLabel(touchedAt, now, locale?)` (`rules.ts`). Under 60 s it returns "Just now". Under 60 min it returns "1 minute ago" or "{n} minutes ago", and under 24 h "1 hour ago" or "{n} hours ago". Otherwise it returns `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`. The returned text lives in core, per sad §8 Time (breakdown-time choice).
- [ ] Add `storageLine(persisted)`: `true` gives `'persisted'`, and `false` or `undefined` gives `'not-persisted'`. The wording lives in gallery `messages.ts` (T15), per sad §8 Error handling (breakdown-time choice).
- [ ] Export from `src/core/gallery/index.ts` and re-export from `src/core/index.ts`.
- [ ] Write `rules.test.ts`: one test per Edge case below, plus a property test over random sets of 0–21 records with a random `keep` and a random `damaged` set.

## Edge cases

| Case | Behaviour |
|---|---|
| 19 stored, new Work arrives | `[]` (there is room) |
| 20 stored, the open Work among them, new Work arrives | the oldest of the other 19 |
| the only candidate is the Work just replaced | it is evicted (AC-09) |
| `keep` is the only stored Work and `extra` is 1 | `[]`, because `keep` is never returned |
| all stored Works damaged except `keep` | damaged first, oldest first |
| equal `touchedAt` | the lower id goes first, so the result is stable |
| `touchedAt` 59 s / 60 s / 59 min / 60 min / 23 h 59 min / 24 h ago | Just now / 1 minute ago / 59 minutes ago / 1 hour ago / 23 hours ago / the date |
| `persisted` undefined (API missing) | `'not-persisted'` |

## Definition of Done

- [ ] The `rules.test.ts` property test proves `keep` is never picked and the count stays ≤ 20.
- [ ] The example tests cover damaged-first ordering, the id tie-break and `extra`.
- [ ] The `touchedLabel` boundaries pass with an injected `now`.
- [ ] `entryName('')` gives "Untitled".
- [ ] `storageLine` maps `true`, `false` and `undefined`.
- [ ] `result.test.ts` covers the three new codes.
- [ ] Every Hard Rule inlined above still holds: `core/gallery` imports nothing outside `core`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean.
