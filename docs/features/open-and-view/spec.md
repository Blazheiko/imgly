---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-03"
feature_size: "M"
---

# Spec — open-and-view

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root)
> **Reference module / docs / channels used:** `docs/idea-brief.md`, `docs/architecture-map.md`, `docs/roadmap.md` (step 2), `docs/design-system.md`. No other channels.

## 1. Context

The Editor needs to bring a photo from their phone or desktop into the app and see it, ready to edit, without answering dialogs or being surprised. The Portfolio reviewer needs the same thing to work on the first try, because the first open of the first image is their first impression of the app. Every later tool (crop, adjustments, drawing, export, gallery) starts from an open Work. That makes this the foundation step of the roadmap (`docs/roadmap.md` step 2).

Why now: it is the first unblocked step after the project skeleton, and the brief's 4–6 week MVP budget depends on the rest of the roadmap building on it.

Committed approach: **an open that needs no dialogs and holds no surprises.** The new file is read completely before it replaces the current Work. Phone orientation is applied. Any downscale to the Downscale limit is announced in one line with the original and new dimensions, and every failure comes with a plain-language reason. Rationale: the comparable browser editors either stop the user with a blocking resize dialog (Pixlr) or surface raw technical decode errors (Squoosh). The sharpest failure vector found is losing the open Work during a replace. The deep-dive's headline success signal is a fast first Preview with smooth zoom and pan.

Traceability: downscale limit 4096 px resolves roadmap decision D1 (`docs/roadmap.md` §Open decisions). The replace rule set here (read first, confirm only for Unsaved edits) is inherited by every later editing feature.

- Decision override: drag-and-drop moved from roadmap step 10 into this feature — rationale: the design canon's empty state is a drop zone (`docs/design-system.md` §Interaction & writing conventions), and drag-and-drop works in every target browser, unlike the Chromium-only "Open with…". Roadmap step 10 shrinks to paste, copy to the clipboard and "Open with…".
- Decision override: AC-15 is verified in this feature against a test-prepared Work that has Unsaved edits, because no editing tool exists yet — rationale: the replace rule must be fixed before the tools that inherit it. The first feature that adds an editing tool (roadmap step 4, crop and rotate) must re-verify AC-15 with real edits.

## 2. Goals

- Any common phone or desktop image opens into a ready-to-edit Preview within seconds, with no dialogs on the happy path.
- The open Work is never lost, and an image is never degraded without the Editor being told how.
- The View (fit, 100%, zoom, pan) feels smooth on a laptop trackpad and mouse, so later tools can build on it unchanged.

## 3. Non-goals

- Pasting from the clipboard, copying to the clipboard, and acting as the operating system's "Open with…" image handler. These stay in roadmap step 10. This feature covers only the "Open image" action and drag-and-drop.
- Keeping the full resolution of images larger than the Downscale limit. The brief accepts the downscale to keep memory and storage manageable.
- Keeping the Work between sessions. Persistence is the gallery step (roadmap step 8), so an open Work lives only in the current session.
- Opening several images at once, batch processing or comparing images. The editor holds exactly one Work.
- Touch-optimised gestures. The app is desktop-first and only has to not break on mobile (`docs/design-system.md` §Platform posture).
- Opening anything that is not a Supported image, even when the browser itself could decode it: SVG and other vector files, BMP, ICO, TIFF, camera RAW/DNG and PSD. These are refused with a named reason (AC-07). This keeps behaviour the same in every browser and keeps vector files with active content out.

## 4. User stories

### US-01: Open an image from disk

**As a** Editor
**I want** to choose an image file from my computer with an "Open image" action
**So that** I can start editing it

### US-02: Drop an image onto the app

**As a** Editor
**I want** to drop an image file anywhere on the app window
**So that** I can open it without going through a file dialog

### US-03: Know when an image was reduced

**As a** Editor
**I want** to be told when my image was reduced to the Downscale limit, and from what size to what size
**So that** I know what resolution I am editing and exporting

### US-04: Understand why an image won't open

**As a** Editor
**I want** a plain-language reason whenever a file can't be opened or opens differently from how I expect
**So that** I know what to do next instead of facing an empty canvas

### US-05: Inspect the image closely

**As a** Editor
**I want** to fit the image to the window, see it at 100%, zoom and pan
**So that** I can check details before and while editing

