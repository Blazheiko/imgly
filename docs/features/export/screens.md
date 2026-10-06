---
status: approved         # draft | approved
feature_size: "S"
tool: "code"
updated_at: "2026-10-05"
---

# Screens — export

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below.
- **Inputs:** screen inventory from `ux-flows.md` (SCR-01 to SCR-05, all covered). States come from spec §5 ACs, the `sad.md` §6 flows and their `alt`/`else` branches, the §1 Decision override ("File ready — Save…"), and the `sad.md` §8 `AppError` codes. There is no `contracts/` folder, because the feature has no external interface (`target_surfaces: [web-frontend]`, no server), so no state comes from a contract error response.
- **SCR ids are this feature's** (ux-flows.md §Screen inventory). They differ from open-and-view's: export SCR-01 is open-and-view's SCR-02 (Editor with Work), export SCR-02 is its SCR-01 (Empty editor), export SCR-05 is its SCR-03 (Replace confirmation).
- **One deviation from the canon, deliberate:** `docs/design-system.md` §Loading puts a spinner overlay on the canvas while exporting. Here the progress is on the Export button and in the panel instead, and the canvas has no overlay, because AC-11 keeps zoom and pan available during an export and the Preview must stay unobstructed. `implement` updates the canon's Loading line when it lands.

### Shell changes

- **Top bar** (`EditorTopBar`) gets an actions slot on the right (`sad.md` §5). On SCR-01 it holds `BaseButton` secondary "Open image" (unchanged) followed by `ExportAction`: `BaseButton` primary "Export". On SCR-02 `ExportAction` is shown unavailable: the top bar of an empty editor otherwise has no actions (open-and-view SCR-01).
- **Export panel** (SCR-03) is a `Popover` anchored under the Export button, right-aligned to it, width `--panel-width`. It sits over the canvas area, never replaces it, and has no backdrop, so the Preview stays visible and can be zoomed and panned.
- Notices stay in `ToastStack` at the bottom right (single notice boundary).

### Keyboard

