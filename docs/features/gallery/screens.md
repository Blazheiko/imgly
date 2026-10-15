---
status: draft             # draft | approved
feature_size: "M"
tool: "code"
updated_at: "2026-10-13"
---

# Screens — gallery

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below.
- **Inputs:** screen inventory from `ux-flows.md` (SCR-01 to SCR-07, all covered). States come from spec §5 ACs (AC-01 to AC-21), the `sad.md` §6 Critical flows 1 and 2 and Flows 3–7 with their `alt`/`else` branches, and the `sad.md` §8 `AppError` codes (`STORAGE_UNAVAILABLE`, `STORAGE_FAILED`, `WORK_DAMAGED`, and the existing `STORAGE_QUOTA`). There is no `contracts/` folder, because the feature has no external interface (`target_surfaces: [web-frontend]`, no server), so no state comes from a contract error response.
- **States with no AC but with a design source:** "delete failed" comes from `sad.md` Flow 4 (`STORAGE_FAILED` on a delete), and the "newer version in another tab" notice and the "held by another tab" unavailable reason come from ADR-0006. Both were flagged for `screens` in `sad.md` §6 (Notes for later stages).
- **Decisions taken here** (confirmed with the owner on 2026-10-13):
  - The damaged-Work notice offers "Delete…" as an **action on the `Toast`** (ux-flows design input 5), not as a separate dialog. SCR-04 and SCR-05 stay the only blocking dialogs the app designs.
  - The stored thumbnail has a **long side of exactly 320 px** (ADR-0005 allows ≤ 512 px). It is shown in a 160 × 160 CSS px box, so it stays sharp at a device pixel ratio of 2.
  - The Gallery overlay (SCR-03) is **modal**. The top bar stays visible but is inert, and only choosing, deleting and closing act.
- **Reused unchanged:** open-and-view's drag-over, loading, error and System file dialog states on SCR-01 and SCR-02, its `DropOverlay`, `Spinner` overlay and failure notices. The tools, Undo and Redo, and Export keep their own screens and are not redrawn here.

### Shell changes

- **Top bar** (`EditorTopBar`): with a Work open (SCR-02), "Gallery" is the **first** action, before "Open image". The full order is `GalleryAction` (`BaseButton` secondary "Gallery"), "Open image", `UndoRedoActions`, `CropRotateAction`, `AdjustAction`, `DrawAction`, `ExportAction`. "Open image" is rendered by `EditorTopBar` itself, so it gains a `leading-actions` slot before it, which `EditorView` forwards and `App.vue` fills with `GalleryAction`. On SCR-01 the Gallery is already on screen, so "Gallery" is absent from the top bar, as "Open image" is.
- **Unavailable actions** follow the `AdjustAction` precedent. While a tool is open, "Gallery" stays focusable (`aria-disabled`, 0.45 opacity) with its hint as its accessible description, and activating it shows the hint as a `Toast` `info`. During an export it is truly `disabled`. A waiting replacement is a modal `Dialog`, so the top bar can't be reached then. "Gallery" has no keyboard shortcut.
- **Start screen** (SCR-01): `EditorView`'s new `start-screen` slot (`sad.md` §5) holds `GalleryStart` **under** open-and-view's `EmptyCanvas`. The drop zone becomes a band at the top of the canvas area, with `--space-8` padding above and below its "Open image" button and hint. The Gallery section follows below. The canvas area scrolls vertically when the entries don't fit.
- **Overlay** (SCR-03): `EditorView`'s new `overlay` slot holds `GalleryOverlay`. It covers the canvas area and the status bar, under the top bar, with a `--color-surface` background. It is `role="dialog"`, `aria-modal="true"` and labelled by its "Gallery" heading. While it is open, everything outside it is `inert`, focus stays inside it, and drops are ignored (the window drop guard still stops navigation). The overlay sets `editor.activePanel` to `'gallery'` (`PanelId` widens to `'export' | 'gallery'`), so the existing "a panel is open" guards make every tool, Undo, Redo, Export and `Ctrl/Cmd+O` shortcut do nothing while it shows.
- **Gallery list** (`GalleryList`, shared by SCR-01 and SCR-03): a header row and a grid.
  - **Header:** heading "Gallery" (`--font-size-lg`), and on the right the count "{n} of 20 places used" (`--font-size-sm`, `--color-text-muted`). On SCR-03 the `BaseButton` ghost "Close" sits at the far right of the header. Under the header is the **storage line** (`--font-size-sm`, `--color-text-muted`, AC-13).
  - **Grid:** entries newest first (by when they were last opened or changed), in columns of `--gallery-tile-size` (new token, 160px) with `--space-4` gaps, as many columns as fit.
  - **Entry** (`GalleryEntry`): a native `<button>` holding a 160 × 160 thumbnail box (`--color-canvas-surround` background, `--radius-md`, the thumbnail fitted inside it with `object-fit: contain`), then the name on one line (ellipsis, the full name as its `title`), then the status line in `--color-text-muted`: the touched label, or "Open", or "Damaged". Under the button is `BaseButton` ghost "Delete". The entry button's accessible name is "{name}, {status}". The Delete button's is "Delete “{name}”". Hover and focus-visible follow `BaseButton` (focus ring `--color-focus-ring`). The open Work's entry has a 2px `--color-accent` border on its thumbnail box.