### US-06: Keep my work when opening another image

**As a** Editor
**I want** the app to protect the open Work when I open a different image
**So that** I never lose Unsaved edits by accident

### US-07: Understand the app on first visit

**As a** Portfolio reviewer
**I want** the empty app to show me clearly how to open an image
**So that** I can try it within seconds, without instructions

### US-08: Get an honest message when the browser can't render

**As a** Portfolio reviewer
**I want** to be told clearly when my browser can't display the editor, and to have the Preview come back by itself after a temporary graphics interruption
**So that** I don't judge the app on a blank or black canvas

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** the Editor has no image open
**When** the Editor chooses a Supported image through the "Open image" action
**Then** the image is shown at Fit, upright the same way the operating system's photo viewer shows it, and the editor is ready for editing. Fit is the largest zoom at which the whole image fits inside the canvas area (the space left after toolbars and panels), never above 100%, so an image smaller than the canvas area is shown centred at 100% and is never enlarged

### AC-02 (US-02) — happy path

**Given** the app is open, with or without an image
**When** the Editor drops a Supported image anywhere on the app window
**Then** the image opens exactly as in AC-01 (subject to AC-15 and AC-16 when a Work is open), and the app never navigates away or shows the file in place of itself

### AC-03 (US-02) — error

**Given** the app is open
**When** the Editor drops several files at once
**Then** the files are tried in the order the browser lists them, each judged by its content, and the first one that is read successfully opens (subject to AC-15 and AC-16 when a Work is open). A short notice says the editor works with one image at a time and the other files were ignored. If none of the files can be opened, nothing is replaced and the reason shown is the one for the first image file (or the AC-04 notice when the drop held no image files at all)

### AC-04 (US-02) — error

**Given** the app is open
**When** the Editor drops something that is not an image file, such as a folder, a document or a link dragged from another browser tab
**Then** nothing is opened or replaced, and a notice says that only image files can be opened

### AC-05 (US-03) — domain invariant

**Given** an image whose long side, once upright, is larger than the Downscale limit
**When** the Editor opens it
**Then** the Original's long side equals the Downscale limit with proportions kept, the short side rounded to the nearest whole pixel and never below 1 px, and a one-line notice states the original and the new dimensions (for example 6000×4000 → 4096×2731). The Original's dimensions stay visible in the interface for as long as the Work is open

### AC-06 (US-03) — happy path

**Given** an image whose long side is at or below the Downscale limit
**When** the Editor opens it
**Then** the Original keeps the image's own dimensions, no downscale notice is shown, and the Original's dimensions stay visible in the interface for as long as the Work is open

### AC-07 (US-04) — error

**Given** a file recognised by its content as an image that is not a Supported image here: HEIC/HEIF in a browser that cannot decode it, or SVG, BMP, ICO, TIFF, camera RAW/DNG or PSD in any browser
**When** the Editor tries to open it
**Then** nothing is replaced, and a notice names the format, says the editor cannot open it here, and suggests converting it to JPEG or PNG (and, for HEIC/HEIF, using a browser that can open it)

### AC-08 (US-04) — error

**Given** a file that is damaged, truncated or not really the image type its name claims
**When** the Editor tries to open it
**Then** the file is judged by its content rather than its name, nothing is replaced if it can't be read, and a notice says the file could not be read as an image

### AC-09 (US-04) — domain invariant

**Given** an image whose pixel count exceeds the size ceiling the editor can safely handle
**When** the Editor tries to open it
**Then** the editor refuses it based on the width × height the file declares, before decoding its pixels. Nothing is replaced, and a notice states the image's width × height in pixels with its megapixels, and the largest size the editor accepts in megapixels. A file whose declared dimensions can't be read is treated as unreadable (AC-08)

<!-- added-by-fix: review-2026-10-04-2 F2 -->
**And** a file larger than the byte ceiling (500 MB) is refused from its size before any of it is read, with nothing replaced and the notice "This file is too large: {N} MB. The largest file the editor opens is 500 MB.", where {N} is the file's size in MB rounded up

### AC-10 (US-04) — authorization

**Given** the operating system or the browser does not allow the app to read the chosen file (for example missing file permissions, or a cloud-drive file that has not been downloaded)
**When** the Editor tries to open it
**Then** nothing is replaced, and a notice says the app was not allowed to read the file and suggests making it available on this computer first

