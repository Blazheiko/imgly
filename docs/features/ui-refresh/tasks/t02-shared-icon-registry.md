---
id: T2
title: "Add the typed Lucide icon registry in src/shared/icons and the decorative Icon primitive"
layer: "ui"
deps: []
blocks: ["T3", "T5", "T15"]
acs: ["AC-02", "AC-03"]
files_hint: ["src/shared/icons/", "src/shared/ui/Icon.vue", "src/shared/ui/Icon.test.ts", "src/shared/ui/index.ts", "src/shared/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 43 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Add the typed icon registry and the Icon primitive

## Place in the sequence

- **Blocked by:** — · **Blocks:** T3 — BaseButton, T5 — AppLogo and brand icons, T15 — design-system record · **Wave:** 1, in parallel with T1.
- **Lane:** shares `src/shared/ui/index.ts` with T5 — serialized.

## Why (user story)

> **As an** Editor
> **I want** every action button to carry an icon in one consistent style
> **So that** I find the action I need quickly and the top bar reads as one toolbar
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task provides the one icon set every later task draws from; it puts **every** icon of the map in the registry up front so no later task has to touch it.

## Inlined context

> **Chosen:** Option 1. **Typed registry plus an `Icon` primitive** — `src/shared/icons/index.ts` exports a typed `name → path data` map with `LICENSE-lucide` beside it; `src/shared/ui/Icon.vue` renders `<svg aria-hidden focusable="false">` in `currentColor`, sized by `--icon-size-*`. Icon names are checked by TypeScript, so a missing icon fails `pnpm typecheck` instead of rendering blank.
>
> — `adr/0001, Decision outcome + Option 1, abridged` · full text: [ADR-0001](../adr/0001-copy-lucide-paths-into-a-typed-shared-icon-registry-rendered-by-an-icon-primitive.md)

> Lucide names on a 24 × 24 grid, stroke 1.75, round caps and joins, `currentColor`.
>
> Icons in the map: `layout-grid`, `image-plus`, `undo-2`, `redo-2`, `crop`, `sliders-horizontal`, `pen-line`, `monitor-down`, `download`, `save`, `x`, `trash-2`, `check`, `rotate-ccw`, `rotate-ccw-square`, `rotate-cw-square`, `flip-horizontal-2`, `flip-vertical-2`, `wand-sparkles`, `eye`, `eraser`, `replace`, `refresh-cw`, `zoom-out`, `zoom-in`, `scan`, `maximize`, `image-off`, `info`.
>
> — `screens.md §Icon map, abridged (Icon column, 29 names)` · full text: [screens.md](../screens.md)

> | Icons | One typed registry and the `Icon` primitive; icons are decoration (`aria-hidden`, `focusable="false"`), so a button's accessible name comes only from its label or `aria-label` | `src/shared/icons/`, `src/shared/ui/Icon.vue` |
> | Third-party code | Lucide paths copied with their ISC notice kept beside them; no runtime package | `src/shared/icons/LICENSE-lucide` |
>
> — `sad.md §8, rows Icons + Third-party code, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/shared/` may import only `core` types — never `features`, `infra`, `render`. New third-party code downloaded at runtime: 0 packages.
>
> — `CLAUDE.md §Module boundaries` + `spec.md §6, NFR row «New third-party code», abridged`

**Fallback:** insufficient or contradicted by the code → read [ADR-0001](../adr/0001-copy-lucide-paths-into-a-typed-shared-icon-registry-rendered-by-an-icon-primitive.md) and [screens.md](../screens.md) §Icon map. Do not guess path data: copy it from Lucide's published SVGs.

## Data delta

No DB changes.

## API contract

Internal — no API surface. Exports: `icons` (readonly map), `type IconName = keyof typeof icons`, and `Icon` (`props: { name: IconName; size?: 'sm' | 'md' | 'lg' }`, default `sm`) from `@/shared`.

## Acceptance criteria

### AC-02 — happy path

> **Given** the Editor is on any screen of the app
> **When** they look at any action button, that is, any button that performs an action anywhere in the app: the top bar, the Gallery and its cards, the notices (Dismiss, Reload, "Delete…"), every tool panel (such as Apply, Cancel, Auto, Compare and Clear), the export panel, every confirmation dialog (both its cancel and its confirming button) and the full-screen messages (such as "Reload page"); choice controls such as a colour swatch, a format option or a proportion option are not action buttons
> **Then** each one shows an icon from one set drawn in one style and size, and the top bar shows, left to right and in the same keyboard order, four groups separated by thin dividers: Gallery and Open image; Undo and Redo; Crop and rotate, Adjust and Draw; Install app and Export, with Export last
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

(This task delivers «one set drawn in one style and size»; the buttons adopt it in T7–T13.)

### AC-03 — domain invariant

> **Given** an action button shows an icon; only Undo, Redo, a card's Delete and the buttons that already have no visible label today (Rotate left, Rotate right, Flip horizontal and Flip vertical in Crop and rotate, and Zoom out and Zoom in, whose "−" and "+" become icons) show an icon without a visible label, and every other action button shows its icon next to its label (patched by `screens` on 2026-10-16)
> **When** a screen reader or the keyboard reaches the button
> **Then** the button is announced by the same name as before this feature, the icon itself is not announced, each icon-only button has a tooltip naming its action (Undo and Redo also name their shortcut), and the keyboard order of the top bar is unchanged except that Install app now comes before Export
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

(This task delivers «the icon itself is not announced».)

## Checklist

- [ ] Copy the 29 Lucide icons' inner SVG elements into a typed `as const` map — `src/shared/icons/index.ts`
- [ ] Add Lucide's ISC licence text — `src/shared/icons/LICENSE-lucide`
- [ ] `Icon.vue`: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">`, width/height from `var(--icon-size-*)` — `src/shared/ui/Icon.vue`
- [ ] Export `Icon`, `IconName` — `src/shared/ui/index.ts`, `src/shared/index.ts`
- [ ] Tests: every registry name renders a non-empty `<svg>` with `aria-hidden="true"` and `focusable="false"`; a parent button's accessible name is unaffected — `src/shared/ui/Icon.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Unknown name | Compile error in `pnpm typecheck`, never a blank icon |
| Size not given | `sm` (16 px) |
| Icon inside a button with a label | The button's text content and accessible name are the label alone |

## Definition of Done

- [ ] `Icon.test.ts` proves all 29 names render, each `aria-hidden` and `focusable="false"`
- [ ] No runtime dependency added to `package.json`; `LICENSE-lucide` present
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
