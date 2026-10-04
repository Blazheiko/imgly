---
status: approved         # draft | approved
feature_size: "M"
tool: "code"
updated_at: "2026-10-04"
---

# Screens — open-and-view

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below.
- **Inputs:** screen inventory from `ux-flows.md` (SCR-01 to SCR-06, all covered). States come from spec §5 ACs, the `sad.md` §6 flows 1–7 `alt`/`else` branches, and the `sad.md` §8 `AppError` codes. There is no `contracts/` folder, because the feature has no external interface (`target_surfaces: [web-frontend]`, no server), so no state comes from a contract error response.
- **Not fixed here (tactical, left to `tasks`):** the fixed zoom levels the zoom controls step through (AC-12b), how long informational notices stay before dismissing themselves, and the WebGL context-restore deadline (`sad.md` §11).

### Shell shared by every screen

The editor is one view with no page navigation (`ux-flows.md` §Platform decisions). Every screen has
the same three regions:

- **Top bar** (`EditorTopBar`, height `--toolbar-size`). It shows the app name on the left and, only on SCR-02, the "Open image" action on the right.
- **Canvas area.** The SCR-01, SCR-02, SCR-04 and SCR-05 contents swap in here. Fit (AC-01) is measured against this region.
- **Status bar** (`EditorStatusBar`), shown only on SCR-02. It holds the Original's dimensions and the zoom controls.

The tool rail and inspector panel from `docs/design-system.md` §Platform posture are **not drawn in
this feature**, because it has no editing tool yet. They arrive with roadmap step 4, and the canvas
area shrinks to make room for them. Notices appear in `ToastStack` at the bottom right of the canvas
area, above the status bar. The window-level drop guard is always installed. On every screen a drop
never navigates away from the app or shows the file in place of it (AC-02, AC-18).

Below 1024 px the same screens apply. The status bar may wrap onto two lines, and only "Open image"
has to work, because touch gestures are a spec §3 non-goal.

### Keyboard (SCR-02 and SCR-03)

| Key | Action | Notes |
|---|---|---|
| `Ctrl/Cmd+O` | Open image | Prevents the browser's own "open file". Works on SCR-01 and SCR-02 |
| `Shift+1` | Fit | Turns auto-fit back on (AC-12b) |
| `Shift+0` | 100% | One image pixel per physical screen pixel (AC-12) |
| `+` or `=` | Zoom in to the next fixed level, around the centre | |
| `-` | Zoom out to the previous fixed level, around the centre | |
| `Space` + drag | Pan | AC-13 |
| `Esc` | Cancel in SCR-03 | |

The browser's own `Ctrl/Cmd` `+` / `-` / `0` keep their page-zoom meaning and are never
intercepted. The shortcuts are listed in the zoom controls' tooltips (`docs/design-system.md`
§Keyboard).

## Screens

### SCR-01 — Empty editor

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | App load with graphics available (`sad.md` §6 flow 6, capabilities-present branch); reload from SCR-05. This is also the screen's `empty` state. AC-17 | `EditorTopBar` (app name only) · `EmptyCanvas`: `BaseButton` primary "Open image" + one-line hint "or drop an image anywhere in this window" · `ToastStack` | wireframe 01-a |
| empty | Same as `default`: SCR-01 *is* the no-Work state | as `default` | wireframe 01-a |
| drag-over | Files dragged over the window (ux-flows US-02, `sad.md` flow 3). Dragging out returns to `default` | `DropOverlay` over the whole window: "Drop an image to open it" | wireframe 01-b |
| loading | File chosen in SCR-06 or dropped, and the read is in progress (US-01, `sad.md` flow 1). "Open image" **stays enabled** and drops are still accepted, so a newer open supersedes this one (AC-16b) | `Spinner` overlay centred in the canvas area, labelled "Opening image" for screen readers · `EmptyCanvas` stays underneath | wireframe 01-c |
| error | The open was refused: AC-04 (no image files), AC-07 (unsupported format), AC-08 (`NOT_AN_IMAGE` / `UNREADABLE` / `DECODE_FAILED`), AC-09 (`TOO_LARGE`), AC-10 (`FILE_NOT_PERMITTED`), AC-03 (several files, none read). Canvas unchanged, no confirmation asked | `EmptyCanvas` unchanged · `Toast` variant `failure` (stays until dismissed) in `ToastStack`. Copy → §Message catalog | wireframe 01-d |
| success | The read succeeded. There is no Work yet, so nothing can have Unsaved edits | → SCR-02 `success` (new Work at Fit, then its notices) | — |
| validation | N/A: the screen has no form or typed input | — | — |

