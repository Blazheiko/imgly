---
status: Living
tool: code               # figma | pencil | code — the single committed source of the design-tool choice (never sdd.local.md: that file is per-developer + gitignored)
figma_file: ""           # tool: figma → the Figma file URL/key the canon lives in; else ""
pen_file: ""             # tool: pencil → the .pen library path (e.g. docs/design/library.pen); else ""
updated_at: "2026-10-16"
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

- **Colors:** `--color-*`, each set in `:root` (dark) and overridden in the light block. Tokens v2 (ui-refresh, values measured in `docs/features/ui-refresh/screens.md` §Token values):
  - surfaces and text: `surface`, `surface-raised`, `surface-sunken` (disabled buttons, the meter track on dark, an unpainted thumbnail), `surface-overlay`, `canvas-surround`, `border`, `border-subtle`, `border-strong` (secondary borders, the drop-area dash), `text`, `text-muted`;
  - brand: `brand` (Iris `#6D5BFF`), `brand-from` / `brand-to` (the logo gradient's stops, read by `AppLogo`), `brand-gradient` (logo only), `accent`, `accent-gradient` (primary button), `accent-hover` (a darker gradient), `accent-active`, `accent-text` (accent text and icons), `accent-subtle` (pressed, the Storage note), `on-accent`, `focus-ring`;
  - the top bar and the Installed app's title bar: `titlebar` (`#15122A` dark, `#F4F2FF` light), `on-titlebar`, `on-titlebar-muted`, `titlebar-border`. The same two values are written in `index.html`'s two `theme-color` tags and the manifest in `vite.config.ts`; `src/app/window-colour.test.ts` keeps them equal (ui-refresh ADR-0002);
  - semantic: `success`, `warning` (damaged card), `danger` (text and icons), `danger-subtle`, `danger-solid` and `danger-solid-hover` (the danger button);
  - overlays: `glass` and `on-glass` (the card's Delete on the thumbnail), `scrim` (`DropOverlay`, the card's blurred backdrop)
  — `src/shared/styles/tokens.css`
- **Elevation:** `--shadow-sm` / `--shadow-md` / `--shadow-lg`, per theme — `src/shared/styles/tokens.css`
- **Spacing / sizing:** a 4px-based scale `--space-1…--space-8`; `--radius-sm|md|lg|xl|full` (6 / 8 / 12 / 16 / 999 px); `--control-height-sm|md|lg` (28 / 36 / 44 px, `--control-height` = md); `--icon-size-sm|md|lg` (16 / 20 / 32 px); `--toolbar-size` (56px); `--panel-width`; the primitive widths `--toast-max-width`, `--dialog-width`, `--canvas-message-max-width`; `--content-max-width` (1120px, the start screen's column); `--gallery-card-min` (200px, the Work card grid's minimum column); `--gallery-tile-size` (160px, kept for older callers) — `src/shared/styles/tokens.css`
- **Typography:** the system UI font stack. `--font-size-xs…lg`, `--font-size-xl` (20), `--font-size-2xl` (24), `--font-size-display` (32), `--line-height-tight|normal`, `--tracking-tight`, `--font-weight-*` and `--font-mono` for numeric readouts such as slider values and pixel sizes — `src/shared/styles/tokens.css`
- **Motion:** `--duration-fast` (120 ms, colour changes), `--duration-base` (200 ms, the card lift), `--ease-out`, `--lift-card` (−2px). Under `prefers-reduced-motion: reduce` every `--duration-*` is `0ms` and `--lift-card` is `0px`, so only colours change (`tokens.test.ts` pins both). `BaseButton` animates only while pointed at or pressed, so a change of availability repaints at once

## Component inventory

`BaseButton` is seeded by scaffold S1; every other primitive is added here by `implement` when a
feature first needs it. `screens.md` may only use names from this table,
or declare `NEW: <name>` with a reason why no existing primitive fits.

| Component | Source (`file:line` / node / URL) | States it supports | Notes |
|---|---|---|---|
| BaseButton | `src/shared/ui/BaseButton.vue:1` | default / hover / focus-visible / active / pressed / busy / disabled / unavailable (`aria-disabled`) | Variants `primary` (accent gradient) / `secondary` / `ghost` (inherits the text colour, so it takes `--color-on-titlebar` in the top bar) / `danger` (destructive confirmations only, e.g. the Gallery's Delete). `size` `sm` / `md` (default) / `lg`. Optional `icon` (a registry name) is drawn before the label; with no label the button is icon-only, a square of its height, and must carry an `aria-label` and a `title` (dev builds warn otherwise). `busy` puts a `Spinner` in the icon's place, hidden from assistive tech unless `busyLabel` is set; then the Spinner announces it as part of the name (Export's "Exporting"). Disabled and unavailable share one neutral look (`--color-surface-sunken`, muted text; `ghost` keeps its transparent background and only its text is muted), never a faded brand colour. Optional `pressed` makes it a toggle: `aria-pressed` plus the `--color-accent-subtle` look. The focus ring is 2px `--color-focus-ring` at a 2px offset in every variant |
| Icon | `src/shared/ui/Icon.vue:1` | `sm` / `md` / `lg` (`--icon-size-*`) | One icon from the typed registry `src/shared/icons/index.ts` (Lucide paths, ISC notice in `LICENSE-lucide`; ui-refresh ADR-0001): a 24 × 24 `<svg>`, stroke 1.75, `currentColor`, `aria-hidden` and never focusable, so a button's name comes only from its label or `aria-label`. An unknown name fails `pnpm typecheck`. Every action button takes its icon from `docs/features/ui-refresh/screens.md` §Icon map; choice controls (swatches, format, proportion, brush or eraser options) never get one |
| AppLogo | `src/shared/ui/AppLogo.vue:1` | with / without wordmark | The imgly brand mark (two crop corners and a dot, `brand/logo-concept.svg`) in the brand gradient from `--color-brand-from` / `--color-brand-to`, decorative, followed by the visible wordmark "imgly" (not a heading, no keyboard stop). The top bar's left end. `public/icons/favicon.svg` and the PNG app icons (`pnpm icons`) are drawn from the same mark |
| Spinner | `src/shared/ui/Spinner.vue:1` | indeterminate (reduced-motion slows it) | `role="status"` with a visually hidden `label`. The canvas loading overlay (open-and-view) |
| Toast | `src/shared/ui/Toast.vue:1` | `info` / `failure` / `lasting`; action busy; dismiss button hover / focus-visible | `info` and `lasting` are `role="status"` (polite) with a `--color-accent-text` left edge, `failure` is `role="alert"` with a `--color-danger` edge; raised, `--radius-lg`, `--shadow-md`. Emits `dismiss`. Optional `action: { label, icon?, run, busy?, busyLabel? }` renders a ghost `sm` `BaseButton` with its icon before Dismiss; clicking it focuses the action (Safari and Firefox on macOS don't), calls `run()` then emits `dismiss`, unless `run()` returns `'keep-open'` (the notice stays and focus stays on the action). A `busy` action is `aria-disabled` (still focusable), shows BaseButton's `busy` Spinner in the icon's place (no `busyLabel` passed to BaseButton, so it stays hidden from assistive tech and the button is named once by the visible `busyLabel`) and `busyLabel`, and ignores clicks (pwa-install-update AC-10, AC-11). Dismiss is a ghost `sm` icon-only `BaseButton` with the `x` icon, `aria-label` and `title` "Dismiss" |
| ToastStack | `src/shared/ui/ToastStack.vue:1` | empty / one / many stacked | The single bottom-right notice boundary, bound to `useNotices` in `src/shared/notices/`. Info dismisses itself after 6000 ms, failures and `lasting` notices stay (AC-11b, pwa-install-update AC-06). `pushAll` returns the new ids in input order, so a caller can withdraw one notice with `dismiss(id)`. A notice with a `slot` replaces the notice already in that slot at the same position (under a new id), so at most one notice per slot is shown (pwa-install-update AC-14). Each toast carries its slot as `data-slot`, so a dialog can return focus to a slotted notice's action. `update(id, patch)` changes a shown notice in place, keeping its id, e.g. to flip its action to `busy` |
| Dialog | `src/shared/ui/Dialog.vue:1` | open (backdrop, focus trapped) | `role="alertdialog"`, `title`, `initialFocus` selector, default + `actions` slots. `Esc` and backdrop click emit `cancel`; focus returns to the opener, or to the optional `returnFocus` selector when the opener has left the page. With `preferReturnFocus`, `returnFocus` wins whenever it matches (ReloadDialog: back to "Reload" even after another button took focus) |
| CanvasMessage | `src/shared/ui/CanvasMessage.vue:1` | `status` / `alert`; with or without action | Full-canvas message for blocking conditions (SCR-04, SCR-05): `title`, default slot body, optional `action` slot |
| Popover | `src/shared/ui/Popover.vue:1` | closed / open / locked | Non-modal `role="dialog"` hung right-aligned under an `anchor`, width `--panel-width`, no backdrop. Focus moves in on open (`initialFocus` selector or first focusable), is not trapped, and returns to the anchor on close. `Esc` and a pointerdown outside the panel and anchor emit `close` unless `locked` (export, SCR-03) |
| SegmentedControl | `src/shared/ui/SegmentedControl.vue:1` | selected / hover / focus-visible / disabled option; with hints | `role="radiogroup"` of `role="radio"` buttons with `v-model`, `options: { value, label, disabled?, hint? }[]` and `label`. Roving tabindex; arrow keys move and select, skipping disabled options and wrapping. `modelValue: null` selects nothing, and the first enabled option keeps the tab stop. Option hints render as one-line notes under the group (export format, size presets); the group wraps onto a second row when its options do not fit (crop-rotate proportions). An option may carry `title` (its tooltip, e.g. "Brush (B)") and `swatch` (a CSS colour): a swatch option renders a filled square in a `--color-border` frame instead of its text, keeps `label` as accessible name and tooltip, shows the selected ring when checked, and a group of swatches lays out in rows of five (draw palette) |
| NumberField | `src/shared/ui/NumberField.vue:1` | default / focus-visible / pending text / disabled; optional unit | Labelled text input with `v-model`, `label`, `unit`, `hideLabel`; integer (`inputmode="numeric"`) by default, signed decimal (`inputmode="decimal"`) with `decimal`, shown with `decimals` places. Escape discards text still being typed and lets the key reach the surrounding tool (crop-rotate AC-20). Shows raw text while typing; applies through the caller's `normalize(raw, previous)` on blur and `Enter` (which never submits or bubbles) and through the exposed `apply()` (export quality / long side, canon §Validation) |
| SliderField | `src/shared/ui/SliderField.vue:1` | default / dragging / focus-visible / disabled | The canon's clamped slider paired with a number field: a range (`min`, `max`, `step` (default 1), `aria-label` = `label`) and a `NumberField` on one `v-model`. `decimals` rounds and shows the value (no float drift), `marks` adds tick marks (a `datalist`), and the arrow keys move one step, ten with Shift. An optional `neutral` makes a double-click on the range set that value (no-op when disabled or already there), and `rangeTitle` is the range's tooltip ("Double-click to reset" on the adjust sliders). With a `unit`, the range's `aria-valuetext` is the value with its decimals and unit ("60%", "2.0°"), so a screen reader hears the unit the number field shows. Exposes `apply()` for a value still being typed (export quality, crop-rotate straighten at 0.1° with a mark at 0, the seven adjust sliders with `neutral` 0, later brush width) |

## Interaction & writing conventions

- **Errors:** one toast boundary (bottom-right, auto-dismiss except for errors) shows every `AppError` from `core`/`infra` (`docs/architecture-map.md` §Conventions, Error handling). A blocking condition such as "WebGL2 unavailable" gets a full-canvas message instead of a toast.
- **Empty states:** with no image open, the start screen is one centred column (`--content-max-width`): a dashed drop-area card with the `image-plus` icon, "Open an image to start", one primary `lg` "Open image" and a one-line hint, highlighted while a file is dragged over the window, with the Gallery below at the same edges. The card itself is decoration: only its button opens the picker. The gallery's empty state is plain text plus the same action.
- **Loading:** an indeterminate spinner overlay on the canvas while decoding or downscaling. While exporting there is no canvas overlay (zoom and pan stay live): the Export button and the export panel's confirm button show "Exporting…" with a `Spinner`, and "Open image" is disabled. Slider changes preview live without a loading state. There are no skeleton screens.
- **Validation:** almost no forms. Numeric inputs such as export quality and brush width are clamped sliders paired with a number field. Out-of-range typed values snap to the bound on blur, and there are no inline error messages.
- **Keyboard:** every tool and action is reachable by keyboard. `Ctrl/Cmd+Z` / `Shift+Ctrl/Cmd+Z` undo and redo, and single-letter tool shortcuts are listed in tooltips. Focus is always visible through `--color-focus-ring`. A control revealed on hover (the Work card's Delete) is also revealed on `:focus-within` and always under `(hover: none)`, and is hidden only by opacity, so it never leaves the keyboard order.
- **Microcopy tone:** short, plain and honest. Verbs on buttons ("Export", "Crop"), no exclamation marks, and storage limits stated plainly ("Saved in this browser only — export to keep a copy").
