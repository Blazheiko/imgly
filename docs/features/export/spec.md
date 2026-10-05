---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-05"
feature_size: "S"
---

# Spec — export

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root)
> **Reference module / docs / channels used:** `docs/idea-brief.md`, `docs/roadmap.md` (step 3, decision D4), `docs/architecture-map.md`, `docs/design-system.md`, `docs/features/open-and-view/spec.md`, `src/core/document.ts`. No other channels.

## 1. Context

The Editor needs to get the edited image out of the app as a file they can keep and share. Browser storage is not durable: the browser can evict it, and the user can clear it (idea-brief §6). So an Export is the only reliable copy of a Work, and losing it, or getting a file that differs from what the Editor saw, means losing the work. The Portfolio reviewer needs the same flow to work on the first try, because export is how the end-to-end "open, edit, save" story ends.

Why now: export is roadmap step 3 and the first step after open-and-view. It only needs an open Work, so it can ship before the editing tools and give every later tool a way to save its result.

Committed approach: **export as an honest save.** The file is in the format it claims, looks like the Preview, and the Work counts as saved only when the file has really been handed off. One export panel offers the format (only the formats this browser can actually produce), a quality setting for JPEG and WebP, a smaller size, and a file name taken from the Source name. Where the browser has a "Save as…" dialog the Editor picks the folder and name there; elsewhere the file goes to the browser's downloads. No embedded metadata is written. Rationale: comparable browser editors (Pixlr, Squoosh) offer a quality slider and a size estimate, but none of the ones researched ties export to protecting the work. The sharpest failure vector found was a "false save", where the Work is marked saved although no file was written and the next open discards the edits. The deep-dive's success criterion is that the file is never lost and matches what the Editor saw.

Traceability and deliberate compromises:

- Roadmap decision D4 is resolved here: formats the browser cannot encode (WebP in Safari, confirmed through Safari 27.2 by caniuse, MDN and WebKit bug 226950) are never selectable and never faked: they are shown as unavailable, with a hint (AC-12).
- The open-and-view §8 question on embedded metadata is resolved here: none is kept or written (AC-16).
- Decision override: in browsers without a "Save as…" dialog (Firefox, Safari), the export counts as saved once the finished file is handed to the browser's download — rationale: that is the last signal the page receives. A later failure inside the browser (download prompt cancelled, disk full) is not visible to the app, and the notice names the file so the Editor can check for it.
- Design input: whether each target browser creates or empties the chosen file when the "Save as…" dialog closes is not yet verified. `sdd:design` checks it and orders the export so that a refusal after the dialog is as rare as possible. Where the browser does empty it, AC-13's notice says so.
- Cross-feature change: opening an image must now keep its Source name and Source format with the Work (AC-07, AC-08, AC-19). This touches the open-and-view feature.
- Decision override: size stays S — rationale: one new module, no new interface and no storage migration; the open-and-view change is two fields, and the upper bound of S is accepted. If design shows otherwise, `/sdd:classify-size export` re-sizes it.
- Decision override: until an editing tool exists, "the Work with all its edits" is verified with a test-prepared Work that has Unsaved edits, as open-and-view did for AC-15. The first editing feature (roadmap step 4) re-verifies AC-01 and AC-09 with real edits.

## 2. Goals

- The Editor can turn any open Work into a file in a format they choose, with one panel and no surprises, in every target browser.
- An exported file always matches what the Editor saw and the format it is named for, so an Export can be trusted as the durable copy of the Work.
- The Work counts as saved only after the file has been written or handed to the browser's downloads, and the Editor is never told a file was saved when the app knows it was not.

## 3. Non-goals

