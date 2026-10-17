---
id: T9
title: "Give the crop-rotate, adjust and draw panels their action icons; rotate and flip move from inline SVGs to the registry"
layer: "ui"
deps: ["T3"]
blocks: ["T14"]
acs: ["AC-02", "AC-03"]
files_hint: ["src/features/crop-rotate/CropRotateControls.vue", "src/features/adjust/AdjustControls.vue", "src/features/draw/DrawControls.vue"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 48 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Give the tool panels their action icons

## Place in the sequence

- **Blocked by:** T3 — BaseButton · **Blocks:** T14 — e2e checks · **Wave:** 3.
- **Lane:** own lane.

## Why (user story)

> **As an** Editor
> **I want** every action button to carry an icon in one consistent style
> **So that** I find the action I need quickly and the top bar reads as one toolbar
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task covers the three tool panels' action rows.

## Inlined context

> Every surface keeps its layout, behaviour and states from its own feature's manifest. Each action button gains its icon from §Icon map, and every button takes the §Buttons look. The tool panels' action rows stay as they are: Reset (ghost) at the left, then Cancel (secondary, `x`) and Apply (primary, `check`) at the right.
>
> | crop-rotate panel | Rotate left and right and Flip horizontal and vertical are icon-only `ghost` with their `aria-label` and `title` (spec AC-03 as patched). Reset, Cancel and Apply have icons and labels | `SegmentedControl` (proportions, no icons) |
> | adjust panel | Auto (`wand-sparkles`), Compare (`eye`, `pressed` while held), Reset, Cancel and Apply |
> | adjust Auto unavailable | Auto can't run (adjust `autoAvailable` false). Neutral disabled look (AC-13) |
> | draw panel | Clear (`eraser`, ghost), Cancel and Apply. The brush and eraser options and the colour swatches are choice controls and get no icon |
>
> — `screens.md §SCR-07, intro + rows, abridged` · full text: [screens.md](../screens.md)

> | Cancel (every dialog and tool panel) | `x` | yes |
> | Apply | `check` | yes |
> | Reset | `rotate-ccw` | yes |
> | Rotate left / Rotate right | `rotate-ccw-square` / `rotate-cw-square` | no (as today) |
> | Flip horizontal / Flip vertical | `flip-horizontal-2` / `flip-vertical-2` | no (as today) |
> | Auto | `wand-sparkles` | yes |
> | Compare | `eye` | yes |
> | Clear | `eraser` | yes |
>
> — `screens.md §Icon map, rows for SCR-07 tool panels, abridged (Where column dropped)` · full text: [screens.md](../screens.md)

Today: `CropRotateControls.vue` holds four hand-drawn inline `<svg>` (rotate and flip); e2e finds these buttons by name (`'Apply'`, `'Auto'`, …).

> **Hard rule:** names, order, enabled rules unchanged; e2e and unit tests pass unedited. Choice controls never get an icon.
>
> — `spec.md §6, NFR row «Accessible names»` + `spec.md §5, AC-02 choice-control clause, abridged`

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-07 and wireframe 07-a. Do not guess.

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

## Checklist

- [ ] Rotate/flip: `BaseButton` ghost icon-only with the registry icons, keep `aria-label` and `title`; Reset/Cancel/Apply icons — `CropRotateControls.vue`
- [ ] Auto, Compare, Reset, Cancel, Apply icons — `AdjustControls.vue`
- [ ] Clear, Cancel, Apply icons; swatches and brush/eraser options untouched — `DrawControls.vue`
- [ ] Added test cases (co-located panel tests): each action shows one `aria-hidden` svg; icon-only ones keep `aria-label` + `title`; swatches have no svg

## Edge cases

| Case | Behaviour |
|---|---|
| Auto unavailable | Neutral disabled look, icon still shown |
| Compare held | `pressed` look, icon `eye` unchanged |
| Colour swatch / proportion / brush option | No icon (choice control) |

## Definition of Done

- [ ] Added Vitest cases pass; existing panel tests and e2e names untouched
- [ ] No `<svg` left in `CropRotateControls.vue`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