```text
01-a  default / empty
+----------------------------------------------------------+
| imgly                                                    |  EditorTopBar
+----------------------------------------------------------+
|                                                          |
|                                                          |
|                     [ Open image ]                       |  BaseButton primary
|          or drop an image anywhere in this window        |  --color-text-muted
|                                                          |
|                                                          |
+----------------------------------------------------------+

01-b  drag-over (covers the whole window, top bar included)
+==========================================================+
|: : : : : : : : : : : : : : : : : : : : : : : : : : : : :|
|:                                                        :|  DropOverlay: dashed
|:                Drop an image to open it                :|  --color-accent border
|:                                                        :|
|: : : : : : : : : : : : : : : : : : : : : : : : : : : : :|
+==========================================================+

01-c  loading
+----------------------------------------------------------+
| imgly                                                    |
+----------------------------------------------------------+
|                                                          |
|                     [ Open image ]   <- still enabled    |
|                          ( @ )                           |  Spinner overlay
|          or drop an image anywhere in this window        |
|                                                          |
+----------------------------------------------------------+

01-d  error (failure reason stays until dismissed)
+----------------------------------------------------------+
| imgly                                                    |
+----------------------------------------------------------+
|                     [ Open image ]                       |
|          or drop an image anywhere in this window        |
|                      +---------------------------------+ |
|                      | This file couldn't be read as   | |  Toast failure
|                      | an image.                   [x] | |
|                      +---------------------------------+ |
+----------------------------------------------------------+
```

### SCR-02 — Editor with Work

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A Work is open at Fit, upright, never above 100% (AC-01, AC-06, `sad.md` flow 1). Auto-fit is on, so a window resize re-fits (AC-12b) | `EditorTopBar` with `BaseButton` secondary "Open image" · `PreviewCanvas` · `EditorStatusBar`: `DimensionsReadout` ("4096 × 2731 px", `--font-mono`, visible as long as the Work is open, AC-05/AC-06) + `ZoomBar` (`BaseButton` ghost "−" / "+" / "Fit" / "100%" + zoom level readout) · `ToastStack` | wireframe 02-a |
| zoomed / panned | Pinch, `Ctrl/Cmd`+scroll, zoom controls, 100%, pan gestures (AC-12, AC-12b, AC-13, `sad.md` flow 5). Zoom is clamped between the smaller of Fit and 10%, and 800%. Auto-fit is off until "Fit". The Work and its revision are unchanged (AC-14) | as `default`. The zoom readout shows the live level. The cursor is `grab` / `grabbing` only while the image is larger than the canvas area; an image that fits stays centred and shows the default cursor | wireframe 02-b |
| success | A new image replaced the Work: directly when there are no Unsaved edits (AC-14), or after SCR-03 "Replace" (AC-15). Its notices appear **only after** the replace, all at once, none hiding another (AC-05, AC-11, AC-03, AC-11b) | as `default` + `Toast` variant `info` (dismisses itself), stacked in `ToastStack` | wireframe 02-c |
| drag-over | Files dragged over the window (ux-flows US-02) | `DropOverlay` over the whole window, with the Preview dimmed underneath | wireframe 01-b (same overlay) |
| loading | A file was chosen or dropped while a Work is open (US-06, `sad.md` flow 1). The Preview stays visible, and zoom, pan, "Open image" and drop all keep working. A newer open abandons this one (AC-16b) | as `default` + `Spinner` overlay centred over the live `PreviewCanvas` | wireframe 02-d |
| error | The new file was refused (AC-16, with codes as in SCR-01 `error`). The Work and View are exactly as before, and no confirmation is asked | as `default` + `Toast` variant `failure` (stays until dismissed) | wireframe 01-d (same toast, over the Work) |
| restoring | The graphics context was lost and a restore is pending before the deadline (AC-19, `sad.md` flow 7). The canvas area never shows black: it is filled with `--color-canvas-surround` and a `Spinner`. The zoom controls stay visible | `PreviewCanvas` (cleared to surround) + `Spinner` · `EditorStatusBar` unchanged | wireframe 02-e |
| restored | The context is back: the Preview is redrawn at the unchanged View, without reopening the file (AC-19) | → `default` / `zoomed / panned`, whichever it was | — |
| display lost | The restore deadline passed or the rebuild failed (AC-19b) | → SCR-05 | — |
| replace pending | The read succeeded and the Work has Unsaved edits (AC-15) | → SCR-03 over this screen | — |
| empty | N/A: a screen with no Work is SCR-01 | — | — |
| validation | N/A: there is no typed input. The zoom readout is display-only | — | — |