- **Notices** stay in `ToastStack` at the bottom right, above the overlay and under a `Dialog`'s backdrop. `Toast` gains an optional action (§New components).
- **Autosave is invisible on success** (ux-flows §Platform decisions): no "Saved" indicator anywhere.
- Below 1024 px the same layout applies: the grid has fewer columns, the overlay scrolls, and nothing else changes (canon §Platform posture).

### Keyboard

| Key | Where | Action | AC |
|---|---|---|---|
| `Tab` | SCR-01 | Reaches "Open image" in the drop zone, then "Open image" in the empty state if shown, then each entry and its "Delete", newest first | AC-03, AC-05 |
| `Tab` / `Shift+Tab` | SCR-03 | Cycle inside the overlay only: "Close", then each entry and its "Delete" | AC-03 |
| `Enter` / `Space` | An entry | Chooses that Work (reopens it, or closes the overlay for the open Work) | AC-04 |
| `Enter` / `Space` | A "Delete" | Opens SCR-04, or shows the hint for the open Work | AC-06, AC-07 |
| `Esc` | SCR-03 | Closes the overlay, the Work unchanged. Focus returns to "Gallery" | AC-03 |
| `Esc` | SCR-04 or SCR-05 open | Cancels that dialog only (`Dialog`). The overlay stays | AC-06, AC-17 |
| `Ctrl/Cmd+O` | SCR-01 | Opens the file dialog, as before | — |
| `Ctrl/Cmd+O`, tool keys, `Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`, zoom keys | SCR-03 | Do nothing (a panel is open) | AC-03 |

When the overlay opens, focus moves to its first entry, or to "Close" when it has none. After a delete, focus moves to the next entry, else the previous one, else the empty-state "Open image". After a reopen, focus returns to "Gallery" in the top bar (or to the Preview's first focusable control on SCR-01's way to SCR-02, as after any open).

## Screens

### SCR-01 — Start screen

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | App load or reload with no Work open, the Gallery store opened and at least one Work stored (Flow 3 `records listed`, AC-03, AC-05). Entries newest first with thumbnail, Source name or "Untitled" and touched label, the count and the storage line. Nothing reopens on its own | `EditorTopBar` (app name only) · open-and-view's `EmptyCanvas` as a band · `GalleryStart` → `GalleryList` (`GalleryEntry` ×n, `BaseButton` ghost "Delete" ×n) · `ToastStack` | wireframe 01-a |
| listing | Between the store opening and the list being read. No spinner and no skeleton (canon §Loading): the section renders once the list is read (target: every thumbnail painted within 500 ms for 20 Works, spec §6). Until a thumbnail paints, its box is the empty `--color-canvas-surround` square | as `default`, empty thumbnail boxes | wireframe 01-a |
| empty | No Work stored, e.g. a first visit (Flow 3 `no records`, AC-05). Plain text "Works you open will appear here." and the same "Open image" action, plus the count "0 of 20 places used" and the storage line | `GalleryList` header + text + `BaseButton` secondary "Open image" | wireframe 01-b |
| storage line | Always under the header while the Gallery is available (AC-13). Wording follows `persisted()` each time the Gallery shows, and the non-persistent wording where the API is missing (`sad.md` §8) | text in `GalleryList` (→ §Message catalog) | wireframe 01-a, 01-b |
| damaged entry | A record's shape or its thumbnail can't be read while listing (Flow 3 `opt`, AC-08). The box shows "Can't be read" (`--font-size-xs`, `--color-text-muted`), the name is the stored Source name if it is text, else "Untitled", and the status is "Damaged". It stays chooseable and deletable. Every other entry lists normally | `GalleryEntry` damaged look | wireframe 01-a (third entry) |
| unavailable | The store can't be opened at page load (Flow 3 `storage cannot be opened`, `STORAGE_UNAVAILABLE`, AC-12), or it is still held by an older tab after a bounded wait (ADR-0006). The Gallery section shows a title and the reason instead of the grid, the count and the storage line. Opening, editing and exporting work, and nothing is stored until the next page load | `GalleryList` unavailable text (→ §Message catalog) | wireframe 01-c |
| reopening | An entry chosen (Critical flow 2). The Work is read and decoded in full (target p95 ≤ 1.5 s to its first Preview, spec §6). A `Spinner` overlay labelled "Opening {name}" is centred over the Gallery section, and the entries are inert until it ends. With no Work open, no replace gate applies | `Spinner` overlay | wireframe 01-d |
| reopened | The Work was readable in full | → SCR-02 `reopened` | — |
| reopen failed (damaged) | Any part missing, damaged or invalid (Critical flow 2, `WORK_DAMAGED`, AC-08). The start screen stays, the entry is marked damaged, and a failure notice names the Work with the action "Delete…" | `GalleryEntry` damaged look · `Toast` `failure` with action "Delete…" → SCR-04 | wireframe 01-e |
| reopen failed (read) | The stored parts couldn't be read (`STORAGE_FAILED` on choose, review round 3 R3-2). This says nothing about the Work, so the entry keeps its look and no Delete is offered. A failure notice names the Work and asks to try again | as `default` + `Toast` `failure`, no action | — |
| delete | "Delete" on any entry, damaged or not (Flow 4, AC-06). There is no open Work here, so delete is never unavailable | → SCR-04 | — |
| deleted | SCR-04 confirmed and committed. The entry is gone and the count drops by one. The last delete leaves the `empty` state | as `default` / `empty` | wireframe 01-a / 01-b |
| delete failed | The delete transaction failed (Flow 4 `storage failure`, `STORAGE_FAILED`). The entry stays as it was | as `default` + `Toast` `failure` | — |
| drag-over / loading / error | Opening a file from the drop zone or by drop: open-and-view's SCR-01 states unchanged. A successful open goes to SCR-02 and stores the new Work (AC-09) | open-and-view's `DropOverlay`, `Spinner`, `Toast` | — |
| validation | N/A: the screen has no typed input | — | — |

