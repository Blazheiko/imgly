---
status: approved          # draft | approved
feature_size: "M"
tool: "code"
updated_at: "2026-10-09"
---

# Screens — draw

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below.
- **Inputs:** screen inventory from `ux-flows.md` (SCR-01 to SCR-08, all covered). States come from spec §5 ACs and the `sad.md` §6 flows F1–F7 with their `alt`/`else` branches, plus the design's Critical flows 1 and 2. There is no `contracts/` folder, because the feature has no external interface (`target_surfaces: [web-frontend]`, no server), so no state comes from a contract error response. No new `AppError` code exists (`sad.md` §8): the width rules never fail, painting and Apply cannot fail, and the only failure notices are open-and-view's and export's own, shown unchanged.
- **SCR ids are this feature's** (ux-flows.md §Screen inventory). SCR-01 and SCR-02 match the earlier tools' ids. SCR-04 is crop-rotate's SCR-03, SCR-05 is adjust's SCR-03, SCR-06 is export's SCR-03 (Export panel), SCR-07 is open-and-view's SCR-03 (Replace confirmation) and SCR-08 is open-and-view's SCR-06 (System file dialog).
- **Reused unchanged, so no draw task builds them:** SCR-07 and SCR-08, and SCR-03's `loading (reading a new image)`, `error (new image can't open)` and `replace confirmation` rows, are open-and-view's screens shown as they are while the tool is open (AC-13). Zoom and pan inside the tool are the editor's View, also unchanged (AC-18). SCR-04, SCR-05 and SCR-06 change only through the shared renderer and export path (`sad.md` §5), not through new UI, except for the `draw refused` rows.

### Shell changes

- **Top bar** (`EditorTopBar` actions slot): "Open image" (`BaseButton` secondary, unchanged), then `CropRotateAction`, then `AdjustAction`, then `DrawAction` (`BaseButton` secondary "Draw", with a brush icon and the shortcut "D" in its tooltip), then `ExportAction` (`BaseButton` primary "Export"). `App.vue` mounts `DrawAction` right after `AdjustAction` (`sad.md` §5), so it sits next to "Adjust" (AC-19).
- **Unavailable actions** follow the `CropRotateAction` and `AdjustAction` precedent: an action that cannot run now but is not blocked by an export stays focusable (`aria-disabled`, styled at 0.45 opacity, not `disabled`). Its hint is its accessible description, and activating it, or pressing its key, shows the same hint as a `Toast` `info`. During an export the action is truly `disabled` and its key does nothing (AC-14).
- **Tool layout** (SCR-03): `DrawTool` takes the editor's tool slot in place, like `AdjustTool`: a **tool panel** of width `--panel-width` on the right of the canvas, full height, background `--color-surface-raised`, holding `DrawControls`. The canvas area keeps the `PreviewCanvas` at the current zoom and pan with the Work's Crop (AC-18). `DrawOverlay` sits over it in the `#tool-canvas` slot and takes the pointer. Below 1024 px the panel moves under the canvas (canon §Platform posture), and nothing else changes.
- **Pointer over the image** (SCR-03): over the shown image the system cursor is hidden and a **width circle** follows the pointer. It is a ring whose diameter is the width at the current zoom (width × zoom device pixels), drawn as a 1 px `--color-text` ring inside a 1 px `--color-surface` ring so it shows on light and dark photos. The ring never takes the pointer and never draws itself. It follows the zoom live. Outside the shown image, over the canvas surround, the normal cursor shows and no ring is drawn (AC-02). A press there still starts a Stroke, which is clipped to the Crop (AC-09).
- **Status bar** (`EditorStatusBar`): unchanged. Drawing never changes the Work's size, so `DimensionsReadout` reads exactly as before, and `ZoomBar` keeps working in the tool (AC-18).
- Notices stay in `ToastStack` at the bottom right (single notice boundary).

### Keyboard

