---
status: draft             # draft | approved
feature_size: "S"
tool: "code"
updated_at: "2026-10-16"
---

# Screens — ui-refresh

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below. The brand artwork is the one drawn file:
  `docs/features/ui-refresh/brand/logo-concept.svg` (preview `logo-concept.png`), approved by the
  owner on 2026-10-16, which closes spec §8. `AppLogo`, `public/icons/favicon.svg` and the PNG icons
  are drawn from its `mark` symbol (§Brand mark).
- **Inputs:** screen inventory from `ux-flows.md` (SCR-01 to SCR-07, all covered). States come from
  spec §5 (AC-01 to AC-15), the `sad.md` §6 Critical flows 1 and 2, and, for the states this feature
  only restyles, the existing manifests: gallery `screens.md` SCR-01 and SCR-03 to SCR-05,
  pwa-install-update SCR-01 and SCR-03 to SCR-07, and open-and-view's drag-over, loading and error
  states. There is no `contracts/` folder because the feature has no external interface
  (`target_surfaces: [web-frontend]`), so no state comes from a contract error response. The feature
  adds no `AppError` code (`sad.md` §8), so every error state here is an existing one.
- **Decisions taken here** (confirmed with the owner on 2026-10-16):
  - **Button gradient.** The primary button uses `#6D5BFF → #7B4FE8`, not the plan's `→ #A35BFF`:
    white text on `#A35BFF` measures 3.82:1, below spec §6's 4.5:1. The logo keeps `#6D5BFF → #A35BFF`,
    because a graphic only needs 3:1. Hover goes **darker**, not lighter as `design-proposal.md` §5
    says, because a lighter Iris (`#7F6FFF`) gives white text only 3.74:1.
  - **Drop overlay.** open-and-view's `DropOverlay` stays and keeps its text "Drop an image to open
    it" (pinned by `EditorView.test.ts` and `e2e/open-and-view/empty-and-drop.spec.ts`, which QG-2
    forbids editing). Its background becomes `--color-scrim` (translucent) with the text in a solid
    pill, so on the start screen the highlighted drop area shows through underneath (AC-04).
  - **Icon-only buttons.** Rotate left, Rotate right, Flip horizontal and Flip vertical (icon-only
    today) and Zoom out and Zoom in (the glyphs "−" and "+" today) stay without a visible label.
    They keep their `aria-label` and `title`, and the "−" and "+" glyphs become icons. AC-03's list
    of icon-only buttons was incomplete, and the spec is patched to name them.
  - **Notices** gain icons on their action and Dismiss buttons only. No leading icon marks a notice's
    kind, because no AC asks for one.
- **Reused unchanged:** every behaviour, name, shortcut, enabled rule, notice wording and focus rule
  of the screens below. Only Install app moves before Export. Where a row says "as gallery SCR-xx" or
  "as pwa-install-update SCR-xx", the behaviour and wording are that manifest's, and only the look
  defined here applies.

## Look decisions

### Token values (tokens v2)

The values the screens' contrast depends on, measured with the WCAG relative-luminance formula. The
other tokens of `sad.md` §5 (radii, shadows, type scale, sizes) follow `design-proposal.md` §7
unchanged. Existing tokens not listed keep their values.

| Token | Dark (`:root`) | Light | Used for | Measured |
|---|---|---|---|---|
| `--color-brand` | `#6D5BFF` | `#6D5BFF` | brand references | — |
| `--color-brand-gradient` | `linear-gradient(135deg, #6D5BFF, #A35BFF)` | same | logo mark only | stops vs titlebar 3.99 / 4.77 (dark), 4.14 / 3.45 (light) ≥ 3 |
| `--color-accent` | `#6D5BFF` | `#6D5BFF` | primary background, open badge, bar fill on light | white text 4.57 |
| `--color-accent-gradient` | `linear-gradient(135deg, #6D5BFF, #7B4FE8)` | same | primary button | white text 4.57 / 5.09 |
| `--color-accent-hover` | `linear-gradient(135deg, #5E4CF2, #6C44DD)` | same | primary hover | white text 5.54 / 5.99 |
| `--color-accent-active` | `#5240DB` | `#5240DB` | primary active | white text 6.74 |
| `--color-accent-text` | `#8F82FF` | `#5847E6` | accent-coloured text and icons, bar fill on dark | 5.75 on surface, 5.91 on titlebar (dark); 5.66 / 5.49 (light) |
| `--color-accent-subtle` | `#2B2550` | `#ECE9FF` | pressed tool, Storage note, open badge on light | text 11.76 / 14.18; icon 4.59 / 5.11 |
| `--color-on-accent` | `#FFFFFF` | `#FFFFFF` | text and icons on accent and danger | — |
| `--color-focus-ring` | `#A99CFF` | `#5847E6` | 2 px outline, 2 px offset | 7.71 on titlebar, 7.51 on surface, 6.66 on raised (dark); 5.49 / 5.66 / 6.07 (light) |
| `--color-titlebar` | `#15122A` | `#F4F2FF` | top bar, `theme-color`, manifest (`#15122A`) | — |
| `--color-on-titlebar` | `#ECEAFF` | `#1E1A3D` | top-bar text, icons, wordmark | 15.44 / 14.95 |
| `--color-on-titlebar-muted` | `#A8A2D8` | `#5A5480` | top-bar secondary text | 7.66 / 6.30 |
| `--color-titlebar-border` | `#3A3361` | `#C9C3EE` | top-bar bottom edge, group dividers | decorative (exempt) |
| `--color-surface-sunken` | `#2A2D35` | `#E9EBEF` | disabled button background, bar track on dark | disabled label 5.24 / 4.99 (exempt) |
| `--color-border-strong` | `#8A909C` | `#8A93A3` | secondary-button border, drop-area dash | 4.91 on raised / 3.10 on white |
| `--color-danger` | `#FF6B6B` | `#C53030` | danger text and icons | 5.67 on raised / 5.47 on white |
| `--color-danger-solid` | `#D63A3A` | `#C53030` | danger button | white text 4.64 / 5.47 |
| `--color-danger-solid-hover` | `#B83030` | `#A82828` | danger hover | white text 5.99 / 7.00 |
| `--color-warning` | `#E8A93A` | `#9A6412` | damaged card border and symbol | 7.61 on raised / 4.99 on white |
| `--color-glass` | `#1B1838E6` | `#1B1838E6` | Delete button on the thumbnail | `#ECEAFF` icon 14.40 |
| `--color-scrim` | `#0E0F12B8` | `#E4E6EAB8` | `DropOverlay` background | text sits in a solid `--color-canvas-surround` pill, 15.91 |