```text
01-a  default (with a damaged entry)
+--------------------------------------------------------------------------------------+
| imgly                                                                                |  EditorTopBar, no actions
+--------------------------------------------------------------------------------------+
|                                   [ Open image ]                                     |  EmptyCanvas band
|                        or drop an image anywhere in this window                      |
|--------------------------------------------------------------------------------------|
|  Gallery                                                       3 of 20 places used   |  header
|  Works are saved in this browser only, and the browser may clear them when space    |  storage line
|  runs low. Export to keep a copy.                                                    |
|                                                                                      |
|  +------------+   +------------+   +------------+                                    |
|  |            |   |            |   |            |                                    |
|  |   thumb    |   |   thumb    |   | Can't be   |                                    |  160 × 160 boxes
|  |            |   |            |   | read       |                                    |
|  +------------+   +------------+   +------------+                                    |
|  Beach.jpg        Untitled         Cat.png                                           |
|  Just now         5 minutes ago    Damaged                                           |  --color-text-muted
|  (Delete)         (Delete)         (Delete)                                          |  BaseButton ghost
+--------------------------------------------------------------------------------------+
```

```text
01-b  empty
+--------------------------------------------------------------------------------------+
| imgly                                                                                |
+--------------------------------------------------------------------------------------+
|                                   [ Open image ]                                     |  primary
|                        or drop an image anywhere in this window                      |
|--------------------------------------------------------------------------------------|
|  Gallery                                                       0 of 20 places used   |
|  Works are saved in this browser only, and the browser may clear them when space    |
|  runs low. Export to keep a copy.                                                    |
|                                                                                      |
|  Works you open will appear here.                                                    |
|  ( Open image )                                                                      |  secondary
+--------------------------------------------------------------------------------------+
```

```text
01-c  unavailable
+--------------------------------------------------------------------------------------+
| imgly                                                                                |
+--------------------------------------------------------------------------------------+
|                                   [ Open image ]                                     |
|                        or drop an image anywhere in this window                      |
|--------------------------------------------------------------------------------------|
|  Gallery                                                                             |  no count, no line
|  The Gallery is unavailable in this window.                                          |  --font-size-md
|  This browser isn't letting the editor keep anything for this site, for example     |  reason, muted
|  because site data is blocked. You can still open, edit and export images, but      |
|  nothing is kept after this page closes.                                             |
+--------------------------------------------------------------------------------------+
```

```text
01-d  reopening
+--------------------------------------------------------------------------------------+
| imgly                                                                                |
+--------------------------------------------------------------------------------------+
|                                   [ Open image ]                                     |
|--------------------------------------------------------------------------------------|
|  Gallery                                                       3 of 20 places used   |
|  +------------+   +------------+   +------------+                                    |
|  |   thumb    |   |   (@)      |   |            |                                    |  Spinner over the
|  +------------+   +------------+   +------------+                                    |  section, entries inert
+--------------------------------------------------------------------------------------+
```