```text
02-a  default (Fit)
+----------------------------------------------------------+
| imgly                                     [ Open image ] |  BaseButton secondary
+----------------------------------------------------------+
|##########################################################|  --color-canvas-surround
|######+--------------------------------------------+######|
|######|                                            |######|
|######|              Preview at Fit                |######|  PreviewCanvas
|######|                                            |######|
|######+--------------------------------------------+######|
+----------------------------------------------------------+
| 4096 × 2731 px                  [-]  42%  [+] [Fit][100%] |  EditorStatusBar
+----------------------------------------------------------+

02-b  zoomed in and panned (image larger than the canvas area)
+----------------------------------------------------------+
| imgly                                     [ Open image ] |
+----------------------------------------------------------+
|                                                          |
|          Preview at 250%, cursor: grab                   |
|                                                          |
+----------------------------------------------------------+
| 4096 × 2731 px                  [-] 250%  [+] [Fit][100%] |
+----------------------------------------------------------+

02-c  success with notices (shown after the replace, info dismisses itself)
+----------------------------------------------------------+
| imgly                                     [ Open image ] |
+----------------------------------------------------------+
|######+--------------------------------------------+######|
|######|                      +-------------------------+ |
|######|                      | Reduced to the 4096 px  | |  Toast info
|######|                      | limit: 6000×4000 →      | |
|######|                      | 4096×2731.              | |
|######|                      +-------------------------+ |
|######|                      | Animated image: only    | |  Toast info
|######|                      | the first frame was kept| |
|######+----------------------+-------------------------+ |
+----------------------------------------------------------+
| 4096 × 2731 px                  [-]  42%  [+] [Fit][100%] |
+----------------------------------------------------------+

02-d  loading (Work stays live underneath)
+----------------------------------------------------------+
| imgly                                     [ Open image ] |  still enabled
+----------------------------------------------------------+
|######+--------------------------------------------+######|
|######|                   ( @ )                    |######|  Spinner overlay
|######|        current Work, zoom and pan work     |######|
|######+--------------------------------------------+######|
+----------------------------------------------------------+
| 4096 × 2731 px                  [-]  42%  [+] [Fit][100%] |
+----------------------------------------------------------+

02-e  restoring (never a black canvas)
+----------------------------------------------------------+
| imgly                                     [ Open image ] |
+----------------------------------------------------------+
|##########################################################|
|#########################( @ )############################|  Spinner on surround
|##########################################################|
+----------------------------------------------------------+
| 4096 × 2731 px                  [-]  42%  [+] [Fit][100%] |
+----------------------------------------------------------+
```

### SCR-03 — Replace confirmation

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A new image was read successfully while the Work has Unsaved edits (AC-15, `sad.md` flow 1 `else` branch). It is modal over the dimmed SCR-02, with the Work still visible behind it. Focus is trapped and goes to **Cancel** first; on close it returns to the element that had it | `ReplaceDialog` (`Dialog`, role `alertdialog`): title "Replace the current image?", body "Your edits to the current image will be lost.", `BaseButton` secondary "Cancel" + `BaseButton` primary "Replace" | wireframe 03-a |
| replace | "Replace" pressed | → SCR-02 `success`: the new Work at Fit, **then** its notices | — |
| cancel | "Cancel", `Esc`, or a click on the backdrop | → SCR-02 with the Work and View exactly as before. The read image is discarded and no notices appear (AC-15) | — |
| drop while open | Files dropped while the dialog is open | Ignored: the modal blocks until it is answered. The window drop guard still stops navigation (AC-02). No `DropOverlay` is shown | — |
| loading | N/A: the dialog appears only after the read succeeded | — | — |
| error | N/A: a refused or unreadable file never reaches the dialog (AC-16) | — | — |
| empty | N/A: shown only when a Work with Unsaved edits exists | — | — |
| validation | N/A: there is no input, only two choices | — | — |