### Buttons (`BaseButton`, ADR-0003)

| Variant | Default | Hover | Active | Disabled or unavailable |
|---|---|---|---|---|
| `primary` | `--color-accent-gradient`, white label and icon, 1 px top highlight, `--shadow-sm` | `--color-accent-hover` | `--color-accent-active` | `--color-surface-sunken`, `--color-text-muted`, no shadow, no gradient |
| `secondary` | `--color-surface-raised`, 1 px `--color-border-strong`, `--color-text` | `--color-accent-subtle` background | border `--color-accent-text` | same neutral look |
| `ghost` | transparent, `currentColor` (on the top bar `--color-on-titlebar`) | `--color-accent-subtle` | `--color-accent-subtle`, border `--color-accent-text` | same neutral look, transparent background |
| `danger` (NEW variant) | `--color-danger-solid`, white | `--color-danger-solid-hover` | `--color-danger-solid-hover` | same neutral look |
| `pressed` (any variant) | `--color-accent-subtle` background, 1 px `--color-accent-text` border | unchanged | unchanged | — |

- **Sizes:** `sm` 28 px, `md` 36 px (default), `lg` 44 px (`--control-height-*`). The icon is
  `--icon-size-sm` (16 px) in `sm` and `md` and `--icon-size-md` (20 px) in `lg`.
- **Icon with label:** icon first, then `--space-2`, then the label. **Icon-only:** a square of the
  size's height with the icon centred, an `aria-label` and a `title`.
- **Busy:** a `Spinner` of the icon's size takes the icon's place, so the button still shows one
  symbol. Its label is the existing busy label ("Exporting…", "Reloading…").
- **"Unavailable" (`aria-disabled`, focusable, with a hint)** looks the same as `disabled`, replacing
  today's 0.45 opacity everywhere it is used (AC-13).
- **Focus:** `outline: 2px solid var(--color-focus-ring); outline-offset: 2px` on `:focus-visible`
  in every variant and state, so the ring is drawn on the surrounding surface, never on the
  button's own colour (AC-13).
- **Motion:** colour transitions `--duration-fast` (120 ms). The only movement is the card lift
  (SCR-02). Under `prefers-reduced-motion: reduce` every duration is 0 and every transform is none
  (AC-14).

### Icon map (`Icon`, ADR-0001)

Lucide names on a 24 × 24 grid, stroke 1.75, round caps and joins, `currentColor`. A button not
listed here has no icon, and a choice control (swatch, format, proportion, brush or eraser option)
never gets one (AC-02).

| Action | Where | Icon | Label shown |
|---|---|---|---|
| Gallery | SCR-01 | `layout-grid` | yes |
| Open image | SCR-01, SCR-02 drop area, SCR-02 empty Gallery | `image-plus` | yes |
| Undo / Redo | SCR-01 | `undo-2` / `redo-2` | no (tooltip names the shortcut, as today) |
| Crop and rotate / Adjust / Draw | SCR-01 | `crop` / `sliders-horizontal` / `pen-line` | yes |
| Install app | SCR-01 | `monitor-down` | yes |
| Export (top bar and export panel) | SCR-01, SCR-07 | `download` | yes |
| Save… | SCR-07 export panel | `save` | yes |
| Close | SCR-03 | `x` | yes |
| Delete (card) | SCR-02, SCR-03 | `trash-2` | no (tooltip = its accessible name, "Delete “{name}”") |
| Delete (confirmation) / "Delete…" (notice) | SCR-05, SCR-06 | `trash-2` | yes |
| Cancel (every dialog and tool panel) | SCR-05, SCR-07 | `x` | yes |
| Dismiss | SCR-06 | `x` | no (`aria-label="Dismiss"`, `title="Dismiss"`) |
| Apply | SCR-07 | `check` | yes |
| Reset | SCR-07 crop-rotate, adjust | `rotate-ccw` | yes |
| Rotate left / Rotate right | SCR-07 crop-rotate | `rotate-ccw-square` / `rotate-cw-square` | no (as today) |
| Flip horizontal / Flip vertical | SCR-07 crop-rotate | `flip-horizontal-2` / `flip-vertical-2` | no (as today) |
| Auto | SCR-07 adjust | `wand-sparkles` | yes |
| Compare | SCR-07 adjust | `eye` | yes |
| Clear | SCR-07 draw | `eraser` | yes |
| Replace | SCR-07 replace confirmation | `replace` | yes |
| Reload (notice, reload confirmation) / Reload page | SCR-06, SCR-07 | `refresh-cw` | yes |
| Zoom out / Zoom in | SCR-07 zoom bar | `zoom-out` / `zoom-in` | no (as today) |
| Fit / 100% | SCR-07 zoom bar | `scan` / `maximize` | yes |
| — (not buttons) | Damaged card / Storage note / drop area | `image-off` / `info` / `image-plus` (`lg`) | — |

### Brand mark (`AppLogo`)

