---
status: approved         # draft | approved
feature_size: "M"
tool: "code"
updated_at: "2026-10-08"
---

# Screens — adjust

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below.
- **Inputs:** screen inventory from `ux-flows.md` (SCR-01 to SCR-07, all covered). States come from spec §5 ACs and the `sad.md` §6 flows F1–F7 with their `alt`/`else` branches, plus the design's Critical flows 1–3. There is no `contracts/` folder, because the feature has no external interface (`target_surfaces: [web-frontend]`, no server), so no state comes from a contract error response. No new `AppError` code exists (`sad.md` §5, §8): the field rules never fail, "nothing to correct" is a result shown as a hint in the tool, and the only failure notices are open-and-view's own, shown unchanged while the tool is open.
- **SCR ids are this feature's** (ux-flows.md §Screen inventory). SCR-01 and SCR-02 match crop-rotate's ids; SCR-04 is crop-rotate's SCR-03 (its tool), SCR-05 is export's SCR-03 (Export panel), SCR-06 is open-and-view's SCR-03 (Replace confirmation), SCR-07 is open-and-view's SCR-06 (System file dialog).

### Shell changes

- **Top bar** (`EditorTopBar` actions slot): "Open image" (`BaseButton` secondary, unchanged), then `CropRotateAction`, then `AdjustAction` (`BaseButton` secondary "Adjust", with a sliders icon and the shortcut "A" in its tooltip), then `ExportAction` (`BaseButton` primary "Export"). `App.vue` mounts `AdjustAction` right after `CropRotateAction` (`sad.md` §5), so it sits next to "Crop and rotate" (AC-21).
- **Unavailable actions** follow the `CropRotateAction` precedent: an action that cannot run now but is not blocked by an export stays focusable (`aria-disabled`, styled at 0.45 opacity, not `disabled`). Its hint is its accessible description, and activating it, or pressing its key, shows the same hint as a `Toast` `info`. During an export the action is truly `disabled` and its key does nothing (AC-15).
- **Tool layout** (SCR-03): `AdjustTool` takes the editor's tool slot in place, like `CropRotateTool`: a **tool panel** of width `--panel-width` on the right of the canvas, full height, background `--color-surface-raised`, holding `AdjustControls`. The canvas area keeps the `PreviewCanvas` at the current zoom and pan, with no overlay except the "Before" label while Compare is held. Below 1024 px the panel moves under the canvas (canon §Platform posture), and nothing else changes.
- **Status bar** (`EditorStatusBar`): unchanged. Adjustments never change the Work's size (AC-06), so `DimensionsReadout` reads exactly as before, and `ZoomBar` keeps working in the tool (AC-20).
- Notices stay in `ToastStack` at the bottom right (single notice boundary).

### Keyboard

