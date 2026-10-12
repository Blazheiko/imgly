---
status: approved       # draft | approved
feature_size: "S"
tool: "code"
updated_at: "2026-10-11"
---

# Screens — undo-redo

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below.
- **Inputs:** the screen inventory from `ux-flows.md` (SCR-01 to SCR-05, all covered). States come from spec §5 ACs and the `sad.md` §6 flows (Critical flows 1 and 2, Flows 3 to 7) with their `alt`/`else` branches. There is no `contracts/` folder: the feature has no external interface (`target_surfaces: [web-frontend]`, `api` skipped on the quick route), so no state comes from a contract error response. No new `AppError` exists (`sad.md` §8): Undo and Redo cannot fail, and their refusals are app rules shown as unavailable buttons and info notices.
- **SCR ids are this feature's** (ux-flows.md §Screen inventory). SCR-01 and SCR-02 match the earlier features' editor ids. SCR-03 is any of the three tools open (crop-rotate's, adjust's and draw's tool screens), SCR-04 is export's exporting state, and SCR-05 is open-and-view's Replace confirmation.
- **Reused unchanged, so no undo-redo task builds them:** the tools' panels in SCR-03, export's panel and its exporting state in SCR-04, and the `Dialog` with its copy in SCR-05 ("Your edits to the current image will be lost.", which already covers the Edit history). Each of them changes only where the Undo and Redo buttons and shortcuts appear on top of it.

### Shell changes

- **Top bar** (`EditorTopBar`): "Open image" (`BaseButton` secondary, unchanged), then the new **`UndoRedoActions`** (two icon `BaseButton`s, `ghost`: Undo with a counter-clockwise arrow, Redo with a clockwise arrow), then `CropRotateAction`, `AdjustAction`, `DrawAction` and `ExportAction` as before. `App.vue` mounts `UndoRedoActions` first in the `top-bar-actions` slot (`sad.md` §5), so Undo and Redo sit right after the file action, where desktop editors put them (AC-14). A `--space-2` gap follows Redo, so the pair reads as one group apart from the tools.
- **Accessible names and hints:** each button's accessible name is its action ("Undo", "Redo"). Its hint is both the tooltip (`title`) and the accessible description (`aria-describedby`), and it names the tool of the Step and the shortcut, for example "Undo Adjust (Ctrl/Cmd+Z)" (AC-01, AC-14). An unavailable button's hint says why (→ §Message catalog).
- **Unavailable buttons** follow the `CropRotateAction` / `AdjustAction` / `DrawAction` precedent. When the reason is not an export, the button stays focusable (`aria-disabled`, styled at 0.45 opacity, not `disabled`) and its hint is its accessible description. Activating it while a tool is open shows the hint as a `Toast` `info`. Activating it with nothing to undo or redo, or with no image, does nothing (AC-05). During an export both buttons are truly `disabled` (AC-07).
- **Outcome:** an Undo or Redo shows no notice. The Preview is the outcome, and the hints update to the next Steps (ux-flows §Platform decisions). The View fits the restored image only when the image's size changed (AC-12). `DimensionsReadout` follows the restored size.
- Notices stay in `ToastStack` at the bottom right (single notice boundary).

### Keyboard

| Key | Where | Action | AC |
|---|---|---|---|
| `Ctrl/Cmd+Z` | SCR-01, outside a focused text or number field | Undo, when a kept Step is there. Otherwise does nothing | AC-01, AC-05, AC-14 |
| `Shift+Ctrl/Cmd+Z`, `Ctrl+Y` | SCR-01, outside a focused text or number field | Redo, when an undone Step is waiting. Otherwise does nothing. `Cmd+Y` is never handled, so it stays the browser's | AC-02, AC-05 |
| Any of the three | SCR-02 | Does nothing | AC-05 |
| Any of the three | SCR-03, outside a focused text or number field | Shows the "apply or cancel the open tool first" notice; the Work and the tool's Draft do not change | AC-08 |
| Any of the three | SCR-04 | Shows the "export in progress" notice; refused, not queued | AC-07 |
| Any of the three | SCR-05 (the replace dialog owns the keys) | Does nothing | AC-10 (ledger L7) |
| Any of the three | A focused text or number field, on any screen | The field's own text undo or redo; the Edit history is untouched | AC-08, AC-14 |
| `Tab`, `Enter` / `Space` | SCR-01 | Reach and activate Undo and Redo, in top-bar order after "Open image" | AC-14 |

A held key's repeats are ignored, so holding `Ctrl/Cmd+Z` undoes one Step (ledger L8). Handled keys call `preventDefault`. Focus stays on the button after an Undo or Redo by click or keyboard. If that button becomes unavailable, it keeps focus as an `aria-disabled` button and announces its new hint.

## Screens

### SCR-01 — Editor with Work

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default (nothing to undo) | A Work was just opened or replaced, or every kept Step is undone and nothing waits to be redone (AC-05, AC-10). Undo and Redo are `aria-disabled` with the hints "Nothing to undo" and "Nothing to redo". Their activation and shortcuts do nothing | `EditorTopBar` with "Open image" + `UndoRedoActions` (`BaseButton` ghost ×2, `aria-disabled`) + `CropRotateAction` + `AdjustAction` + `DrawAction` + `ExportAction` · `PreviewCanvas` · `EditorStatusBar` · `ToastStack` | wireframe 01-a |
| can undo | At least one kept Step, nothing undone (AC-01, AC-14). Undo is available with the hint "Undo <tool> (Ctrl/Cmd+Z)". Redo stays "Nothing to redo" | `UndoRedoActions` (Undo enabled, Redo `aria-disabled`) + as `default` | wireframe 01-b |
| can undo and redo | After one or more Undos with older kept Steps left (AC-02). Both available, each hint naming its Step's tool | `UndoRedoActions` (both enabled) + as `default` | wireframe 01-c |
| oldest reached | Every kept Step undone: back at the opened state, or at the oldest kept Step after the history limit dropped older ones (AC-05, AC-11). Undo "Nothing to undo", Redo available | `UndoRedoActions` (Undo `aria-disabled`, Redo enabled) + as `default` | wireframe 01-d |
| success (undone or redone) | An Undo or Redo was applied (Critical flow 1, Flows 3 and 4). The Preview shows the restored Work exactly. The View is fitted when the image size changed, else kept (AC-12). No notice. The hints name the next Steps' tools | as the resulting availability state · `DimensionsReadout` shows the restored size | wireframe 01-c |
| new Step after Undo | An Apply that counts as an edit after one or more Undos (AC-04, Flow 3). Redo becomes "Nothing to redo" and Undo names the new Step's tool. An Apply with no change, zoom, pan, Cancel and Export change neither button (AC-06) | as `can undo` | wireframe 01-b |
| reading a new image | An image is being read (open-and-view's spinner overlay). Undo and Redo stay available (ledger L7) | as above + open-and-view's `Spinner` overlay, unchanged | — (open-and-view) |
| export panel open | The export panel is open and no export runs (ledger L7). Undo and Redo stay available. An Undo that changes the size updates the panel's size field through its `computed` | as above + export's `Popover` panel, unchanged | — (export) |
| tool open | Any of the three tools is opened | → SCR-03 in place | — |
| exporting | An export is confirmed | → SCR-04 in place | — |
| error | N/A: Undo and Redo cannot fail (`sad.md` §8, no new `AppError`) | — | — |
| loading | N/A: Undo and Redo have no loading state; the update is within the p95 ≤ 150 ms target (spec §6) | — | — |
| empty | N/A: a screen with no Work is SCR-02. "Nothing to undo" is the `default` row above | — | — |

```text
01-a  default (nothing to undo)
+--------------------------------------------------------------------------------------+
| imgly  [ Open image ] (↶)(↷)  [ Crop and rotate ] [ Adjust ] [ Draw ] [ Export ]     |  ↶ ↷ aria-disabled
+--------------------------------------------------------------------------------------+     "Nothing to undo"
|######################################################################################|     "Nothing to redo"
|#########+------------------------------------------------------+#####################|
|#########|                       Preview                        |#####################|
|#########+------------------------------------------------------+#####################|
+--------------------------------------------------------------------------------------+
| 4096 × 3072 px                                          [-]  42%  [+] [Fit][100%]    |
+--------------------------------------------------------------------------------------+
```

```text
01-b  can undo / new Step after Undo
+--------------------------------------------------------------------------------------+
| imgly  [ Open image ] [↶](↷)  [ Crop and rotate ] [ Adjust ] [ Draw ] [ Export ]     |
+-----------------------+--------------------------------------------------------------+
                        | Undo Draw (Ctrl/Cmd+Z) |   tooltip and accessible description
                        +------------------------+   (↷: "Nothing to redo")
```

```text
01-c  can undo and redo / success
+--------------------------------------------------------------------------------------+
| imgly  [ Open image ] [↶][↷]  [ Crop and rotate ] [ Adjust ] [ Draw ] [ Export ]     |
+--------------------------------+-----------------------------------------------------+
                                 | Redo Adjust (Shift+Ctrl/Cmd+Z) |   ↶: "Undo Crop and rotate (Ctrl/Cmd+Z)"
                                 +--------------------------------+
|#########|   Preview: the restored Work, exactly as before      |#####################|  View fitted only if
+--------------------------------------------------------------------------------------+  the size changed
| 3000 × 2000 px  (restored size)                         [-]  56%  [+] [Fit][100%]    |
+--------------------------------------------------------------------------------------+
```

```text
01-d  oldest reached
+--------------------------------------------------------------------------------------+
| imgly  [ Open image ] (↶)[↷]  [ Crop and rotate ] [ Adjust ] [ Draw ] [ Export ]     |  ↶ "Nothing to undo"
+--------------------------------------------------------------------------------------+  ↷ "Redo Crop and rotate
                                                                                            (Shift+Ctrl/Cmd+Z)"
```

### SCR-02 — Empty editor

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | No Work is open (AC-05). Undo and Redo are shown but unavailable: `aria-disabled`, hints "Nothing to undo" and "Nothing to redo". Activation and shortcuts do nothing | `EditorTopBar` with "Open image" + `UndoRedoActions` (`BaseButton` ghost ×2, `aria-disabled`) + the tools' and export's unavailable actions · open-and-view's `EmptyCanvas`, unchanged | wireframe 02-a |
| empty | Same as `default`: SCR-02 *is* the no-Work state | as `default` | wireframe 02-a |
| loading | N/A: open-and-view's reading overlay is unchanged, and Undo and Redo stay unavailable through it because no Work exists yet | — | — |
| error | N/A: nothing can be undone here, so nothing can fail | — | — |

```text
02-a  default
+--------------------------------------------------------------------------------------+
| imgly  [ Open image ] (↶)(↷)  ( Crop and rotate ) ( Adjust ) ( Draw ) ( Export )     |  all aria-disabled
+--------------------------------------------------------------------------------------+
|                                                                                      |
|                                 [ Open image ]                                       |  EmptyCanvas (open-and-view)
|                      or drop an image anywhere in this window                        |
|                                                                                      |
+--------------------------------------------------------------------------------------+
```

### SCR-03 — Open tool

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Crop and rotate", "Adjust" or "Draw" is open with or without unapplied changes (AC-08). Undo and Redo are `aria-disabled` with the hint "Apply or cancel the open tool first." | `UndoRedoActions` (both `aria-disabled`) + the open tool's own screen, unchanged | wireframe 03-a |
| hint | Undo or Redo activated, or their shortcuts pressed outside a text or number field (AC-08, Flow 6) | as `default` + `Toast` `info` "Apply or cancel the open tool first." (→ §Message catalog). The Work and the Draft do not change | wireframe 03-a |
| text field focused | `Ctrl/Cmd+Z` (or a redo shortcut) in a focused text or number field of the tool, such as a `NumberField` or `SliderField`'s field (AC-08) | the field's own text undo; no notice | — |
| closed | Apply or Cancel (AC-08, Flow 6) | → SCR-01. The Edit history then includes the tool's Step if its Apply counted as an edit (`can undo`), and is unchanged otherwise | — |
| loading | N/A: refusing Undo has no loading state | — | — |
| error | N/A: a refusal is an app rule shown as the `hint` row, not an error | — | — |
| empty | N/A: a tool can only be open over a Work | — | — |

```text
03-a  default / hint  (Adjust shown; Crop and rotate and Draw alike)
+--------------------------------------------------------------------------------------+
| imgly  [ Open image ] (↶)(↷)  ( Crop and rotate ) [■Adjust] ( Draw ) ( Export )      |  ↶ ↷ aria-disabled:
+--------------------------------------------------------------------------------------+  "Apply or cancel the
|################|                      Preview (Draft)                 | Adjust     |   open tool first."
|################|                                                      | panel      |
|################|                                                      | unchanged  |
|                                       +-------------------------------------+       |
|                                       | Apply or cancel the open tool first.|       |  Toast info, on
|                                       +-------------------------------------+       |  activate / shortcut
+--------------------------------------------------------------------------------------+
```

### SCR-04 — Export in progress

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | An export is confirmed and runs, including export's File ready and "Save as…" stages (AC-07). Undo and Redo are truly `disabled` | `UndoRedoActions` (`BaseButton` ghost ×2, `disabled`) + export's own exporting state, unchanged | wireframe 04-a |
| hint | An Undo or Redo shortcut is pressed (AC-07, Flow 6) | as `default` + `Toast` `info` "An export is in progress. Undo and Redo work again when it ends." Refused, not queued | wireframe 04-a |
| ended | The export succeeds, fails or is cancelled (AC-07, AC-09) | → SCR-01 with the same Edit history. Only a success moves the save point, which is not shown on screen | — |
| loading | N/A: this whole screen is export's loading state, unchanged | — | — |
| error | N/A: an export failure is export's own `failure` notice, unchanged | — | — |
| empty | N/A: an export needs a Work | — | — |

```text
04-a  default / hint
+--------------------------------------------------------------------------------------+
| imgly  (Open image) (↶)(↷) (Crop and rotate) (Adjust) (Draw) [ (o) Exporting… ]      |  all disabled
+--------------------------------------------------------------------------------------+
|#########|                     Preview                          |#####################|  zoom and pan stay live
|                         +--------------------------------------------------------+   |
|                         | An export is in progress. Undo and Redo work again ... |   |  Toast info, on shortcut
|                         +--------------------------------------------------------+   |
+--------------------------------------------------------------------------------------+
```

### SCR-05 — Replace confirmation

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A new image was read while the Work has Unsaved edits (AC-09, AC-10). The `Dialog` traps focus. Undo and Redo sit under the backdrop and cannot be reached, and their shortcuts do nothing | open-and-view's `Dialog` "Replace the current image?" with its copy and actions unchanged | wireframe 05-a |
| replace | "Replace" (AC-10, Flow 5) | → SCR-01 `default` with the new Work: empty Edit history, both buttons "Nothing to undo / redo" | — |
| cancel | "Cancel" or `Esc` (AC-10, Flow 5) | → SCR-01 in its previous state, with its Edit history and the same availability | — |
| skipped | The Work is at its save point: last exported, or the opened state of a never-exported Work, reached by Undo or Redo too (AC-09) | the dialog does not appear; → SCR-01 `default` with the new Work at once | — |
| loading | N/A: the image was already read before the dialog opens | — | — |
| error | N/A: confirming or cancelling cannot fail | — | — |
| empty | N/A: the dialog appears only over an open Work | — | — |

```text
05-a  default
+--------------------------------------------------------------------------------------+
| imgly  [ Open image ] [↶][↷]  [ Crop and rotate ] [ Adjust ] [ Draw ] [ Export ]     |  under the backdrop
+--------------------------------------------------------------------------------------+
|::::::::::::::::::::+-------------------------------------------+:::::::::::::::::::::|
|::::::::::::::::::::| Replace the current image?                |:::::::::::::::::::::|  Dialog, unchanged
|::::::::::::::::::::| Your edits to the current image will be   |:::::::::::::::::::::|
|::::::::::::::::::::| lost.                                     |:::::::::::::::::::::|
|::::::::::::::::::::|                     [ Cancel ] [ Replace ]|:::::::::::::::::::::|
|::::::::::::::::::::+-------------------------------------------+:::::::::::::::::::::|
+--------------------------------------------------------------------------------------+
```

## Message catalog

The seed for `src/features/undo-redo/messages.ts` (`sad.md` §5). **info** notices dismiss themselves. Tooltips are also the buttons' accessible descriptions. The tool names are the tools' own labels.

| Kind | Trigger | AC | Copy |
|---|---|---|---|
| label | the two buttons' accessible names | AC-14 | Undo · Redo |
| tooltip | Undo, with a kept Step | AC-01, AC-14 | Undo {tool} (Ctrl/Cmd+Z) |
| tooltip | Redo, with an undone Step waiting | AC-01, AC-14 | Redo {tool} (Shift+Ctrl/Cmd+Z) |
| tooltip | Undo with nothing to undo, or no image | AC-05 | Nothing to undo |
| tooltip | Redo with nothing to redo, or no image | AC-04, AC-05 | Nothing to redo |
| tooltip + info | either button or shortcut while a tool is open | AC-08 | Apply or cancel the open tool first. |
| tooltip + info | either button (tooltip) or shortcut (info) during an export | AC-07 | An export is in progress. Undo and Redo work again when it ends. |
| value | `{tool}` | AC-01 | Crop and rotate · Adjust · Draw |

"Apply or cancel the open tool first." is the same text the tools already use (adjust, draw AC-16), copied into the new feature's `messages.ts`, because features don't import each other.

## New components

**Shared primitives** go to `src/shared/ui/`, and `implement` registers each one in `docs/design-system.md` §Component inventory. **Feature composites** go to `src/features/undo-redo/` and stay out of the shared inventory. No new shared primitive is needed.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `UndoRedoActions` (feature composite) | Two `BaseButton` ghost icon buttons (inline SVG arrows, as `DrawAction` draws its brush) bound to the editor store's `canUndo`, `canRedo`, `undoTool`, `redoTool`, `undo` and `redo`, with the availability, hint and `disabled`-during-export rules above, mounted in the top-bar slot by `App.vue` | n/a (feature-local) |