```text
01-e  reopen failed (damaged)
+--------------------------------------------------------------------------------------+
|  ...                                                                                 |
|  +------------+   +------------+   +------------+                                    |
|  |   thumb    |   | Can't be   |   |   thumb    |                                    |  entry now damaged
|  |            |   | read       |   |            |                                    |
|  +------------+   +------------+   +------------+                                    |
|  Beach.jpg        Untitled         Cat.png                                           |
|  Just now         Damaged          2 hours ago                                       |
|                                  +------------------------------------------------+  |
|                                  | “Untitled” can't be opened: its stored data is |  |  Toast failure
|                                  | damaged.                   [ Delete… ]     [×] |  |  + action
|                                  +------------------------------------------------+  |
+--------------------------------------------------------------------------------------+
```

### SCR-02 — Editor with Work

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | A Work is open, no tool open, no export running. "Gallery" is first in the top bar | `EditorTopBar` with `GalleryAction` (`BaseButton` secondary "Gallery") + "Open image" + the existing actions · `PreviewCanvas` · `EditorStatusBar` · `ToastStack` | wireframe 02-a |
| saving | After an image replaced the Work, or after Apply, Undo or Redo (Critical flow 1, AC-01). Nothing is shown and editing continues (longest freeze ≤ 200 ms, spec §6). The leave warning is armed only while saving (→ SCR-06) | as `default` | wireframe 02-a |
| stored | The save committed. Nothing is shown (ux-flows §Platform decisions) | as `default` | wireframe 02-a |
| evicted | The save evicted Works to make room: the 21st Work (AC-09), a full quota (AC-10), or this Work written back after another tab evicted it (AC-21). One `info` notice names every evicted Work, "Untitled" for a nameless one | as `default` + `Toast` `info` | wireframe 02-b |
| not saved (storage full) | The Work doesn't fit even alone (`STORAGE_QUOTA`, AC-10). Nothing is evicted and the earlier stored state is kept. The Work stays open and editable | as `default` + `Toast` `failure` | — |
| save failed | Any other save failure (`STORAGE_FAILED`, AC-11). One `failure` notice, not repeated while the next saves keep failing. It is withdrawn as soon as a save succeeds, and a later failure shows it again | as `default` + `Toast` `failure` (withdrawable) | wireframe 02-c |
| newer version elsewhere | Another tab upgraded the store (ADR-0006, Flow 7). The running save finishes, the pending one is dropped, and one `info` notice asks for a reload. From then on the tab behaves as `Gallery unavailable` | as `default` + `Toast` `info` | — |
| Gallery unavailable | The store couldn't be opened at load, or was closed for a newer version (AC-12). "Gallery" stays available and opens SCR-03 `unavailable`. Replacing the Work asks whenever it has Unsaved edits (→ SCR-05) | as `default` | wireframe 02-a |
| tool open | A tool is open (crop-rotate, adjust or draw). "Gallery" is `aria-disabled` with the hint as its description, and activating it shows the hint as a `Toast` `info` | `GalleryAction` unavailable look + `Toast` `info` | wireframe 02-d |
| exporting | An export runs. "Gallery" is `disabled` | `GalleryAction` (`BaseButton` disabled) + export's own exporting state | wireframe 02-d |
| reopened | A Work chosen in SCR-01 or SCR-03 was readable and replaced the open one (Critical flow 2, AC-04, AC-18). The overlay is closed. The Preview is fitted, Undo and Redo are unavailable (empty Edit history), there are no Unsaved edits, and no notice shows. Each tool opens on its stored part. A save follows that updates when it was last opened | as `default` | wireframe 02-a |
| gallery open | "Gallery" activated | → SCR-03 | — |
| replace asks | An open or a chosen Work reaches the replace gate with unstored edits | → SCR-05 | — |
| leave while saving | Reload or tab close while saving | → SCR-06 | — |
| first save in this browser | The first save ever, or after the browser cleared the Gallery | → SCR-07 (browser-dependent) | — |
| empty | N/A: a screen with no Work is SCR-01 | — | — |
| loading | N/A here: opening a file keeps open-and-view's states, and the wait for a running save is SCR-05 `waiting for save` | — | — |
| validation | N/A: no new input | — | — |

