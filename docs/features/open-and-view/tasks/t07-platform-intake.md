---
id: T7
title: "Add the platform intake: window drop guard, files from a DataTransfer, and the single-file picker"
layer: "infra"
deps: []
blocks: ["T13", "T17"]
acs: ["AC-02", "AC-04", "AC-18"]
files_hint: ["src/infra/platform/"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 55 inlined lines
status: "done"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Add the platform intake: window drop guard, files from a DataTransfer, and the single-file picker

## Place in the sequence

- **Blocked by:** nothing — can start immediately.
- **Blocks:** T13 — Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary, T17 — Add the start-up capability gate and the blocking screens SCR-04, SCR-05 plus SCR-02's restoring state.
- **Wave:** 1 — no deps, starts in the first wave.
- **Lane:** own lane.

## Why (user story)

> **US-02: Drop an image onto the app**
>
> **As a** Editor  
> **I want** to drop an image file anywhere on the app window  
> **So that** I can open it without going through a file dialog
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It guarantees the browser never navigates to a dropped file, and hands the editor only real files (never folders or links) in browser order.

## Inlined context

> UI->>UI: blocks the browser default, so it never navigates away or shows the file
> UI->>ED: hands over the dropped items in browser order
> ED->>ED: keeps only files, skipping folders and links
>
> — `sad.md §6, Flow 3 steps 7–9, abridged` · full text: [sad.md](../sad.md)

> The drop guard is installed on the whole window before anything else, so even a drop that the app ignores never opens the file in the tab.
>
> — `sad.md §6, Flow 3 note, verbatim` · full text: [sad.md](../sad.md)

> The window-level drop guard is installed before the gate, so a drop never navigates away even on SCR-04.
>
> — `adr/0003 §Decision outcome, How it works bullet 3, abridged` · full text: [adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md](../adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md)

> default | "Open image" or `Ctrl/Cmd+O` on SCR-01 or SCR-02 (US-01). One file only, filtered with `accept="image/*"`; the Editor can still switch the OS filter to all files. The content still decides what opens (AC-08)
> cancelled | The dialog is closed without a file | → the starting screen unchanged, with no notice (ux-flows US-01)
>
> — `screens.md §SCR-06, default + cancelled rows, abridged` · full text: [screens.md](../screens.md)

> `infra/platform/` — file picker, window-level drop guard, files from a DataTransfer
>
> — `sad.md §5, internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> The window-level drop guard is always installed. On every screen a drop never navigates away from the app or shows the file in place of it (AC-02, AC-18).
>
> — `screens.md §Shell shared by every screen, verbatim` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — happy path

> **Given** the app is open, with or without an image
> **When** the Editor drops a Supported image anywhere on the app window
> **Then** the image opens exactly as in AC-01 (subject to AC-15 and AC-16 when a Work is open), and the app never navigates away or shows the file in place of itself
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — error

> **Given** the app is open
> **When** the Editor drops something that is not an image file, such as a folder, a document or a link dragged from another browser tab
> **Then** nothing is opened or replaced, and a notice says that only image files can be opened
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** the browser lacks the graphics capability the editor requires
> **When** the Portfolio reviewer opens the app
> **Then** the canvas area shows a full message explaining that this browser can't display the editor and naming browsers that can. The "Open image" action is unavailable, and a file dropped onto the app opens nothing and never makes the browser navigate away or show the file in place of the app; the same message stays in place
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `installDropGuard(win, { onDragEnter, onDragLeave, onDrop })` — `preventDefault` on `dragover` and `drop` for the whole window, an enter/leave counter so child elements don't flicker the overlay; returns an uninstall function — `src/infra/platform/drop-guard.ts`
- [ ] `filesFromDataTransfer(dt): { files: File[], nonFileCount: number }` — `kind === 'file'` items only, folders excluded via `webkitGetAsEntry()?.isDirectory`, links/text counted as non-files, browser order kept — `src/infra/platform/data-transfer.ts`
- [ ] `pickImageFile(): Promise<File | null>` — hidden `<input type="file" accept="image/*">` without `multiple`; resolves `null` on the input's `cancel` event — `src/infra/platform/file-picker.ts`
- [ ] Vitest (happy-dom) with fake `DragEvent` / `DataTransfer`: default prevented, folder and link filtered, order kept, counter behaviour — `src/infra/platform/*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Folder dropped | excluded; `files: []`, `nonFileCount: 1` (→ AC-04) |
| Link dragged from another tab | no file items; default still prevented (→ AC-04) |
| Image + folder dropped together | only the image is returned |
| Drop while the editor ignores drops (SCR-03/04/05) | the guard still prevents navigation; ignoring is the caller's decision |
| Drag moves across child elements | overlay state stays on until the counter returns to 0 |
| Picker dialog cancelled | `null`, no notice |

## Definition of Done

- [ ] Vitest proves the guard prevents the default on `dragover` and `drop`, filters folders and links, keeps order, and the picker resolves `null` on cancel
- [ ] lint + typecheck clean