| Key | Where | Action | AC |
|---|---|---|---|
| `D` (the letter d, else the D key's position) | SCR-01 | Opens the tool | AC-19 |
| `D` | SCR-02 | Shows the "open an image first" notice | AC-17 |
| `D` | SCR-04 or SCR-05 open | Shows the "apply or cancel the open tool first" notice; nothing while a text field has focus | AC-16 |
| `D` | Export panel open, the tool already open, a text field focused, or an export running | Does nothing | AC-14, AC-19 |
| `C`, `A` | SCR-03 | Show the "apply or cancel the open tool first" notice; nothing while a text field has focus | AC-16 |
| `Tab`, `Enter` / `Space` | SCR-01 | Reach and activate "Draw" | AC-19 |
| `Tab` | SCR-03 | Reaches every control in panel order: the mode group, the palette group, the custom colour, the width slider, its number field, Clear, Cancel, Apply | AC-19 |
| Arrows | The mode or palette group focused | Move and select within the group (roving tabindex) | AC-19 |
| `B` / `E` (letter first, else key position) | SCR-03, no text field focused | Select the Brush / the Eraser | AC-19 |
| `[` / `]` (character first, else the two keys right of P), `Shift` ×10 | SCR-03, no text field focused | Width 1 (10) smaller / larger, repeating while held, kept within 1 to 200 | AC-19 |
| Arrows (`Shift` ×10) | The width slider focused | Width 1 (10) smaller / larger, kept within 1 to 200 | AC-19 |
| `Enter` / `Space` | A focused button | Presses that button | AC-19 |
| `Enter` | The width field | Applies the typed width. Never applies the tool | AC-03 |
| `Enter` | Anywhere else in SCR-03 | Applies the tool, after the pointer is released if a Stroke is in progress | AC-18, AC-19 |
| `Esc` | Anywhere in SCR-03, including a field, also during a Stroke | Cancels the tool; a width still being typed and a Stroke in progress are discarded | AC-06, AC-18, AC-19 |
| `Ctrl/Cmd+S` | SCR-03 | Shows the "apply or cancel the drawing first" notice. Never the browser's "Save page" | AC-15 |
| Zoom keys, wheel, pinch, `Space`-drag pan | SCR-03 (outside a focused button or field) | As in the editor: never draw, never change the Draft, never count as an edit. During a Stroke, `Space` does not start a pan | AC-18 |

All of `D`, `B`, `E`, `[` and `]` type normally in a text field (AC-19). A key, colour or width change during a Stroke applies from the next Stroke (AC-18). Focus moves to the mode group (on "Brush") when the tool opens. After Apply or Cancel it returns to the "Draw" action.

## Screens

### SCR-01 — Editor with Work

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A Work is open, no export running, no tool open. "Draw" is visible next to "Adjust" and reachable by keyboard (AC-19) | `EditorTopBar` with "Open image" + `CropRotateAction` + `AdjustAction` + `DrawAction` (`BaseButton` secondary) + `ExportAction` · `PreviewCanvas` · `EditorStatusBar` (`DimensionsReadout`, `ZoomBar`) · `ToastStack` | wireframe 01-a |
| marks applied | After Apply (F5, AC-01). The Preview shows the Work with its Geometry, its Adjustments and the Drawing layer on top, at the same zoom and pan as before (AC-18). Unsaved edits are set only when the Draft changed something (AC-12) | as `default` | wireframe 01-a |
| tool open | "Draw" clicked, activated by keyboard, or `D` | → SCR-03 in place | — |
| exporting | An export is running (F1, AC-14). "Draw" is visibly `disabled` and `D` does nothing; the request is refused, not queued | `DrawAction` (`BaseButton` disabled) + export's own exporting state | wireframe 01-b |
| success | N/A: Apply has no notice. The Preview is the outcome (ux-flows §Platform decisions) | — | — |
| error | N/A: applying a drawing cannot fail (`sad.md` §8, no new `AppError`) | — | — |
| empty | N/A: a screen with no Work is SCR-02 | — | — |
| loading | N/A: opening the tool has no loading state; its readiness is the p95 ≤ 150 ms target (spec §6) | — | — |

```text
01-a  default / marks applied
+--------------------------------------------------------------------------------------+
| imgly   [ Open image ] [ Crop and rotate ] [ Adjust ] [ Draw ] [ Export ]            |  secondary ×4 · primary
+--------------------------------------------------------------------------------------+
|######################################################################################|
|#########+------------------------------------------------------+#####################|
|#########|  Preview: Geometry + Adjustments + Drawing layer  ~O~ |#####################|  View unchanged by the tool
|#########+------------------------------------------------------+#####################|
+--------------------------------------------------------------------------------------+
| 4096 × 3072 px                                          [-]  42%  [+] [Fit][100%]    |  unchanged by drawing
+--------------------------------------------------------------------------------------+
```

```text
01-b  exporting
+--------------------------------------------------------------------------------------+
| imgly  (Open image) (Crop and rotate) (Adjust) (Draw) [ (o) Exporting… ]             |  all disabled
+--------------------------------------------------------------------------------------+
|#########|                     Preview                          |#####################|  zoom and pan stay live
+--------------------------------------------------------------------------------------+
```

### SCR-02 — Empty editor

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | No Work is open (AC-17). "Draw" is shown but unavailable: focusable (`aria-disabled`), with the hint as its accessible description | `EditorTopBar` with `CropRotateAction`, `AdjustAction` and `DrawAction` (`BaseButton` secondary, `aria-disabled`) + `ExportAction` (unavailable) · open-and-view's `EmptyCanvas` unchanged | wireframe 02-a |
| hint | "Draw" activated, or `D` pressed, with no image open (F1, AC-17) | as `default` + `Toast` `info` "Open an image first to draw on it." (→ §Message catalog) | wireframe 02-a |
| empty | Same as `default`: SCR-02 *is* the no-Work state | as `default` | wireframe 02-a |
| loading | N/A: no tool can open here | — | — |
| error | N/A: no tool can open, so nothing can fail | — | — |

```text
02-a  default / hint
+--------------------------------------------------------------------------------------+
| imgly                  ( Crop and rotate ) ( Adjust ) ( Draw )  ( Export )           |  all aria-disabled
+--------------------------------------------------------------------------------------+
|                                                                                      |
|                                 [ Open image ]                                       |  EmptyCanvas (open-and-view)
|                      or drop an image anywhere in this window                        |
|                                             +------------------------------------+   |
|                                             | Open an image first to draw on it. |   |  Toast info, on
|                                             +------------------------------------+   |  activate / D
+--------------------------------------------------------------------------------------+
```

### SCR-03 — Draw tool

Panel layout, top to bottom (`DrawControls`). Group headings are in `--font-size-xs`, `--color-text-muted`:

1. **Mode:** `SegmentedControl` "Mode" with "Brush" and "Eraser". It opens on "Brush" every time (AC-01).
2. **Colour:** `SegmentedControl` "Colour" with the 10 preset colours as `swatch` options, in the order of AC-02 (Black, White, Red, Orange, Yellow, Green, Cyan, Blue, Purple, Pink), wrapping onto two rows of five. Each swatch is a square filled with its colour inside a `--color-border` frame, with its name as its accessible name and tooltip. The chosen one shows the selected ring. When the colour is a custom one that matches no preset, no swatch is selected (`modelValue: null`). Next to the group is **"Custom colour"**: the browser's native colour input, drawn as a swatch of the current custom colour (or a neutral dashed square before one is chosen), with that label. It offers any fully opaque colour. It shows the selected ring when the current colour is a custom one.
3. **Width:** `SliderField` "Width", 1 to 200, step 1, unit "px", with no neutral mark. The number field accepts a trailing "px" in any case, with or without spaces (AC-03). Its tooltip is "Width ([ and ], Shift for 10)".
4. **Footer:** `BaseButton` ghost "Clear" on the left; `BaseButton` secondary "Cancel" and `BaseButton` primary "Apply" on the right.

The colour controls stay enabled with the Eraser selected: a colour chosen then applies to later Brush Strokes. The Brush and the Eraser share the width (AC-02).

Canvas area: the `PreviewCanvas` showing the image with its Geometry and applied Adjustments and the Draft on top, at the current zoom and pan, with the Work's Crop (AC-11, AC-18). `DrawOverlay` sits over it, taking the pointer and drawing the width circle (§Shell changes).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Tool opened (F1, AC-01, AC-18). The Draft is the Work's applied layer, empty for a new Work. Mode "Brush", the colour and width as last chosen in this session (Red and 12 px the first time). The View is unchanged, apart from the re-fit or pan clamp the narrower canvas area needs while the panel is open, as with "Adjust" (AC-18). "Draw" shows as pressed (`aria-pressed`). "Crop and rotate", "Adjust" and "Export" show as unavailable (`aria-disabled`, AC-15, AC-16). "Open image" stays available (AC-13) | `DrawTool` · `DrawControls` (`SegmentedControl` ×2, native colour input, `SliderField`, `BaseButton` ×3) · `PreviewCanvas` · `DrawOverlay` · `ZoomBar` | wireframe 03-a |
| empty (no marks) | The Draft has no marks: a new Work, or after Clear (F1, F4, AC-05). The Preview shows the image alone. Every control works as in `default` | as `default` | wireframe 03-a |
| drawing | The main button is pressed and dragged over the canvas with the Brush (F2, AC-01). The Stroke grows under the width circle at 30 or more updates a second, as one smooth line of the chosen colour and width with round ends, through every pointer position. Only the part inside the Crop is painted (AC-09). No loading indicator (canon §Loading) | as `default` | wireframe 03-b |
| dot | A click without moving (F2, AC-01). One round dot of the width, clipped to the Crop | as `default` | — |
| erasing | The Eraser selected (button, `E`) and dragged or clicked (F4, AC-04). Marks under the path, at the width, disappear and the image shows exactly as where nothing was drawn. A mark may keep a partly transparent fringe up to 1 px wide at the path's edge. Where nothing is drawn, nothing changes | as `default` with "Eraser" selected | wireframe 03-c |
| input during a Stroke | A colour, mode or width change (control, `B`, `E`, `[`, `]`), `Space` or `Enter` while the pointer is still pressed (F2, AC-18). The control shows the new value at once, and it applies from the next Stroke. `Space` does not pan, and `Enter` applies the tool only after release | as `drawing` | — |
| zoom and pan | Wheel, pinch, the zoom keys or `Space`-drag, also during a Stroke (F2, AC-18). The View changes and the width circle follows the new zoom. No Stroke is made or broken | as `default` + `ZoomBar` | — |
| Stroke ended early | A pointer cancel, the window losing focus, or a second touch during a Stroke (F2, AC-18). The Stroke stops where it is and what was drawn is kept | as `default` | — |
| colour chosen | A palette swatch selected by click or arrows (F3, AC-02). That swatch shows the selected ring. The next Strokes use it | as `default` | wireframe 03-a |
| custom colour | "Custom colour" chosen and a colour picked in the browser's picker (F3, AC-02). No preset is selected unless the colour equals one, and the custom swatch shows the colour with the selected ring | as `default` + the browser's colour picker | wireframe 03-c |
| width changed | The slider dragged, its arrow keys, or `[` / `]` (F3, AC-02, AC-19). The field and the width circle follow, within 1 to 200 | as `default` | — |
| typing (pending) | The Editor is typing in the width field. Nothing is checked yet, and the width stays as before (AC-03) | `NumberField` pending text | — |
| validation | The Editor leaves the width field or presses `Enter` in it (F3, AC-03). Out of range snaps to 1 or 200, a fraction rounds half up, empty or non-numeric text (including `1e2`) reverts, and "20px", "20 px" and "20PX" mean 20. No inline error message, per the canon's §Validation: the corrected value is the feedback | `NumberField` showing the corrected width | — |
| cleared | "Clear" chosen (F4, AC-05). Every mark disappears from the Preview at once, with no confirmation, including applied marks and marks outside the Crop. → `empty (no marks)`. Strokes drawn afterwards are kept | as `default` | wireframe 03-a |
| export refused | Export or `Ctrl/Cmd+S` while the tool is open (F7, AC-15). The browser's "Save page" never opens | as `default` + `Toast` `info` "Apply or cancel the drawing first, then export." | wireframe 03-d |
| tool refused | "Crop and rotate" or "Adjust" activated, or `C` / `A` outside a text field, while the tool is open (F7, AC-16) | as `default` + `Toast` `info` "Apply or cancel the open tool first." | wireframe 03-d |
| loading (reading a new image) | "Open image" or a drop while the tool is open, until the new image is read (F5, AC-13). open-and-view's canvas loading overlay shows. The tool stays open with its Draft | as `default` + open-and-view's `Spinner` overlay on the canvas | — |
| error (new image can't open) | The new image can't be read or isn't supported (F5, AC-13). open-and-view's failure notice shows. The tool stays open exactly as it was | as `default` + open-and-view's `Toast` `failure` (unchanged copy) | — |
| replace confirmation | The new image was read and the Work has Unsaved edits from an earlier Apply (F5, AC-13) | → SCR-07 over this screen; declining returns here unchanged | — |
| closed | Apply (→ SCR-01 `marks applied`), Cancel or `Esc` (→ SCR-01 with the layer from before), or a successful replace (→ SCR-01 with the new Work and no layer) (F5, AC-06, AC-12, AC-13). The View is unchanged by Apply and Cancel | — | — |
| display lost | open-and-view's display-lost message replaces the canvas area unchanged (`sad.md` §8). With no image shown there is nothing to draw on. The panel stays, so the controls, Clear, Cancel and Apply still work | open-and-view's `CanvasMessage` | — |
| success | N/A: Apply closes the tool, and its outcome is SCR-01's Preview | — | — |
| error (apply) | N/A: painting, Clear, Apply and the width rules cannot fail (`sad.md` §8) | — | — |

```text
03-a  default (Brush, Red, 12 px; Draft with one circle drawn)
+-----------------------------------------------------------------------------------------+
| imgly  [ Open image ] (Crop and rotate) (Adjust) [ Draw ]=pressed  ( Export )           |  Crop, Adjust, Export unavailable
+-----------------------------------------------------------------------------------------+
|######################################|  MODE                                            |
|######+--------------------------+####|  [ Brush ]=selected [ Eraser ]                    |  SegmentedControl
|######|                          |####|                                                  |
|######|  Preview: image + Draft  |####|  COLOUR                                          |
|######|        ~~(  O  )~~       |####|  [■][□][■]=sel [■][■]                             |  SegmentedControl, swatch ×10
|######|  at the current zoom and |####|  [■][■][■][■][■]          [ ┄ ] Custom colour     |  native colour input
|######|  pan, Crop only          |####|                                                  |
|######+--------------------------+####|  WIDTH                                           |
|######################################|  Width   1 --o------------------- 200 [ 12 ] px   |  SliderField, unit px
|######################################|                                                  |
|######################################|  [ Clear ]                  [ Cancel ] [ Apply ]  |  ghost · secondary · primary
+-----------------------------------------------------------------------------------------+
| 4096 × 3072 px                                          [-]  42%  [+] [Fit][100%]       |
+-----------------------------------------------------------------------------------------+
```

```text
03-b  drawing (pointer pressed, Stroke growing; width circle at width × zoom)
|######+--------------------------+####|
|######|        ~~(  O  )~~       |####|
|######|              \___        |####|  live line, round ends, clipped to the Crop
|######|                  `--(◯)  |####|  (◯) = width circle, system cursor hidden over the image
|######+--------------------------+####|
```

```text
03-c  erasing / custom colour
|  MODE                                            |
|  [ Brush ] [ Eraser ]=selected                   |
|  COLOUR                                          |
|  [■][□][■][■][■]                                 |  no preset selected
|  [■][■][■][■][■]          [■]=sel Custom colour  |  custom swatch shows the picked colour
```

```text
03-d  export refused / tool refused
+-----------------------------------------------------------------------------------------+
| imgly  [ Open image ] (Crop and rotate) (Adjust) [ Draw ]=pressed  ( Export )           |
+-----------------------------------------------------------------------------------------+
|                      ...tool as in 03-a...                                              |
|                                           +---------------------------------------------+
|                                           | Apply or cancel the drawing first,          |  Toast info (Export, Ctrl/Cmd+S)
|                                           | then export.                                |  or "Apply or cancel the open
|                                           +---------------------------------------------+  tool first." (Crop, Adjust, C, A)
+-----------------------------------------------------------------------------------------+
```

### SCR-04 — Crop and rotate tool

crop-rotate's tool (crop-rotate screens.md SCR-03), unchanged except for the states below.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default, Work with marks | "Crop and rotate" opened on a Work with an applied Drawing layer (F6, AC-11). The whole turned image shows with every mark, including the marks outside the crop frame, so widening the frame shows them where they will be. "Draw" shows as unavailable (`aria-disabled`) | crop-rotate's `CropRotateTool` unchanged · `DrawAction` (`aria-disabled`) | crop-rotate screens.md 03-a |
| Geometry applied | Apply in this tool (F6, AC-08). The marks turn, flip and straighten with the image. A narrower Crop hides marks outside it, and a later wider Crop shows them again | → SCR-01 `marks applied` | — |
| draw refused | "Draw" activated, or `D` outside a text field, while this tool is open (F1, AC-16). In a text field `D` does nothing | as `default, Work with marks` + `Toast` `info` "Apply or cancel the open tool first." | — |
| loading, error, empty, success | Unchanged from crop-rotate's SCR-03 | crop-rotate's states | crop-rotate screens.md SCR-03 |

### SCR-05 — Adjust tool

adjust's tool (adjust screens.md SCR-03), unchanged except for the states below.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default, Work with marks | "Adjust" opened on a Work with an applied Drawing layer (F6, AC-11). The Preview shows the Draft's Adjustments on the image and the marks on top, unadjusted: a red mark stays the same red at any slider value. "Draw" shows as unavailable (`aria-disabled`) | adjust's `AdjustTool` unchanged · `DrawAction` (`aria-disabled`) | adjust screens.md 03-a |
| comparing, Work with marks | Compare held (F6, AC-11). The "Before" view shows the image without Adjustments and the marks on top | adjust's `comparing` state unchanged | adjust screens.md 03-b |
| draw refused | "Draw" activated, or `D` outside a text field, while this tool is open (F1, AC-16). In a text field `D` does nothing | as `default, Work with marks` + `Toast` `info` "Apply or cancel the open tool first." | — |
| loading, error, empty, success | Unchanged from adjust's SCR-03 | adjust's states | adjust screens.md SCR-03 |

### SCR-06 — Export panel

export's panel (export screens.md SCR-03), unchanged in look and copy. It cannot open while the tool is open (SCR-03 `export refused`), and `D` does nothing while it is open (AC-19).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Panel opened on a Work with an applied Drawing layer (F7, AC-10). The Export contains the Work with its Geometry and Adjustments and the applied layer on top, never a Draft | export's `ExportPanel` unchanged | export screens.md 03-a |
| transparency hint | JPEG chosen. The hint shows exactly when the drawn result still has a transparent pixel inside the Crop (F7, AC-10): marks that cover every transparent pixel remove it, and an opaque Original never shows it | export's JPEG transparency hint, unchanged copy | export screens.md 03-a |
| error, loading, success | Unchanged from export's SCR-03 and SCR-01: the export flows run as before from the verified file. A smaller Export with marks takes the two-pass render inside the worker, with no new state (Critical flow 2) | export's states | export screens.md |
| empty | N/A: the panel only opens on a Work | — | — |

### SCR-07 — Replace confirmation

open-and-view's `ReplaceDialog` (`Dialog`), unchanged in look and copy.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A new image was read while the Work has Unsaved edits, from SCR-01 or from SCR-03 (F5, AC-13). A Draft never counts as Unsaved edits on its own, so with only a Draft and no applied edits this dialog does not appear | `ReplaceDialog` (`Dialog`) unchanged | open-and-view screens.md SCR-03 |
| declined | "Cancel" or `Esc`: back to the screen it came from, unchanged. From SCR-03 the tool stays open with its Draft and focus returns into the tool | — | — |
| replaced | "Replace": the new Work opens in SCR-01 with no Drawing layer. From SCR-03 the tool closes and its Draft is discarded | — | — |
| error, loading, empty | N/A: the dialog is a confirmation only; reading happened before it, and failures are SCR-03 or SCR-01 `error` | — | — |

### SCR-08 — System file dialog

The operating system's own file picker, not designed by us (open-and-view SCR-06).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Open image" on SCR-01 or SCR-03 (F5) | platform | — |
| cancelled | Nothing chosen: back to the screen it came from, unchanged. From SCR-03 the tool keeps its Draft (AC-13) | — | — |
| file chosen | → open-and-view's open pipeline; from SCR-03 it continues as SCR-03 `loading (reading a new image)` | — | — |
| error, empty | N/A: the platform dialog has no states of ours | — | — |

## Message catalog

The seed for `src/features/draw/messages.ts` (`sad.md` §5), plus the one new string in export. **info** notices dismiss themselves. Labels and tooltips are the controls' accessible names.

| Kind | Trigger | AC | Copy |
|---|---|---|---|
| info | "Draw" or `D` with no image open | AC-17 | Open an image first to draw on it. |
| info | Export or `Ctrl/Cmd+S` while the tool is open (export's `messages.ts`, `infoToolOpen('draw')`) | AC-15 | Apply or cancel the drawing first, then export. |
| info | "Crop and rotate", "Adjust", `C` or `A` while Draw is open, and "Draw" or `D` while either of them is open | AC-16 | Apply or cancel the open tool first. |
| tooltip | "Draw" action | AC-19 | Draw (D) |
| tooltip | mode options | AC-19 | Brush (B) · Eraser (E) |
| tooltip | width slider | AC-19 | Width ([ and ], Shift for 10) |
| label | group headings | AC-01 | Mode · Colour · Width |
| label | palette swatches, in order (accessible names and tooltips) | AC-02 | Black · White · Red · Orange · Yellow · Green · Cyan · Blue · Purple · Pink |
| label | the native colour input | AC-02 | Custom colour |
| button | footer | AC-01, AC-05, AC-06 | Clear · Cancel · Apply |

## New components

**Shared primitives** go to `src/shared/ui/`, and `implement` registers each one in `docs/design-system.md` §Component inventory. **Feature composites** go to `src/features/draw/` and stay out of the shared inventory. No new shared primitive is needed; one existing primitive gains a small option.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `SegmentedControl` (extended: `swatch`) | The palette is a radiogroup of 10 colours with one selection, arrow keys, a roving tab stop and a "nothing selected" state for a custom colour, all of which `SegmentedControl` has. It has no way to show a colour instead of text. An optional `swatch` (a CSS colour) on an option renders a filled square in a `--color-border` frame, keeps `label` as the accessible name and tooltip, and lets the group wrap as it already does. One radiogroup primitive stays | pending |
| `DrawAction` (feature composite) | `BaseButton` secondary "Draw" with its pressed, disabled-during-export and unavailable (`aria-disabled` + hint) states and the `D` shortcut, mounted in the top-bar slot by `App.vue`, as `AdjustAction` | n/a (feature-local) |
| `DrawTool` (feature composite) | SCR-03's layout: the tool panel beside the canvas, mounted in the editor's tool slot (`sad.md` §5) | n/a (feature-local) |
| `DrawControls` (feature composite) | SCR-03's panel, composed from `SegmentedControl` ×2, the native colour input (`<input type="color">`, the browser's own picker, which offers exactly "any fully opaque colour"), `SliderField` and `BaseButton` ×3. It holds the `B`, `E`, `[`, `]`, `Enter` and `Esc` handling | n/a (feature-local) |
| `DrawOverlay` (feature composite) | The pointer surface over the canvas in the `#tool-canvas` slot: pointer capture, coalesced positions, the hidden cursor and the width circle (§Shell changes). It lets drags through while `Space` is held, as crop-rotate's frame does (`sad.md` §5) | n/a (feature-local) |
