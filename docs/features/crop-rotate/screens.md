---
status: approved         # draft | approved
feature_size: "M"
tool: "code"
updated_at: "2026-10-07"
---

# Screens — crop-rotate

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below.
- **Inputs:** screen inventory from `ux-flows.md` (SCR-01 to SCR-06, all covered). States come from spec §5 ACs and the `sad.md` §6 flows F1–F8 with their `alt`/`else` branches. There is no `contracts/` folder, because the feature has no external interface (`target_surfaces: [web-frontend]`, no server), so no state comes from a contract error response. No new `AppError` code exists (`sad.md` §5, §8), so the only failure notices are open-and-view's own, shown unchanged while the tool is open.
- **SCR ids are this feature's** (ux-flows.md §Screen inventory). SCR-01 and SCR-02 match export's ids; SCR-04 is export's SCR-03 (Export panel), SCR-05 is open-and-view's SCR-03 (Replace confirmation), SCR-06 is open-and-view's SCR-06 (System file dialog).

### Shell changes

- **Top bar** (`EditorTopBar` actions slot): "Open image" (`BaseButton` secondary, unchanged), then `CropRotateAction` (`BaseButton` secondary "Crop and rotate", with a crop icon and the shortcut "C" in its tooltip), then `ExportAction` (`BaseButton` primary "Export"). `App.vue` mounts `CropRotateAction` before `ExportAction` (`sad.md` §5), so the action sits next to Export (AC-20).
- **Tool layout** (SCR-03): the `CropRotateTool` takes over the area between the top bar and the status bar in place, with no page change (ux-flows §Platform decisions). The canvas area keeps the Preview, with `CropOverlay` laid over it. A **tool panel** of width `--panel-width` sits on the right of the canvas, full height, background `--color-surface-raised`, holding `CropRotateControls`. Below 1024 px the panel moves under the canvas (canon §Platform posture), and nothing else changes.
- **Status bar** (`EditorStatusBar`): `DimensionsReadout` shows the Work's size from `workSize`, followed by ", from {W} × {H} px" whenever the width or the height differs from the Original's, compared in order (AC-01, AC-14). While the tool is open it still shows the Work as applied, not the Draft: the Draft's size is in the tool's width and height fields. `ZoomBar` is unchanged and keeps working in the tool (AC-19).
- Notices stay in `ToastStack` at the bottom right (single notice boundary).

### Keyboard

| Key | Where | Action | AC |
|---|---|---|---|
| `C` | SCR-01 | Opens the tool | AC-20 |
| `C` | SCR-02 | Shows the "open an image first" notice | AC-18 |
| `C` | Export panel open, tool already open, a text field focused, or an export running | Does nothing | AC-15, AC-20 |
| `Tab`, `Enter` / `Space` | SCR-01 | Reach and activate "Crop and rotate" | AC-20 |
| `Tab` | SCR-03 | Reaches every control: the frame, its 4 edges and 4 corners, then the panel's controls in order | AC-20 |
| Arrows (`Shift` ×10) | Frame focused | Move the frame by 1 px of the image (10 px) | AC-20 |
| Arrows (`Shift` ×10) | Edge or corner focused | Resize by 1 px (10 px); a locked proportion follows | AC-20 |
| Arrows (`Shift` ×10) | Straighten slider focused | Change the angle by 0.1° (1°) | AC-20 |
| `Enter` / `Space` | A focused button | Presses that button | AC-20 |
| `Enter` | Angle, width or height field | Applies the typed value. Never applies the tool | AC-07, AC-10 |
| `Enter` | Anywhere else in SCR-03 | Applies the tool | AC-20 |
| `Esc` | Anywhere in SCR-03, including a field | Cancels the tool; a value still being typed is discarded | AC-11, AC-20 |
| `Ctrl/Cmd+S` | SCR-03 | Shows the "apply or cancel the crop first" notice. Never the browser's "Save page" | AC-16 |
| Zoom keys, `Space`-drag pan | SCR-03 | As in the editor: never change the Draft, never count as an edit | AC-19 |

Focus moves to the frame when the tool opens. After Apply or Cancel it returns to the "Crop and rotate" action.

## Screens

