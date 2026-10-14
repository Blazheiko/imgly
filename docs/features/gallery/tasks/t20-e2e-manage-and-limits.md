---
id: T20
title: "e2e (Chromium, Firefox, WebKit): delete, the open Work's entry, damaged Works, 25 images, byte-budget quota, a failing save, the storage line and the persistence request"
layer: "tests"
deps: ["T17", "T18"]
blocks: []
acs: ["AC-06", "AC-07", "AC-08", "AC-09", "AC-10", "AC-11", "AC-13", "AC-14"]
files_hint: ["e2e/gallery/manage-and-limits.spec.ts", "e2e/gallery/helpers.ts"]
owner: "Blazheiko"
estimate: "L"
context_budget: "M"   # measured: 98 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T20 — e2e (Chromium, Firefox, WebKit): delete, the open Work's entry, damaged Works, 25 images, byte-budget quota, a failing save, the storage line and the persistence request

## Place in the sequence

- **Blocked by:** T17 — Mount the Gallery in both homes; T18 — Add the Gallery e2e hooks to window.__imglyTest.
- **Blocks:** — (nothing waits on it).
- **Wave:** 9 — in parallel with T19, T21 and T22.
- **Lane:** shares `e2e/gallery/helpers.ts` with T19 and T21 — serialized; whichever runs first creates it.

## Why (user story)

> **US-05: Know how safe my Works are**
>
> **As an** Editor  
> **I want** the app to tell me plainly where my Works are kept, whether the browser may clear them, and when a Work was removed or could not be saved  
> **So that** I export what I must not lose and am never surprised by a missing Work
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It proves in three real browsers that every Work leaving the Gallery is named, the cap holds, and the storage line and persistence request behave.

## Inlined context

> | AC-06 happy | delete then reload leaves no stored part behind | e2e-through-UI | after confirming, the entry is gone and the count drops; after a reload the hooks find no `works`, `originals` or `layers` entry for that id (spec §6.1); cancelling keeps the Work exactly as it was; all three engines |
> | AC-07 invariant | the open Work's entry can't be deleted in a real browser | e2e-through-UI | Delete on the "Open" entry shows the hint; the Work stays listed and open; all three engines |
> | AC-08 error | damaged stored data in a real browser | e2e-through-UI | a hook damages one Work's Original and another's thumbnail: the first lists normally and gives the notice when chosen, the second lists as damaged; both delete normally; every other Work opens; all three engines |
> | AC-09 invariant | opening 25 images keeps 20 Works and names each one evicted | e2e-through-UI | after each of images 21 to 25, one notice names the evicted Work; the Gallery holds 20; the open Work is listed; all three engines (§6 Gallery cap) |
> | AC-10 error | a byte budget makes the real UI evict and then refuse | e2e-through-UI | a hook sets a budget for three Works: the fourth evicts the oldest with a notice; a Work larger than the budget gives the could-not-save notice, evicts nothing and stays editable; all three engines |
> | AC-10 error | the browser's own quota error is recognised as a full quota | e2e-through-UI | Chromium only: the site quota is shrunk through the DevTools protocol; the save gives the eviction or could-not-save notice, never the generic failure notice |
> | AC-11 error | a failing save in a real browser | e2e-through-UI | a hook fails the next save: the notice shows once; editing continues; the next Apply succeeds and the notice goes; all three engines |
> | AC-13 happy | the line in a real browser | e2e-through-UI | with persistence granted and with it refused (a stubbed answer), the line shows the matching wording on the start screen and in the overlay; all three engines |
> | AC-14 authorization | the request counted in a real browser | e2e-through-UI | a hook counts `persist()` calls: none at load, one at the first save, none after a reload and further saves; all three engines |
>
> — `test-plan.md §AC coverage, e2e-through-UI rows for AC-06..AC-11, AC-13, AC-14, verbatim` · full text: [test-plan.md](../test-plan.md)

> - **A full quota is tested at three depths (owner, 2026-10-14).** […] 2. e2e-through-UI on all three engines: a test hook sets a byte budget in the repository, so the real UI gets a real-shaped refusal. 3. One Chromium-only e2e row shrinks the site's real quota through the browser's DevTools protocol. It proves the browser's own error is classified as a full quota, not as another failure.
>
> — `test-plan.md §Decisions taken in this plan, quota bullet, abridged` · full text: [test-plan.md](../test-plan.md)

