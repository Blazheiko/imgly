---
id: T1
title: "Extend tokens.css to tokens v2: brand, titlebar, semantic colours, sizes and motion that drops to 0 under reduced motion"
layer: "ui"
deps: []
blocks: ["T3", "T5", "T6", "T15"]
acs: ["AC-13", "AC-14"]
files_hint: ["src/shared/styles/tokens.css", "src/shared/styles/tokens.test.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 65 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Extend tokens.css to tokens v2

## Place in the sequence

- **Blocked by:** — · **Blocks:** T3 — BaseButton, T5 — AppLogo and brand icons, T6 — window colour, T15 — design-system record · **Wave:** 1, in parallel with T2 (no shared file).
- **Lane:** own lane (`tokens.css` is touched by no other task).

## Why (user story)

> **As an** Editor
> **I want** the restyled interface to keep visible focus, readable contrast and calm motion
> **So that** the new look does not make the app harder to use
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

Every later task colours, sizes and animates through these tokens; this task puts the measured values in one place and makes motion collapse to 0 under reduced motion.

## Inlined context

> | Token | Dark (`:root`) | Light | Used for |
> |---|---|---|---|
> | `--color-brand` | `#6D5BFF` | `#6D5BFF` | brand references |
> | `--color-brand-gradient` | `linear-gradient(135deg, #6D5BFF, #A35BFF)` | same | logo mark only |
> | `--color-accent` | `#6D5BFF` | `#6D5BFF` | primary background, open badge, bar fill on light |
> | `--color-accent-gradient` | `linear-gradient(135deg, #6D5BFF, #7B4FE8)` | same | primary button |
> | `--color-accent-hover` | `linear-gradient(135deg, #5E4CF2, #6C44DD)` | same | primary hover |
> | `--color-accent-active` | `#5240DB` | `#5240DB` | primary active |
> | `--color-accent-text` | `#8F82FF` | `#5847E6` | accent-coloured text and icons, bar fill on dark |
> | `--color-accent-subtle` | `#2B2550` | `#ECE9FF` | pressed tool, Storage note, open badge on light |
> | `--color-on-accent` | `#FFFFFF` | `#FFFFFF` | text and icons on accent and danger |
> | `--color-focus-ring` | `#A99CFF` | `#5847E6` | 2 px outline, 2 px offset |
> | `--color-titlebar` | `#15122A` | `#F4F2FF` | top bar, `theme-color`, manifest (`#15122A`) |
> | `--color-on-titlebar` | `#ECEAFF` | `#1E1A3D` | top-bar text, icons, wordmark |
> | `--color-on-titlebar-muted` | `#A8A2D8` | `#5A5480` | top-bar secondary text |
> | `--color-titlebar-border` | `#3A3361` | `#C9C3EE` | top-bar bottom edge, group dividers |
> | `--color-surface-sunken` | `#2A2D35` | `#E9EBEF` | disabled button background, bar track on dark |
> | `--color-border-strong` | `#8A909C` | `#8A93A3` | secondary-button border, drop-area dash |
> | `--color-danger` | `#FF6B6B` | `#C53030` | danger text and icons |
> | `--color-danger-solid` | `#D63A3A` | `#C53030` | danger button |
> | `--color-danger-solid-hover` | `#B83030` | `#A82828` | danger hover |
> | `--color-warning` | `#E8A93A` | `#9A6412` | damaged card border and symbol |
> | `--color-glass` | `#1B1838E6` | `#1B1838E6` | Delete button on the thumbnail |
> | `--color-scrim` | `#0E0F12B8` | `#E4E6EAB8` | `DropOverlay` background |
>
> The other tokens of `sad.md` §5 (radii, shadows, type scale, sizes) follow `design-proposal.md` §7 unchanged. Existing tokens not listed keep their values.
>
> — `screens.md §Look decisions, Token values, abridged (Measured column dropped)` · full text: [screens.md](../screens.md)

> **Sizes:** `sm` 28 px, `md` 36 px (default), `lg` 44 px (`--control-height-*`). The icon is `--icon-size-sm` (16 px) in `sm` and `md` and `--icon-size-md` (20 px) in `lg`.
> **Motion:** colour transitions `--duration-fast` (120 ms). The only movement is the card lift (SCR-02). Under `prefers-reduced-motion: reduce` every duration is 0 and every transform is none (AC-14).
>
> — `screens.md §Look decisions, Buttons, abridged` · full text: [screens.md](../screens.md)

Names also used downstream and not in the table: `--icon-size-lg` (drop area, damaged card), `--duration-base` (200 ms, card hover), `--shadow-sm|md|lg`, `--radius-md|lg|xl|full`, `--font-size-xs…2xl`, `--tracking-tight`, `--toolbar-size` (56 px). Values for these come from `design-proposal.md` §7.

> **Hard rule:** Hover and open motion ≤ 200 ms per transition; 0 ms of movement when reduced motion is requested — measured by a unit test of the motion values.
>
> — `spec.md §6, NFR table row «Hover and open motion», abridged` · full text: [spec.md](../spec.md)

> **Hard rule:** every colour, spacing, radius, shadow, size, duration and font is a `--…` custom property in `tokens.css`, set for dark in `:root` and overridden for light; components never hard-code one.
>
> — `sad.md §8, Design tokens, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) §Token values and [design-proposal.md](../design-proposal.md) §7, and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. New CSS custom properties only; existing token names keep working (`--control-height` stays as an alias of `--control-height-md` if components still use it).

## Acceptance criteria

### AC-13 — domain invariant

> **Given** the restyled interface in either theme, including the brand-tinted top bar
> **When** the Editor reads any text or looks at any control and its focus
> **Then** every text and icon is readable against its background at the contrast stated in §6, keyboard focus is always visibly marked, and a disabled action such as Export with no image looks unavailable through a neutral background and muted text, never a pale, washed-out brand colour; disabled controls are exempt from the text contrast target, as in the accessibility guidelines
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** the system asks apps to reduce motion
> **When** the Editor points at a card or a button, or a panel opens
> **Then** nothing lifts, zooms or slides; only colours change, and every action still works as without the setting
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add the colour tokens of the table to `:root` (dark) and the `@media (prefers-color-scheme: light)` block — `src/shared/styles/tokens.css`
- [ ] Add `--control-height-sm|md|lg`, `--icon-size-sm|md|lg`, `--duration-fast` (120 ms), `--duration-base` (200 ms), `--lift-card` (`-2px`), shadows, radii, type scale and tracking — `tokens.css`
- [ ] Under `@media (prefers-reduced-motion: reduce)` set every `--duration-*` to `0ms` and `--lift-card` to `0` — `tokens.css`
- [ ] Extend `tokens.test.ts`: every `--duration-*` ≤ 200 ms; each is `0ms` in the reduced-motion block; every colour token of the table is defined in both theme blocks — `src/shared/styles/tokens.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| A component still uses an old token (`--color-accent-hover` as a solid colour) | It keeps rendering; the gradient value works as `background`, and T3 moves BaseButton to it |
| `prefers-reduced-motion: reduce` | All durations 0, the card lift 0; colours still change |
| Light theme | Every token in the table has its light value; none falls back to the dark one |

## Definition of Done

- [ ] `tokens.test.ts` proves durations ≤ 200 ms, 0 under reduced motion, and both theme blocks define every v2 colour
- [ ] No component file changed; the existing visual is unchanged except where it already reads an updated token
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