| Key | Where | Action | AC |
|---|---|---|---|
| `Ctrl/Cmd+S` | SCR-01, panel closed | Opens the export panel. Never the browser's "Save page" | AC-17 |
| `Ctrl/Cmd+S` | SCR-03 idle | Confirms, like the confirm button, after applying a value still being typed | AC-17 |
| `Ctrl/Cmd+S` | During an export | Does nothing (the browser's "Save page" still never opens) | AC-17 |
| `Ctrl/Cmd+S` | SCR-02 | Shows the "open an image first" notice | AC-17 |
| `Tab`, `Enter` / `Space` | SCR-01 | Reach and activate Export | AC-17 |
| `Enter` | Quality or size field | Applies the value as if leaving the field. Does not export | AC-04, AC-05, AC-17 |
| `Enter` / `Space` | Confirm button | Confirms | AC-17 |
| `Esc` / click outside | SCR-03 idle or File ready | Applies a value still being typed, then closes. In File ready this ends the export as cancelled | AC-17, AC-19, `sad.md` §1 |
| `Esc` / click outside | During an export (not File ready) | Does nothing | AC-17 |

Focus moves into the panel on open: to the selected format option. It is not trapped, because the panel is non-modal. On close, focus returns to the Export button.

## Screens

### SCR-01 — Editor with Work

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A Work is open (open-and-view), no export running. Export is visible next to the canvas and reachable by keyboard (AC-17) | `EditorTopBar` with `BaseButton` secondary "Open image" + `ExportAction` (`BaseButton` primary "Export") · `PreviewCanvas` · `EditorStatusBar` · `ToastStack` | wireframe 01-a |
| panel open | Export clicked, activated by keyboard, or `Ctrl/Cmd+S` | → SCR-03 over this screen | — |
| loading (exporting) | From confirm until the export ends, including while SCR-04 is open (AC-11, `sad.md` §6 "While an export runs"). "Open image", Export and the editing controls are disabled. Export shows progress. The canvas has no overlay: zoom and pan keep working, and the View does not change the file (AC-03) | `ExportAction`: `BaseButton` primary disabled, label "Exporting…" + `Spinner` · "Open image" `BaseButton` disabled · `PreviewCanvas` live | wireframe 01-b |
| drop while exporting | A file is dropped during an export (AC-11). It is not opened. This is the only action that shows a notice; a disabled control does nothing | as `loading` + `Toast` `info` "Wait for the export to finish…" (→ §Message catalog). No `DropOverlay` while exporting | wireframe 01-b |
| success (saved) | The file was written through SCR-04 (AC-01). The panel closes and the Work has no Unsaved edits (AC-09) | as `default` + `Toast` `info` "Saved {file}." | wireframe 01-c |
| success (downloaded) | The file was handed to the browser's downloads (AC-02) | as `default` + `Toast` `info` "{file} is in your browser's downloads." | wireframe 01-c |
| error | Every export failure leaves the panel open → SCR-03 `error` | → SCR-03 | — |
| empty | N/A: a screen with no Work is SCR-02 | — | — |
| validation | N/A: the screen itself has no input. The panel's fields are SCR-03 | — | — |

```text
01-a  default
+----------------------------------------------------------+
| imgly                          [ Open image ] [ Export ] |  secondary · primary
+----------------------------------------------------------+
|##########################################################|
|######+--------------------------------------------+######|
|######|                                            |######|
|######|                  Preview                   |######|
|######|                                            |######|
|######+--------------------------------------------+######|
+----------------------------------------------------------+
| 4096 × 3072 px                  [-]  42%  [+] [Fit][100%] |
+----------------------------------------------------------+
```

```text
01-b  loading (exporting), panel open behind it is SCR-03 loading
+----------------------------------------------------------+
| imgly                   (Open image)  [ (o) Exporting… ] |  both disabled
+----------------------------------------------------------+
|######+--------------------------------------------+######|  Preview stays live:
|######|                  Preview                   |######|  zoom and pan work
|######+--------------------------------------------+######|
|                       +--------------------------------+ |
|                       | Wait for the export to finish, | |  Toast info
|                       | then drop the image again.     | |  (only after a drop)
|                       +--------------------------------+ |
+----------------------------------------------------------+
```

```text
01-c  success
+----------------------------------------------------------+
| imgly                          [ Open image ] [ Export ] |
+----------------------------------------------------------+
|######|                  Preview                   |######|
|                       +--------------------------------+ |
|                       | Saved IMG_4021-edited.jpg.  [x]| |  Toast info
|                       +--------------------------------+ |
+----------------------------------------------------------+
  downloads path: "IMG_4021-edited.jpg is in your browser's downloads."
```

### SCR-02 — Empty editor

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | No Work is open (AC-17). Export is shown but unavailable: it stays focusable (`aria-disabled`, not `disabled`) so the keyboard user can reach it and hear why, and its accessible description is the hint | `EditorTopBar` with `ExportAction` (`BaseButton` primary, `aria-disabled`, styled disabled) · open-and-view's `EmptyCanvas` unchanged | wireframe 02-a |
| hint | Export activated, or `Ctrl/Cmd+S` pressed, with no image open (AC-17). The browser's "Save page" never opens | as `default` + `Toast` `info` "Open an image first to export it." | wireframe 02-a |
| loading | N/A: nothing can be exported here | — | — |
| error | N/A: no export can start, so none can fail | — | — |
| empty | Same as `default`: SCR-02 *is* the no-Work state | as `default` | wireframe 02-a |
| validation | N/A: no input | — | — |

```text
02-a  default / hint
+----------------------------------------------------------+
| imgly                                        ( Export )  |  aria-disabled
+----------------------------------------------------------+
|                                                          |
|                     [ Open image ]                       |  EmptyCanvas (open-and-view)
|          or drop an image anywhere in this window        |
|                       +--------------------------------+ |
|                       | Open an image first to export  | |  Toast info, on
|                       | it.                            | |  activate / Ctrl/Cmd+S
|                       +--------------------------------+ |
+----------------------------------------------------------+
```

### SCR-03 — Export panel

Layout, top to bottom: **Format** (`SegmentedControl`: PNG · JPEG · WebP, each option with an optional one-line hint under the control), **Quality** (`SliderField` 1–100, only for JPEG and WebP), **Size** (`SegmentedControl` presets 100% · 75% · 50% · 25%, then a `NumberField` "Long side" in px, then the read-only result "4096 × 3072 px" in `--font-mono`), **File name** (read-only text: the suggested name with the extension of the selected format; the Editor renames it in SCR-04 where there is one), the **path line** (`--color-text-muted`), and the confirm button.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Panel opened for this Work (`sad.md` §6 "Open the export panel"). Format: remembered for this Work, else the Source format if the check confirmed it, else PNG. Quality: remembered this session, else 90. Size: remembered for this Work, else 100%. Name: cleaned Source name + `-edited` + extension (AC-07, AC-19) | `Popover` · `SegmentedControl` (format) · `SliderField` (quality) · `SegmentedControl` (size presets) · `NumberField` (long side, unit "px") · size readout · name text · path line · `BaseButton` primary "Export" | wireframe 03-a |
| PNG selected | PNG is the selected format (AC-04). Quality is hidden, not disabled: PNG is lossless | as `default` without `SliderField` | wireframe 03-b |
| format checking | The session's format check has not finished (AC-12). JPEG and WebP are not selectable, PNG is selected and stays selected when the check ends: the panel never switches by itself | `SegmentedControl` with JPEG and WebP disabled + hint "Checking this browser…" | wireframe 03-b |
| format unavailable | The check found that this browser can't produce the format, or failed, or an export produced another format (AC-12) | `SegmentedControl` option disabled + hint "{Format} isn't available in this browser." | wireframe 03-b |
| JPEG transparency hint | JPEG is selected (chosen, preset or remembered) and the Work has a pixel that is not fully opaque (AC-15). A Work with no such pixel shows no hint | as `default` + one-line hint under Format (`--color-text-muted`) | wireframe 03-a |
| validation | A typed quality or long side is applied on blur or `Enter` (AC-04, AC-05, AC-06). Out of range snaps to the bound, a fraction rounds, an empty or non-numeric value returns to the previous one; a size above the Work snaps to full size, too small snaps to the smallest long side with a 1 px short side. No inline error: the field shows the corrected value and the readout updates (canon §Validation). A preset is highlighted only while the long side equals it | `SliderField` · `NumberField` · size readout | wireframe 03-a |
| loading (exporting) | Confirm pressed: values still being typed are applied first, then the export runs (AC-11, AC-17). Controls disabled, the panel can't be closed by `Esc` or a click outside | all controls disabled · `BaseButton` primary disabled "Exporting…" + `Spinner` | wireframe 03-c |
| file ready | Chromium only: encoding outlasted the activation window, so the "Save as…" dialog could not open by itself (`sad.md` §1 Decision override, ADR-0001). The verified file is kept. Still an export: SCR-01 stays in `loading`. "Save…" opens SCR-04; `Esc` or a click outside ends the export as cancelled, with no message | controls disabled · one line "Your file is ready." · `BaseButton` primary "Save…" (focused) | wireframe 03-d |
| cancelled | SCR-04 cancelled, or File ready left (AC-10) | → `default` with the same choices, no message, Unsaved edits kept | — |
| error | The export failed or was refused: `EXPORT_FAILED` (AC-13), `EXPORT_FORMAT_MISMATCH` (AC-12), `EXPORT_EXTENSION_MISMATCH` (AC-01b), `EXPORT_NOT_PERMITTED` (AC-14). The panel stays open with the same choices, except that a refused format is replaced by PNG and shown unavailable. Retrying is one confirm (AC-17). Unsaved edits kept | as `default` (controls enabled again) + `Toast` `failure` (stays until dismissed), copy → §Message catalog | wireframe 03-e |
| success | The file was written or handed off | → SCR-01 `success`, panel closed | — |
| empty | N/A: the panel opens only when a Work is open | — | — |

The **path line** under the file name says where the file will go, so the Editor is never surprised (AC-02): "You'll choose where to save it." where the browser has a "Save as…" dialog, "It goes to your browser's downloads." elsewhere.

```text
03-a  default (JPEG, quality shown, transparency hint)
                       +----------------------------------+
                       | Format                           |
                       | [ PNG ][#JPEG#][ WebP ]          |  SegmentedControl
                       | JPEG has no transparency:        |  hint, only for a
                       | transparent areas become white.  |  transparent Work
                       | PNG or WebP keep them.           |
                       |                                  |
                       | Quality                          |
                       | |-----------------o---|  [ 90 ]  |  SliderField
                       |                                  |
                       | Size                             |
                       | [#100%#][ 75% ][ 50% ][ 25% ]    |  SegmentedControl
                       | Long side [ 4096 ] px            |  NumberField
                       | 4096 × 3072 px                   |  --font-mono
                       |                                  |
                       | File name                        |
                       | IMG_4021-edited.jpg              |  read-only
                       | You'll choose where to save it.  |  path line, muted
                       |                     [ Export ]   |  BaseButton primary
                       +----------------------------------+
```

```text
03-b  PNG selected; format checking / unavailable
                       +----------------------------------+
                       | Format                           |
                       | [#PNG#][ JPEG ][(WebP)]          |  WebP disabled
                       | WebP isn't available in this     |  "Checking this
                       | browser.                         |  browser…" while
                       |                                  |  the check runs
                       | Size                             |  (no Quality: PNG
                       | [ 100% ][ 75% ][#50%#][ 25% ]    |   is lossless)
                       | Long side [ 2048 ] px            |
                       | 2048 × 1536 px                   |
                       |                                  |
                       | File name                        |
                       | IMG_4021-edited.png              |
                       | It goes to your browser's        |
                       | downloads.                       |
                       |                     [ Export ]   |
                       +----------------------------------+
```

```text
03-c  loading (exporting)
                       +----------------------------------+
                       | Format   (PNG)(#JPEG#)(WebP)     |  all disabled
                       | Quality  (90)                    |
                       | Size     (100%) (4096) px        |
                       | IMG_4021-edited.jpg              |
                       |          [ (o) Exporting… ]      |  disabled + Spinner
                       +----------------------------------+
```

```text
03-d  file ready (Chromium, activation window lapsed)
                       +----------------------------------+
                       | Format   (PNG)(#JPEG#)(WebP)     |  disabled
                       | ...                              |
                       | Your file is ready.              |
                       |                     [ Save… ]    |  primary, focused
                       +----------------------------------+
```

```text
03-e  error (panel open, same choices, failure toast)
                       +----------------------------------+
                       | Format                           |
                       | [ PNG ][#JPEG#][ WebP ]          |  enabled again
                       | ...                              |
                       |                     [ Export ]   |  one confirm retries
                       +----------------------------------+
                       +--------------------------------+
                       | The export failed. Try again,  |  Toast failure
                       | or choose a smaller size.   [x]|  (stays)
                       +--------------------------------+
```

### SCR-04 — "Save as…" dialog

The operating system's or browser's own dialog (Chromium only). Not designed by us. What the app controls is what it is opened with.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | SCR-03 confirmed and the file verified (ADR-0001), or "Save…" in File ready. Opened with the suggested name and only the chosen format's type (`.png`; `.jpg .jpeg .jpe .jfif`; `.webp`), with no "all files" choice (AC-01b) | platform dialog · SCR-01 `loading` behind it | — |
| save | The Editor saves. The returned name's extension matches | → write → SCR-01 `success (saved)` | — |
| cancel | The Editor cancels (AC-10) | → SCR-03 `cancelled` | — |
| error | Returned name has no matching extension (AC-01b), or the write is refused (AC-14) | → SCR-03 `error` | — |
| loading / empty / validation | N/A: the platform's dialog, its own states | — | — |

### SCR-05 — Replace confirmation

open-and-view's `ReplaceDialog`, unchanged in look and copy. export only decides whether it appears (`sad.md` §6 "Open another image after an export").

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Another image is opened or dropped while the Work has Unsaved edits: never exported, or the export was cancelled, refused or failed, or the Work was edited after it (AC-10) | `ReplaceDialog` (`Dialog`) as in open-and-view | open-and-view wireframe 03-a |
| skipped | The last export completed and nothing was edited since (AC-09). The new Work replaces it with no dialog, and takes the new image's Source name and format (AC-08) | → open-and-view's Editor with Work `success` | — |
| loading / error / empty / validation | N/A: as in open-and-view's manifest | — | — |

## Message catalog

The seed for `src/features/export/messages.ts` (`sad.md` §8, User messages). **info** notices dismiss themselves. **failure** notices stay until dismissed. `{file}` is the file name as saved or suggested, already cleaned (AC-07). No raw browser error text is ever shown.

| Kind | Code / trigger | AC | Copy |
|---|---|---|---|
| info | saved through "Save as…" | AC-01 | Saved {file}. |
| info | handed to the downloads | AC-02 | {file} is in your browser's downloads. |
| info | Export or `Ctrl/Cmd+S` with no image | AC-17 | Open an image first to export it. |
| info | file dropped during an export | AC-11 | Wait for the export to finish, then drop the image again. |
| failure | `EXPORT_FAILED` | AC-13 | The export failed. Try again, or choose a smaller size. |
| failure | `EXPORT_FORMAT_MISMATCH` | AC-12 | This browser didn't make a real {Format} file, so nothing was saved. {Format} is turned off for now; PNG is selected. |
| failure | `EXPORT_EXTENSION_MISMATCH` | AC-01b | "{name}" doesn't end in {ext}, so nothing was written. Save again with a {ext} name. |
| failure | `EXPORT_NOT_PERMITTED` | AC-14 | The app wasn't allowed to save there. Choose another folder. |
| failure suffix | after `EXPORT_EXTENSION_MISMATCH` or `EXPORT_NOT_PERMITTED` (the dialog had already emptied or created the file) | AC-13 | A file named "{name}" there may now be empty or missing. |
| hint | format unavailable | AC-12 | {Format} isn't available in this browser. |
| hint | format check running | AC-12 | Checking this browser… |
| hint | JPEG and transparent pixels | AC-15 | JPEG has no transparency: transparent areas become white. PNG or WebP keep them. |
| line | path, "Save as…" available | AC-01 | You'll choose where to save it. |
| line | path, downloads | AC-02 | It goes to your browser's downloads. |
| line | file ready | `sad.md` §1 | Your file is ready. |

`{ext}` is the format's main extension (`.png`, `.jpg`, `.webp`). `{name}` is the name the dialog returned. Here, unlike open-and-view, file names are shown, because the Editor chose them and needs them to find the file (spec §1).

## New components

**Shared primitives** go to `src/shared/ui/`, and `implement` registers each one in `docs/design-system.md` §Component inventory. **Feature composites** go to `src/features/export/` and stay out of the shared inventory.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `Popover` (shared primitive) | A non-modal panel anchored to a button: no backdrop, focus moves in but is not trapped, `Esc` and a click outside close it unless the owner locks it (during an export). `Dialog` is modal (`alertdialog`, backdrop, focus trap), which would block zoom and pan (AC-11) | pending |
| `SegmentedControl` (shared primitive) | A single-choice group (`radiogroup`, arrow keys) with a per-option disabled state and a one-line hint. Used for format (AC-12 unavailable options) and size presets. `BaseButton` has no selected state or group semantics | pending |
| `NumberField` (shared primitive) | An integer input with an optional unit that applies its value on blur and `Enter` through a caller's normalize function (snap, round or revert), and exposes "apply now" for confirm and close (AC-04, AC-05, AC-17). Nothing in the inventory accepts input | pending |
| `SliderField` (shared primitive) | The canon's "clamped slider paired with a number field" (§Validation): a range input bound to a `NumberField`. Quality here, brush width later | pending |
| `ExportAction` (feature composite) | `BaseButton` primary "Export" with its exporting (`Spinner`) and unavailable (`aria-disabled` + hint) states, mounted in the top-bar slot by `App.vue` | n/a (feature-local) |
| `ExportPanel` (feature composite) | SCR-03: the `Popover` content composed from the primitives above | n/a (feature-local) |
