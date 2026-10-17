---
id: T7
title: "Rebuild the top bar: AppLogo + wordmark, --color-titlebar, four groups with dividers only between shown groups, Install app before Export"
layer: "ui"
deps: ["T3", "T5", "T6"]
blocks: ["T14"]
acs: ["AC-01", "AC-02", "AC-11", "AC-15"]
files_hint: ["src/features/editor/components/EditorTopBar.vue", "src/features/editor/components/EditorTopBar.test.ts", "src/features/editor/EditorView.vue", "src/app/App.vue", "src/app/App.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 58 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Rebuild the top bar

## Place in the sequence

- **Blocked by:** T3 — BaseButton, T5 — AppLogo, T6 — window colour · **Blocks:** T14 — e2e checks · **Wave:** 4 (after T6, which follows T5).
- **Lane:** shares `src/features/editor/EditorView.vue` with T10 and T11 — serialized (never in parallel with them).

## Why (user story)

> **As a** Portfolio reviewer
> **I want** to see imgly's own logo in the top bar, the browser tab and the Installed app's icon
> **So that** I immediately know which product I am looking at and that it was designed with care
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task builds the top bar's frame (brand, colour, groups, order); the action buttons inside it get their icons in T8, except "Open image", which lives in `EditorTopBar` and gets `image-plus` here.

## Inlined context

> The top bar is `--toolbar-size` (56 px) high on `--color-titlebar`, with a 1 px `--color-titlebar-border` bottom edge. Left to right: `AppLogo` with the wordmark, then up to four groups separated by 1 px × 24 px `--color-titlebar-border` dividers with `--space-3` either side: **① Gallery, Open image · ② Undo, Redo · ③ Crop and rotate, Adjust, Draw · ④ Install app, Export**. Group ④ sits at the right end, and Export is last. A divider is drawn only **between two groups that both show at least one button**. An empty group leaves no divider and no gap (AC-15). Every top-bar button is `md`. Export is `primary`, the others are `ghost` in `--color-on-titlebar`, and the open tool is `pressed`. The keyboard order follows the visual order.
>
> | no Work | Group ① is absent, so the logo is followed directly by ②. Undo, Redo, the three tools and Export are unavailable, in the neutral look (AC-13) |
> | no install offer / Installed app | Group ④ is Export alone, with no gap and no extra divider |
> | dark theme | Top bar `#15122A`, the same colour as the window's title bar (AC-11) |
> | light theme | Top bar `#F4F2FF`, text and icons `#1E1A3D` (AC-11). Export keeps the Iris gradient with white text (4.57:1) |
>
> — `screens.md §SCR-01, intro + rows, abridged` · full text: [screens.md](../screens.md)

> ```text
> | ⌜•⌟ imgly │ ▦ Gallery  ⊕ Open image │ ↶  ↷ │ ⌗ Crop and rotate  ⫶ Adjust  ✎ Draw │ ⇩ Install app [⇩ Export] |
> ```
>
> — `screens.md §SCR-01, wireframe 01-a, abridged` · full text: [screens.md](../screens.md)

Today: `EditorTopBar.vue` shows `<span class="editor-top-bar__name">imgly</span>`, then `.editor-top-bar__actions` holding slot `leading-actions` (GalleryAction), a secondary "Open image" `BaseButton`, then slot `actions`. `App.vue:59-61` fills `#top-bar-actions` with `UndoRedoActions, CropRotateAction, AdjustAction, DrawAction, ExportAction, InstallAction`; `EditorView.vue:185-194` forwards the slots. `InstallAction` renders nothing without an offer.

> Cross-feature change: pwa-install-update placed Install app last in the top bar, after Export (its SCR-01 and AC-01, pinned by a unit test of the app shell). This feature moves Install app before Export, so that one test and that screen are updated deliberately (AC-02).
>
> — `spec.md §1, Traceability bullet 3, verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:** every existing unit and end-to-end test passes without any edit, except the one app-shell test that pins Install app after Export (`src/app/App.test.ts:473`).
>
> — `sad.md §10 QG-2, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-01 (all states and wireframes 01-a to 01-d). Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. `EditorTopBar` / `EditorView` slots may be split per group (e.g. `top-bar-history`, `top-bar-tools`, `top-bar-trailing`); slot names are internal to editor + app shell.

## Acceptance criteria

### AC-01 — happy path

> **Given** the app is open in a browser tab or as an Installed app, in either theme
> **When** the Portfolio reviewer looks at the top bar, the browser tab and the system's list of apps
> **Then** the top bar's left end shows the imgly mark followed by the name "imgly", the tab shows the same mark, and the Installed app's icon shows the same mark on the brand colour, with no generic picture symbol left in any of those four places (the top bar, the tab, the Installed app's icon and the icon used when the app is added to a home screen); an image icon inside the interface, such as on the drop area, is not a brand mark
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — happy path

> **Given** the Editor is on any screen of the app
> **When** they look at any action button, that is, any button that performs an action anywhere in the app: the top bar, the Gallery and its cards, the notices (Dismiss, Reload, "Delete…"), every tool panel (such as Apply, Cancel, Auto, Compare and Clear), the export panel, every confirmation dialog (both its cancel and its confirming button) and the full-screen messages (such as "Reload page"); choice controls such as a colour swatch, a format option or a proportion option are not action buttons
> **Then** each one shows an icon from one set drawn in one style and size, and the top bar shows, left to right and in the same keyboard order, four groups separated by thin dividers: Gallery and Open image; Undo and Redo; Crop and rotate, Adjust and Draw; Install app and Export, with Export last
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — cross-context

> **Given** the Editor runs the Installed app in a Chromium-based desktop browser (in Safari's installed app the same holds as far as Safari allows)
> **When** the system's theme is dark, or is light, or changes between them while the app is open
> **Then** the window's title bar takes the top bar's brand-tinted colour for that theme, deep indigo in dark and pale lavender in light, and the top bar itself uses that same colour, so the title bar and the top bar read as one strip with no contrasting band between them; while the app is still starting, before the page has loaded, the window may show the dark colour
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — authorization

> **Given** the Editor's browser does not offer to install the app, or the app already runs as an Installed app
> **When** the Editor looks at the restyled top bar
> **Then** no Install app action is shown, and no empty space or extra divider is left where it would be, so the top bar never offers an action that does nothing
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `AppLogo` + wordmark at the left; background `--color-titlebar`, border `--color-titlebar-border`, text `--color-on-titlebar`; "Open image" → ghost `md` with `icon="image-plus"` — `EditorTopBar.vue`
- [ ] Four group containers; dividers drawn only between non-empty groups (e.g. `.group:not(:has(*))` hidden + divider via `.group:has(*) ~ .group:has(*)::before`, or explicit `v-if`s) — `EditorTopBar.vue`
- [ ] Forward the group slots — `EditorView.vue`
- [ ] Mount `GalleryAction` in ①, `UndoRedoActions` in ②, the three tool actions in ③, `InstallAction` then `ExportAction` in ④ — `App.vue`
- [ ] Update the one order test to "Install app right before Export, Export last" — `src/app/App.test.ts` (only that case)
- [ ] Tests (added): logo + "imgly" text; no divider next to an empty group; no Install → no extra divider — `EditorTopBar.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| No Work (start screen) | Group ① absent; logo then ② with one divider between them |
| No install offer / Installed app | ④ = Export alone; no gap, no extra divider |
| Tool open | Its button `pressed`; the rest keep their existing unavailable rules |
| Light theme | Top bar `#F4F2FF`, text `#1E1A3D` |

## Definition of Done

- [ ] `EditorTopBar.test.ts` and the updated `App.test.ts` case prove brand, group order, Export last and the divider rule
- [ ] All other existing unit tests pass unedited
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