### SCR-01 — Editor with Work

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A Work is open, no export running, no tool open. "Crop and rotate" is visible next to Export and reachable by keyboard (AC-20) | `EditorTopBar` with "Open image" + `CropRotateAction` (`BaseButton` secondary) + `ExportAction` · `PreviewCanvas` · `EditorStatusBar` (`DimensionsReadout`, `ZoomBar`) · `ToastStack` | wireframe 01-a |
| Geometry applied | After Apply with a Geometry (F6, AC-01). The Preview shows only the Crop, the View fits the Work, and the size reads "{w} × {h} px, from {W} × {H} px" whenever width or height differs in order, so a 90° Rotation alone shows it too | as `default`, `DimensionsReadout` with its "from" part | wireframe 01-b |
| tool open | "Crop and rotate" clicked, activated by keyboard, or `C` | → SCR-03 in place | — |
| exporting | An export is running (export AC-11, F1). "Crop and rotate" is visibly disabled and `C` does nothing; the request is refused, not queued (AC-15) | `CropRotateAction` (`BaseButton` disabled) + export's own exporting state | wireframe 01-c |
| success | N/A: Apply has no notice. The Preview and the size in the status bar are the outcome (ux-flows §Platform decisions) | — | — |
| error | N/A: applying a Geometry cannot fail (`sad.md` §8, no new `AppError`) | — | — |
| empty | N/A: a screen with no Work is SCR-02 | — | — |
| loading | N/A: opening the tool has no loading state; its readiness is the p95 ≤ 150 ms target (spec §6) | — | — |

```text
01-a  default
+------------------------------------------------------------------+
| imgly                 [ Open image ] [ Crop and rotate ] [ Export ] |  secondary · secondary · primary
+------------------------------------------------------------------+
|##################################################################|
|#########+------------------------------------------------+#######|
|#########|                     Preview                    |#######|
|#########+------------------------------------------------+#######|
+------------------------------------------------------------------+
| 4096 × 3072 px                          [-]  42%  [+] [Fit][100%] |
+------------------------------------------------------------------+
```

```text
01-b  Geometry applied (cropped and turned)
+------------------------------------------------------------------+
| imgly                 [ Open image ] [ Crop and rotate ] [ Export ] |
+------------------------------------------------------------------+
|###################+---------------------------+##################|
|###################|   Preview: only the Crop  |##################|  View fits the Work
|###################+---------------------------+##################|
+------------------------------------------------------------------+
| 1080 × 1920 px, from 4096 × 3072 px     [-]  61%  [+] [Fit][100%] |  "from" part, mono, muted
+------------------------------------------------------------------+
```

```text
01-c  exporting
+------------------------------------------------------------------+
| imgly             (Open image) (Crop and rotate) [ (o) Exporting… ] |  all three disabled
+------------------------------------------------------------------+
|#########|                     Preview                    |#######|  zoom and pan stay live
+------------------------------------------------------------------+
```

### SCR-02 — Empty editor

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | No Work is open (AC-18). "Crop and rotate" is shown but unavailable: it stays focusable (`aria-disabled`, not `disabled`) so a keyboard user can reach it and hear why, and its accessible description is the hint | `EditorTopBar` with `CropRotateAction` (`BaseButton` secondary, `aria-disabled`, styled disabled) + `ExportAction` (unavailable, export SCR-02) · open-and-view's `EmptyCanvas` unchanged | wireframe 02-a |
| hint | "Crop and rotate" activated, or `C` pressed, with no image open (AC-18) | as `default` + `Toast` `info` "Open an image first to crop or rotate it." (→ §Message catalog) | wireframe 02-a |
| empty | Same as `default`: SCR-02 *is* the no-Work state | as `default` | wireframe 02-a |
| loading | N/A: no tool can open here | — | — |
| error | N/A: no tool can open, so nothing can fail | — | — |

```text
02-a  default / hint
+------------------------------------------------------------------+
| imgly                            ( Crop and rotate )  ( Export )  |  both aria-disabled
+------------------------------------------------------------------+
|                                                                  |
|                         [ Open image ]                           |  EmptyCanvas (open-and-view)
|              or drop an image anywhere in this window            |
|                           +------------------------------------+ |
|                           | Open an image first to crop or     | |  Toast info, on
|                           | rotate it.                         | |  activate / C
|                           +------------------------------------+ |
+------------------------------------------------------------------+
```

### SCR-03 — Crop and rotate tool

Panel layout, top to bottom (`CropRotateControls`), each group with a small heading in `--font-size-xs`, `--color-text-muted`:

1. **Rotate and flip:** four `BaseButton` ghost icon buttons in a row, each with an `aria-label` and tooltip: "Rotate left", "Rotate right", "Flip horizontal", "Flip vertical".
2. **Straighten:** `SliderField` from −45 to 45 in steps of 0.1, unit "°", with a tick at 0. The number field shows one decimal (AC-05).
3. **Proportion:** `SegmentedControl` Free · Original · 1:1 · 4:3 · 3:2 · 16:9, then a second `SegmentedControl` Landscape · Portrait. Orientation is disabled for Free and 1:1, where it has no meaning (AC-08).
4. **Size:** two `NumberField`s "Width" and "Height", unit "px", side by side (AC-09).
5. **Footer:** `BaseButton` ghost "Reset" on the left; `BaseButton` secondary "Cancel" and `BaseButton` primary "Apply" on the right.