The approved artwork, on a 32 × 32 grid (`brand/logo-concept.svg`, symbol `mark`): a top-left crop
corner `M5 14V8a3 3 0 0 1 3-3h6`, a bottom-right crop corner `M27 18v6a3 3 0 0 1-3 3h-6`, both
stroke 3.25 with round caps and joins, and an accent dot `circle(21, 11, r 3)`.

- **In the page:** stroked and filled with `--color-brand-gradient`, at 24 px in the top bar,
  followed by the wordmark "imgly" (`--font-size-xl`, `--font-weight-bold`, `--tracking-tight`,
  `--color-on-titlebar`). `AppLogo` is decoration (`aria-hidden`) next to the visible text "imgly",
  which is not a heading and adds no keyboard stop.
- **Outside the page** (SCR-04): `favicon.svg` is the gradient mark on a transparent background.
  `icon-192.png` and `icon-512.png` are the white mark at 60% of the side on a gradient rounded
  square (radius 22% of the side). `icon-maskable-512.png` is a full-bleed gradient with the white
  mark inside the central 80% safe circle at 46% of the side. `apple-touch-icon-180.png` is the
  full-bleed version (iOS rounds the corners). All are rendered by `scripts/render-icons.ts`
  (`sad.md` §5).

## Screens

### SCR-01 — Editor with its top bar

The top bar is `--toolbar-size` (56 px) high on `--color-titlebar`, with a 1 px
`--color-titlebar-border` bottom edge. Left to right: `AppLogo` with the wordmark, then up to four
groups separated by 1 px × 24 px `--color-titlebar-border` dividers with `--space-3` either side:
**① Gallery, Open image · ② Undo, Redo · ③ Crop and rotate, Adjust, Draw · ④ Install app, Export**.
Group ④ sits at the right end, and Export is last. A divider is drawn only **between two groups
that both show at least one button**. An empty group leaves no divider and no gap (AC-15). Every
top-bar button is `md`. Export is `primary`, the others are `ghost` in `--color-on-titlebar`, and
the open tool is `pressed`. The keyboard order follows the visual order.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default (Work open) | A Work is open, no tool, no export (AC-01, AC-02). All four groups, with Install app only when offered | `EditorTopBar` · `AppLogo` · `GalleryAction`, `BaseButton` ghost "Open image", `UndoRedoActions`, `CropRotateAction`, `AdjustAction`, `DrawAction`, `InstallAction`, `ExportAction`, each a `BaseButton` with `Icon` | wireframe 01-a |
| no Work | The start screen is shown (gallery SCR-01, pwa SCR-01 states unchanged). Group ① is absent, so the logo is followed directly by ②. Undo, Redo, the three tools and Export are unavailable, in the neutral look (AC-13), and each still shows its hint when activated, as today | as `default` without group ① | wireframe 01-b |
| install offered | The browser holds an install offer and the window is not the Installed app (pwa-install-update SCR-01). Install app shows **before** Export (AC-02, AC-03) | `InstallAction` (`BaseButton` ghost, `monitor-down`) | wireframe 01-a |
| no install offer / Installed app | No offer, or `standalone` (AC-15, pwa SCR-03). Group ④ is Export alone, with no gap and no extra divider | as `default` | wireframe 01-c |
| tool open | A tool is open (crop-rotate, adjust or draw). Its button is `pressed`. Gallery, Export and the other tools are unavailable in the neutral look and keep their hints, as today | `BaseButton` `pressed` + neutral unavailable look | wireframe 01-d |
| exporting | An export runs. Export shows "Exporting…" with a `Spinner` in place of its icon. Gallery and Open image are `disabled`, in the neutral look | `ExportAction` busy · `Spinner` | wireframe 01-d |
| reading an image | open-and-view's loading state: the `Spinner` overlay on the canvas. The top bar is as `default`, with Export briefly unavailable | as `default` | — |
| dark theme | `prefers-color-scheme: dark`. Top bar `#15122A`, the same colour as the window's title bar (AC-11) | tokens | wireframe 01-a |
| light theme | `prefers-color-scheme: light`. Top bar `#F4F2FF`, text and icons `#1E1A3D` (AC-11). Export keeps the Iris gradient with white text (4.57:1) | tokens | wireframe 01-a (light values) |
| focus | Keyboard focus on any top-bar control: the 2 px `--color-focus-ring` outline at a 2 px offset on the titlebar (7.71 / 5.49:1, AC-13) | `BaseButton` focus-visible | — |
| reduced motion | No transform anywhere. Colour changes are instant (AC-14) | tokens | — |
| notice / panel / dialog | A notice, a tool panel, the export panel or a confirmation opens | → SCR-06 / SCR-07 | — |
| error | N/A: the top bar has no error state of its own. Refusals and failures are notices (SCR-06), and blocking conditions are full-screen messages (SCR-07) | — | — |
| empty | N/A as a separate state: "no Work" above is the empty case | — | — |
| validation | N/A: no typed input | — | — |

```text
01-a  default, Work open, install offered — dark (light: same layout, #F4F2FF / #1E1A3D)
+------------------------------------------------------------------------------------------------+
| ⌜•⌟ imgly │ ▦ Gallery  ⊕ Open image │ ↶  ↷ │ ⌗ Crop and rotate  ⫶ Adjust  ✎ Draw │ ⇩ Install app [⇩ Export] |
+------------------------------------------------------------------------------------------------+
  AppLogo    ① ghost                  ② icon-only ③ ghost (open tool = pressed)     ④ ghost   primary, last
  --color-titlebar background, 56 px; │ = 1 px --color-titlebar-border divider, only between shown groups
```

```text
01-b  no Work (start screen)
+------------------------------------------------------------------------------------------------+
| ⌜•⌟ imgly │ ↶  ↷ │ ⌗ Crop and rotate  ⫶ Adjust  ✎ Draw │ ⇩ Install app (⇩ Export)              |
+------------------------------------------------------------------------------------------------+
             ② and ③: ghost unavailable look (transparent, muted text); Export: neutral unavailable
             look (--color-surface-sunken, muted text); all still focusable with their hints; no group ①, so no divider before ②
```

