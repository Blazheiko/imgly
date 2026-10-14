---
id: T15
title: "Add the gallery feature's store and messages: list entries, storage line, unavailable reason, choose through editor.reopenWork with the damaged notice and its Delete action, and delete through the repository"
layer: "ui"
deps: ["T1", "T5", "T6", "T9", "T13"]
blocks: ["T16"]
acs: ["AC-03", "AC-06", "AC-08", "AC-12", "AC-13", "AC-15"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/messages.ts", "src/features/gallery/messages.test.ts", "src/features/gallery/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 103 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T15 — Add the gallery feature's store and messages

## Place in the sequence

- **Blocked by:** T1 — Add core/gallery rules · T5 — Add listWorks, loadWork and deleteWork · T6 — Open the Gallery database as a Result, and add storage-persistence · T9 — Extend Toast and useNotices with an optional action · T13 — Add reopenWork(id) to the editor store.
- **Blocks:** T16 — Build GalleryEntry, GalleryList and DeleteWorkDialog.
- **Wave:** 6.
- **Lane:** shares `src/features/gallery/index.ts` with T17 — serialized.

## Why (user story)

> **As an** Editor
> **I want** to see my recent Works as thumbnails with their names and when I last opened or changed them, newest first
> **So that** I recognise the one I want at a glance
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It is the view-model both Gallery homes render: what is listed, what the line says, and what choosing or deleting does.

## Inlined context

> - `src/features/gallery/` has: the list, start-screen and overlay components; the "Gallery" top-bar action; the delete confirmation; `store.ts`, which holds the listed entries, the overlay's open state and the storage line; `messages.ts` and `index.ts`.
>   It reads the repository to list and delete Works, and calls only the editor store's public API, through `@/features/editor`.
>
> — `adr/0001 §Decision outcome, How it works bullet 6, abridged` · full text: [adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md](../adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md)

> ```
> alt storage cannot be opened → Gallery unavailable for this page load, with the reason
> else opened
>     UI->>D: list the small records, most recently touched first (no Original or layer read)
>     UI->>UI: check each record's shape and decode its thumbnail
>     UI->>X: ask whether storage is persistent
>     opt a record or its thumbnail cannot be read → that entry marked damaged, every other entry normal
> ```
>
> — `sad.md §6, Flow 3, abridged` · full text: [sad.md](../sad.md)

> ```
> UI->>S: which Work is open in this tab → the open Work's id, or none
> alt the entry is the Work open in this tab → Delete unavailable, hint
> else confirm → UI->>D: delete the record, the Original and the layer in one transaction
>     alt deleted → entry gone, count of used places down by one
>     else storage failure → notice - the Work could not be deleted, entry kept
> ```
>
> — `sad.md §6, Flow 4, abridged` · full text: [sad.md](../sad.md)

> | failure + action | `WORK_DAMAGED` on choose | AC-08 | “{name}” can't be opened: its stored data is damaged. Action: **Delete…** |
> | failure | `STORAGE_FAILED` on a delete | — (Flow 4) | “{name}” couldn't be deleted. Try again. |
> | info (hint) | "Gallery" while a tool is open | — (ux-flows SCR-02) | Apply or cancel the open tool first. |
> | info (hint) | "Delete" on the open Work | AC-07 | The open Work can't be deleted. Open another image first. |
> | info (hint) | choose while exporting | AC-15 | Wait for the export to finish, then choose a Work. |
> | info (hint) | choose while a replacement waits | AC-15 | Answer the open question first, then choose a Work. |
> | line | storage line, persisted | AC-13 | Works are kept in this browser. Export a Work to keep a copy elsewhere. |
> | line | storage line, not persisted or API missing | AC-13 | Works are saved in this browser only, and the browser may clear them when space runs low. Export to keep a copy. |
> | label | count | AC-03 | {n} of 20 places used |
> | label | entry status | AC-03, AC-08 | Open · Damaged |
> | label | damaged thumbnail box | AC-08 | Can't be read |
> | text | empty state | AC-05 | Works you open will appear here. (+ "Open image" on SCR-01) |
> | title | unavailable, all reasons | AC-12 | The Gallery is unavailable in this window. |
> | body | unavailable: storage refused or blocked | AC-12 | This browser isn't letting the editor keep anything for this site, for example because site data is blocked. You can still open, edit and export images, but nothing is kept after this page closes. |
> | body | unavailable: held by an older tab | AC-12, ADR-0006 | Another tab of the editor is holding the Gallery. Close the other tabs of the editor, then reload this page. |
> | body | unavailable: closed for a newer version | AC-12, ADR-0006 | A newer version of the editor is open in another tab. Reload this page to use the Gallery. |
> | dialog | SCR-04 | AC-06 | Title "Delete “{name}”?" · body "It can't be brought back. An Export is the only copy kept outside this browser." · Cancel · Delete |
> | spinner | reopening (screen-reader label) | AC-04 | Opening {name} |
> | button | top bar / overlay | AC-03 | Gallery · Close (tooltip "Close (Esc)") |
> | button | entry | AC-06 | Delete (accessible name "Delete “{name}”") |
>
> — `screens.md §Message catalog, gallery rows, verbatim` · full text: [screens.md](../screens.md)

> | Data read from storage | Untrusted (§3 trust boundary). Listing checks a record's shape and its thumbnail only. […] The Source name is only ever rendered as text, and stored data is only ever shown as an image (spec §6.1) |
> | Concurrency across tabs | […] The Gallery reads the list each time it shows, with no live refresh. […] |
>
> — `sad.md §8, rows Data read from storage + Concurrency across tabs, abridged` · full text: [sad.md](../sad.md)

**Breakdown-time choice:** the store reaches the repository handle and `reopenWork` through the editor store's public API (`@/features/editor`), never through App.vue state; thumbnails become object URLs here and are revoked on `refresh()`/dispose.

> **Hard rule:** Features never import each other. They coordinate through the `editor` store […]. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Reads `works` (list) and deletes from `works`, `originals`, `layers` through T5's repository.

## API contract

Internal — no API surface. Store surface for T16/T17 (breakdown-time choice): `useGallery()` → `{ entries, count, storageLine, unavailableReason, overlayOpen, reopening, refresh(), choose(id), requestDelete(id), confirmDelete(), cancelDelete(), pendingDelete, open(), close() }`; `entries[i] = { id, name, status: 'touched'|'open'|'damaged', label, thumbnailUrl | null }`.

## Acceptance criteria

### AC-03 (US-03) — happy path

> **Given** the Gallery holds several Works, one of which is open
> **When** the Editor chooses "Gallery" in the top bar
> **Then** the Gallery lists every stored Work, most recently opened or changed first. Each entry shows a thumbnail of the Work with all its edits, its Source name ("Untitled" when the Work has none) and when it was last opened or changed: "Just now" under a minute, "N minutes ago" under an hour, "N hours ago" under a day, and otherwise the date in the browser's language. The open Work's entry is marked "Open", and the Gallery shows how many of the 20 places are used. The Gallery can be closed again without changing anything
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-06 (US-04) — happy path

> **Given** the Gallery holds a Work that is not open
> **When** the Editor chooses to delete it
> **Then** the app asks for confirmation, naming the Work and saying it cannot be brought back and that an Export is the only copy kept outside this browser. Confirming removes the Work from the Gallery and from this browser at once, and the count of used places goes down by one. Cancelling keeps the Work exactly as it was
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-08 (US-02) — error

> **Given** a Work in the Gallery can no longer be read back, because its stored data is damaged or incomplete
> **When** the Editor chooses it, or the Gallery tries to show its thumbnail
> **Then** the open Work stays exactly as it was. Listing the Gallery checks only what the entry shows (its thumbnail and details), and choosing a Work checks all of it. The entry is marked as damaged instead of failing silently, and choosing it shows a notice that names the Work, says it cannot be opened and offers to delete it. Every other Work in the Gallery lists, opens and deletes normally. A damaged Work still counts toward the 20 places and is the first to be evicted when room is needed, with the usual notice naming it
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-05) — authorization