Canvas area (`CropOverlay` over `PreviewCanvas`): the whole Turned image fitted to the View, with transparent empty corners showing the canvas surround. Outside the frame, four dimming panels in `--color-canvas-surround` at 0.7 opacity, the same dimming the `Dialog` backdrop uses. The frame is a 1 px line in `--color-text` with 8 handles (4 corners, 4 edge midpoints). Each handle and the frame are focusable, showing `--color-focus-ring` when focused.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Tool opened (F1, AC-12, AC-19). The Draft is the Work's Geometry: whole Turned image, frame where the Crop is, outside dimmed, View fitted to the whole Turned image. Proportion is Free the first time for this Work, else the remembered one (AC-08). Width and height show the frame's size. "Crop and rotate" shows as pressed (`aria-pressed`), "Export" as unavailable (AC-16), "Open image" stays available (AC-17) | `CropRotateTool` · `CropOverlay` · `CropRotateControls` (`BaseButton` ×7, `SliderField`, `SegmentedControl` ×2, `NumberField` ×2) · `PreviewCanvas` · `ZoomBar` | wireframe 03-a |
| dragging the frame | An edge, corner or the inside of the frame is dragged (F2, AC-01). A rule-of-thirds grid shows inside the frame while dragging. The frame stops at the image edge and never goes below 1 × 1 px or turns inside out (AC-02). Width and height follow (AC-09) | as `default` + thirds grid in `CropOverlay` | wireframe 03-b |
| straightening | The slider is dragged, an arrow key moves it, or an angle is applied from its field (F4, AC-05). A fine grid shows over the image while the angle changes. The frame shrinks around its centre to fit and never grows back by itself (AC-06). The slider and field show the angle with one decimal, signed, 0 marked | as `default` + fine grid in `CropOverlay` | wireframe 03-c |
| turned or mirrored | Rotate or flip chosen (F3, AC-03, AC-04). Image and frame turn or mirror together, width and height swap on a turn, a locked 4:3 becomes 3:4, and after a flip the slider shows the angle with its sign changed | as `default` | wireframe 03-a |
| proportion locked | A proportion other than Free is chosen (F5, AC-08). The frame becomes the largest of that proportion inside the current frame and keeps it while dragged or resized, until Free | as `default`, `SegmentedControl` selection, orientation enabled except for 1:1 | wireframe 03-a |
| typing (pending) | The Editor is typing in the angle, width or height field. Nothing is checked yet (AC-07, AC-10) | `NumberField` pending text | — |
| validation | The Editor leaves a field or presses `Enter` in it (F4, F5). Out of range snaps to the bound, a fraction rounds, zero or negative size becomes 1, a too-large size becomes the largest that fits, and empty or non-numeric text (including `1e2`) reverts. No inline error message, per the canon's §Validation: the corrected value is the feedback | `NumberField` showing the corrected value | — |
| reset | "Reset" chosen (F6, AC-12). The Draft shows no Geometry: no Rotation, no Flip, 0°, frame on the whole image, proportion Free. The Work is unchanged until Apply | as `default` | wireframe 03-a |
| export refused | Export or `Ctrl/Cmd+S` while the tool is open (F7, AC-16). The browser's "Save page" never opens | as `default` + `Toast` `info` "Apply or cancel the crop first, then export." | wireframe 03-d |
| loading (reading a new image) | "Open image" or a drop while the tool is open, until the new image is read (F8, AC-17). open-and-view's canvas loading overlay shows. The tool stays open with its Draft | as `default` + open-and-view's `Spinner` overlay on the canvas | — |
| error (new image can't open) | The new image can't be read or isn't supported (F8). open-and-view's failure notice shows. The tool stays open exactly as it was | as `default` + open-and-view's `Toast` `failure` (unchanged copy) | — |
| replace confirmation | The new image was read and the Work has Unsaved edits (F8) | → SCR-05 over this screen; declining returns here unchanged | — |
| closed | Apply (→ SCR-01, `default` or `Geometry applied`), Cancel or `Esc` (→ SCR-01 as before), or a successful replace (→ SCR-01 with the new Work) (F6, F8, AC-11, AC-13, AC-19) | — | — |
| empty | N/A: the tool only opens on a Work (AC-18) | — | — |
| success | N/A: Apply closes the tool, and its outcome is SCR-01's Preview and status bar | — | — |
| display lost | open-and-view's display-lost message replaces the canvas area unchanged (`sad.md` §8); `CropOverlay` is part of that area and is hidden with it. The panel stays, so Cancel still works | open-and-view's `CanvasMessage` | — |

```text
03-a  default (straightened 3.4°, proportion 4:3, landscape)
+-------------------------------------------------------------------------------+
| imgly        [ Open image ] [ Crop and rotate ]=pressed   ( Export )          |  Export unavailable
+-------------------------------------------------------------------------------+
|       .   .   .   .   .   .   .   .  |  ROTATE AND FLIP                        |
|   . /''''''''''''''''''''''''''''\   |  [↺] [↻] [⇋] [⇵]                        |  ghost icon buttons
|  . /:::::::::::::::::::::::::::::::\ |                                         |
|   /::::o--------o--------o::::::::::\|  STRAIGHTEN                             |
|  |:::::|                 |::::::::::| |  -45 ---------|--o-------- 45  [ 3.4 ]° |  SliderField, 0 tick
|  |:::::o     frame       o::::::::::| |                                        |
|  |:::::|                 |::::::::::| |  PROPORTION                            |
|   \::::o--------o--------o::::::::/  |  (Free)(Original)(1:1)[4:3](3:2)(16:9) |  SegmentedControl
|    \:::::::::::::::::::::::::::::/   |  [Landscape](Portrait)                  |
|  .  \,,,,,,,,,,,,,,,,,,,,,,,,,,,/  . |                                         |
|       .   .   .   .   .   .   .   .  |  SIZE                                   |
|  ::: dimmed   o handles   . corners  |  Width [ 2880 ] px   Height [ 2160 ] px |  NumberField ×2
|      outside the turned image show   |                                         |
|      the canvas surround             |  [ Reset ]          [ Cancel ] [ Apply ]|  ghost · secondary · primary
+-------------------------------------------------------------------------------+
| 4096 × 3072 px                                    [-]  38%  [+] [Fit][100%]   |  the Work as applied
+-------------------------------------------------------------------------------+
```

```text
03-b  dragging the frame (rule-of-thirds grid)        03-c  straightening (fine grid)
   o-------o-------o                                    +--+--+--+--+--+--+--+
   |   |       |   |                                    |  |  |  |  |  |  |  |
   |---+-------+---|  thirds, only while dragging       +--+--+--+--+--+--+--+  fine grid over the image,
   |   |       |   |                                    |  |  |  |  |  |  |  |  only while the angle changes
   |---+-------+---|                                    +--+--+--+--+--+--+--+
   |   |       |   |                                    frame shrinks to fit, never grows back
   o-------o-------o
   Width and Height fields follow the drag
```

```text
03-d  export refused
+-------------------------------------------------------------------------------+
| imgly        [ Open image ] [ Crop and rotate ]=pressed   ( Export )          |
+-------------------------------------------------------------------------------+
|                      ...tool as in 03-a...                                    |
|                                           +----------------------------------+|
|                                           | Apply or cancel the crop first,  ||  Toast info
|                                           | then export.                     ||
|                                           +----------------------------------+|
+-------------------------------------------------------------------------------+
```

### SCR-04 — Export panel

export's panel (export screens.md SCR-03), unchanged except for the states below. It cannot open while the tool is open (SCR-03 `export refused`).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Panel opened with a Geometry applied (F7, AC-14). "Full size" and the presets count from the Crop's size, and the size readout shows the Work's size after its Geometry | export's `ExportPanel` unchanged | export screens.md 03-a |
| remembered size snapped | A remembered long side larger than the Work (after a tighter Crop). The field shows the Work's full size, but the remembered value is kept and comes back when the Crop is widened again (AC-14) | `NumberField` (long side) showing the snapped value | — |
| transparency check running | JPEG selected, the Original has transparent pixels and the Work has a Geometry (F7, ADR-0004). The hint stays hidden until the check answers | as `default`, no hint | — |
| transparency hint | The check found a pixel inside the Crop that is not fully opaque, or the check failed (the safe side) (AC-14) | export's JPEG transparency hint, unchanged copy | export screens.md 03-a |
| no transparency hint | The check found every pixel inside the Crop opaque, for example the transparent corner was cropped away (AC-14) | as `default`, no hint | — |
| error, loading, success | Unchanged from export's SCR-03 and SCR-01: the export flows run as before from the verified file | export's states | export screens.md |
| empty | N/A: the panel only opens on a Work | — | — |

### SCR-05 — Replace confirmation

open-and-view's `ReplaceDialog` (`Dialog`), unchanged in look and copy.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A new image was read while the Work has Unsaved edits, from SCR-01 or from SCR-03 (F8, AC-17). Unapplied changes in the tool never count as Unsaved edits on their own, so with only a Draft and no applied edits this dialog does not appear | `ReplaceDialog` (`Dialog`) unchanged | open-and-view screens.md SCR-03 |
| declined | "Cancel" or `Esc`: back to the screen it came from, unchanged. From SCR-03 the tool stays open with its Draft and focus returns into the tool | — | — |
| replaced | "Replace": the new Work opens in SCR-01. From SCR-03 the tool closes and its Draft is discarded | — | — |
| error, loading, empty | N/A: the dialog is a confirmation only; reading happened before it, and failures are SCR-03 or SCR-01 `error` | — | — |

### SCR-06 — System file dialog

The operating system's own file picker, not designed by us (open-and-view SCR-06).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Open image" on SCR-01 or SCR-03 (F8) | platform | — |
| cancelled | Nothing chosen: back to the screen it came from, unchanged. From SCR-03 the tool keeps its Draft (AC-17) | — | — |
| file chosen | → open-and-view's open pipeline; from SCR-03 it continues as SCR-03 `loading (reading a new image)` | — | — |
| error, empty | N/A: the platform dialog has no states of ours | — | — |

## Message catalog

The seed for `src/features/crop-rotate/messages.ts` (`sad.md` §5). **info** notices dismiss themselves. Labels and tooltips are the controls' accessible names.

| Kind | Trigger | AC | Copy |
|---|---|---|---|
| info | "Crop and rotate" or `C` with no image open | AC-18 | Open an image first to crop or rotate it. |
| info | Export or `Ctrl/Cmd+S` while the tool is open | AC-16 | Apply or cancel the crop first, then export. |
| tooltip | "Crop and rotate" action | AC-20 | Crop and rotate (C) |
| readout | status bar, size differs from the Original | AC-01, AC-14 | {w} × {h} px, from {W} × {H} px |
| label | rotate buttons | AC-03 | Rotate left · Rotate right |
| label | flip buttons | AC-04 | Flip horizontal · Flip vertical |
| label | straighten slider and field | AC-05 | Straighten |
| label | proportion groups | AC-08 | Proportion · Free · Original · 1:1 · 4:3 · 3:2 · 16:9 · Landscape · Portrait |
| label | size fields | AC-09 | Width · Height |
| label | frame and handles (screen readers) | AC-20 | Crop frame · Top edge · Right edge · Bottom edge · Left edge · Top-left corner · Top-right corner · Bottom-right corner · Bottom-left corner |
| button | footer | AC-11, AC-12 | Reset · Cancel · Apply |

## New components

**Shared primitives** go to `src/shared/ui/`, and `implement` registers each one in `docs/design-system.md` §Component inventory. **Feature composites** go to `src/features/crop-rotate/` and stay out of the shared inventory. No new shared primitive is needed; three existing ones gain a small option.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `SliderField` (extended: `step`, `decimals`, `marks`) | The straighten slider needs 0.1° steps, one decimal shown and a tick at 0 (AC-05). Today `SliderField` is step 1 with whole numbers. An option keeps one slider primitive instead of a second one | pending (update its row) |
| `NumberField` (extended: decimal and signed input) | The angle field accepts a sign and one decimal point or comma (AC-07); today it is `inputmode="numeric"`. Its caller's `normalize` already decides what is a number | pending (update its row) |
| `BaseButton` (extended: `pressed`) | "Crop and rotate" shows as pressed (`aria-pressed`) while the tool is open; `BaseButton` has no pressed state | pending (update its row) |
| `CropRotateAction` (feature composite) | `BaseButton` secondary "Crop and rotate" with its pressed, disabled-during-export and unavailable (`aria-disabled` + hint) states, mounted in the top-bar slot by `App.vue` | n/a (feature-local) |
| `CropRotateTool` (feature composite) | SCR-03's layout: the tool panel beside the canvas and `CropOverlay` over it, mounted in the editor's tool slot (`sad.md` §5) | n/a (feature-local) |
| `CropRotateControls` (feature composite) | SCR-03's panel, composed from `BaseButton`, `SliderField`, `SegmentedControl` and `NumberField` | n/a (feature-local) |
| `CropOverlay` (feature composite) | The dimming, frame, 8 focusable handles and both grids as DOM over the WebGL canvas (ADR-0005). Nothing in the inventory draws over the canvas or handles pointer drags | n/a (feature-local) |