```text
01-c  no install offer, or Installed app
+------------------------------------------------------------------------------------------------+
| ⌜•⌟ imgly │ ▦ Gallery  ⊕ Open image │ ↶  ↷ │ ⌗ Crop and rotate  ⫶ Adjust  ✎ Draw │      [⇩ Export] |
+------------------------------------------------------------------------------------------------+
                                                                         group ④ = Export alone, no gap
```

```text
01-d  tool open (Adjust) / exporting
+------------------------------------------------------------------------------------------------+
| ⌜•⌟ imgly │ (▦ Gallery) ⊕ Open image │ ↶  ↷ │ (⌗ Crop…) [⫶ Adjust]* (✎ Draw) │ (⇩ Export)        |
+------------------------------------------------------------------------------------------------+
  ( ) = neutral unavailable look   [ ]* = pressed (--color-accent-subtle, --color-accent-text border)
  exporting:  … │ [◌ Exporting…]   Spinner in place of the icon; Gallery and Open image disabled
```

### SCR-02 — Start screen

The canvas area scrolls vertically. Its content is one column, centred, at most 1120 px wide, with
`--space-7` side padding, so the drop area's left and right edges line up with the Gallery below
(AC-04).

- **Drop area** (`EmptyCanvas`, restyled): a `--radius-xl` card with a 2 px dashed
  `--color-border-strong` border on `--color-surface-raised`, `--space-8` padding, centred content:
  the `image-plus` icon at `--icon-size-lg` in `--color-accent-text`, the heading "Open an image to
  start" (`--font-size-2xl`, `--font-weight-bold`, a `<p>`, not a heading, so the outline is
  unchanged), the `BaseButton` primary `lg` "Open image" with `image-plus`, and the hint "or drop an
  image anywhere in this window" (`--font-size-sm`, `--color-text-muted`, as today). The card itself
  is not focusable and has no click handler (AC-04).
- **Gallery header** (`GalleryList`): "Gallery" (`--font-size-xl`), then on the right the count
  "{n} of 20 places used" (wording unchanged) above a 4 px × 120 px bar. The bar is a native
  `<meter min="0" max="20">`, `aria-hidden` because the visible count already says it, with its
  fill in `--color-accent-text` (dark) or `--color-accent` (light) on a `--color-surface-sunken` or
  `--color-border` track (4.10 / 4.21:1) (AC-09).
- **Storage note:** the existing Storage line text, unchanged, inside a `--radius-md` note on
  `--color-accent-subtle` with the `info` icon (`sm`, `--color-accent-text`) before it (AC-10).
- **Card grid:** `repeat(auto-fill, minmax(200px, 1fr))`, gap `--space-6`. Newest first, as today.
- **Work card** (`GalleryEntry`, restyled): a `<li>` with `--color-surface-raised`, `--radius-lg`,
  a 1 px `--color-border-subtle` border and `--shadow-sm`. On top is a 4:3 thumbnail box (every card
  the same shape), clipped by the card's top radius: the thumbnail `img` (`object-fit: contain`)
  over a second copy of the same object URL, `object-fit: cover`, blurred 16 px, scaled 1.1 and
  darkened by `--color-scrim`. Below are the name (one line, ellipsis, `title` = full name) and the
  second line in `--color-text-muted` (touched label, "Damaged"). The choosing `<button>` covers the
  thumbnail and the text and keeps `data-entry-id` and its name "{name}, {status}" (AC-06).
- **Card Delete:** the `BaseButton` ghost `sm` icon-only `trash-2`, keeping `data-delete-id`, its
  `aria-label` and the open-Work `aria-disabled` and `aria-describedby` hint, with
  `title` = its accessible name. It sits at the thumbnail's top-right corner, `--space-2` in, on
  `--color-glass` with `--radius-full`, and in DOM order **after** the choosing button, so the
  keyboard order is unchanged. It is hidden with `opacity: 0` (never `display: none` or
  `visibility: hidden`, so it stays in the keyboard order) and shown on the card's `:hover`, on
  `:focus-within` and always under `@media (hover: none)` (AC-06, AC-07).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | No Work open, Works stored (gallery SCR-01 `default`, AC-04, AC-06) | `EmptyCanvas` (`BaseButton` primary `lg` + `Icon`) · `GalleryStart` → `GalleryList` (`Icon` `info`) → `GalleryEntry` ×n (`BaseButton` ghost `sm` icon-only) | wireframe 02-a |
