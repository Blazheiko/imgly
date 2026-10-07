---
status: Living
tool: code               # figma | pencil | code — the single committed source of the design-tool choice (never sdd.local.md: that file is per-developer + gitignored)
figma_file: ""           # tool: figma → the Figma file URL/key the canon lives in; else ""
pen_file: ""             # tool: pencil → the .pen library path (e.g. docs/design/library.pen); else ""
updated_at: "2026-10-04"
---

# Design system — imgly-editor

> The project's **design canon**, produced once per repo by `design-system` and read by
> `ux-flows` / `screens` / `implement` / `review`. Committed — the tool choice and the inventory
> are team-wide, not per-developer. `architecture-map.md` §Frontend / UI foundation stays the
> inventory of the **code**; this file is the **design-side** canon (tool, posture, tokens,
> component inventory, cross-screen conventions). Refresh via `/sdd:design-system` when the
> foundation changes.
>
> **Greenfield state:** no UI code exists yet. `/sdd:scaffold` creates the token file and the first
> primitive, and `implement` registers each new component in the inventory below as features land.

## Platform posture

- **Posture:** desktop-first. The brief's primary users (the owner and portfolio reviewers) are on desktop browsers. Mobile only has to not break (`docs/idea-brief.md` §5).
- **Breakpoints / device classes:**
  - `≥ 1280px` is the design target: full layout with a tool rail, canvas and inspector panel.
  - `1024–1279px` is supported: the inspector narrows and the canvas keeps priority.
  - `< 1024px` only has to not break: one column, the inspector collapses under the canvas, and touch is not optimised.

## Design tool

- **Tool:** code. Screens are inline markdown wireframes in each feature's `screens.md`. No Figma or Pencil MCP is in use, and a solo portfolio project gains little from a separate design file.
- **Library location:** the in-repo components in `src/shared/ui/` are the library, styled only through the tokens below (`docs/architecture-map.md` §Frontend / UI foundation).

## Token source

All tokens are CSS custom properties in one file. A component or screen never hard-codes a colour,
spacing value or font inline. It references `var(--…)`. The dark theme is the default (the canvas
reads better on a neutral dark surround). A light theme comes from `@media (prefers-color-scheme: light)`
in the same file.

- **Colors:** `--color-*` (surface, surface-raised, canvas-surround, border, text, text-muted, accent + hover/active, on-accent, danger, focus-ring) — `src/shared/styles/tokens.css`
- **Spacing / sizing:** a 4px-based scale `--space-1…--space-8`, plus `--radius-*`, `--panel-width`, `--toolbar-size` and the primitive widths `--toast-max-width`, `--dialog-width`, `--canvas-message-max-width` — `src/shared/styles/tokens.css`
- **Typography:** the system UI font stack. `--font-size-xs…lg`, `--font-weight-*` and `--font-mono` for numeric readouts such as slider values and pixel sizes — `src/shared/styles/tokens.css`

## Component inventory

`BaseButton` is seeded by scaffold S1; every other primitive is added here by `implement` when a
feature first needs it. `screens.md` may only use names from this table,
or declare `NEW: <name>` with a reason why no existing primitive fits.