### AC-11 (US-04) — error

**Given** an animated image
**When** the Editor opens it
**Then** its first frame opens as the Original, and a notice says only the first frame is kept

### AC-11b (US-04) — cross-context

**Given** one open produces several notices (for example an animated image that is also downscaled, dropped together with other files)
**When** the open finishes
**Then** every notice is shown and none hides another. Informational notices (downscale, first frame only, files ignored) go away by themselves, and reasons an open failed stay until the Editor dismisses them

### AC-12 (US-05) — happy path

**Given** an image is open
**When** the Editor pinches on the trackpad, scrolls with Ctrl/Cmd held, or uses the zoom-in and zoom-out controls, "Fit" or "100%"
**Then** the Preview zooms toward the pointer (or the centre for the controls), the current zoom level is visible, "100%" shows one image pixel per physical screen pixel, and the rest of the app interface never changes size

### AC-12b (US-05) — edge

**Given** an image is open
**When** the Editor zooms past either end of the range, uses the zoom controls, or resizes the window
**Then** zoom stays between the smaller of Fit and 10% at the low end and 800% at the high end. The zoom-in and zoom-out controls step through fixed zoom levels. While the Editor has not zoomed or panned since the image opened or "Fit" was last chosen, resizing the window keeps the image at Fit. After a manual zoom or pan, resizing keeps the zoom level

### AC-13 (US-05) — happy path

**Given** an image is open and zoomed in beyond the canvas area
**When** the Editor scrolls with two fingers or with a plain mouse wheel (vertical), scrolls with Shift held (horizontal), drags while holding Space, or drags while no editing tool is active
**Then** the Preview pans in that direction and the Work does not change. Panning stops at the image's edge, so the image can never be pushed out of the canvas area. An image that fits inside the canvas area stays centred and does not pan

### AC-14 (US-05) — domain invariant

**Given** the Editor has only zoomed or panned the open Work
**When** the Editor opens another image
**Then** no confirmation is asked, because View changes never count as Unsaved edits

### AC-15 (US-06) — cross-context

**Given** the open Work has Unsaved edits made with an editing tool
**When** the Editor opens another image that has been read successfully
**Then** the app asks for confirmation and says the current edits will be lost. Choosing to cancel keeps the current Work and View exactly as they were and discards the image that was read. Notices about the new image (downscale, first frame only) appear only after it has actually replaced the Work

*Verification note:* until an editing tool exists, this is verified with a Work prepared to have Unsaved edits; the first editing feature (roadmap step 4) re-verifies it with real edits.

### AC-16 (US-06) — domain invariant

**Given** an image is open
**When** the Editor opens another file that turns out to be unreadable, unsupported, refused or not permitted
**Then** no confirmation is asked, the open Work stays exactly as it was, and the matching reason is shown — the open Work is only ever replaced by an image that has been read successfully

### AC-16b (US-06) — cross-context

**Given** an image is still being read after the Editor chose or dropped it
**When** the Editor chooses or drops another file before that read finishes
**Then** the earlier open is abandoned and never replaces the Work. Only the most recently chosen file can open. While a read is in progress, the current Work stays on screen and can still be zoomed and panned

### AC-17 (US-07) — happy path

**Given** a Portfolio reviewer opens the app for the first time and no image is open
**When** the app finishes loading
**Then** the canvas area shows one primary "Open image" action and a one-line hint that an image can also be dropped onto the app

### AC-18 (US-08) — cross-context

**Given** the browser lacks the graphics capability the editor requires
**When** the Portfolio reviewer opens the app
**Then** the canvas area shows a full message explaining that this browser can't display the editor and naming browsers that can. The "Open image" action is unavailable, and a file dropped onto the app opens nothing and never makes the browser navigate away or show the file in place of the app; the same message stays in place

### AC-19 (US-08) — cross-context

**Given** an image is open
**When** the device's graphics are interrupted temporarily, for example by sleep and wake or a graphics switch
**Then** the Preview comes back by itself without reopening the file, and the Work and View are unchanged

### AC-19b (US-08) — error