| listing | Before the list is read (gallery SCR-01 `listing`). No spinner and no skeleton (canon §Loading). Until a thumbnail paints, its box is `--color-surface-sunken` | as `default` | wireframe 02-a |
| empty | No Work stored (gallery SCR-01 `empty`). Count "0 of 20 places used" with an empty bar, the Storage note, then "Works you open will appear here." and `BaseButton` secondary "Open image" with `image-plus`, as today | `GalleryList` · `BaseButton` secondary · `Icon` | wireframe 02-b |
| unavailable | The Gallery store couldn't be opened (gallery SCR-01 `unavailable`). The title and reason show in a `--radius-md` note on `--color-surface-raised` with no icon. No count, no bar, no Storage note | `GalleryList` | wireframe 02-c |
| damaged card | A Damaged Work (gallery SCR-01 `damaged entry`, AC-09). No thumbnail and no blur: the box is `--color-surface-sunken` with `image-off` (`lg`, `--color-warning`) above "Can't be read", and the card border is 1 px `--color-warning`. It is still counted in the header, chooseable and deletable | `GalleryEntry` · `Icon` | wireframe 02-a (third card) |
| hover | Pointer over a card (AC-06). The card lifts by `translateY(-2px)` (≤ 4 px) with `--shadow-md`, its border turns `--color-accent-text`, and Delete appears. Transitions take `--duration-base` (200 ms) | `GalleryEntry` | wireframe 02-d |
| focus within | Keyboard focus on the card's button or its Delete, including after SCR-05 is cancelled (AC-07). Delete is visible. The focused control shows the focus ring | `GalleryEntry` | wireframe 02-d |
| touch | `@media (hover: none)`. Delete is always visible and nothing lifts (AC-06) | `GalleryEntry` | wireframe 02-d |
| drag-over | A file is dragged anywhere over the window (AC-04). The drop area's border turns 2 px solid `--color-accent-text` and its background `--color-accent-subtle`. Over it, `DropOverlay` shows "Drop an image to open it" in a solid pill on `--color-scrim`, so the highlight shows through | `EmptyCanvas` highlighted · `DropOverlay` (open-and-view, restyled) | wireframe 02-e |
| drop refused | The dropped file is not a Supported image (AC-05). The highlight and the overlay end, no Work opens, and open-and-view's refusal shows with its wording unchanged | `Toast` `failure` → SCR-06 | — |
| opening | A Supported image was picked or dropped: open-and-view's `Spinner` overlay, then SCR-01 with the Work | `Spinner` | — |
| reopening | A card chosen (gallery SCR-01 `reopening`). The `Spinner` overlay over the Gallery section, and the cards are inert | `Spinner` | — |
| reopen failed | As gallery SCR-01 `reopen failed (damaged)` and `(read)`. The card turns into `damaged card`, or stays as it was, and a notice shows | `Toast` `failure` → SCR-06 | — |
| delete | Delete on any card. There is no open Work on this screen, so it never looks unavailable here | → SCR-05 | — |
| deleted | SCR-05 confirmed. The card is removed, the count and bar drop by one, and focus moves to the next card, else the previous one, else the empty-state "Open image" (gallery rule, AC-12) | as `default` / `empty` | — |
| delete failed | As gallery SCR-01 `delete failed`. The card stays | `Toast` `failure` → SCR-06 | — |
| reduced motion | No lift, no zoom. Hover and focus change only colours, and Delete appears with no fade (AC-14) | tokens | — |
| validation | N/A: no typed input | — | — |

```text
02-a  default (third card damaged) — dark
+------------------------------------------------------------------------------------------------+
| ⌜•⌟ imgly │ ↶  ↷ │ ⌗ Crop and rotate  ⫶ Adjust  ✎ Draw │ (⇩ Export)                             |  SCR-01 01-b
+------------------------------------------------------------------------------------------------+
|    +----------------------------------------------------------------------------------------+  |
|    |                                        ⊞                                                |  |  image-plus lg
|    |                               Open an image to start                                    |  |  --font-size-2xl
|    |                                 [ ⊕  Open image ]                                       |  |  primary lg
|    |                       or drop an image anywhere in this window                          |  |  muted
|    +- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -+  |  2 px dashed
|                                                                                                |
|    Gallery                                                              3 of 20 places used    |
|                                                                         ▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱    |  meter, aria-hidden
|    +----------------------------------------------------------------------------------------+  |
|    | ⓘ Works are saved in this browser only, and the browser may clear them when space runs |  |  Storage note,
|    |   low. Export to keep a copy.                                                          |  |  --color-accent-subtle
|    +----------------------------------------------------------------------------------------+  |
|    +----------------------+   +----------------------+   +----------------------+              |
|    |░░░░┌──────────┐░░░░░|   |░┌──────────────────┐░|   |          ⊘           |              |  4:3 box: contain
|    |░░░░│  thumb   │░░░░░|   |░│      thumb       │░|   |    Can't be read     |              |  over blurred cover;
|    |░░░░└──────────┘░░░░░|   |░└──────────────────┘░|   |                      |              |  damaged: image-off,
|    +----------------------+   +----------------------+   +----------------------+              |  --color-warning border
|    | Beach.jpg            |   | Untitled             |   | Cat.png              |              |
|    | Just now             |   | 5 minutes ago        |   | Damaged              |              |  muted
|    +----------------------+   +----------------------+   +----------------------+              |
+------------------------------------------------------------------------------------------------+
```

```text
02-b  empty                                         02-c  unavailable
+-----------------------------------------------+   +-----------------------------------------------+
|  [drop area as 02-a]                          |   |  [drop area as 02-a]                          |
|  Gallery                 0 of 20 places used  |   |  Gallery                                      |  no count, bar, note
|                          ▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱  |   |  +-----------------------------------------+  |
|  ⓘ Works are saved in this browser only, …    |   |  | The Gallery is unavailable in this      |  |  note on raised,
|  Works you open will appear here.             |   |  | window.                                 |  |  no icon
|  ( ⊕ Open image )                             |   |  | This browser isn't letting the editor … |  |
|                                               |   |  +-----------------------------------------+  |
+-----------------------------------------------+   +-----------------------------------------------+
```

```text
02-d  hover / focus within / touch                  02-e  drag-over
+----------------------+                            +-----------------------------------------------+
|░░░┌──────────┐░(🗑)░░|  ↑ 2 px, --shadow-md         |▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒|  --color-scrim
|░░░│  thumb   │░░░░░░░|  border --color-accent-text |▒▒ +===================================+ ▒▒▒▒▒|
|░░░└──────────┘░░░░░░░|  (🗑) glass, sm icon-only   |▒▒ ‖  ⊞  Open an image to start     ‖ ▒▒▒▒▒|  drop area highlighted:
+----------------------+  focus within: ring on the  |▒▒ ‖     ┌─────────────────────────┐ ‖ ▒▒▒▒▒|  solid --color-accent-text,
| Beach.jpg            |  focused control, no lift   |▒▒ ‖     │ Drop an image to open it│ ‖ ▒▒▒▒▒|  --color-accent-subtle
| Just now             |  touch: (🗑) always shown,   |▒▒ +=====└─────────────────────────┘=+ ▒▒▒▒▒|  DropOverlay pill, solid
+----------------------+  no lift                    +-----------------------------------------------+
```