| Component | Source (`file:line` / node / URL) | States it supports | Notes |
|---|---|---|---|
| BaseButton | `src/shared/ui/BaseButton.vue:1` | default / hover / focus-visible / active / disabled | Variants `primary` / `secondary` / `ghost`. Optional `pressed` makes it a toggle: `aria-pressed` plus an accent-bordered pressed look (crop-rotate "Crop and rotate" while the tool is open); left out, no `aria-pressed`. It is the base for icon and toolbar buttons |
| Spinner | `src/shared/ui/Spinner.vue:1` | indeterminate (reduced-motion slows it) | `role="status"` with a visually hidden `label`. The canvas loading overlay (open-and-view) |
| Toast | `src/shared/ui/Toast.vue:1` | `info` / `failure`; dismiss button hover / focus-visible | `info` is `role="status"` (polite), `failure` is `role="alert"`. Emits `dismiss` |
| ToastStack | `src/shared/ui/ToastStack.vue:1` | empty / one / many stacked | The single bottom-right notice boundary, bound to `useNotices` in `src/shared/notices/`. Info dismisses itself after 6000 ms, failures stay (AC-11b) |
| Dialog | `src/shared/ui/Dialog.vue:1` | open (backdrop, focus trapped) | `role="alertdialog"`, `title`, `initialFocus` selector, default + `actions` slots. `Esc` and backdrop click emit `cancel`; focus returns to the opener |
| CanvasMessage | `src/shared/ui/CanvasMessage.vue:1` | `status` / `alert`; with or without action | Full-canvas message for blocking conditions (SCR-04, SCR-05): `title`, default slot body, optional `action` slot |
| Popover | `src/shared/ui/Popover.vue:1` | closed / open / locked | Non-modal `role="dialog"` hung right-aligned under an `anchor`, width `--panel-width`, no backdrop. Focus moves in on open (`initialFocus` selector or first focusable), is not trapped, and returns to the anchor on close. `Esc` and a pointerdown outside the panel and anchor emit `close` unless `locked` (export, SCR-03) |
| SegmentedControl | `src/shared/ui/SegmentedControl.vue:1` | selected / hover / focus-visible / disabled option; with hints | `role="radiogroup"` of `role="radio"` buttons with `v-model`, `options: { value, label, disabled?, hint? }[]` and `label`. Roving tabindex; arrow keys move and select, skipping disabled options and wrapping. `modelValue: null` selects nothing, and the first enabled option keeps the tab stop. Option hints render as one-line notes under the group (export format, size presets) |
| NumberField | `src/shared/ui/NumberField.vue:1` | default / focus-visible / pending text / disabled; optional unit | Labelled text input with `v-model`, `label`, `unit`, `hideLabel`; integer (`inputmode="numeric"`) by default, signed decimal (`inputmode="decimal"`) with `decimal`, shown with `decimals` places. Escape discards text still being typed and lets the key reach the surrounding tool (crop-rotate AC-20). Shows raw text while typing; applies through the caller's `normalize(raw, previous)` on blur and `Enter` (which never submits or bubbles) and through the exposed `apply()` (export quality / long side, canon §Validation) |
| SliderField | `src/shared/ui/SliderField.vue:1` | default / dragging / focus-visible / disabled | The canon's clamped slider paired with a number field: a range (`min`, `max`, `step` (default 1), `aria-label` = `label`) and a `NumberField` on one `v-model`. `decimals` rounds and shows the value (no float drift), `marks` adds tick marks (a `datalist`), and the arrow keys move one step, ten with Shift. Exposes `apply()` for a value still being typed (export quality, crop-rotate straighten at 0.1° with a mark at 0, later brush width) |

## Interaction & writing conventions

- **Errors:** one toast boundary (bottom-right, auto-dismiss except for errors) shows every `AppError` from `core`/`infra` (`docs/architecture-map.md` §Conventions, Error handling). A blocking condition such as "WebGL2 unavailable" gets a full-canvas message instead of a toast.
- **Empty states:** with no image open, the canvas area is a drop zone with one primary "Open image" action and a one-line hint (drag-and-drop or paste where supported). The gallery's empty state is plain text plus the same action.
- **Loading:** an indeterminate spinner overlay on the canvas while decoding or downscaling. While exporting there is no canvas overlay (zoom and pan stay live): the Export button and the export panel's confirm button show "Exporting…" with a `Spinner`, and "Open image" is disabled. Slider changes preview live without a loading state. There are no skeleton screens.
- **Validation:** almost no forms. Numeric inputs such as export quality and brush width are clamped sliders paired with a number field. Out-of-range typed values snap to the bound on blur, and there are no inline error messages.
- **Keyboard:** every tool and action is reachable by keyboard. `Ctrl/Cmd+Z` / `Shift+Ctrl/Cmd+Z` undo and redo, and single-letter tool shortcuts are listed in tooltips. Focus is always visible through `--color-focus-ring`.
- **Microcopy tone:** short, plain and honest. Verbs on buttons ("Export", "Crop"), no exclamation marks, and storage limits stated plainly ("Saved in this browser only — export to keep a copy").