- Upscaling or choosing a size larger than the Work. The Downscale limit already bounds the Work, and enlarging adds no detail.
- An estimate of the file size before exporting. It needs a trial encode on every control change and would push the feature past size S.
- Choosing a background colour for transparent areas in JPEG. White is fixed (AC-15), and PNG or WebP keep transparency.
- Writing embedded metadata (capture date, camera, location) or a colour profile other than sRGB into the file. It protects privacy and keeps behaviour the same in every browser. Files are standard sRGB; technical blocks the browser's encoder adds that say nothing about the person or the photo (a JFIF header, pixel density, an sRGB marker) are allowed (AC-16).
- A warning when the tab is closed or reloaded with Unsaved edits. It depends on keeping the Work in browser storage, which later roadmap steps cover. The only warning US-05 covers is the confirmation before replacing the Work (AC-09).
- Other formats such as AVIF, GIF, HEIC or a project file. AVIF encoding is not reliably available in the target browsers, and the idea brief rules out a project format.
- Copying the exported image to the clipboard. That stays in roadmap step 10 (OS integration).

## 4. User stories

### US-01: Save the Work as an image file

**As a** Editor
**I want** to export the open Work as a PNG, JPEG or WebP file
**So that** I keep a copy of my edited image outside the app

### US-02: Balance quality against file size

**As a** Editor
**I want** to set the quality when I export to JPEG or WebP
**So that** I can trade image quality for a smaller file

### US-03: Export a smaller image

**As a** Editor
**I want** to export the Work at a smaller size than its full size
**So that** the file is small enough to send or upload

### US-04: Recognise the exported file

**As a** Editor
**I want** the exported file to be named after the image I opened
**So that** I can find it and tell it apart from the original photo

### US-05: Know that my work is saved

**As a** Editor
**I want** a successful export to count as saving my Work
**So that** I am not asked to confirm replacing a Work whose edits I have already saved, and I am still asked when I have not

### US-06: Understand why an export did not happen

**As a** Editor
**I want** a plain reason when a format is unavailable or an export fails
**So that** I never end up with a wrong or blank file, or with an export that failed inside the app without my knowing it

### US-07: Share an image without leaking where it was taken

**As a** Editor
**I want** exported files to carry no embedded photo metadata
**So that** sharing an edited photo does not reveal its location, date or camera

### US-08: Export on the first try

**As a** Portfolio reviewer
**I want** to find and complete the export without instructions
**So that** I can judge the open, edit and save flow end to end

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** an image is open and the browser offers a "Save as…" dialog
**When** the Editor chooses Export, picks a format (or keeps the default, AC-19), confirms in the panel, which opens the "Save as…" dialog, and saves in the dialog under the suggested name
**Then** a file in the chosen format is written to the chosen folder, containing the Work with all its edits at the chosen size. At full size in PNG it matches the Preview's own rendering at 100% (§6 Fidelity); at a smaller size it keeps the Work's proportions (AC-05), and in JPEG or WebP it differs only by compression at the chosen quality. A notice names the saved file. Saving in the dialog is the confirm step, not an extra one (AC-17)

### AC-01b (US-01) — error

**Given** the Editor is saving through the "Save as…" dialog
**When** they change the suggested name in the dialog
**Then** the dialog offers only the chosen format. The check below applies to the name the dialog returns, not the name typed, so when the dialog adds the extension itself (`photo` becomes `photo.jpg`) the file is saved. Any other name with a matching extension is accepted, and the notice names the file as saved. An extension matches when it is one of `.jpg`, `.jpeg`, `.jpe` or `.jfif` for JPEG, `.png` for PNG, or `.webp` for WebP, in any letter case. If the name has no extension or an extension that does not match the chosen format (for example `photo.png` for JPEG), nothing is written, a notice explains why and suggests saving again with the matching extension, and the Work keeps its Unsaved edits

### AC-02 (US-01) — happy path

**Given** an image is open and the browser has no "Save as…" dialog
**When** the Editor chooses Export, picks a format and confirms
**Then** the file is handed to the browser's downloads under the suggested name, and a notice names the file and says it was handed to the browser's downloads, so the Editor can look for it there. "Handed to the browser's downloads" means the moment the app starts the download of the finished file, after it has been fully produced and checked (AC-12). On this path the only failures the app can see are failures to produce the file (AC-12, AC-13); anything that goes wrong later inside the browser is covered by the §1 decision override

### AC-03 (US-01) — cross-context