```text
03-a  default
+----------------------------------------------------------+
| imgly                                     [ Open image ] |  (behind backdrop,
+----------------------------------------------------------+   not reachable)
|::::::::::::::::::::::::::::::::::::::::::::::::::::::::::|
|:::::::::+--------------------------------------+:::::::::|
|:::::::::| Replace the current image?           |:::::::::|  Dialog
|:::::::::| Your edits to the current image will |:::::::::|
|:::::::::| be lost.                             |:::::::::|
|:::::::::|              [ Cancel ]  [ Replace ] |:::::::::|  focus starts on Cancel
|:::::::::+--------------------------------------+:::::::::|
+----------------------------------------------------------+
| 4096 × 2731 px                  [-]  42%  [+] [Fit][100%] |
+----------------------------------------------------------+
```

### SCR-04 — Unsupported browser

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | The start-up capability gate found WebGL2, the texture size or worker canvas missing (AC-18, `UNSUPPORTED_BROWSER`, `sad.md` flow 6, capability-missing branch). The screen *is* the error state | `EditorTopBar` (app name only; "Open image" is absent) · `CanvasMessage` (role `status`): "This browser can't display the editor." / "The editor needs WebGL2 graphics, which this browser doesn't support or has turned off. Try a current version of Chrome, Edge, Firefox or Safari." | wireframe 04-a |
| drag-over / drop | Files dragged or dropped onto the window (AC-18) | No `DropOverlay`. Nothing opens, the browser never navigates away, and the same message stays | wireframe 04-a (unchanged) |
| error | This screen is itself the blocking-error state (`docs/design-system.md`: blocking conditions get a full-canvas message, not a toast) | — | — |
| loading | N/A: nothing can be opened here | — | — |
| empty | N/A: no Work can exist | — | — |
| validation | N/A: no input | — | — |

```text
04-a  default
+----------------------------------------------------------+
| imgly                                                    |  no Open image
+----------------------------------------------------------+
|                                                          |
|       This browser can't display the editor.             |  CanvasMessage title
|                                                          |
|       The editor needs WebGL2 graphics, which this       |  body, --color-text-muted
|       browser doesn't support or has turned off.         |
|       Try a current version of Chrome, Edge, Firefox     |
|       or Safari.                                         |
|                                                          |
+----------------------------------------------------------+
```

### SCR-05 — Display lost

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | On SCR-02, the graphics context was not restored before the deadline, or rebuilding failed (AC-19b, `DISPLAY_LOST`, `sad.md` flow 7 `else` branch). This replaces the canvas area, and the status bar is hidden. Focus moves to "Reload page" | `EditorTopBar` (app name only) · `CanvasMessage` (role `alert`): "The display couldn't recover." / "Your graphics were interrupted and the editor couldn't restore them. Reload the page to continue. The open image and any edits will be lost." + `BaseButton` primary "Reload page" | wireframe 05-a |
| reload | "Reload page" or the browser's own reload | → SCR-01 (the Work is gone, as the message says) | — |
| drag-over / drop | Files dragged or dropped onto the window | Ignored, with no `DropOverlay`. The drop guard stops navigation | — |
| error | This screen is itself the blocking-error state | — | — |
| loading | N/A: nothing is opened from here | — | — |
| empty | N/A: reached only from a screen with a Work | — | — |
| validation | N/A: no input | — | — |

```text
05-a  default
+----------------------------------------------------------+
| imgly                                                    |
+----------------------------------------------------------+
|                                                          |
|       The display couldn't recover.                      |  CanvasMessage title
|                                                          |
|       Your graphics were interrupted and the editor      |
|       couldn't restore them. Reload the page to          |
|       continue. The open image and any edits will be     |
|       lost.                                              |
|                                                          |
|                    [ Reload page ]                       |  BaseButton primary
+----------------------------------------------------------+
```

### SCR-06 — System file dialog

The operating system's own picker. It is not designed here, and only how the app opens it is fixed.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Open image" or `Ctrl/Cmd+O` on SCR-01 or SCR-02 (US-01). One file only, filtered with `accept="image/*"`; the Editor can still switch the OS filter to all files. The content still decides what opens (AC-08) | OS-native (a hidden file input, triggered by the `BaseButton`) | N/A: OS-native |
| cancelled | The dialog is closed without a file | → the starting screen unchanged, with no notice (ux-flows US-01) | — |
| file chosen | One file selected | → `loading` on the starting screen (SCR-01 or SCR-02) | — |
| error | N/A in the dialog: a refusal such as AC-10 surfaces after it closes, as the `error` state of the starting screen | — | — |
| loading / empty / validation | N/A: the OS owns this screen | — | — |

## Message catalog