```text
02-a  default / saving / stored / reopened
+--------------------------------------------------------------------------------------+
| imgly  [Gallery] [Open image] [Undo][Redo] [Crop and rotate] [Adjust] [Draw] [Export] |
+--------------------------------------------------------------------------------------+
|#########+------------------------------------------------------+#####################|
|#########|                       Preview                        |#####################|  nothing shown on save
|#########+------------------------------------------------------+#####################|
+--------------------------------------------------------------------------------------+
| 4096 × 3072 px                                          [-]  42%  [+] [Fit][100%]    |
+--------------------------------------------------------------------------------------+
```

```text
02-b  evicted
|#########|                       Preview                        |#####################|
|                                        +---------------------------------------------+
|                                        | “Beach.jpg” was removed from the Gallery to |  Toast info
|                                        | make room.                              [×] |
|                                        +---------------------------------------------+
```

```text
02-c  save failed (stays until dismissed or a save succeeds)
|                                        +---------------------------------------------+
|                                        | This Work couldn't be saved to the Gallery. |  Toast failure
|                                        | Export it to keep a copy.               [×] |
|                                        +---------------------------------------------+
```

```text
02-d  tool open / exporting
+--------------------------------------------------------------------------------------+
| imgly  (Gallery)~ [Open image] ...                       tool open: aria-disabled + hint
| imgly  (Gallery)  (Open image) ... [ (o) Exporting… ]    exporting: disabled
+--------------------------------------------------------------------------------------+
```

### SCR-03 — Gallery overlay

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Gallery" chosen on SCR-02 (Flow 3, AC-03). The list as on SCR-01, with "Close". The open Work's entry has the accent border and the status "Open". "Gallery" shows as pressed (`aria-pressed`) in the inert top bar | `GalleryOverlay` → `GalleryList` (`GalleryEntry` ×n, `BaseButton` ghost "Delete" ×n, `BaseButton` ghost "Close") | wireframe 03-a |
| listing | As SCR-01 `listing` | as `default` | wireframe 03-a |
| storage line | As SCR-01 `storage line` (AC-13) | as `default` | wireframe 03-a |
| damaged entry | As SCR-01 `damaged entry` (AC-08) | as SCR-01 | wireframe 01-a |
| closed | "Close" or `Esc` | → SCR-02 with the Work and View unchanged, focus on "Gallery" | — |
| open Work chosen | The "Open" entry chosen. It acts as "Close": nothing is read or replaced | → `closed` | — |
| delete unavailable | "Delete" on the "Open" entry (Flow 4, AC-07). It is `aria-disabled` with the hint as its description, and activating it shows the hint as a `Toast` `info` | `BaseButton` ghost unavailable look + `Toast` `info` | wireframe 03-a |
| choose unavailable | An export runs, or a replacement waits for confirmation, when a Work is chosen (Critical flow 2, AC-15). The open Work doesn't change, and a `Toast` `info` hint says to wait or answer first. The overlay can't normally open in either state (the action is disabled, the dialog is modal), so this guards the store's `reopenWork` | `Toast` `info` | — |
| reopening | Another entry chosen. As SCR-01 `reopening`, over the overlay's list | `Spinner` overlay | wireframe 01-d |
| waiting for save | The Work is readable and a save is running or pending (AC-16). The `reopening` spinner stays until the save settles | `Spinner` overlay | wireframe 01-d |
| replace asks | Unsaved edits are not stored, or the Gallery is unavailable (AC-17) | → SCR-05 over the overlay. Cancel returns here, the open Work unchanged | — |
| reopened | Readable and replaced (AC-04) | → SCR-02 `reopened`, the overlay closed | — |
| reopen failed (damaged) | As SCR-01 `reopen failed` (AC-08). The overlay stays open and the open Work stays exactly as it was | `GalleryEntry` damaged look · `Toast` `failure` with "Delete…" | wireframe 01-e |
| reopen failed (read) | As SCR-01 `reopen failed (read)`. The overlay stays open and the open Work stays exactly as it was | as `default` + `Toast` `failure`, no action | — |
| delete | "Delete" on any other entry | → SCR-04 over the overlay | — |
| deleted / delete failed | As on SCR-01. The count drops by one, or the failure notice shows and the entry stays | as SCR-01 | — |
| open Work not stored | The open Work was never stored (its first save failed or found no room). It has no entry, so nothing is marked "Open", and the count doesn't include it | as `default` | — |
| empty | Nothing is stored, which only happens with `open Work not stored`. As SCR-01 `empty`, without its "Open image" button (the top bar is inert and the overlay is about stored Works) | `GalleryList` header + text | wireframe 01-b (no button) |
| unavailable | As SCR-01 `unavailable`, for any of its reasons, including a store closed for a newer version (AC-12, ADR-0006). "Close" still works | `GalleryList` unavailable text + "Close" | wireframe 01-c |
| validation | N/A: no typed input | — | — |

