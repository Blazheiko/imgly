---
id: T16
title: "Build GalleryEntry, GalleryList and DeleteWorkDialog: thumbnails, names, touched labels, Open and Damaged looks, count, storage line, empty and unavailable states, and the delete confirmation"
layer: "ui"
deps: ["T9", "T15"]
blocks: ["T17"]
acs: ["AC-03", "AC-05", "AC-06", "AC-07", "AC-08", "AC-12", "AC-13"]
files_hint: ["src/features/gallery/components/GalleryEntry.vue", "src/features/gallery/components/GalleryList.vue", "src/features/gallery/components/DeleteWorkDialog.vue", "src/features/gallery/components/GalleryList.test.ts", "src/features/gallery/components/DeleteWorkDialog.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 86 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T16 — Build GalleryEntry, GalleryList and DeleteWorkDialog

## Place in the sequence

- **Blocked by:** T9 — Extend Toast and useNotices, add the `--gallery-tile-size` token · T15 — Add the gallery feature's store and messages.
- **Blocks:** T17 — Mount the Gallery in both homes.
- **Wave:** 7.
- **Lane:** own lane.

## Why (user story)

> **As an** Editor
> **I want** to see my recent Works as thumbnails with their names and when I last opened or changed them, newest first
> **So that** I recognise the one I want at a glance
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It renders the list both homes share and the delete confirmation.

## Inlined context

> - **Gallery list** (`GalleryList`, shared by SCR-01 and SCR-03): a header row and a grid.
>   - **Header:** heading "Gallery" (`--font-size-lg`), and on the right the count "{n} of 20 places used" (`--font-size-sm`, `--color-text-muted`). On SCR-03 the `BaseButton` ghost "Close" sits at the far right of the header. Under the header is the **storage line** (`--font-size-sm`, `--color-text-muted`, AC-13).
>   - **Grid:** entries newest first […], in columns of `--gallery-tile-size` (new token, 160px) with `--space-4` gaps, as many columns as fit.
>   - **Entry** (`GalleryEntry`): a native `<button>` holding a 160 × 160 thumbnail box (`--color-canvas-surround` background, `--radius-md`, the thumbnail fitted inside it with `object-fit: contain`), then the name on one line (ellipsis, the full name as its `title`), then the status line in `--color-text-muted`: the touched label, or "Open", or "Damaged". Under the button is `BaseButton` ghost "Delete". The entry button's accessible name is "{name}, {status}". The Delete button's is "Delete “{name}”". […] The open Work's entry has a 2px `--color-accent` border on its thumbnail box.
>
> — `screens.md §Shell changes, Gallery list bullet, abridged` · full text: [screens.md](../screens.md)

> | listing | […] No spinner and no skeleton (canon §Loading) […]. Until a thumbnail paints, its box is the empty `--color-canvas-surround` square |
> | empty | No Work stored […]. Plain text "Works you open will appear here." and the same "Open image" action, plus the count "0 of 20 places used" and the storage line |
> | damaged entry | […] The box shows "Can't be read" (`--font-size-xs`, `--color-text-muted`), the name is the stored Source name if it is text, else "Untitled", and the status is "Damaged". It stays chooseable and deletable. Every other entry lists normally |
> | unavailable | […] The Gallery section shows a title and the reason instead of the grid, the count and the storage line. […] |
>
> — `screens.md §SCR-01, rows listing, empty, damaged entry, unavailable, abridged` · full text: [screens.md](../screens.md)

> | delete unavailable | "Delete" on the "Open" entry (Flow 4, AC-07). It is `aria-disabled` with the hint as its description, and activating it shows the hint as a `Toast` `info` |
> | empty | Nothing is stored, which only happens with `open Work not stored`. As SCR-01 `empty`, without its "Open image" button […] |
>
> — `screens.md §SCR-03, rows delete unavailable + empty, abridged` · full text: [screens.md](../screens.md)

> | default | "Delete" on an entry that is not open, in SCR-01 or SCR-03, or "Delete…" on the damaged-Work notice (Flow 4, AC-06, AC-08). Modal over the screen it came from. Focus is trapped and starts on **Cancel**. The name is the Source name, or "Untitled" | `DeleteWorkDialog` (`Dialog`, `role="alertdialog"`): title "Delete “{name}”?", body, `BaseButton` secondary "Cancel" + `BaseButton` primary "Delete" |
> | cancel | "Cancel", `Esc` or a backdrop click | → the screen it came from, the Work unchanged, focus back on its "Delete" |
>
> — `screens.md §SCR-04, rows default + cancel, abridged` · full text: [screens.md](../screens.md)

> After a delete, focus moves to the next entry, else the previous one, else the empty-state "Open image".
>
> — `screens.md §Keyboard, focus paragraph, abridged` · full text: [screens.md](../screens.md)

> | Resource lifetime | […] Thumbnail object URLs are revoked when the list unmounts |
>
> — `sad.md §8, Resource lifetime row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** plain CSS with `<style scoped>`; every colour, spacing value and font comes from `var(--…)` in `tokens.css`; reuse `src/shared/ui/` primitives (`BaseButton`, `Dialog`). `GalleryEntry`, `GalleryList` and `DeleteWorkDialog` are feature composites, not registered in the design system.
>
> — `CLAUDE.md §Conventions Styling + screens.md §New components, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [screens.md](../screens.md)

All texts come from T15's `src/features/gallery/messages.ts` (`screens.md` §Message catalog).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. Props/emits for T17 (breakdown-time choice): `GalleryList` props `{ showClose: boolean; showOpenImage: boolean }`, emits `close`, `open-image`; it reads `useGallery()` (T15). `DeleteWorkDialog` reads `pendingDelete` and calls `confirmDelete()` / `cancelDelete()`.

## Acceptance criteria

### AC-03 (US-03) — happy path

> **Given** the Gallery holds several Works, one of which is open
> **When** the Editor chooses "Gallery" in the top bar
> **Then** the Gallery lists every stored Work, most recently opened or changed first. Each entry shows a thumbnail of the Work with all its edits, its Source name ("Untitled" when the Work has none) and when it was last opened or changed: "Just now" under a minute, "N minutes ago" under an hour, "N hours ago" under a day, and otherwise the date in the browser's language. The open Work's entry is marked "Open", and the Gallery shows how many of the 20 places are used. The Gallery can be closed again without changing anything
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-05 (US-07) — happy path

> **Given** a first visit, so the Gallery is empty
> **When** the start screen appears
> **Then** next to the "Open image" drop zone, the Gallery shows plain text saying that Works the Editor opens will appear here, with the same "Open image" action. After the Portfolio reviewer opens an image, applies a change and reloads the page, the start screen lists that Work, and choosing it reopens it with the change. Nothing reopens on its own after a reload
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

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

## Checklist

- [ ] `GalleryEntry`: native button (thumbnail box, name with `title`, status), ghost "Delete" with `aria-disabled` + hint description for the open entry, open/damaged looks, accessible names — `src/features/gallery/components/GalleryEntry.vue`
- [ ] `GalleryList`: header (heading, count, optional Close), storage line, grid with `--gallery-tile-size`, empty state (with or without "Open image"), unavailable title + reason; revoke object URLs on unmount — `src/features/gallery/components/GalleryList.vue`
- [ ] `DeleteWorkDialog` from `Dialog` + two `BaseButton`s, focus on Cancel, focus back to the entry's Delete on cancel, next/previous/empty "Open image" after delete — `src/features/gallery/components/DeleteWorkDialog.vue`
- [ ] Component tests with real stores on fake-indexeddb, one case per state row above — `src/features/gallery/components/GalleryList.test.ts`, `src/features/gallery/components/DeleteWorkDialog.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Source name `<img onerror>` | rendered as text only |
| very long Source name | one line with ellipsis; full name in `title` |
| damaged entry | box "Can't be read", status "Damaged", still chooseable and deletable |
| thumbnail not painted yet | empty `--color-canvas-surround` box, no spinner |
| Delete on the open entry activated | `info` hint toast, no dialog |
| last entry deleted | `empty` state; focus to "Open image" (SCR-01) |
| unavailable | no grid, count or storage line; the reason body for that reason |
| list unmounts | every created object URL revoked (count create vs revoke) |

## Definition of Done

- [ ] component tests render every SCR-01/SCR-03 list state (default, listing, empty, storage line, damaged entry, unavailable for each reason, open entry with accent border and "Open")
- [ ] SCR-04: the title names the Work or "Untitled", the cannot-be-brought-back text shows, focus starts on Cancel, and Cancel/Esc/backdrop keep the Work and return focus to its Delete
- [ ] Delete on the open entry is `aria-disabled` with the AC-07 hint and opens no dialog; entry and Delete accessible names match
- [ ] object URLs are revoked on unmount; a markup Source name renders as text
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