> - **25 small distinct images**, generated in the page at run time (a coloured rectangle with its number), for the cap and eviction rows.
> - **Independent oracle.** […] Stored state is read back through the hooks, not through the code under test. The label and message rows compare with the texts written in the test, not with the catalog.
>
> — `test-plan.md §Test data, abridged` · full text: [test-plan.md](../test-plan.md)

> | info | Works evicted, one | “{name}” was removed from the Gallery to make room. |
> | failure | `STORAGE_QUOTA`, doesn't fit alone | This Work couldn't be saved to the Gallery because the browser's storage is full. Export it to keep a copy. |
> | failure (withdrawable) | `STORAGE_FAILED` on a save | This Work couldn't be saved to the Gallery. Export it to keep a copy. |
> | failure + action | `WORK_DAMAGED` on choose | “{name}” can't be opened: its stored data is damaged. Action: **Delete…** |
> | info (hint) | "Delete" on the open Work | The open Work can't be deleted. Open another image first. |
> | line | storage line, persisted | Works are kept in this browser. Export a Work to keep a copy elsewhere. |
> | line | storage line, not persisted or API missing | Works are saved in this browser only, and the browser may clear them when space runs low. Export to keep a copy. |
>
> — `screens.md §Message catalog, rows used here, abridged` · full text: [screens.md](../screens.md)

> - **On every PR, three engines:** e2e-through-UI […]. **On every PR, Chromium only:** the real-quota row and the 50-reload interrupted-save row.
>
> — `test-plan.md §CI placement, abridged` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

`sad.md` §11 notes the design keeps the earlier stored state and evicts nothing when the Work can't fit alone (ADR-0004); the e2e test follows the design, and T23 aligns AC-10's wording.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [test-plan.md](../test-plan.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

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
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 (US-05) — error

> **Given** the Gallery was available when the page loaded, and an Autosave later fails for a reason other than full storage
> **When** the failure happens
> **Then** one notice says the Work could not be saved to the Gallery and to export it to keep a copy, and editing continues. The next Step, Undo or Redo tries again without a new notice. Once a save succeeds, the notice is withdrawn, and a later failure shows it again. While the latest applied state is not stored, replacing the Work follows AC-17
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

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

## Checklist

- [ ] Helpers: generate N numbered images in the page, open one, wait for its committed save via `galleryRecords()`, read toast texts — `e2e/gallery/helpers.ts`
- [ ] AC-06: delete a non-open Work, confirm → gone, count −1; reload → no `works`/`originals`/`layers` key for its id; cancel path keeps it — `e2e/gallery/manage-and-limits.spec.ts`
- [ ] AC-07: Delete on the "Open" entry → hint, no dialog, Work still listed and open
- [ ] AC-08: `galleryDamage(a, 'original')`, `galleryDamage(b, 'thumbnail')` → a lists normally and gives the notice with "Delete…" when chosen; b lists as damaged; both delete; others open
- [ ] AC-09: open 25 images; after each of 21–25 one notice names the evicted Work; 20 stored; open Work listed
- [ ] AC-10: `gallerySetByteBudget` for three Works → the fourth evicts the oldest with a notice; an oversized Work → could-not-save notice, nothing evicted, still editable; Chromium-only DevTools-shrunk quota → eviction or could-not-save notice, never the generic one
- [ ] AC-11: `galleryFailNextSave` → one notice; edit continues; next Apply succeeds → notice withdrawn
- [ ] AC-13: stub `persisted()` true/false → matching line on SCR-01 and SCR-03
- [ ] AC-14: `galleryPersistCalls()` 0 at load, 1 after the first save, unchanged after reload and further saves

## Edge cases

| Case | Behaviour |
|---|---|
| Cancel the delete confirmation | Work exactly as it was |
| 20 Works and the open one among them | the oldest of the other 19 is evicted; the just-replaced Work only when it is the only candidate |
| A damaged Work while room is needed | evicted first, named in the notice |
| A Work larger than the budget, alone | `STORAGE_QUOTA` notice; earlier stored state kept; nothing evicted |
| Several Works evicted by one save | one notice naming all of them, not one per Work |
| Persistence declined | saving continues; line uses the non-persistent wording |
| Source name with markup (`<img onerror>`) | rendered as text in the entry and every notice |

## Definition of Done

- [ ] `pnpm test:e2e e2e/gallery/manage-and-limits.spec.ts` passes on Chromium, Firefox and WebKit, with the real-quota row on Chromium only
- [ ] no `works`, `originals` or `layers` entry remains after delete and reload; 20 Works with one notice per evicted Work after 25 opens
- [ ] message assertions use texts written in the test, not imported from the catalog
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