```text
03-a  default
+--------------------------------------------------------------------------------------+
| imgly  [Gallery*] [Open image] [Undo][Redo] ...  [Export]                     inert  |  * pressed
+--------------------------------------------------------------------------------------+
|  Gallery                                         4 of 20 places used    ( Close )   |  role=dialog, modal
|  Works are kept in this browser. Export a Work to keep a copy elsewhere.             |  persisted wording
|                                                                                      |
|  +============+   +------------+   +------------+   +------------+                   |
|  ||          ||   |            |   |            |   |            |                   |  accent border
|  ||  thumb   ||   |   thumb    |   |   thumb    |   |   thumb    |                   |  on the open Work
|  +============+   +------------+   +------------+   +------------+                   |
|  Beach.jpg        Cat.png          Untitled         Dog.webp                         |
|  Open             Just now         2 hours ago      12 Oct 2026                      |
|  (Delete)~        (Delete)         (Delete)         (Delete)                         |
|                                                                                      |
+--------------------------------------------------------------------------------------+
   ~ aria-disabled: "The open Work can't be deleted. Open another image first."
```

### SCR-04 — Delete confirmation

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Delete" on an entry that is not open, in SCR-01 or SCR-03, or "Delete…" on the damaged-Work notice (Flow 4, AC-06, AC-08). Modal over the screen it came from. Focus is trapped and starts on **Cancel**. The name is the Source name, or "Untitled" | `DeleteWorkDialog` (`Dialog`, `role="alertdialog"`): title "Delete “{name}”?", body, `BaseButton` secondary "Cancel" + `BaseButton` primary "Delete" | wireframe 04-a |
| damaged Work | The same dialog for a damaged entry. Its name is the stored Source name if it is text, else "Untitled" | as `default` | wireframe 04-a |
| confirm | "Delete" pressed. The record, the Original and the layer are removed in one transaction (Flow 4) | → the screen it came from, `deleted` | — |
| cancel | "Cancel", `Esc` or a backdrop click | → the screen it came from, the Work unchanged, focus back on its "Delete" | — |
| error | The delete transaction failed (`STORAGE_FAILED`) | → the screen it came from, `delete failed` | — |
| loading | N/A: one small transaction. The dialog closes on "Delete" and the list updates when it commits | — | — |
| empty | N/A: opened only for an existing entry | — | — |
| validation | N/A: only two choices | — | — |

```text
04-a  default
+--------------------------------------------------------------------------------------+
|::::::::::::::::::::::::::::::+--------------------------------------+::::::::::::::::|
|::::::::::::::::::::::::::::::| Delete “Beach.jpg”?                  |::::::::::::::::|  Dialog
|::::::::::::::::::::::::::::::| It can't be brought back. An Export  |::::::::::::::::|
|::::::::::::::::::::::::::::::| is the only copy kept outside this   |::::::::::::::::|
|::::::::::::::::::::::::::::::| browser.                             |::::::::::::::::|
|::::::::::::::::::::::::::::::|               [ Cancel ]  [ Delete ] |::::::::::::::::|  focus on Cancel
|::::::::::::::::::::::::::::::+--------------------------------------+::::::::::::::::|
+--------------------------------------------------------------------------------------+
```

### SCR-05 — Replace confirmation

open-and-view's `ReplaceDialog`, reworded. Only its body and the condition for showing it change.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | The replace gate reached with Unsaved edits whose latest state is **not** stored: a save failed, a running save failed while the gate waited, or the Gallery is unavailable (Flow 5, Critical flow 2, AC-12, AC-17). Modal over SCR-02 or SCR-03. Focus starts on **Cancel** | `ReplaceDialog` (`Dialog`): title "Replace the current image?", body "Your latest edits aren't saved in the Gallery and will be lost.", `BaseButton` secondary "Cancel" + `BaseButton` primary "Replace" | wireframe 05-a |
| waiting for save | A file was read, or a readable Work chosen, while a save runs or is pending (AC-16). No dialog yet. For a file, open-and-view's canvas `Spinner` overlay stays. For a chosen Work, SCR-03's `reopening` spinner stays. Then it goes to `no dialog` or `default` | open-and-view's `Spinner` overlay | — |
| no dialog | No Unsaved edits, or their latest state is stored (AC-16). The new image or Work replaces the open one without asking, and an open tool's Draft is discarded | → SCR-02 (`default` for a new file, `reopened` for a chosen Work) | — |
| confirm | "Replace" pressed | → as `no dialog` | — |
| cancel | "Cancel", `Esc` or a backdrop click. The Work and View stay, the read image is dropped, nothing is stored and nothing evicted (AC-09) | → SCR-02 or SCR-03 unchanged | — |
| unreadable | N/A: a refused or damaged file or Work never reaches the gate (AC-17, open-and-view AC-16) | — | — |
| loading | See `waiting for save` | — | — |
| empty | N/A: shown only when a Work with Unsaved edits is open | — | — |
| validation | N/A: only two choices | — | — |