**Given** an image is open and the Editor has zoomed and panned the Preview
**When** the Editor exports it
**Then** the file contains the whole Work at the chosen size, regardless of the zoom level or the visible part, and the View is unchanged afterwards

### AC-04 (US-02) — happy path

**Given** the export panel is open
**When** the Editor chooses JPEG or WebP
**Then** a quality setting from 1 to 100 appears, set to 90 by default, and a higher value gives a larger file with fewer compression artefacts: for the reference photo in the e2e fixtures, the file at quality 10 is smaller than at 50, which is smaller than at 90. JPEG and WebP share one quality value, so switching between them keeps it. When the Editor chooses PNG, the quality setting is hidden, because PNG is lossless. A typed value outside 1 to 100 snaps to the nearest bound, a fractional value rounds to the nearest whole number, and an empty or non-numeric value returns to the previous value when the Editor leaves the field

### AC-05 (US-03) — happy path

**Given** the export panel is open for a Work of a known size
**When** the Editor chooses a smaller export size
**Then** the panel shows the resulting width and height in pixels before the export, the proportions of the Work are kept, and the exported file has exactly those dimensions. The Editor picks a preset (100%, 75%, 50%, 25%) or types the long side in pixels. The long side is the input: a preset sets it to that percentage of the Work's long side, rounded to the nearest whole pixel. The short side is the long side times the Work's proportions, rounded to the nearest whole pixel. An exact half pixel always rounds up (2047.5 becomes 2048, 1536.5 becomes 1537). Proportions count as kept when the short side is within 0.5 px of the exact value, and this holds for every export size, including the smallest (AC-06). The long-side field follows the input rules of AC-04: a fractional value rounds to the nearest whole number, an empty or non-numeric value returns to the previous value, and zero or a negative value counts as too small (AC-06); values are checked and snapped when the Editor leaves the field, not while typing

### AC-06 (US-03) — domain invariant

**Given** the export panel is open
**When** the Editor enters a size larger than the Work, or so small that the short side, rounded by the AC-05 rule, would be less than 1 pixel
**Then** the size snaps to the Work's full size, or to the smallest long side whose short side, rounded by the AC-05 rule, is 1 pixel (for a 4096×10 Work, 205×1), because an Export is never larger than the Work and never empty

### AC-07 (US-04) — happy path

**Given** the Work was opened from a file named, for example, `IMG_4021.HEIC`
**When** the Editor exports it as JPEG
**Then** the suggested file name is `IMG_4021-edited.jpg`, with an extension that always matches the chosen format. The cleanup uses the strictest rules of Windows, macOS and Linux together, applied to the Source name in this order: (1) the characters `< > : " / \ | ? *` and the control characters U+0000–U+001F and U+007F–U+009F become `_`; (2) leading and trailing dots and spaces are removed; (3) the name is cut to at most 200 bytes in UTF-8 without splitting a character; (4) leading and trailing dots and spaces are removed again; (5) if the part before the first dot, with trailing spaces removed, is a Windows reserved name in any letter case, `_` is added after that part. The reserved names are exactly `CON`, `PRN`, `AUX`, `NUL`, `CONIN$`, `CONOUT$`, `COM0`–`COM9`, `LPT0`–`LPT9`, `COM¹`, `COM²`, `COM³`, `LPT¹`, `LPT²` and `LPT³`; (6) if nothing usable is left (the name is empty or only `_`, dots and spaces), `image` is used. Then `-edited` and the matching extension are added, so the fallback name is `image-edited` with the matching extension. Non-ASCII letters are kept. The Source name is the opened file's name with its last extension removed, but only when that extension is one of `jpg`, `jpeg`, `jpe`, `jfif`, `png`, `webp`, `avif`, `gif`, `heic` or `heif` in any letter case: `IMG_4021.HEIC` gives `IMG_4021`, and `scan.v2` stays `scan.v2`

### AC-08 (US-04) — cross-context

**Given** the Editor opened one image and then replaced it with another, by the "Open image" action or by dropping a file
**When** the Editor exports the new Work
**Then** the suggested name comes from the new image's Source name, never from the image it replaced