### SCR-03 — Gallery overlay

The same `GalleryList` as SCR-02 (header, bar, Storage note, cards, every state above) inside
gallery's modal `GalleryOverlay`, on `--color-surface`, under the top bar. The header's right end
shows the `BaseButton` ghost "Close" with the `x` icon after the count. In the top bar, "Gallery" is
`pressed`, and everything outside the overlay stays `inert`, as today.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Gallery" on SCR-01 with a Work open (gallery SCR-03 `default`). The open Work's card carries the "Open" badge (AC-08) | `GalleryOverlay` → `GalleryList` → `GalleryEntry` ×n · `BaseButton` ghost "Close" + `Icon` `x` | wireframe 03-a |
| open Work card | The Work open in this tab (AC-08). Its second line "Open" is a pill badge: `--radius-full`, `--font-size-xs`, `--font-weight-medium`, white on `--color-accent` (4.57:1), with no other marker. The card's name stays "{name}, Open" | `GalleryEntry` | wireframe 03-a |
| open Work Delete | Delete on the open Work's card (AC-08). It shows with the card on hover and focus, in the neutral unavailable look (`--color-surface-sunken`, muted icon), stays focusable with its hint, deletes nothing, and the existing refusal shows | `BaseButton` unavailable look · `Toast` `info` → SCR-06 | wireframe 03-a |
| empty / unavailable / damaged card / hover / focus within / touch / reopening / reopen failed / delete failed / reduced motion | As SCR-02, inside the overlay (gallery SCR-03 states unchanged) | as SCR-02 | wireframes 02-b to 02-d |
| delete (another card) | Delete on a card that is not open | → SCR-05 | — |
| deleted | SCR-05 confirmed. The card is removed and focus moves to the neighbouring card, else "Close" (AC-12, gallery rule) | as `default` | — |
| closed | "Close", `Esc`, or a card chosen. The overlay goes and focus returns to "Gallery", as today | → SCR-01 | — |
| drag-over | N/A: drops are ignored while the overlay is open (gallery SCR-03). No highlight | — | — |
| validation | N/A: no typed input | — | — |

```text
03-a  default, open Work's card hovered
+------------------------------------------------------------------------------------------------+
| ⌜•⌟ imgly │ [▦ Gallery]* ⊕ Open image │ ↶  ↷ │ ⌗ Crop and rotate  ⫶ Adjust  ✎ Draw │ [⇩ Export]   |  inert behind
+------------------------------------------------------------------------------------------------+
|    Gallery                                         3 of 20 places used        ( ✕ Close )      |
|                                                    ▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱                         |
|    ⓘ Works are saved in this browser only, …                                                   |
|    +----------------------+   +----------------------+   +----------------------+              |
|    |░░░┌──────────┐░(🗑)░░|   |░┌──────────────────┐░|   |░░┌────────────┐░░░░░|              |
|    |░░░│  thumb   │░░░░░░░|   |░│      thumb       │░|   |░░│   thumb    │░░░░░|              |
|    +----------------------+   +----------------------+   +----------------------+              |
|    | Beach.jpg            |   | Untitled             |   | Cat.png              |              |
|    | (● Open)             |   | 5 minutes ago        |   | 2 hours ago          |              |  badge on accent
|    +----------------------+   +----------------------+   +----------------------+              |
|      (🗑) = neutral unavailable look on the open Work's card                                   |
+------------------------------------------------------------------------------------------------+
```

### SCR-04 — Brand surfaces outside the page

Not drawn by the page. The app declares the files and colours, and the browser and the system draw
them (`sad.md` §3, §6 Critical flow 2). The artwork is §Brand mark.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default (browser tab) | The app open in a tab, in a light or dark browser (AC-01). `favicon.svg` (the gradient mark) is the tab icon. `icon-192.png` stays the fallback | `index.html` `<link rel="icon">` | `brand/logo-concept.png` panel E |
| app list icon | The app installed: the system's list of apps, dock or taskbar (AC-01). `icon-192.png` and `icon-512.png`: white mark on the gradient rounded square | web manifest `icons` | panel C |
| home-screen icon | Added to a home screen. `icon-maskable-512.png` (mark inside the 80% safe circle) where maskable icons are used, `apple-touch-icon-180.png` on iOS (AC-01) | manifest `purpose: maskable` · `<link rel="apple-touch-icon">` | panel D |
| title bar, dark | Installed app, system theme dark (AC-11). The title bar is `#15122A` from `<meta name="theme-color" media="(prefers-color-scheme: dark)">`, the same as SCR-01's top bar, so there is no band between them | two `theme-color` tags (ADR-0002) | wireframe 04-a |
| title bar, light | System theme light (AC-11). The title bar is `#F4F2FF`, the same as the top bar | two `theme-color` tags | wireframe 04-a |
| theme switch | The system theme changes while the app is open (AC-11). The browser repaints the title bar from the other tag, and the top bar repaints from `--color-titlebar` | — | — |
| starting | The Installed app opens, before the page has loaded (AC-11). The window shows the manifest's `theme_color` and `background_color` `#15122A`, in both themes | web manifest | — |
| Safari installed app | Best effort (AC-11, `sad.md` §11). Whatever Safari applies of the `theme-color` tags, checked once by hand. No fallback is drawn | — | — |
| error / empty / loading / validation | N/A: browser-owned surfaces. Nothing here can fail visibly, and "starting" above is the only before-load moment | — | — |

