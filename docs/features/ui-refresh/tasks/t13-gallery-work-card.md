---
id: T13
title: "Restyle each Work as a card: 4:3 thumbnail over its blurred copy, ≤4 px lift, Delete revealed on hover/focus-within/touch, damaged and Open states"
layer: "ui"
deps: ["T3", "T12"]
blocks: ["T14"]
acs: ["AC-06", "AC-07", "AC-08", "AC-09", "AC-14"]
files_hint: ["src/features/gallery/components/GalleryEntry.vue", "src/features/gallery/components/GalleryEntry.test.ts", "src/features/gallery/components/GalleryList.vue"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 63 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Restyle each Work as a card

## Place in the sequence

- **Blocked by:** T3 — BaseButton, T12 — Gallery header (shares `GalleryList.vue`) · **Blocks:** T14 — e2e checks · **Wave:** 4.
- **Lane:** shares `GalleryList.vue` with T12 — serialized after it.

## Why (user story)

> **As an** Editor
> **I want** each Work in the Gallery shown as a card with its thumbnail, name, last-touched time and its own controls
> **So that** I can find a Work and reopen or delete it confidently
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task builds the card and its Delete control in every state.

## Inlined context

> - **Card grid:** `repeat(auto-fill, minmax(200px, 1fr))`, gap `--space-6`. Newest first, as today.
> - **Work card** (`GalleryEntry`, restyled): a `<li>` with `--color-surface-raised`, `--radius-lg`, a 1 px `--color-border-subtle` border and `--shadow-sm`. On top is a 4:3 thumbnail box (every card the same shape), clipped by the card's top radius: the thumbnail `img` (`object-fit: contain`) over a second copy of the same object URL, `object-fit: cover`, blurred 16 px, scaled 1.1 and darkened by `--color-scrim`. Below are the name (one line, ellipsis, `title` = full name) and the second line in `--color-text-muted` (touched label, "Damaged"). The choosing `<button>` covers the thumbnail and the text and keeps `data-entry-id` and its name "{name}, {status}" (AC-06).
> - **Card Delete:** the `BaseButton` ghost `sm` icon-only `trash-2`, keeping `data-delete-id`, its `aria-label` and the open-Work `aria-disabled` and `aria-describedby` hint, with `title` = its accessible name. It sits at the thumbnail's top-right corner, `--space-2` in, on `--color-glass` with `--radius-full`, and in DOM order **after** the choosing button, so the keyboard order is unchanged. It is hidden with `opacity: 0` (never `display: none` or `visibility: hidden`, so it stays in the keyboard order) and shown on the card's `:hover`, on `:focus-within` and always under `@media (hover: none)` (AC-06, AC-07).
>
> | listing | Until a thumbnail paints, its box is `--color-surface-sunken` |
> | damaged card | No thumbnail and no blur: the box is `--color-surface-sunken` with `image-off` (`lg`, `--color-warning`) above "Can't be read", and the card border is 1 px `--color-warning`. It is still counted in the header, chooseable and deletable |
> | hover | The card lifts by `translateY(-2px)` (≤ 4 px) with `--shadow-md`, its border turns `--color-accent-text`, and Delete appears. Transitions take `--duration-base` (200 ms) |
> | touch | `@media (hover: none)`. Delete is always visible and nothing lifts (AC-06) |
> | reduced motion | No lift, no zoom. Hover and focus change only colours, and Delete appears with no fade (AC-14) |
>
> — `screens.md §SCR-02, Card grid + Work card + Card Delete + rows, abridged` · full text: [screens.md](../screens.md)

> | open Work card | Its second line "Open" is a pill badge: `--radius-full`, `--font-size-xs`, `--font-weight-medium`, white on `--color-accent` (4.57:1), with no other marker. The card's name stays "{name}, Open" |
> | open Work Delete | It shows with the card on hover and focus, in the neutral unavailable look, stays focusable with its hint, deletes nothing, and the existing refusal shows |
>
> — `screens.md §SCR-03, rows, abridged` · full text: [screens.md](../screens.md)

Today: `GalleryEntry.vue:30-41` — one native `<button>` named "name, status", Delete a separate ghost `BaseButton` with `data-delete-id`; thumbnails are 320 px PNG object URLs (`gallery/store.ts:121`). `200px` in `minmax` trips `tokens.test.ts`'s px-width rule only for `width:` lines; prefer a token anyway.

> **Hard rule:** the card's blurred backdrop reuses the thumbnail object URL already in memory; no new stored field. Gallery with 20 Works: longest interface freeze ≤ 200 ms while pointing across the cards.
>
> — `sad.md §8, Persistence` + `spec.md §6, NFR row «Gallery with 20 Works», abridged`

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-02 (wireframes 02-a, 02-d) and SCR-03 (03-a). Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 — happy path

> **Given** the Gallery lists at least one Work
> **When** the Editor looks at the Gallery
> **Then** each Work is a raised card with rounded corners, and every card has the same shape; the thumbnail shows the whole image, never cropped, with any space around it filled by a blurred copy of the same image instead of empty bars; under it are the name (shortened with an ellipsis when too long) and the same second line as today (when it was last touched, or "Open" or "Damaged"); the card keeps the name a screen reader announces today; and pointing at a card lifts it by at most 4 px and reveals its Delete control as an icon on the thumbnail; on a touch screen, where nothing can point, the Delete control is always visible
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — happy path

> **Given** the Gallery lists a Work that is not open
> **When** the Editor chooses the card, or moves keyboard focus onto it and presses Enter
> **Then** the Work reopens exactly as it does today, and while keyboard focus is anywhere in the card, including on the Delete control itself and when focus returns to it after the delete confirmation is cancelled, the Delete control is visible without pointing at it; the Delete control is always in the keyboard order, so focus never lands on a hidden control
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant

> **Given** the Gallery lists the Work that is open in this tab, whose second line "Open" is shown as a badge
> **When** the Editor tries to delete it from its card
> **Then** the card's Delete control looks unavailable, the Work is not deleted, and the app tells the Editor that the open Work cannot be deleted, as it does today
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — domain invariant

> **Given** the Gallery holds some Works, one of which is a Damaged Work
> **When** the Editor looks at the Gallery's header and cards
> **Then** the header shows how many of the 20 places are used as a count and a thin bar, the Damaged Work still counts toward those places, and its card shows a "damaged" symbol and border instead of a thumbnail
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** the system asks apps to reduce motion
> **When** the Editor points at a card or a button, or a panel opens
> **Then** nothing lifts, zooms or slides; only colours change, and every action still works as without the setting
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Card markup: `<li>`, 4:3 box with blurred `cover` copy + `contain` img, name + second line; choosing button keeps `data-entry-id` and name — `GalleryEntry.vue`
- [ ] Delete: ghost `sm` icon-only `trash-2`, `title` = `aria-label`, glass, top-right, after the choosing button in DOM; `opacity: 0` → 1 on `:hover`, `:focus-within`, `(hover: none)` — `GalleryEntry.vue`
- [ ] Hover lift via `--lift-card` and `--duration-base`; damaged state (`image-off`, warning border); Open badge; open-Work Delete `aria-disabled` neutral look — `GalleryEntry.vue`
- [ ] Grid `repeat(auto-fill, minmax(…, 1fr))`, gap `--space-6` — `GalleryList.vue`
- [ ] Tests: name unchanged; Delete in DOM after the choose button, has `title`, never `display:none`; damaged card shows `image-off` and no img; Open badge; open-Work Delete `aria-disabled` and click pushes the existing refusal — `GalleryEntry.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Very long name | One line with ellipsis; `title` holds the full name |
| Portrait or panorama thumbnail | Whole image via `contain`, sides filled by the blurred copy |
| Focus returns to Delete after cancel | Delete visible (`:focus-within`) |
| Touch screen | Delete always visible, no lift |
| Reduced motion | No lift, Delete appears without fade |
| Open Work's Delete | Neutral unavailable look, refusal notice, nothing deleted |

## Definition of Done

- [ ] `GalleryEntry.test.ts` covers name, DOM order, reveal rule, damaged, Open badge, open-Work refusal
- [ ] Existing gallery unit and e2e tests pass unedited
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