| Key | Where | Action | AC |
|---|---|---|---|
| `A` | SCR-01 | Opens the tool | AC-21 |
| `A` | SCR-02 | Shows the "open an image first" notice | AC-19 |
| `A` | SCR-04 (Crop and rotate open) | Shows the "apply or cancel the open tool first" notice; nothing while a text field has focus | AC-18 |
| `A` | Export panel open, the tool already open, a text field focused, or an export running | Does nothing | AC-15, AC-21 |
| `C` | SCR-03 | Shows the "apply or cancel the open tool first" notice; nothing while a text field has focus | AC-18 |
| `Tab`, `Enter` / `Space` | SCR-01 | Reach and activate "Adjust" | AC-21 |
| `Tab` | SCR-03 | Reaches every control in panel order: each slider then its number field, top to bottom, then Compare, Auto, Reset, Cancel, Apply | AC-21 |
| Arrows (`Shift` ×10) | A slider focused | Change it by 1 (10), kept in range | AC-21 |
| `Enter` / `Space` | A focused button other than Compare | Presses that button | AC-21 |
| `Enter` / `Space` held | Compare focused | Holds Compare; releasing the key ends it | AC-08 |
| `\` held (`KeyboardEvent.code === 'Backslash'`, any layout) | SCR-03, no text field focused | Holds Compare; releasing the key ends it. In a text field it does nothing | AC-08 |
| `Enter` | A number field | Applies the typed value. Never applies the tool | AC-05 |
| `Enter` | Anywhere else in SCR-03 (a slider, the panel) | Applies the tool | AC-21 |
| `Esc` | Anywhere in SCR-03, including a field | Cancels the tool; a value still being typed is discarded | AC-09, AC-21 |
| `Ctrl/Cmd+S` | SCR-03 | Shows the "apply or cancel the adjustments first" notice. Never the browser's "Save page" | AC-16 |
| Zoom keys, `Space`-drag pan | SCR-03 (outside the Compare button) | As in the editor: never change the Draft, never count as an edit | AC-20 |

Focus moves to the brightness slider when the tool opens. After Apply or Cancel it returns to the "Adjust" action.

## Screens

### SCR-01 — Editor with Work

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A Work is open, no export running, no tool open. "Adjust" is visible next to "Crop and rotate" and reachable by keyboard (AC-21) | `EditorTopBar` with "Open image" + `CropRotateAction` + `AdjustAction` (`BaseButton` secondary) + `ExportAction` · `PreviewCanvas` · `EditorStatusBar` (`DimensionsReadout`, `ZoomBar`) · `ToastStack` | wireframe 01-a |
| Adjustments applied | After Apply with values that differ (F5, AC-01, AC-11). The Preview shows the Work with its Geometry and its Adjustments at the same zoom and pan as before (AC-20). The status bar is unchanged (AC-06). Unsaved edits are set only when a value differed from the values at open | as `default` | wireframe 01-a |
| tool open | "Adjust" clicked, activated by keyboard, or `A` | → SCR-03 in place | — |
| exporting | An export is running (export AC-11, F1, F6). "Adjust" is visibly `disabled` and `A` does nothing; the request is refused, not queued (AC-15) | `AdjustAction` (`BaseButton` disabled) + export's own exporting state | wireframe 01-b |
| success | N/A: Apply has no notice. The Preview is the outcome (ux-flows §Platform decisions) | — | — |
| error | N/A: applying Adjustments cannot fail (`sad.md` §8, no new `AppError`) | — | — |
| empty | N/A: a screen with no Work is SCR-02 | — | — |
| loading | N/A: opening the tool has no loading state; its readiness is the p95 ≤ 150 ms target (spec §6) | — | — |

```text
01-a  default / Adjustments applied
+------------------------------------------------------------------------------+
| imgly        [ Open image ] [ Crop and rotate ] [ Adjust ] [ Export ]        |  secondary ×3 · primary
+------------------------------------------------------------------------------+
|##############################################################################|
|#########+------------------------------------------------------+#############|
|#########|      Preview: the Work with Geometry + Adjustments   |#############|  View unchanged by the tool
|#########+------------------------------------------------------+#############|
+------------------------------------------------------------------------------+
| 4096 × 3072 px                                    [-]  42%  [+] [Fit][100%]  |  unchanged by Adjustments
+------------------------------------------------------------------------------+
```

```text
01-b  exporting
+------------------------------------------------------------------------------+
| imgly     (Open image) (Crop and rotate) (Adjust) [ (o) Exporting… ]         |  all disabled
+------------------------------------------------------------------------------+
|#########|                     Preview                          |#############|  zoom and pan stay live
+------------------------------------------------------------------------------+
```

### SCR-02 — Empty editor

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | No Work is open (AC-19). "Adjust" is shown but unavailable: focusable (`aria-disabled`), with the hint as its accessible description | `EditorTopBar` with `CropRotateAction` and `AdjustAction` (`BaseButton` secondary, `aria-disabled`) + `ExportAction` (unavailable) · open-and-view's `EmptyCanvas` unchanged | wireframe 02-a |
| hint | "Adjust" activated, or `A` pressed, with no image open (F1, AC-19) | as `default` + `Toast` `info` "Open an image first to adjust it." (→ §Message catalog) | wireframe 02-a |
| empty | Same as `default`: SCR-02 *is* the no-Work state | as `default` | wireframe 02-a |
| loading | N/A: no tool can open here | — | — |
| error | N/A: no tool can open, so nothing can fail | — | — |

```text
02-a  default / hint
+------------------------------------------------------------------------------+
| imgly                      ( Crop and rotate ) ( Adjust )  ( Export )        |  all aria-disabled
+------------------------------------------------------------------------------+
|                                                                              |
|                              [ Open image ]                                  |  EmptyCanvas (open-and-view)
|                   or drop an image anywhere in this window                   |
|                                        +-----------------------------------+ |
|                                        | Open an image first to adjust it. | |  Toast info, on
|                                        +-----------------------------------+ |  activate / A
+------------------------------------------------------------------------------+
```

### SCR-03 — Adjust tool

Panel layout, top to bottom (`AdjustControls`). Group headings are in `--font-size-xs`, `--color-text-muted`. The seven sliders keep the order of AC-01:

1. **Light:** `SliderField` "Brightness" and "Contrast", −100 to 100.
2. **Colour:** `SliderField` "Saturation", "Temperature" and "Tint", −100 to 100.
3. **Effects:** `SliderField` "Grayscale" and "Sepia", 0 to 100, with the unit "%" next to the field (the field holds the bare number).

   Every slider has step 1, a mark at its neutral value (0), and its value in the number field next to it. Double-clicking the slider sets it to neutral (AC-10). Its tooltip is "Double-click to reset".
4. **Actions:** `BaseButton` secondary "Compare" (held, shown pressed while held) and `BaseButton` secondary "Auto". Below them is one line of hint text, `role="status"`, in `--font-size-xs` and `--color-text-muted`. It is empty unless Auto found nothing to correct.
5. **Footer:** `BaseButton` ghost "Reset" on the left; `BaseButton` secondary "Cancel" and `BaseButton` primary "Apply" on the right.

Canvas area: the `PreviewCanvas` showing the Draft at the current zoom and pan, with the Work's Crop (no whole-turned-image view, AC-20). While Compare is held, a "Before" label sits at the top left of the canvas area, inset by `--space-3`. It is a small pill in `--color-surface-raised` with `--color-text`, `--font-size-xs`, announced through `aria-live="polite"`.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Tool opened (F1, AC-01, AC-20). The Draft is the Work's Adjustments (neutral for a new Work), each slider at its value with its neutral mark. The View is unchanged. "Adjust" shows as pressed (`aria-pressed`). "Crop and rotate" and "Export" show as unavailable (`aria-disabled`, AC-16, AC-18). "Open image" stays available (AC-17) | `AdjustTool` · `AdjustControls` (`SliderField` ×7, `BaseButton` ×5) · `PreviewCanvas` · `ZoomBar` | wireframe 03-a |
| dragging | A slider is dragged or moved with the arrow keys (F2, AC-01, AC-21). The number field and the Preview follow the latest value, at 30 or more updates a second. No loading indicator (canon §Loading) | as `default` | wireframe 03-a |
| typing (pending) | The Editor is typing in a number field. Nothing is checked yet, and the Preview keeps the previous value (AC-05) | `NumberField` pending text | — |
| validation | The Editor leaves a field or presses `Enter` in it (F2, AC-05). Out of range snaps to the bound, a fraction rounds half up, empty or non-numeric text (including `1e2`) reverts, and a trailing "%" is accepted in Grayscale and Sepia. No inline error message, per the canon's §Validation: the corrected value is the feedback | `NumberField` showing the corrected value | — |
| slider reset | A slider is double-clicked, or 0 is typed in its field (F2, AC-10). That slider goes to its neutral mark in the Draft only | as `default` | — |
| reset | "Reset" chosen (F5, AC-10). All seven sliders go to neutral in the Draft only; the Work is unchanged until Apply | as `default` | wireframe 03-a |
| comparing | Compare held by the mouse, by `Space` or `Enter` on the focused button, or by the held `\` key outside a text field (F3, AC-08). The Preview shows the Work with its Geometry and no Adjustments. The "Before" label shows, and Compare shows as pressed. The sliders keep showing the Draft | as `default` + "Before" label (in `AdjustTool`) + `BaseButton` `pressed` | wireframe 03-b |
| comparing, Draft changed | A slider, typed value, Auto, Reset or a per-slider reset while Compare is held (F3, AC-08). The sliders and fields show the new Draft; the Preview stays on "Before" until release | as `comparing` | wireframe 03-b |
| compare ended | Compare released, the window loses focus, or the tool closes (F3, AC-08). The label goes and the Preview shows the Draft again, or the Work when the tool has closed | as `default` | — |
| auto applied | "Auto" chosen with something to measure (F4, AC-12, AC-13). Brightness, contrast, temperature and tint move to whole numbers within ±50. Saturation, grayscale and sepia stay. The Preview follows, unless Compare is held | as `default` | wireframe 03-a |
| empty (nothing to correct) | "Auto" chosen when the pixels inside the Crop that are not fully transparent are all one colour, or there are none (F4, AC-13). The sliders stay as they were, and the hint line reads "Nothing to correct automatically." It clears on the next change to the Draft | as `default` + the hint line in `AdjustControls` | wireframe 03-c |
| export refused | Export or `Ctrl/Cmd+S` while the tool is open (F6, AC-16). The browser's "Save page" never opens | as `default` + `Toast` `info` "Apply or cancel the adjustments first, then export." | wireframe 03-d |
| crop refused | "Crop and rotate" activated, or `C` outside a text field, while the tool is open (F6, AC-18) | as `default` + `Toast` `info` "Apply or cancel the open tool first." | wireframe 03-d |
| loading (reading a new image) | "Open image" or a drop while the tool is open, until the new image is read (F7, AC-17). open-and-view's canvas loading overlay shows. The tool stays open with its Draft | as `default` + open-and-view's `Spinner` overlay on the canvas | — |
| error (new image can't open) | The new image can't be read or isn't supported (F7). open-and-view's failure notice shows. The tool stays open exactly as it was | as `default` + open-and-view's `Toast` `failure` (unchanged copy) | — |
| replace confirmation | The new image was read and the Work has Unsaved edits from an earlier Apply (F7) | → SCR-06 over this screen; declining returns here unchanged | — |
| closed | Apply (→ SCR-01 `Adjustments applied`), Cancel or `Esc` (→ SCR-01 as before), or a successful replace (→ SCR-01 with the new Work, neutral Adjustments) (F5, F7, AC-09, AC-11, AC-17). Compare ends with it | — | — |
| display lost | open-and-view's display-lost message replaces the canvas area unchanged (`sad.md` §8). "Auto" is `disabled` while the display is lost or being restored (F4). The panel stays, so the sliders, Cancel and Apply still work | open-and-view's `CanvasMessage` + `BaseButton` disabled ("Auto") | — |
| success | N/A: Apply closes the tool, and its outcome is SCR-01's Preview | — | — |
| error (apply) | N/A: Apply, Reset, Auto's computation and the field rules cannot fail (`sad.md` §8) | — | — |

```text
03-a  default (Draft: brightness +30, temperature +12, sepia 40%)
+-----------------------------------------------------------------------------------+
| imgly     [ Open image ] (Crop and rotate) [ Adjust ]=pressed  ( Export )         |  Crop, Export unavailable
+-----------------------------------------------------------------------------------+
|######################################|  LIGHT                                     |
|######+--------------------------+####|  Brightness  -100 ------|---o---- 100 [ 30 ]|  SliderField, mark at 0
|######|                          |####|  Contrast    -100 ------o-------- 100 [  0 ]|
|######|  Preview: the Draft at   |####|                                            |
|######|  the current zoom and    |####|  COLOUR                                    |
|######|  pan, Crop only          |####|  Saturation  -100 ------o-------- 100 [  0 ]|
|######|                          |####|  Temperature -100 ------|-o------ 100 [ 12 ]|
|######+--------------------------+####|  Tint        -100 ------o-------- 100 [  0 ]|
|######################################|                                            |
|######################################|  EFFECTS                                   |
|######################################|  Grayscale      0 o------------- 100 [  0 ]%|  unit "%" next to the field
|######################################|  Sepia          0 |----o-------- 100 [ 40 ]%|
|######################################|                                            |
|######################################|  [ Compare ] [ Auto ]                      |  secondary ×2
|######################################|                                            |  hint line (empty)
|######################################|  [ Reset ]              [ Cancel ] [ Apply ]|  ghost · secondary · primary
+-----------------------------------------------------------------------------------+
| 4096 × 3072 px                                       [-]  42%  [+] [Fit][100%]    |
+-----------------------------------------------------------------------------------+
```

```text
03-b  comparing (Compare held; sliders still show the Draft)
+-----------------------------------------------------------------------------------+
|######################################|  ...sliders as in 03-a...                 |
|######+--------------------------+####|                                            |
|######| ( Before )               |####|                                            |  pill, aria-live polite
|######|                          |####|                                            |
|######|  Preview: the Work with  |####|  [ Compare ]=pressed [ Auto ]              |
|######|  its Geometry and no     |####|                                            |
|######|  Adjustments             |####|  [ Reset ]              [ Cancel ] [ Apply ]|
|######+--------------------------+####|                                            |
+-----------------------------------------------------------------------------------+
```

```text
03-c  empty (Auto found nothing to correct)
|  [ Compare ] [ Auto ]                      |
|  Nothing to correct automatically.         |  role="status", muted, xs
|  [ Reset ]              [ Cancel ] [ Apply ]|
```

```text
03-d  export refused / crop refused
+-----------------------------------------------------------------------------------+
| imgly     [ Open image ] (Crop and rotate) [ Adjust ]=pressed  ( Export )         |
+-----------------------------------------------------------------------------------+
|                      ...tool as in 03-a...                                        |
|                                         +-----------------------------------------+
|                                         | Apply or cancel the adjustments first,  |  Toast info (Export, Ctrl/Cmd+S)
|                                         | then export.                            |  or "Apply or cancel the open
|                                         +-----------------------------------------+  tool first." (Crop and rotate, C)
+-----------------------------------------------------------------------------------+
```

### SCR-04 — Crop and rotate tool

crop-rotate's tool (crop-rotate screens.md SCR-03), unchanged except for the states below.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default, adjusted Work | "Crop and rotate" opened on a Work with applied Adjustments (F6, AC-18). The whole turned image, inside and outside the frame, shows with the applied Adjustments, so widening the frame never shows a seam. "Adjust" shows as unavailable (`aria-disabled`) | crop-rotate's `CropRotateTool` unchanged · `AdjustAction` (`aria-disabled`) | crop-rotate screens.md 03-a |
| Geometry applied | Apply in this tool (F6, AC-18). The new Crop keeps the same Adjustments | → SCR-01 `Adjustments applied` | — |
| adjust refused | "Adjust" activated, or `A` outside a text field, while this tool is open (F1, AC-18). In a text field `A` does nothing | as `default, adjusted Work` + `Toast` `info` "Apply or cancel the open tool first." | — |
| loading, error, empty, success | Unchanged from crop-rotate's SCR-03 | crop-rotate's states | crop-rotate screens.md SCR-03 |

### SCR-05 — Export panel

export's panel (export screens.md SCR-03), unchanged in look and copy. It cannot open while the tool is open (SCR-03 `export refused`).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Panel opened on a Work with applied Adjustments (F6, AC-14). The Export contains the Work with its Geometry and only its applied Adjustments, never a Draft | export's `ExportPanel` unchanged | export screens.md 03-a |
| transparency hint | Exactly as it would be without Adjustments, because they never change transparency (AC-14, AC-06) | export's JPEG transparency hint, unchanged copy | export screens.md 03-a |
| error, loading, success | Unchanged from export's SCR-03 and SCR-01: the export flows run as before from the verified file. A smaller adjusted Export takes the two-pass render inside the worker, with no new state (Critical flow 3) | export's states | export screens.md |
| empty | N/A: the panel only opens on a Work | — | — |

### SCR-06 — Replace confirmation

open-and-view's `ReplaceDialog` (`Dialog`), unchanged in look and copy.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A new image was read while the Work has Unsaved edits, from SCR-01 or from SCR-03 (F7, AC-17). A Draft never counts as Unsaved edits on its own, so with only a Draft and no applied edits this dialog does not appear | `ReplaceDialog` (`Dialog`) unchanged | open-and-view screens.md SCR-03 |
| declined | "Cancel" or `Esc`: back to the screen it came from, unchanged. From SCR-03 the tool stays open with its Draft and focus returns into the tool | — | — |
| replaced | "Replace": the new Work opens in SCR-01 with neutral Adjustments. From SCR-03 the tool closes and its Draft is discarded | — | — |
| error, loading, empty | N/A: the dialog is a confirmation only; reading happened before it, and failures are SCR-03 or SCR-01 `error` | — | — |

### SCR-07 — System file dialog

The operating system's own file picker, not designed by us (open-and-view SCR-06).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Open image" on SCR-01 or SCR-03 (F7) | platform | — |
| cancelled | Nothing chosen: back to the screen it came from, unchanged. From SCR-03 the tool keeps its Draft (AC-17) | — | — |
| file chosen | → open-and-view's open pipeline; from SCR-03 it continues as SCR-03 `loading (reading a new image)` | — | — |
| error, empty | N/A: the platform dialog has no states of ours | — | — |

## Message catalog

The seed for `src/features/adjust/messages.ts` (`sad.md` §5), plus the two changed strings in export and crop-rotate. **info** notices dismiss themselves. Labels and tooltips are the controls' accessible names.

| Kind | Trigger | AC | Copy |
|---|---|---|---|
| info | "Adjust" or `A` with no image open | AC-19 | Open an image first to adjust it. |
| info | Export or `Ctrl/Cmd+S` while the tool is open (export's `messages.ts`, chosen by the open tool) | AC-16 | Apply or cancel the adjustments first, then export. |
| info | "Crop and rotate" or `C` while Adjust is open, and "Adjust" or `A` while Crop and rotate is open | AC-18 | Apply or cancel the open tool first. |
| hint | "Auto" with nothing to measure (inline, `role="status"`) | AC-13 | Nothing to correct automatically. |
| label | over the canvas while Compare is held | AC-08 | Before |
| tooltip | "Adjust" action | AC-21 | Adjust (A) |
| tooltip | "Compare" button | AC-08 | Hold to see the photo before adjusting (\\) |
| tooltip | each slider | AC-10 | Double-click to reset |
| label | group headings | AC-01 | Light · Colour · Effects |
| label | sliders and their fields | AC-01 | Brightness · Contrast · Saturation · Temperature · Tint · Grayscale · Sepia |
| button | actions and footer | AC-08, AC-09, AC-10, AC-12 | Compare · Auto · Reset · Cancel · Apply |

## New components

**Shared primitives** go to `src/shared/ui/`, and `implement` registers each one in `docs/design-system.md` §Component inventory. **Feature composites** go to `src/features/adjust/` and stay out of the shared inventory. No new shared primitive is needed; one existing primitive gains a small option.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `SliderField` (extended: `neutral`) | Double-clicking a slider sets it to its neutral value (AC-10). `SliderField` has no double-click behaviour. An optional `neutral` prop (double-click emits it) keeps one slider primitive, and later sliders such as brush width can leave it out | pending (update its row) |
| `AdjustAction` (feature composite) | `BaseButton` secondary "Adjust" with its pressed, disabled-during-export and unavailable (`aria-disabled` + hint) states and the `A` shortcut, mounted in the top-bar slot by `App.vue`, as `CropRotateAction` | n/a (feature-local) |
| `AdjustTool` (feature composite) | SCR-03's layout: the tool panel beside the canvas and the "Before" label over it, mounted in the editor's tool slot (`sad.md` §5) | n/a (feature-local) |
| `AdjustControls` (feature composite) | SCR-03's panel, composed from `SliderField` ×7 and `BaseButton` ×5. It holds Compare's press-and-hold handling (pointer, `Space` / `Enter`) and the inline hint line, which is plain text with `role="status"` | n/a (feature-local) |