```text
05-a  default
+--------------------------------------------------------------------------------------+
| imgly  [Gallery] [Open image] ...                                  (behind backdrop) |
+--------------------------------------------------------------------------------------+
|::::::::::::::::::::::::::::::+--------------------------------------+::::::::::::::::|
|::::::::::::::::::::::::::::::| Replace the current image?           |::::::::::::::::|
|::::::::::::::::::::::::::::::| Your latest edits aren't saved in    |::::::::::::::::|
|::::::::::::::::::::::::::::::| the Gallery and will be lost.        |::::::::::::::::|
|::::::::::::::::::::::::::::::|              [ Cancel ]  [ Replace ] |::::::::::::::::|  focus on Cancel
|::::::::::::::::::::::::::::::+--------------------------------------+::::::::::::::::|
+--------------------------------------------------------------------------------------+
```

### SCR-06 — Browser leave warning

The browser's own "leave site?" prompt. It is not designed here: browsers ignore custom text, so the app sets none.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Reload or tab close while Autosave is saving (Flow 6, AC-20). `EditorView` installs `beforeunload` only while `saving` is true | browser-native | N/A: browser-native |
| stay | The Editor stays | → SCR-02, the save finishes and the handler is removed | — |
| leave | The Editor leaves, or the browser crashes. The unfinished transaction rolls back as a whole (AC-19) | → SCR-01 after reload: the Work in its last stored state, or absent | — |
| not shown | No save running: reload or close shows no warning, even with Unsaved edits (AC-20) | — | — |
| loading / empty / error / validation | N/A: the browser owns this prompt | — | — |

### SCR-07 — Browser storage prompt

The browser's own persistent-storage question, shown only by browsers that ask the person. It is not designed here.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | The first save in this browser, or the first save after the browser cleared the Gallery: the `meta` marker is absent and `persist()` is called (Critical flow 1, AC-14). Never at app start | browser-native | N/A: browser-native |
| no prompt | The browser decides without asking. Nothing shows | — | — |
| granted | The browser agreed. The next time the Gallery shows, the storage line uses its persistent wording (AC-13) | → SCR-01 / SCR-03 `storage line` | — |
| declined | The browser or person declined. Saving carries on and the line uses its non-persistent wording. The app doesn't ask again while the marker exists | → SCR-01 / SCR-03 `storage line` | — |
| loading | N/A: saving never waits for the answer | — | — |
| empty / error / validation | N/A: the browser owns this prompt | — | — |

## Message catalog

The seed for `src/features/editor/messages.ts` (Autosave, reopen and the replace dialog) and `src/features/gallery/messages.ts` (list, storage line, unavailable and delete), per `sad.md` §8. **info** notices dismiss themselves after 6000 ms. **failure** notices stay until dismissed, except the save-failed one, which is also withdrawn when a save succeeds. Values in `{…}` are filled in at runtime, and `{name}` is the Source name or "Untitled". No raw browser error text is ever shown.