```text
04-a  Installed app window — dark (left) and light (right): one strip, no band
+-----------------------------------------------+   +-----------------------------------------------+
| ● ● ●              imgly                      |   | ● ● ●              imgly                      |  title bar: theme-color
| ⌜•⌟ imgly │ ▦ Gallery …            [⇩ Export] |   | ⌜•⌟ imgly │ ▦ Gallery …            [⇩ Export] |  top bar: --color-titlebar
+-----------------------------------------------+   +-----------------------------------------------+
|  #15122A above and below the line             |   |  #F4F2FF above and below the line             |
```

### SCR-05 — Delete confirmation

Gallery's `DeleteWorkDialog` on the shared `Dialog`, with its title, body and focus rules unchanged.
The dialog is `--color-surface-raised`, `--radius-xl`, `--shadow-lg`, over the existing backdrop.
Actions, right-aligned: `BaseButton` secondary "Cancel" with `x` (initial focus, `data-initial-focus`
as today), then `BaseButton` **danger** "Delete" with `trash-2` (AC-12).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Delete on a card that is not open, on SCR-02 or SCR-03 (AC-12, gallery SCR-04). Focus is on Cancel | `Dialog` · `BaseButton` secondary + `Icon` `x` · `BaseButton` danger + `Icon` `trash-2` | wireframe 05-a |
| hover / focus on Delete | The confirming button: `--color-danger-solid-hover`, and the focus ring at its offset | `BaseButton` danger | — |
| cancelled | Cancel, `Esc` or a backdrop click. Nothing is deleted, and focus returns to that card's Delete, which stays visible because focus is within the card (AC-07) | → SCR-02 / SCR-03 `focus within` | — |
| confirmed | Delete. The Work is deleted as today, and focus moves to the neighbouring card (AC-12) | → SCR-02 / SCR-03 `deleted` | — |
| error | The delete failed (gallery SCR-01 `delete failed`, `STORAGE_FAILED`). The dialog closes, the card stays, and the existing failure notice shows | → SCR-06 | — |
| loading | N/A: the delete has no busy state today (gallery SCR-04), and none is added | — | — |
| empty / validation | N/A: a two-button question | — | — |

```text
05-a  default
            +--------------------------------------------------+
            | Delete “Beach.jpg”?                              |  Dialog title (unchanged)
            |                                                  |
            | It can't be brought back. An Export is the only  |  body (unchanged)
            | copy kept outside this browser.                  |
            |                                                  |
            |                      ( ✕ Cancel )  [🗑 Delete ]  |  secondary, focused | danger
            +--------------------------------------------------+    (--color-danger-solid, white)
```

### SCR-06 — Notices

The shared `Toast` in `ToastStack`, bottom-right as today, with its kinds, wording, roles, timing and
slots unchanged. The look: `--color-surface-raised`, `--radius-lg`, `--shadow-md`, a 1 px
`--color-border-subtle` border whose 3 px left edge (as today) is `--color-accent-text` (`info`,
`lasting`) or `--color-danger` (`failure`). The optional action is `BaseButton` ghost `sm` with its icon and label, then Dismiss is
`BaseButton` ghost `sm` icon-only `x` (`aria-label="Dismiss"`, `title="Dismiss"`) (spec §1, AC-02).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default (info) | Any `info` notice, for example the open-Work refusal (AC-08), a tool-open hint, offline ready (pwa SCR-04) or evicted Works (gallery). It closes by itself after 6000 ms, as today | `Toast` `info` · `BaseButton` ghost icon-only `x` | wireframe 06-a |
| failure | Any `failure` notice, for example the unsupported-drop refusal (AC-05), a reopen, save or delete failure, or install failed. It stays until dismissed | `Toast` `failure` | wireframe 06-a |
| with action | The damaged-Work notice's "Delete…" (`trash-2`), or the update notice's "Reload" (`refresh-cw`, pwa SCR-05 `lasting`) | `Toast` action (`BaseButton` ghost `sm` + `Icon`) | wireframe 06-b |
| action busy | The update notice's action while waiting or reloading (pwa SCR-05). It reads "Reloading…", and a `Spinner` takes the icon's place, so there is still one symbol. It stays `aria-disabled` and focusable | `Toast` action busy · `Spinner` | wireframe 06-b |
| many | Several notices stack, as today (`ToastStack`) | `ToastStack` | — |
| reduced motion | Notices appear and go with no slide (AC-14) | tokens | — |
| empty | `ToastStack` with no notice renders nothing, as today | — | — |
| error / loading / validation | N/A as separate states: `failure` above is the error kind, `action busy` is the only wait, and there is no typed input | — | — |

```text
06-a  info (open-Work refusal) / failure (unsupported drop)
                                   +----------------------------------------------------+
                                   ┃ The open Work can't be deleted. Open another   (✕) |  info: accent-text edge
                                   ┃ image first.                                       |
                                   +----------------------------------------------------+
                                   +----------------------------------------------------+
                                   ┃ [open-and-view refusal wording, unchanged]     (✕) |  failure: danger edge
                                   +----------------------------------------------------+
06-b  with action / action busy
                                   +----------------------------------------------------+
                                   ┃ A new version of imgly is available.               |
                                   ┃                          ( ↻ Reload )          (✕) |  ghost sm + icon | icon-only
                                   +----------------------------------------------------+
                                   ┃                          ( ◌ Reloading… )      (✕) |  Spinner replaces ↻
```

### SCR-07 — Tool panels, export panel, other dialogs and full-screen messages

