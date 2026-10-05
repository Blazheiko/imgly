---
id: T12
title: "Add drop sequencing, the messages catalog and the notices raised by each open"
layer: "app"
deps: ["T3", "T10", "T11"]
blocks: ["T13"]
acs: ["AC-03", "AC-04", "AC-05", "AC-06", "AC-07", "AC-08", "AC-09", "AC-10", "AC-11", "AC-11b"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/messages.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 118 inlined lines
status: "done"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Add drop sequencing, the messages catalog and the notices raised by each open

## Place in the sequence

- **Blocked by:** T3 — Implement the open policy: size ceiling, Downscale-limit target size, reduction steps and drop-candidate order, T10 — Add the notice queue and the shared UI primitives Spinner, Toast, ToastStack, Dialog and CanvasMessage, T11 — Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions.
- **Blocks:** T13 — Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary.
- **Wave:** 5 — after T3, T10, T11 (wave 4).
- **Lane:** shares `src/features/editor/store.ts` with T11, T17, T20 — serialized.

## Why (user story)

> **US-02: Drop an image onto the app**
>
> **As a** Editor  
> **I want** to drop an image file anywhere on the app window  
> **So that** I can open it without going through a file dialog
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

> **US-03: Know when an image was reduced**
>
> **As a** Editor  
> **I want** to be told when my image was reduced to the Downscale limit, and from what size to what size  
> **So that** I know what resolution I am editing and exporting
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

> **US-04: Understand why an image won't open**
>
> **As a** Editor  
> **I want** a plain-language reason whenever a file can't be opened or opens differently from how I expect  
> **So that** I know what to do next instead of facing an empty canvas
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It turns every open outcome into exactly the right notices — the downscale line, first-frame-only, files ignored, or one plain reason — raised only after a replace has actually happened.

## Inlined context

> alt no files at all → notice that only image files can be opened
> else several files → loop each file in browser order, until one is read successfully […] UI-->>U: plus a notice that the editor works with one image at a time and the other files were ignored
> else none was read → the reason for the first image file, or the only-image-files notice when none was an image
>
> — `sad.md §6, Flow 3, abridged` · full text: [sad.md](../sad.md)

> Files are tried one at a time; a newer drop supersedes this sequence exactly as in flow 2.
>
> — `sad.md §6, Flow 3 note, abridged` · full text: [sad.md](../sad.md)

> Notices for a new image are raised only after the replace, so a cancelled confirmation shows none.
>
> — `sad.md §6, Flow 4 note, verbatim` · full text: [sad.md](../sad.md)

> | info | downscaled | AC-05 | Reduced to the 4096 px limit: {w}×{h} → {w'}×{h'}. |
> | info | first frame only | AC-11 | Animated image: only the first frame was kept. |
> | info | other files ignored | AC-03 | The editor works with one image at a time. {n} other file(s) were ignored. (singular: "1 other file was ignored.") |
> | failure | no image files dropped | AC-04 | Only image files can be opened. |
> | failure | `UNSUPPORTED_FORMAT` | AC-07 | {FORMAT} files can't be opened here. Convert it to JPEG or PNG. (TIFF and TIFF-based camera RAW share one name: "TIFF or camera RAW", `sad.md` §11) |
> | failure | `UNSUPPORTED_FORMAT` (HEIC/HEIF) | AC-07 | HEIC files can't be opened in this browser. Convert it to JPEG or PNG, or use a browser that opens HEIC. |
> | failure | `NOT_AN_IMAGE` / `UNREADABLE` / `DECODE_FAILED` | AC-08 | This file couldn't be read as an image. |
> | failure | `TOO_LARGE` | AC-09 | This image is too large: {w}×{h} px ({mp} MP). The largest the editor opens is {ceiling} MP. |
> | failure | `FILE_NOT_PERMITTED` | AC-10 | The app wasn't allowed to read this file. Make it available on this computer first, for example by downloading it from your cloud drive. |
>
> — `screens.md §Message catalog, rows 1–9, verbatim` · full text: [screens.md](../screens.md)

> Values in `{…}` are filled in at runtime. No file name or raw browser error text is ever shown.
>
> — `screens.md §Message catalog, intro, abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** Every `AppError` code maps to exactly one plain-language message in one catalog, `src/features/editor/messages.ts`; no raw browser error text ever reaches the Editor. Notices go through one queue in `src/shared/notices/`: informational ones (downscale, first frame only, files ignored) dismiss themselves, failure reasons stay until dismissed, and all notices of one open are shown together without hiding each other (AC-11b). Blocking conditions (SCR-04, SCR-05) replace the canvas area instead of using a notice
>
> — `sad.md §8, User messages row, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-03 — error

> **Given** the app is open
> **When** the Editor drops several files at once
> **Then** the files are tried in the order the browser lists them, each judged by its content, and the first one that is read successfully opens (subject to AC-15 and AC-16 when a Work is open). A short notice says the editor works with one image at a time and the other files were ignored. If none of the files can be opened, nothing is replaced and the reason shown is the one for the first image file (or the AC-04 notice when the drop held no image files at all)
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — error

> **Given** the app is open
> **When** the Editor drops something that is not an image file, such as a folder, a document or a link dragged from another browser tab
> **Then** nothing is opened or replaced, and a notice says that only image files can be opened
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — domain invariant

> **Given** an image whose long side, once upright, is larger than the Downscale limit
> **When** the Editor opens it
> **Then** the Original's long side equals the Downscale limit with proportions kept, the short side rounded to the nearest whole pixel and never below 1 px, and a one-line notice states the original and the new dimensions (for example 6000×4000 → 4096×2731). The Original's dimensions stay visible in the interface for as long as the Work is open
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — happy path

> **Given** an image whose long side is at or below the Downscale limit
> **When** the Editor opens it
> **Then** the Original keeps the image's own dimensions, no downscale notice is shown, and the Original's dimensions stay visible in the interface for as long as the Work is open
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — error

> **Given** a file recognised by its content as an image that is not a Supported image here: HEIC/HEIF in a browser that cannot decode it, or SVG, BMP, ICO, TIFF, camera RAW/DNG or PSD in any browser
> **When** the Editor tries to open it
> **Then** nothing is replaced, and a notice names the format, says the editor cannot open it here, and suggests converting it to JPEG or PNG (and, for HEIC/HEIF, using a browser that can open it)
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — error

> **Given** a file that is damaged, truncated or not really the image type its name claims
> **When** the Editor tries to open it
> **Then** the file is judged by its content rather than its name, nothing is replaced if it can't be read, and a notice says the file could not be read as an image
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — domain invariant

> **Given** an image whose pixel count exceeds the size ceiling the editor can safely handle
> **When** the Editor tries to open it
> **Then** the editor refuses it based on the width × height the file declares, before decoding its pixels. Nothing is replaced, and a notice states the image's width × height in pixels with its megapixels, and the largest size the editor accepts in megapixels. A file whose declared dimensions can't be read is treated as unreadable (AC-08)
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — authorization

> **Given** the operating system or the browser does not allow the app to read the chosen file (for example missing file permissions, or a cloud-drive file that has not been downloaded)
> **When** the Editor tries to open it
> **Then** nothing is replaced, and a notice says the app was not allowed to read the file and suggests making it available on this computer first
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — error

> **Given** an animated image
> **When** the Editor opens it
> **Then** its first frame opens as the Original, and a notice says only the first frame is kept
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-11b — cross-context

> **Given** one open produces several notices (for example an animated image that is also downscaled, dropped together with other files)
> **When** the open finishes
> **Then** every notice is shown and none hides another. Informational notices (downscale, first frame only, files ignored) go away by themselves, and reasons an open failed stay until the Editor dismisses them
>
> — `spec.md §5, AC-11b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `messages.ts`: `failureMessage(error: AppError): string` (one entry per code, HEIC variant by `details.format`), `infoDownscaled(src, dst)`, `infoFirstFrame()`, `infoOthersIgnored(n)`, `failureNoImageFiles()` — copy exactly as the catalog — `src/features/editor/messages.ts`
- [ ] `openFile(file)` — wraps `openImage`; on `replaced` pushes the image's info notices in one `pushAll`; on `refused` pushes the failure; on `confirming` holds the notices until `confirmReplace()` (none on cancel)
- [ ] `openDrop({ files, nonFileCount })` — `orderDropCandidates`; 0 files → AC-04 failure; else try files in order until one is read; remember the first refusal that is not `NOT_AN_IMAGE`; a newer open aborts the loop
- [ ] Files-ignored notice when more than one file was dropped and one opened: `n` = number of other dropped files (breakdown decision: folders/links are not counted as files)
- [ ] None read → the remembered first-image-file reason, or the AC-04 notice when every file was `NOT_AN_IMAGE`
- [ ] Vitest for the catalog (every code → exact copy) and for drop sequencing + notice timing with a fake decoder — `src/features/editor/messages.test.ts`, `store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Drop: `notes.txt`, then a truncated JPEG, then a good PNG | PNG opens + files-ignored notice (n = 2) |
| Drop: `notes.txt`, then a truncated JPEG, nothing else | nothing replaced; reason = AC-08 (first *image* file) |
| Drop: two `.txt` files | nothing replaced; AC-04 notice |
| Animated + downscaled image dropped with 1 other file | three info notices together after the replace (AC-11b) |
| Replace confirmation cancelled | no notices at all (AC-15) |
| `TOO_LARGE` 20000×12000 | "This image is too large: 20000×12000 px (240 MP). The largest the editor opens is 100 MP." |
| A newer open starts mid-sequence | the drop loop stops; its notices are never raised |

## Definition of Done

- [ ] Vitest proves every catalog entry's copy, the drop order/selection rules, the first-image-file reason, and that notices appear only after a replace
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