| Kind | Code / trigger | AC | Copy |
|---|---|---|---|
| info | Works evicted, one | AC-09, AC-10, AC-21 | “{name}” was removed from the Gallery to make room. |
| info | Works evicted, several | AC-10 | {n} Works were removed from the Gallery to make room: “{a}”, “{b}” and “{c}”. |
| failure | `STORAGE_QUOTA`, doesn't fit alone | AC-10 | This Work couldn't be saved to the Gallery because the browser's storage is full. Export it to keep a copy. |
| failure (withdrawable) | `STORAGE_FAILED` on a save | AC-11 | This Work couldn't be saved to the Gallery. Export it to keep a copy. |
| failure + action | `WORK_DAMAGED` on choose | AC-08 | “{name}” can't be opened: its stored data is damaged. Action: **Delete…** |
| failure | `STORAGE_FAILED` on choose | AC-08 | “{name}” couldn't be opened. Try again. |
| failure | `STORAGE_FAILED` on a delete | — (Flow 4) | “{name}” couldn't be deleted. Try again. |
| info | newer version open in another tab | — (ADR-0006) | A newer version of the editor is open in another tab. Reload this page to keep saving to the Gallery. |
| info (hint) | "Gallery" while a tool is open | — (ux-flows SCR-02) | Apply or cancel the open tool first. |
| info (hint) | "Delete" on the open Work | AC-07 | The open Work can't be deleted. Open another image first. |
| info (hint) | choose while exporting | AC-15 | Wait for the export to finish, then choose a Work. |
| info (hint) | choose while a replacement waits | AC-15 | Answer the open question first, then choose a Work. |
| line | storage line, persisted | AC-13 | Works are kept in this browser. Export a Work to keep a copy elsewhere. |
| line | storage line, not persisted or API missing | AC-13 | Works are saved in this browser only, and the browser may clear them when space runs low. Export to keep a copy. |
| label | count | AC-03 | {n} of 20 places used |
| label | touched | AC-03 | Just now · 1 minute ago / {n} minutes ago · 1 hour ago / {n} hours ago · otherwise the date, `Intl.DateTimeFormat` in the browser's language with `dateStyle: 'medium'` |
| label | entry status | AC-03, AC-08 | Open · Damaged |
| label | nameless Work | AC-03 | Untitled |
| label | damaged thumbnail box | AC-08 | Can't be read |
| text | empty state | AC-05 | Works you open will appear here. (+ "Open image" on SCR-01) |
| title | unavailable, all reasons | AC-12 | The Gallery is unavailable in this window. |
| body | unavailable: storage refused or blocked | AC-12 | This browser isn't letting the editor keep anything for this site, for example because site data is blocked. You can still open, edit and export images, but nothing is kept after this page closes. |
| body | unavailable: held by an older tab | AC-12, ADR-0006 | Another tab of the editor is holding the Gallery. Close the other tabs of the editor, then reload this page. |
| body | unavailable: closed for a newer version | AC-12, ADR-0006 | A newer version of the editor is open in another tab. Reload this page to use the Gallery. |
| dialog | SCR-04 | AC-06 | Title "Delete “{name}”?" · body "It can't be brought back. An Export is the only copy kept outside this browser." · Cancel · Delete |
| dialog | SCR-05 | AC-17 | Title "Replace the current image?" · body "Your latest edits aren't saved in the Gallery and will be lost." · Cancel · Replace |
| spinner | reopening (screen-reader label) | AC-04 | Opening {name} |
| button | top bar / overlay | AC-03 | Gallery · Close (tooltip "Close (Esc)") |
| button | entry | AC-06 | Delete (accessible name "Delete “{name}”") |

## New components

**Shared primitives** go to `src/shared/ui/`, and `implement` registers each one in `docs/design-system.md` §Component inventory. **Feature composites** go to `src/features/gallery/` (or `src/features/editor/components/` for the editor's own) and stay out of the shared inventory. One shared primitive gains an option and one token is added. No new shared primitive is needed.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `Toast` (extended: `action`) + `useNotices` | AC-08 asks the damaged-Work notice to offer Delete, and `Toast` has only its text and dismiss button. An optional `action: { label, run }` on `NoticeInput` renders a `BaseButton` ghost before the dismiss button, and running it dismisses the notice. `pushAll` returns the new ids so the editor store can withdraw the save-failed notice (AC-11) through the existing `dismiss(id)`. A separate dialog would add a third blocking dialog against ux-flows | pending |
| `--gallery-tile-size` token (160px) | The entry and thumbnail box width. Every size must come from `tokens.css`, and no existing token is 160px | pending (token source) |
| `GalleryAction` (feature composite) | `BaseButton` secondary "Gallery" with its pressed, `disabled`-during-export and unavailable (`aria-disabled` + hint) states, mounted in the top bar's new `leading-actions` slot, as `AdjustAction` | n/a (feature-local) |
| `GalleryList` (feature composite) | The header (heading, count, "Close" when given), storage line, grid, empty and unavailable states, shared by SCR-01 and SCR-03 | n/a (feature-local) |
| `GalleryEntry` (feature composite) | A native button with the thumbnail box, name and status, its open and damaged looks, plus `BaseButton` ghost "Delete". `BaseButton` holds a label, not an image-and-two-lines card | n/a (feature-local) |
| `GalleryStart` (feature composite) | SCR-01's Gallery section under `EmptyCanvas`, in `EditorView`'s `start-screen` slot | n/a (feature-local) |
| `GalleryOverlay` (feature composite) | SCR-03: a modal region over the canvas area and status bar under the top bar. `Dialog` is a centred `alertdialog` with a backdrop over the whole window, and `Popover` is non-modal and anchored, so neither fits | n/a (feature-local) |
| `DeleteWorkDialog` (feature composite) | SCR-04, composed from `Dialog` and `BaseButton` ×2, as `ReplaceDialog` | n/a (feature-local) |
| `ReplaceDialog` (reworded) | SCR-05: the existing composite with its new body text | n/a (existing, feature-local) |