> **Given** storage cannot be opened for this app when the page loads, for example in a private window or with site data blocked for the site
> **When** the Editor opens an image and edits it
> **Then** opening, editing and exporting work as before. The Gallery shows that it is unavailable in this browser window and why in plain words, nothing is stored, and the app does not try to store anything again until the page is next loaded. Replacing the Work asks for confirmation whenever the open Work has Unsaved edits, as open-and-view AC-15 always did
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 (US-05) — happy path

> **Given** the Gallery is showing
> **When** the Editor looks at it, empty or full
> **Then** one line always says where the Works are kept. The line follows the browser's current answer. When the browser has agreed to keep the app's storage, it reads that Works are kept in this browser and to export one to keep a copy elsewhere. Otherwise it reads that Works are saved in this browser only, that the browser may clear them when space runs low, and to export to keep a copy
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-15 (US-02) — cross-context

> **Given** an export is running, or a replacement of the Work is waiting for the Editor's confirmation
> **When** the Editor chooses a Work in the Gallery
> **Then** choosing a Work is unavailable, with a hint to wait for the export or to answer the confirmation first, and the open Work does not change
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write every gallery catalog text above as functions taking `{name}` / `{n}` — `src/features/gallery/messages.ts`; tests compare with strings written in the test — `src/features/gallery/messages.test.ts`
- [ ] `useGallery` setup store: `refresh()` reads `listWorks`, maps names with `entryName`, labels with `touchedLabel` (injected clock), status `open` when `id === editor.openWorkId`, `damaged` from the list flag; reads `isPersisted()` each time; unavailable reason when `!editor.galleryAvailable` — `src/features/gallery/store.ts`
- [ ] `choose(id)`: open entry → `close()`; else `editor.reopenWork(id)`; map `refused` to the AC-15 hint, `damaged` to the failure notice with action `{ label: 'Delete…', run: () => requestDelete(id) }` and mark the entry damaged; `replaced` → `close()`
- [ ] `requestDelete` / `confirmDelete` / `cancelDelete`: refuse the open Work with the AC-07 hint; on confirm `deleteWork` then `refresh()`, or the could-not-delete notice
- [ ] Public `index.ts` exports the store and (later) components — `src/features/gallery/index.ts`
- [ ] Store tests on fake-indexeddb with the real editor store — `src/features/gallery/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| two Works with the same `touchedAt` | order stable, id breaks the tie (from `listWorks`) |
| Source name empty / very long / markup | "Untitled" / kept whole (CSS ellipsis in T16) / stored as text, never HTML |
| thumbnail missing or not a PNG | entry `damaged`; others normal |
| `persisted()` missing | not-persisted wording |
| open Work never stored (first save failed) | no entry marked Open; count excludes it (SCR-03 `open Work not stored`) |
| delete fails | entry and count unchanged; failure notice |
| unavailable for each reason (refused, held, newer version) | the matching body; no list, count or line |
| `refresh()` twice | earlier object URLs revoked |

## Definition of Done

- [ ] `refresh()` lists entries newest first with name, touched label, Open and Damaged status and the count, reads `persisted()` on every refresh, and reports the unavailable reason
- [ ] `choose()` maps refused-while-exporting/confirming to the AC-15 hint and a damaged outcome to the failure notice with a "Delete…" action
- [ ] `delete()` removes the Work and refreshes, or keeps it and raises the could-not-delete notice
- [ ] messages.test compares every catalog text with the strings written in the test
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
