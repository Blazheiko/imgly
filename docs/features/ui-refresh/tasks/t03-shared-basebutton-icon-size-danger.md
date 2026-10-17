---
id: T3
title: "Widen BaseButton: optional icon, size sm|md|lg, danger variant, busy spinner slot and the neutral disabled/unavailable look"
layer: "ui"
deps: ["T1", "T2"]
blocks: ["T4", "T7", "T8", "T9", "T10", "T11", "T12", "T13", "T15"]
acs: ["AC-03", "AC-12", "AC-13", "AC-14"]
files_hint: ["src/shared/ui/BaseButton.vue", "src/shared/ui/BaseButton.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 62 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Widen BaseButton

## Place in the sequence

- **Blocked by:** T1 — tokens v2, T2 — icon registry · **Blocks:** T4, T7–T13, T15 (every task that renders a button) · **Wave:** 2, the hub of the graph.
- **Lane:** own lane.

## Why (user story)

> **As an** Editor
> **I want** every action button to carry an icon in one consistent style
> **So that** I find the action I need quickly and the top bar reads as one toolbar
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task gives the one shared button the icon, sizes, destructive style and states every feature then adopts call by call.

## Inlined context

> **Chosen:** Extend `BaseButton` with optional `icon` (a registry name), `size` (`sm` | `md` | `lg`, default `md`) and a `danger` variant; an icon-only button is a `BaseButton` with `icon`, no label, an `aria-label` and a `title`. Every existing call compiles and renders as before, the icon is `aria-hidden` so names cannot change. A nameless icon-only button is caught by a component test that every icon-only `BaseButton` has an `aria-label`.
>
> — `adr/0003, Option 1 + Decision outcome, abridged` · full text: [ADR-0003](../adr/0003-extend-basebutton-and-toast-with-optional-icon-size-and-danger-instead-of-new-button-primitives.md)

> | Variant | Default | Hover | Active | Disabled or unavailable |
> |---|---|---|---|---|
> | `primary` | `--color-accent-gradient`, white label and icon, 1 px top highlight, `--shadow-sm` | `--color-accent-hover` | `--color-accent-active` | `--color-surface-sunken`, `--color-text-muted`, no shadow, no gradient |
> | `secondary` | `--color-surface-raised`, 1 px `--color-border-strong`, `--color-text` | `--color-accent-subtle` background | border `--color-accent-text` | same neutral look |
> | `ghost` | transparent, `currentColor` (on the top bar `--color-on-titlebar`) | `--color-accent-subtle` | `--color-accent-subtle`, border `--color-accent-text` | same neutral look, transparent background |
> | `danger` (NEW variant) | `--color-danger-solid`, white | `--color-danger-solid-hover` | `--color-danger-solid-hover` | same neutral look |
> | `pressed` (any variant) | `--color-accent-subtle` background, 1 px `--color-accent-text` border | unchanged | unchanged | — |
>
> - **Sizes:** `sm` 28 px, `md` 36 px (default), `lg` 44 px (`--control-height-*`). The icon is `--icon-size-sm` (16 px) in `sm` and `md` and `--icon-size-md` (20 px) in `lg`.
> - **Icon with label:** icon first, then `--space-2`, then the label. **Icon-only:** a square of the size's height with the icon centred, an `aria-label` and a `title`.
> - **Busy:** a `Spinner` of the icon's size takes the icon's place, so the button still shows one symbol. Its label is the existing busy label ("Exporting…", "Reloading…").
> - **"Unavailable" (`aria-disabled`, focusable, with a hint)** looks the same as `disabled`, replacing today's 0.45 opacity everywhere it is used (AC-13).
> - **Focus:** `outline: 2px solid var(--color-focus-ring); outline-offset: 2px` on `:focus-visible` in every variant and state, so the ring is drawn on the surrounding surface, never on the button's own colour (AC-13).
> - **Motion:** colour transitions `--duration-fast` (120 ms). Under `prefers-reduced-motion: reduce` every duration is 0 and every transform is none (AC-14).
>
> — `screens.md §Look decisions, Buttons, verbatim` · full text: [screens.md](../screens.md)

Today's `BaseButton` (`src/shared/ui/BaseButton.vue`) has `variant`, `type`, `disabled`, `pressed`, a default slot, hard-coded `120ms` transitions and `:disabled { opacity: 0.45 }`; about 40 uses in 9 features.

> **Hard rule:** Accessible names and keyboard order of existing actions 100% unchanged; every existing unit and end-to-end test passes without any edit, except the one app-shell test that pins Install app after Export.
>
> — `spec.md §6, NFR row «Accessible names», abridged` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) §Buttons and [ADR-0003](../adr/0003-extend-basebutton-and-toast-with-optional-icon-size-and-danger-instead-of-new-button-primitives.md). Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. `BaseButton` props become `variant?: 'primary' | 'secondary' | 'ghost' | 'danger'`, `size?: 'sm' | 'md' | 'lg'` (default `md`), `icon?: IconName`, `busy?: boolean` (Spinner replaces the icon), plus the existing `type`, `disabled`, `pressed`. All additive.

## Acceptance criteria

### AC-03 — domain invariant

> **Given** an action button shows an icon; only Undo, Redo, a card's Delete and the buttons that already have no visible label today (Rotate left, Rotate right, Flip horizontal and Flip vertical in Crop and rotate, and Zoom out and Zoom in, whose "−" and "+" become icons) show an icon without a visible label, and every other action button shows its icon next to its label (patched by `screens` on 2026-10-16)
> **When** a screen reader or the keyboard reaches the button
> **Then** the button is announced by the same name as before this feature, the icon itself is not announced, each icon-only button has a tooltip naming its action (Undo and Redo also name their shortcut), and the keyboard order of the top bar is unchanged except that Install app now comes before Export
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — happy path

> **Given** the Editor has asked to delete a Work that is not open
> **When** the confirmation appears
> **Then** the button that deletes is styled as destructive, in the danger colour with a bin icon, the safe choice to cancel keeps the initial focus, and confirming deletes the Work as it does today
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

(This task supplies the `danger` variant; T12 applies it.)

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

- [ ] Props `icon`, `size`, `busy`, variant `danger`; render `<Spinner>` when `busy` else `<Icon>` before the slot — `src/shared/ui/BaseButton.vue`
- [ ] Icon-only layout (no slot content → square of `--control-height-*`) — `BaseButton.vue`
- [ ] Variant styles per the table; neutral look for `:disabled` **and** `[aria-disabled='true']`; remove `opacity: 0.45`; transitions from `--duration-fast` — `BaseButton.vue`
- [ ] Tests: existing label-only call renders identical text and name; `icon` renders an `aria-hidden` svg before the label; `busy` swaps the icon for the Spinner; `size` sets the class; `danger` class; an icon-only usage without `aria-label` is flagged (dev warning or test helper) — `src/shared/ui/BaseButton.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Existing call with no new prop | Same name, same text, `md`, renders as before apart from the token look |
| `busy` and no `icon` | Spinner shown in the icon slot; one symbol |
| `aria-disabled="true"` and focusable | Neutral look, stays focusable, click still reaches the feature (which shows its hint) |
| `pressed` + `disabled` | Neutral disabled look wins |
| Reduced motion | No transition time; colours still change |

## Definition of Done

- [ ] `BaseButton.test.ts` covers icon, icon-only, size, danger, busy, neutral disabled/unavailable
- [ ] Full existing unit suite passes unedited (names unchanged)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