### AC-09 (US-05) — domain invariant

**Given** the open Work has Unsaved edits
**When** an export completes (the file is written in the "Save as…" dialog, or handed to the browser's downloads where there is no dialog)
**Then** the Work no longer has Unsaved edits, and opening another image replaces it without asking for confirmation. Any edit made after that export makes the Work have Unsaved edits again

### AC-10 (US-05) — cross-context

**Given** the open Work has Unsaved edits and the Editor has started an export
**When** the Editor cancels the "Save as…" dialog, or the file cannot be written or handed off
**Then** the Work keeps its Unsaved edits, so a later replace still asks for confirmation. Cancelling shows no message, and a failure shows its reason

### AC-11 (US-05) — cross-context

**Given** an export is in progress, from the moment the Editor confirms in the panel, including while the "Save as…" dialog is open
**When** the Editor tries to edit the Work, open another image, or start a second export
**Then** these actions are unavailable until the export has finished or failed, and they are refused, not queued: "Open image", Export and the editing controls are visibly disabled, and Export shows the progress. A file dropped during an export is not opened, and a notice asks the Editor to wait for the export to finish; only a drop shows this notice. A progress indicator is shown. Zooming and panning stay available. The file contains the Work exactly as it was at the moment the Editor confirmed in the panel

### AC-12 (US-06) — error

**Given** the browser cannot produce one of the formats (for example WebP in Safari)
**When** the Editor opens the export panel
**Then** that format is shown but cannot be chosen, and a one-line hint next to it says it is not available in this browser. Whether a browser can produce a format, and whether a produced file is in the chosen format, is decided by the content the browser actually produces, never by the browser's name or version. If a produced file ever turns out not to be in the chosen format, it is not saved, the Editor is told why, and the Work keeps its Unsaved edits; that format then becomes not selectable, with the same hint, for the rest of the browser session, and the default falls back to PNG (AC-19). The panel then selects PNG straight away, and PNG becomes the remembered format for this Work. The check of every format starts when the first image of the session is opened and runs once per browser session; a check that fails or errors counts as the browser not being able to produce that format. Until the check of a format has finished, that format cannot be chosen; PNG is always available. If the panel opens before the check of the Work's Source format has finished, the format is preset to PNG and stays PNG: the panel never changes the selected format by itself when a check finishes

### AC-13 (US-06) — error

**Given** an image is open
**When** the export fails, for example because the device's graphics were interrupted or the browser cannot produce an image of that size
**Then** no blank, black or partial file is saved: a file the Editor chose to overwrite in the "Save as…" dialog is left as it was, and an empty file the dialog may have created is not reported as saved. This holds for every refusal after the "Save as…" dialog (AC-01b, AC-12, AC-13, AC-14): the app removes such an empty file when the browser allows, and when it cannot, the notice says that an empty file with that name may be left in the chosen folder. Where the browser itself empties or replaces the chosen file when the dialog closes, so that a file chosen for overwrite can no longer be left as it was, the notice says that the file with that name may now be empty. A notice explains in plain language that the export failed and suggests trying again or choosing a smaller size, and the Work and its Unsaved edits are unchanged

### AC-14 (US-06) — authorization

**Given** the Editor is saving through the "Save as…" dialog
**When** the operating system or the browser does not allow the app to write to the chosen place (for example a read-only or protected folder)
**Then** nothing is saved and a file the Editor chose to overwrite is left as it was (with the same exception and notice as AC-13), a notice says the app was not allowed to save there and suggests choosing another folder, and the Work keeps its Unsaved edits

### AC-15 (US-06) — error

**Given** the Work has transparent areas, meaning at least one pixel is not fully opaque, whatever format the Work was opened from
**When** JPEG is selected in the export panel, whether the Editor chose it or it was preset or remembered (AC-19)
**Then** the panel says in one line that JPEG has no transparency and transparent areas will become white, and suggests PNG or WebP to keep them. In the exported JPEG every pixel looks as it would on a white background: its colour is opacity × the pixel's colour + (1 − opacity) × white, computed on the stored sRGB values (as the Preview would show it on white), so a fully transparent pixel becomes white. A Work with no transparent pixels shows no such hint

### AC-16 (US-07) — domain invariant

**Given** the opened photo carried embedded metadata such as capture date, camera model or location
**When** the Editor exports the Work in any format
**Then** the exported file contains none of that metadata: no capture date, camera, location, author or text comments, and no Exif, XMP, IPTC or text blocks, and no colour profile other than sRGB. Technical blocks the browser's encoder adds that say nothing about the person or the photo (a JFIF header, pixel density, an sRGB marker) are allowed

### AC-17 (US-08) — happy path

**Given** a Portfolio reviewer has opened an image for the first time
**When** they look for a way to save it
**Then** an "Export" action is visible next to the canvas and reachable by keyboard: it can be reached with Tab and activated with Enter or Space, and Ctrl+S (Cmd+S on a Mac) opens the export panel instead of the browser's "Save page". The export completes in at most three steps: Export, choose a format (no step when the default fits), confirm. Where the browser has a "Save as…" dialog, the confirm in the panel opens the dialog and saving there completes the same step. With no image open, Export is unavailable and its hint says to open an image first; Ctrl/Cmd+S then shows the same hint and never opens the browser's "Save page". While the export panel is open and no export is running, Ctrl/Cmd+S confirms it, like the confirm button. During an export (AC-11), Ctrl/Cmd+S does nothing. Enter in the quality or size field only applies the value as if the Editor had left the field and does not start the export; Enter or Space on the confirm button confirms. Confirming, by the confirm button or Ctrl/Cmd+S, first applies a value still being typed in the quality or size field as if the Editor had left the field (AC-04, AC-05), so the file always has the values the panel shows. The panel stays open during an export, showing the progress with its controls disabled, and closes when the export succeeds. After a cancelled dialog or a refusal (AC-01b, AC-10, AC-12, AC-13, AC-14) it stays open with the same choices, except that a format refused by AC-12 is replaced by PNG, so trying again is one confirm. Escape or a click outside closes the panel only when no export is running

### AC-18 (US-01) — cross-context

**Given** the app was loaded once and the device is now offline
**When** the Editor exports an image
**Then** the export completes exactly as it does online

### AC-19 (US-01) — happy path

**Given** an image is open and the Editor opens the export panel for the first time for this Work
**When** the panel appears
**Then** the format is preset to the Work's Source format when it is PNG, JPEG or WebP and the check has already confirmed that this browser can produce it (AC-12), and to PNG otherwise (for example HEIC, AVIF, GIF, or WebP in Safari). Within the browser session (until the page is reloaded) the panel remembers the quality for every Work, and the format and size for the same Work. Choices are remembered as soon as they are changed, even if the export is then cancelled. Closing the panel (Escape or a click outside) first applies a value still being typed as if the Editor had left the field, so that value is remembered too, and the size is remembered in the form it was chosen: a preset as a percentage, a typed long side in pixels (snapped by AC-06 if the Work has become smaller); a newly opened Work starts again from its Source format and full size. Nothing is remembered across sessions

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air with the latest stable Chrome (as in open-and-view). "Export time" runs from confirming the export in the panel to the file being written or handed to the browser's downloads, minus the time the "Save as…" dialog is open, so the encoding always counts wherever it happens. Each p95 is taken over 20 runs after 2 warm-up runs.

| Aspect | Target | Measurement |
|---|---|---|
| Export time p95, 4096×3072 Work, full size, JPEG at quality 90 | ≤ 1 s | e2e performance test on the reference machine |
| Export time p95, 4096×3072 Work, full size, PNG | ≤ 2 s | e2e performance test on the reference machine |
| Longest interface freeze during a full-size PNG export of a 4096×3072 Work | ≤ 200 ms (progress indicator keeps animating) | long-task trace in the e2e performance test |
| Fidelity of a full-size PNG Export against the Work | max per-channel difference ≤ 2 of 255 against the Preview's own rendering of the Work at 100% zoom (the same rendering the canvas uses, with no transparency backdrop and no display scaling; for a Work with no edits this equals the Original's pixels). The alpha channel is compared on every pixel, and the colour channels after compositing both images onto black and onto white, so the hidden colour of fully transparent pixels does not count | e2e pixel comparison on Chromium, Firefox and WebKit |
| Format honesty: file content matches its extension | 100% of exports | e2e on Chromium, Firefox and WebKit, file type checked by content |
| Memory after 10 consecutive full-size exports of a 4096×3072 Work opened from JPEG, exported as PNG | ≤ 110% of memory after the first export | whole-page memory as the browser reports it (including canvases and file data), after a forced garbage collection, Chromium e2e |
| Exporting with no network connection | 100% of runs succeed | e2e run in offline mode after first load |

