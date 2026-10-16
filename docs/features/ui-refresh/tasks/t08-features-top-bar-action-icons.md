---
id: T8
title: "Give every top-bar action its icon (Gallery, Undo, Redo, Crop and rotate, Adjust, Draw, Install app, Export) and drop the inline SVGs and 0.45 opacity"
layer: "ui"
deps: ["T3"]
blocks: ["T14"]
acs: ["AC-02", "AC-03", "AC-13"]
files_hint: ["src/features/gallery/components/GalleryAction.vue", "src/features/undo-redo/UndoRedoActions.vue", "src/features/crop-rotate/CropRotateAction.vue", "src/features/adjust/AdjustAction.vue", "src/features/draw/DrawAction.vue", "src/features/pwa-install-update/InstallAction.vue", "src/features/export/ExportAction.vue"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 51 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Give every top-bar action its icon

## Place in the sequence

- **Blocked by:** T3 — BaseButton · **Blocks:** T14 — e2e checks · **Wave:** 3, in parallel with T4, T9, T11, T12.
- **Lane:** own lane (each action component is touched by no other task; co-located tests may gain cases).

## Why (user story)

> **As an** Editor
> **I want** every action button to carry an icon in one consistent style
> **So that** I find the action I need quickly and the top bar reads as one toolbar
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task puts the registry icons on the seven feature-owned top-bar actions.

## Inlined context

> | Gallery | SCR-01 | `layout-grid` | yes |
> | Undo / Redo | SCR-01 | `undo-2` / `redo-2` | no (tooltip names the shortcut, as today) |
> | Crop and rotate / Adjust / Draw | SCR-01 | `crop` / `sliders-horizontal` / `pen-line` | yes |
> | Install app | SCR-01 | `monitor-down` | yes |
> | Export (top bar and export panel) | SCR-01, SCR-07 | `download` | yes |
>
> — `screens.md §Icon map, rows for SCR-01, verbatim` · full text: [screens.md](../screens.md)

> Every top-bar button is `md`. Export is `primary`, the others are `ghost` in `--color-on-titlebar`, and the open tool is `pressed`.
> | tool open | Its button is `pressed`. Gallery, Export and the other tools are unavailable in the neutral look and keep their hints, as today |
> | exporting | Export shows "Exporting…" with a `Spinner` in place of its icon. Gallery and Open image are `disabled`, in the neutral look |
>
> — `screens.md §SCR-01, abridged` · full text: [screens.md](../screens.md)

> **"Unavailable" (`aria-disabled`, focusable, with a hint)** looks the same as `disabled`, replacing today's 0.45 opacity everywhere it is used (AC-13).
>
> — `screens.md §Buttons, verbatim` · full text: [screens.md](../screens.md)

Today: inline `<svg>` in `UndoRedoActions.vue` (2), `CropRotateAction.vue`, `AdjustAction.vue`, `DrawAction.vue`; local `opacity: 0.45` rules for the unavailable state in `GalleryAction.vue:42`, `UndoRedoActions.vue:124`, `CropRotateAction.vue:79`, `AdjustAction.vue:79`, `DrawAction.vue:80`, `ExportAction.vue:91`. `BaseButton` (after T3) styles `[aria-disabled='true']` itself.

> **Hard rule:** accessible names, `title`s, shortcuts, enabled rules and hints 100% unchanged; existing tests pass unedited.
>
> — `spec.md §6, NFR row «Accessible names», abridged` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) §Icon map and SCR-01. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — happy path

> **Given** the Editor is on any screen of the app
> **When** they look at any action button, that is, any button that performs an action anywhere in the app: the top bar, the Gallery and its cards, the notices (Dismiss, Reload, "Delete…"), every tool panel (such as Apply, Cancel, Auto, Compare and Clear), the export panel, every confirmation dialog (both its cancel and its confirming button) and the full-screen messages (such as "Reload page"); choice controls such as a colour swatch, a format option or a proportion option are not action buttons
> **Then** each one shows an icon from one set drawn in one style and size, and the top bar shows, left to right and in the same keyboard order, four groups separated by thin dividers: Gallery and Open image; Undo and Redo; Crop and rotate, Adjust and Draw; Install app and Export, with Export last
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — domain invariant

> **Given** an action button shows an icon; only Undo, Redo, a card's Delete and the buttons that already have no visible label today (Rotate left, Rotate right, Flip horizontal and Flip vertical in Crop and rotate, and Zoom out and Zoom in, whose "−" and "+" become icons) show an icon without a visible label, and every other action button shows its icon next to its label (patched by `screens` on 2026-10-16)
> **When** a screen reader or the keyboard reaches the button
> **Then** the button is announced by the same name as before this feature, the icon itself is not announced, each icon-only button has a tooltip naming its action (Undo and Redo also name their shortcut), and the keyboard order of the top bar is unchanged except that Install app now comes before Export
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — domain invariant

> **Given** the restyled interface in either theme, including the brand-tinted top bar
> **When** the Editor reads any text or looks at any control and its focus
> **Then** every text and icon is readable against its background at the contrast stated in §6, keyboard focus is always visibly marked, and a disabled action such as Export with no image looks unavailable through a neutral background and muted text, never a pale, washed-out brand colour; disabled controls are exempt from the text contrast target, as in the accessibility guidelines
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Pass `icon` (and `variant="ghost"` / `size="md"` where needed) on each action; Export `primary` with `busy` while exporting — the seven files in `files_hint`
- [ ] Replace the inline `<svg>` in `UndoRedoActions`, `CropRotateAction`, `AdjustAction`, `DrawAction` with `icon` props; Undo/Redo stay icon-only with their `aria-label` and shortcut `title`
- [ ] Delete the local `opacity: 0.45` unavailable rules (BaseButton now owns the neutral look)
- [ ] Added test cases (in the existing co-located test files or a new `top-bar-icons.test.ts` next to App): each action shows exactly one `aria-hidden` svg and keeps its name

## Edge cases

| Case | Behaviour |
|---|---|
| Export while exporting | "Exporting…" + Spinner, no `download` icon |
| Undo with nothing to undo | Neutral unavailable look, tooltip with shortcut unchanged |
| Install not offered | `InstallAction` renders nothing (unchanged) |

## Definition of Done

- [ ] Added Vitest cases prove one icon per action and unchanged names
- [ ] `grep -n "<svg" src/features` finds no hand-drawn icons in these seven files; no `opacity: 0.45` left in them
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