**Given** an image is open
**When** the device's graphics are interrupted and the browser does not let the editor restore them
**Then** the canvas area shows a full message in plain language instead of a blank or black canvas. The message says the display could not recover, suggests reloading the page, and says plainly that the open Work will be lost on reload

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air (or equivalent) with the latest Chrome (see §8).

"Time to first Preview" runs from the moment a file is chosen in the file dialog or released over the app to the first paint of the fitted Preview, on the path without a replace confirmation. "Memory" means the tab's total memory, graphics (GPU) memory included, not only the JavaScript heap.

| Aspect | Target | Measurement |
|---|---|---|
| Time to first Preview p95, 12 MP JPEG (4032×3024), within limit | ≤ 1.5 s | e2e performance test on the reference machine |
| Time to first Preview p95, 48 MP JPEG (8064×6048), downscale path | ≤ 3 s | e2e performance test on the reference machine |
| Longest interface freeze while opening any accepted image | ≤ 200 ms (loading indicator keeps animating) | long-task trace in the e2e performance test |
| Zoom and pan smoothness on a 4096 px Original | ≥ 50 fps | performance trace during a scripted zoom and pan |
| Memory after 10 consecutive opens of the 48 MP image | ≤ 110% of memory after the first open | memory snapshot in e2e |
| Opening with no network connection | 100% of runs succeed | e2e run in offline mode after first load |
| Size ceiling (largest accepted pixel count) | 100 MP, plus a 500 MB byte ceiling | `sad.md` §8 |

## 6.1 Security / privacy

- **Data classification:** confidential. Users' photos can be personal, and they never leave the device.
- **Personal data touched:** image pixels and embedded metadata (for example capture location) of the opened file, held only in the current session's memory. No new stored fields. Persistence comes with the gallery step.
- **AuthZ/AuthN impact:** none. There are no accounts. The only access check is the operating system's or browser's permission to read the chosen file, and its refusal is handled by AC-10.
- **Abuse cases:**
  - Decompression bomb (small file declaring huge dimensions): refused by the size ceiling before full reading (AC-09), so the tab is never exhausted.
  - Malformed or hostile image file: handled by the browser's own image reading, and failures are reported plainly (AC-08) with the open Work untouched (AC-16).
  - Disguised file type (wrong extension): judged by content, not by name (AC-08).
  - Metadata leak: embedded metadata is not carried into the Original (see §8 on whether any of it should be kept).
- **Security review:** Required. The feature is size M and it is the app's only intake of untrusted files.

## 7. Metrics / KPIs

- **Time to first Preview of the 12 MP reference photo** — baseline: 0 (no feature yet), target: ≤ 1.5 s p95 on the reference machine by the time the feature ships.
- **Honest outcome rate on the reference test set** (JPEG, PNG, WebP, AVIF, animated GIF, HEIC, damaged, truncated, oversize, mis-named files) — baseline: 0, target: 100% of files end in either a correct Preview or a plain-language reason, with 0 blank canvases or tab crashes, by ship.
- **Orientation correctness** — baseline: 0, target: 8 of 8 EXIF orientation test images display upright by ship.

## 8. Open questions

- [x] What is the size ceiling (largest accepted pixel count) that stays safe on the reference machine and on the mobile "must not break" tier? Default now: 100 MP. Also: is there a separate limit on file size in bytes or on the length of one side (for example 200000×400)? Default now: none beyond the pixel-count ceiling. Resolved in `sdd:design` (`sad.md` §8): 100 MP, a separate 500 MB byte ceiling, and no side limit. — owner: Blazheiko (owner)
- [x] Which exact reference machine and browser do the §6 targets bind to? Resolved 2026-10-04 in `sdd:plan-tests`: Apple M1 MacBook Air with the latest stable Chrome; the `test-plan.md` load scenarios bind to it. — owner: Blazheiko (owner)
- [x] Are wide-gamut (Display P3) and colour-profiled images shown in their own colour space or converted to standard sRGB? Default now: converted to sRGB. Resolved in `sdd:design` (ADR-0004): every Original is converted to sRGB on open. — owner: Blazheiko (owner)
- [x] Should any embedded metadata (capture date, location) be kept with the Work for later export? Default now: none is kept. Resolved 2026-10-05 in the export feature's `sdd:specify` (`docs/features/export/spec.md` AC-16): none is kept or written. — owner: Blazheiko (owner)