## 6.1 Security / privacy

- **Data classification:** confidential. Users' photos can be personal, and they never leave the device except as a file the Editor saves.
- **Personal data touched:** image pixels of the Work and its Source name, held in session memory only. The Source name and Source format are new state on the Work. No embedded metadata is written (AC-16).
- **AuthZ/AuthN impact:** none. There are no accounts. The only check is the operating system's or browser's permission to write the chosen file, and its refusal is handled by AC-14.
- **Abuse cases:**
  - File-name injection (a Source name with path separators, reserved device names, leading dots or extreme length): replaced characters and a fallback name (AC-07), so the app never suggests a path or a hidden file.
  - Metadata leak (location in a shared photo): no metadata is carried into the Export (AC-16).
  - Format spoofing (a file whose content does not match its extension): refused before saving (AC-12).
  - Resource exhaustion through export size: bounded by the Work's size, which the Downscale limit bounds (AC-06).
- **Security review:** N/A — no new input from outside the app and no new trust boundary. The feature only writes a file the Editor explicitly asks for, and the two privacy rules (AC-07, AC-16) are verified by tests.

## 7. Metrics / KPIs

- **Format honesty on the reference set** (3 formats × 3 browser engines, including transparent and photo images) — baseline: 0 (no feature yet), target: 100% of files have content matching their extension, or the format is not offered, by ship.
- **Round-trip fidelity** — baseline: 0, target: re-opening a full-size PNG Export gives an image within 2 of 255 per channel of the Preview's rendering of the Work at 100% (compared as in §6) for 100% of reference images, by ship.
- **Steps from an open image to a saved file** — baseline: none (no export), target: ≤ 3 actions with the defaults, by ship.

