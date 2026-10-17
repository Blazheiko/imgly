---
id: T12
title: "Restyle the Gallery header and dialogs: places count with a meter bar, Storage line as an info note, Close with x, danger Delete confirmation"
layer: "ui"
deps: ["T3"]
blocks: ["T13"]
acs: ["AC-09", "AC-10", "AC-12"]
files_hint: ["src/features/gallery/components/GalleryList.vue", "src/features/gallery/components/GalleryList.test.ts", "src/features/gallery/components/DeleteWorkDialog.vue", "src/features/gallery/components/DeleteWorkDialog.test.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 52 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Restyle the Gallery header, Storage note and Delete confirmation

## Place in the sequence

- **Blocked by:** T3 — BaseButton · **Blocks:** T13 — Work card (shares `GalleryList.vue`; T14 waits on T12 through T13) · **Wave:** 3.
- **Lane:** shares `GalleryList.vue` with T13 — serialized before it.

## Why (user story)

> **As an** Editor
> **I want** the Gallery to show how many of its places are used and which Works are open or damaged
> **So that** I understand what is kept and what may be evicted
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task delivers the header count + bar and the Storage note (US-05), and the destructive confirmation (US-07: «deleting a Work to look clearly destructive»).

## Inlined context

> - **Gallery header** (`GalleryList`): "Gallery" (`--font-size-xl`), then on the right the count "{n} of 20 places used" (wording unchanged) above a 4 px × 120 px bar. The bar is a native `<meter min="0" max="20">`, `aria-hidden` because the visible count already says it, with its fill in `--color-accent-text` (dark) or `--color-accent` (light) on a `--color-surface-sunken` or `--color-border` track (AC-09).
> - **Storage note:** the existing Storage line text, unchanged, inside a `--radius-md` note on `--color-accent-subtle` with the `info` icon (`sm`, `--color-accent-text`) before it (AC-10).
>
> | empty | Count "0 of 20 places used" with an empty bar, the Storage note, then "Works you open will appear here." and `BaseButton` secondary "Open image" with `image-plus`, as today |
> | unavailable | The title and reason show in a `--radius-md` note on `--color-surface-raised` with no icon. No count, no bar, no Storage note |
>
> — `screens.md §SCR-02, Gallery header + Storage note + rows, abridged` · full text: [screens.md](../screens.md)

> The header's right end shows the `BaseButton` ghost "Close" with the `x` icon after the count.
>
> — `screens.md §SCR-03, intro, abridged` · full text: [screens.md](../screens.md)

> Actions, right-aligned: `BaseButton` secondary "Cancel" with `x` (initial focus, `data-initial-focus` as today), then `BaseButton` **danger** "Delete" with `trash-2` (AC-12).
> | cancelled | Nothing is deleted, and focus returns to that card's Delete |
> | error | The delete failed (`STORAGE_FAILED`). The dialog closes, the card stays, and the existing failure notice shows |
>
> — `screens.md §SCR-05, intro + rows, abridged` · full text: [screens.md](../screens.md)

Today: `GalleryList.vue` has props `showClose`, `showOpenImage`, `titleId`; the "Close" button at :32 and the empty-state "Open image" at :61.

> **Hard rule:** Accessible names and keyboard order of existing actions 100% unchanged; every existing unit and end-to-end test passes without any edit, except the deliberate pins listed in spec §6 (here: `DeleteWorkDialog.test.ts`'s `.base-button--danger` selector).
>
> — `spec.md §6, NFR row «Accessible names», abridged` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-02, SCR-03, SCR-05. Do not guess.

## Data delta

No DB changes. The count reads the existing entries (Damaged ones included).

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-09 — domain invariant

> **Given** the Gallery holds some Works, one of which is a Damaged Work
> **When** the Editor looks at the Gallery's header and cards
> **Then** the header shows how many of the 20 places are used as a count and a thin bar, the Damaged Work still counts toward those places, and its card shows a "damaged" symbol and border instead of a thumbnail
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

(This task: the count and the bar. T13: the damaged card.)

### AC-10 — happy path

> **Given** the Gallery is shown
> **When** the Editor reads the Storage line
> **Then** it appears as a highlighted note with an information icon and keeps its current wording, so the Editor still learns that Works are kept only in this browser and that only an Export is a durable copy
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — happy path

> **Given** the Editor has asked to delete a Work that is not open
> **When** the confirmation appears
> **Then** the button that deletes is styled as destructive, in the danger colour with a bin icon, the safe choice to cancel keeps the initial focus, and confirming deletes the Work as it does today
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Header: title, count, `<meter aria-hidden min=0 max=20 :value>`; Close ghost with `x` — `GalleryList.vue`
- [ ] Storage line in an `--color-accent-subtle` note with `<Icon name="info">`; unavailable note without icon; empty-state Open image with `image-plus` — `GalleryList.vue`
- [ ] Cancel secondary `x` (keeps `data-initial-focus`), Delete `variant="danger"` `icon="trash-2"` — `DeleteWorkDialog.vue`
- [ ] Added cases: meter value = entries incl. damaged; meter `aria-hidden`; Storage text unchanged next to an `info` svg; Delete has danger class + icon; Cancel focused first — `GalleryList.test.ts`, `DeleteWorkDialog.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| 0 Works | "0 of 20 places used", empty bar, note, empty-state Open image |
| Gallery unavailable | Note without icon; no count, bar or Storage note |
| Delete fails | Dialog closes, card stays, existing failure notice |

## Definition of Done

- [ ] Added Vitest cases pass; existing gallery tests pass unedited
- [ ] every Hard Rule of spec §6 (names, wording unchanged) still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