Every surface keeps its layout, behaviour and states from its own feature's manifest. Each action
button gains its icon from §Icon map, and every button takes the §Buttons look. The tool panels'
action rows stay as they are: Reset (ghost) at the left, then Cancel (secondary, `x`) and Apply
(primary, `check`) at the right.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Any SCR-07 surface is open. Every action button shows its icon from §Icon map next to its label, except the icon-only ones listed there, and takes the §Buttons look. Names, order and enabled rules are unchanged (AC-02, AC-03) | `BaseButton` + `Icon` | wireframes 07-a to 07-e |
| crop-rotate panel | Crop and rotate open. Rotate left and right and Flip horizontal and vertical are icon-only `ghost` with their `aria-label` and `title` (spec AC-03 as patched). Reset, Cancel and Apply have icons and labels | `BaseButton` + `Icon` · `SegmentedControl` (proportions, no icons) · `SliderField` | wireframe 07-a |
| adjust panel | Adjust open. Auto (`wand-sparkles`), Compare (`eye`, `pressed` while held), Reset, Cancel and Apply | `BaseButton` + `Icon` · `SliderField` ×7 | wireframe 07-a |
| adjust Auto unavailable | Auto can't run (adjust `autoAvailable` false). Neutral disabled look (AC-13) | `BaseButton` disabled | — |
| draw panel | Draw open. Clear (`eraser`, ghost), Cancel and Apply. The brush and eraser options and the colour swatches are choice controls and get no icon | `BaseButton` + `Icon` · `SegmentedControl` · `SliderField` | wireframe 07-a |
| export panel | The export panel open (`Popover`). Its confirm button "Export" is primary with `download` | `Popover` · `SegmentedControl` · `SliderField` · `BaseButton` primary + `Icon` | wireframe 07-b |
| exporting | An export runs. The confirm button reads "Exporting…" with a `Spinner` in place of `download` (export screens, unchanged wording) | `BaseButton` busy · `Spinner` | wireframe 07-b |
| file ready | The file is ready to save. "Save…" is primary with `save` | `BaseButton` primary + `Icon` | wireframe 07-b |
| export unavailable | The editor is busy (export `editorBusy`). Neutral disabled look | `BaseButton` disabled | — |
| zoom bar | A Work is open. Zoom out and Zoom in are icon-only (`zoom-out`, `zoom-in`) with their `aria-label` and `title` unchanged. Fit (`scan`) and 100% (`maximize`) keep their labels | `BaseButton` ghost `sm` + `Icon` | wireframe 07-c |
| replace confirmation | open-and-view's replace question. Cancel (secondary, `x`, initial focus as today) and Replace (primary, `replace`). Not `danger`, because only Delete is destructive (AC-12) | `Dialog` · `BaseButton` + `Icon` | wireframe 07-d |
| reload confirmation | pwa-install-update SCR-06. Cancel (secondary, `x`) and Reload (primary, `refresh-cw`) | `Dialog` · `BaseButton` + `Icon` | wireframe 07-d |
| display lost | The full-screen message with "Reload page" (primary, `refresh-cw`), as today | `CanvasMessage` · `BaseButton` primary + `Icon` | wireframe 07-e |
| unsupported browser | The full-screen message with no action, as today. Only the tokens change | `CanvasMessage` | — |
| focus / reduced motion | As §Buttons: the focus ring on every control, and no movement under reduced motion (AC-13, AC-14) | tokens | — |
| error | N/A as a state of these surfaces: their errors are SCR-06 notices or the full-screen messages above, unchanged | — | — |
| empty / validation | N/A: no surface here gains a list or a new input. The existing clamped fields keep their behaviour (canon §Validation) | — | — |

```text
07-a  tool panel action rows (crop-rotate / adjust / draw)
+--------------------------------------------+
| (↺▢) (↻▢) (⇋) (⇵)                          |  crop-rotate: icon-only ghost, as today
| [proportions SegmentedControl, no icons]   |
| ...                                        |
| ( ↺ Reset )          ( ✕ Cancel ) [✓ Apply]|  ghost | secondary | primary
+--------------------------------------------+
| ( ✧ Auto )  ( ◉ Compare )                  |  adjust: Compare pressed while held
| ( ↺ Reset )          ( ✕ Cancel ) [✓ Apply]|
+--------------------------------------------+
| ( ⌫ Clear )          ( ✕ Cancel ) [✓ Apply]|  draw
+--------------------------------------------+
```

```text
07-b  export panel confirm: idle / exporting / file ready
| [⇩ Export ]     [◌ Exporting… ]     [💾 Save… ]  |  primary; Spinner replaces the icon while busy
```

```text
07-c  zoom bar
| 4096 × 3072 px                                 (⊖)  42%  (⊕)  ( ⌖ Fit )  ( ⤢ 100% )  |  ghost sm
```

```text
07-d  replace / reload confirmation              07-e  display lost
+------------------------------------------+     +----------------------------------------------+
| [title and body unchanged]               |     | [title and body unchanged]                   |
|          ( ✕ Cancel ) [⇄ Replace ]       |     |              [↻ Reload page ]                |
|          ( ✕ Cancel ) [↻ Reload  ]       |     +----------------------------------------------+
+------------------------------------------+
```

## New components

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `NEW: Icon` (`src/shared/ui/Icon.vue`) | No primitive renders an icon. Today five files hand-draw inline SVGs at `--space-4` (`sad.md` §2). It renders a typed registry name as a decorative `<svg>` (ADR-0001) | registered |
| `NEW: AppLogo` (`src/shared/ui/AppLogo.vue`) | No primitive draws the brand. Today the top bar shows plain text. It draws §Brand mark, with an optional wordmark | registered |

Widened, not new (ADR-0003), and also re-registered in `docs/design-system.md` §Component inventory:

- **BaseButton** gains `icon`, `size` `sm` | `md` | `lg`, the `danger` variant, the neutral
  disabled and unavailable look, the busy icon slot and the focus offset (§Buttons).
- **Toast** gains `action.icon`, which the `Spinner` replaces while busy, the icon-only `x` Dismiss
  and the edge-coloured look (SCR-06).

Restyled feature components (`EditorTopBar`, `EmptyCanvas`, `DropOverlay`, `GalleryList`,
`GalleryEntry`, `DeleteWorkDialog`) are not primitives and are not registered. The tokens of
§Token values are recorded in `docs/design-system.md` §Token source.