## 8. Open questions

- [x] How does the Editor express the smaller size: percentage presets, the long side in pixels, or both? Resolved 2026-10-05 in `sdd:clarify`: presets 100%, 75%, 50% and 25% plus a long-side field in pixels, with the rounding rule in AC-05. — owner: Blazheiko (owner)
- [x] Should the export panel remember the last format, quality and size? Resolved 2026-10-05 in `sdd:clarify`: within the session the quality is remembered for every Work, the format and size only for the same Work; nothing across sessions (AC-19). — owner: Blazheiko (owner)
- [ ] After an export, when an edit is undone back to the exported state, does the Work have Unsaved edits? Default now: the export sets a save point, so undoing back to it clears Unsaved edits and moving away from it sets them again. — owner: Blazheiko (owner), due: before the first editing feature (roadmap step 4) re-verifies AC-09
- [ ] Which Chromium memory measurement does the §6 Memory row use (it must include canvases and file data, not only the JavaScript heap)? Default now: the browser's whole-page memory measurement, chosen when the e2e setup is planned. — owner: Blazheiko (owner), due: before `sdd:plan-tests`
- [ ] What fidelity threshold do JPEG and WebP Exports, and Exports at a smaller size, have to meet against the Preview's rendering of the Work at the same size (for example mean difference or PSNR, a measure of image similarity in decibels)? Default now: no numeric threshold; format and dimensions are checked. — owner: Blazheiko (owner), due: before `sdd:plan-tests`