This is the seed for `src/features/editor/messages.ts` (`sad.md` §8, User messages), with one entry per
`AppError` code or notice. **info** notices dismiss themselves. **failure** notices stay until the
Editor dismisses them (AC-11b). Values in `{…}` are filled in at runtime. No file name or raw
browser error text is ever shown.

| Kind | Code / trigger | AC | Copy |
|---|---|---|---|
| info | downscaled | AC-05 | Reduced to the 4096 px limit: {w}×{h} → {w'}×{h'}. |
| info | first frame only | AC-11 | Animated image: only the first frame was kept. |
| info | other files ignored | AC-03 | The editor works with one image at a time. {n} other file(s) were ignored. (singular: "1 other file was ignored.") |
| failure | no image files dropped | AC-04 | Only image files can be opened. |
| failure | `UNSUPPORTED_FORMAT` | AC-07 | {FORMAT} files can't be opened here. Convert it to JPEG or PNG. (TIFF and TIFF-based camera RAW share one name: "TIFF or camera RAW", `sad.md` §11) |
| failure | `UNSUPPORTED_FORMAT` (HEIC/HEIF) | AC-07 | HEIC files can't be opened in this browser. Convert it to JPEG or PNG, or use a browser that opens HEIC. |
| failure | `NOT_AN_IMAGE` / `UNREADABLE` / `DECODE_FAILED` | AC-08 | This file couldn't be read as an image. |
| failure | `TOO_LARGE` | AC-09 | This image is too large: {w}×{h} px ({mp} MP). The largest the editor opens is {ceiling} MP. |
| failure | `FILE_NOT_PERMITTED` | AC-10 | The app wasn't allowed to read this file. Make it available on this computer first, for example by downloading it from your cloud drive. |
| blocking | `UNSUPPORTED_BROWSER` | AC-18 | SCR-04 copy |
| blocking | `DISPLAY_LOST` | AC-19b | SCR-05 copy |

For accessibility, `ToastStack` announces info notices politely and failure reasons assertively
(`role="alert"`). Every `Toast` has a dismiss button with a visible focus ring (`--color-focus-ring`).

## New components

The inventory holds only `BaseButton`. **Shared primitives** go to `src/shared/ui/`, and `implement`
registers each one in `docs/design-system.md` §Component inventory. **Feature composites** go to
`src/features/editor/components/`. They are built only from inventory and new primitives, and they
stay out of the shared inventory.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `Spinner` (shared primitive) | The canon's loading convention is an indeterminate spinner overlay, and `BaseButton` is the only primitive | pending |
| `Toast` (shared primitive) | One notice with `info` (dismisses itself) and `failure` (stays, with a dismiss button) variants. Nothing in the inventory shows a non-blocking message | pending |
| `ToastStack` (shared primitive) | The canon's single bottom-right notice boundary, bound to the `src/shared/notices/` queue. It stacks several notices without one hiding another (AC-11b) | pending |
| `Dialog` (shared primitive) | A modal with a focus trap, focus return, `Esc` and a backdrop for SCR-03. No modal exists yet | pending |
| `CanvasMessage` (shared primitive) | The canon's full-canvas message for blocking conditions (SCR-04, SCR-05): title, body and an optional action. A toast is wrong here by convention | pending |
| `EditorTopBar` (feature composite) | Layout region: app name plus, on SCR-02, `BaseButton` "Open image" | n/a (feature-local) |
| `EmptyCanvas` (feature composite) | The SCR-01 content: `BaseButton` primary + the one-line hint (AC-17) | n/a (feature-local) |
| `DropOverlay` (feature composite) | Whole-window drop feedback with the editor's drop copy. It is shown only where drops are accepted (SCR-01, SCR-02) | n/a (feature-local) |
| `PreviewCanvas` (feature composite) | Hosts the one WebGL2 canvas of ADR-0003 and turns pointer and wheel input into View changes. No primitive draws pixels | n/a (feature-local) |
| `EditorStatusBar` (feature composite) | Layout region holding `DimensionsReadout` and `ZoomBar` on SCR-02 | n/a (feature-local) |
| `DimensionsReadout` (feature composite) | The Original's "{w} × {h} px" in `--font-mono`, visible while a Work is open (AC-05, AC-06) | n/a (feature-local) |
| `ZoomBar` (feature composite) | `BaseButton` ghost "−" / "+" / "Fit" / "100%" plus the live zoom-level readout (AC-12, AC-12b), with shortcuts in the tooltips | n/a (feature-local) |
| `ReplaceDialog` (feature composite) | `Dialog` set up with the AC-15 copy, Cancel first | n/a (feature-local) |
