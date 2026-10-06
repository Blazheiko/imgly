---
id: T15
title: "Write the functional e2e suite: format honesty, fidelity, quality and size, naming, metadata, downloads and Save as…"
layer: "tests"
deps: ["T13"]
blocks: ["T14", "T16"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-07", "AC-12", "AC-16"]
files_hint: ["e2e/export/", "e2e/fixtures/", "src/app/test-hooks.ts", "e2e/test-hooks.d.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 100 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T15 — Write the functional e2e suite: format honesty, fidelity, quality and size, naming, metadata, downloads and Save as…

## Place in the sequence

- **Blocked by:** T13 — Mount the Export action in the editor top bar with its states, the Ctrl/Cmd+S shortcut and the exporting lock.
- **Blocks:** T14 — Precache the export worker and prove export works offline after the first load, T16 — Write the @perf export suite: export time p95, longest freeze and memory after 10 exports.
- **Wave:** 8 — after T13.
- **Lane:** shares `e2e/export/`, `src/app/test-hooks.ts` with T3, T14, T16 — serialized.

## Why (user story)

> **US-01: Save the Work as an image file**
>
> **As a** Editor  
> **I want** to export the open Work as a PNG, JPEG or WebP file  
> **So that** I keep a copy of my edited image outside the app
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **US-07: Share an image without leaking where it was taken**
>
> **As a** Editor  
> **I want** exported files to carry no embedded photo metadata  
> **So that** sharing an edited photo does not reveal its location, date or camera
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It proves on three real engines that the file is what it claims to be, looks like the Preview, and carries nothing personal.

## Inlined context

> | Aspect | Target | Measurement |
> |---|---|---|
> | Fidelity of a full-size PNG Export against the Work | max per-channel difference ≤ 2 of 255 against the Preview's own rendering of the Work at 100% zoom (the same rendering the canvas uses, with no transparency backdrop and no display scaling; for a Work with no edits this equals the Original's pixels). The alpha channel is compared on every pixel, and the colour channels after compositing both images onto black and onto white, so the hidden colour of fully transparent pixels does not count | e2e pixel comparison on Chromium, Firefox and WebKit |
> | Format honesty: file content matches its extension | 100% of exports | e2e on Chromium, Firefox and WebKit, file type checked by content |
>
> — `spec.md §6, NFR, verbatim` · full text: [spec.md](../spec.md)

> - Every push: CI runs lint, typecheck, Vitest units (the `core/export` rules, the store's exporting phase and save point, the panel behaviour on happy-dom with a fake worker and fake save target) and the functional Playwright e2e suite on Chromium, Firefox and WebKit: downloads, offline export, format honesty and fidelity by pixel comparison. The Chromium "Save as…" path runs against a stubbed `showSaveFilePicker` (Playwright cannot drive the native dialog)
>
> — `sad.md §7, Monitoring bullet 2, verbatim` · full text: [sad.md](../sad.md)

> - **How verify:** e2e pixel comparison on Chromium, Firefox and WebKit: a test hook reads back the Preview's rendering at 100% with no backdrop and no display scaling, the test decodes the exported PNG and compares as specified; the View is asserted equal before and after
>
> — `sad.md §10, QG-2 How verify, verbatim` · full text: [sad.md](../sad.md)

> | Concept | Convention | Where defined |
> |---|---|---|
> | Privacy | Canvas encoders write pixels only: no Exif, XMP, IPTC, text chunks or non-sRGB profile, verified by a chunk/segment scan in tests (AC-16). The Source name is cleaned by `core/export` before it is ever suggested (AC-07). No file name, pixel or metadata is logged or sent | spec §6.1; here |
>
> — `sad.md §8, verbatim` · full text: [sad.md](../sad.md)

> - Decision override: until an editing tool exists, "the Work with all its edits" is verified with a test-prepared Work that has Unsaved edits, as open-and-view did for AC-15. The first editing feature (roadmap step 4) re-verifies AC-01 and AC-09 with real edits.
>
> — `spec.md §1, Decision override (test-prepared Work), verbatim` · full text: [spec.md](../spec.md)

> - [ ] What fidelity threshold do JPEG and WebP Exports, and Exports at a smaller size, have to meet against the Preview's rendering of the Work at the same size (for example mean difference or PSNR, a measure of image similarity in decibels)? Default now: no numeric threshold; format and dimensions are checked. — owner: Blazheiko (owner), due: before `sdd:plan-tests`
>
> — `spec.md §8, Open question 5, verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the
>
> — `CLAUDE.md §Conventions, Tests, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Fixed by this breakdown:** add test hooks `previewAt100()` (RGBA readback of the Preview at 100%, no backdrop, no DPR scaling) and `exportStatus()`; `e2e/export/helpers.ts` holds `stubSaveFilePicker(page, { returnName })` (captures written bytes in the page) and `captureExport(page)` (download event on Firefox/WebKit, stub on Chromium). Content is judged with `sniffImageHeader` from `src/core`. The metadata scan reads PNG chunks, JPEG segments and WebP RIFF chunks; use an EXIF-carrying fixture (the `orientation-*.jpg` files carry Exif; add a GPS one via `e2e/fixtures/generate.sh` if needed).
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open and the browser offers a "Save as…" dialog
> **When** the Editor chooses Export, picks a format (or keeps the default, AC-19), confirms in the panel, which opens the "Save as…" dialog, and saves in the dialog under the suggested name
> **Then** a file in the chosen format is written to the chosen folder, containing the Work with all its edits at the chosen size. At full size in PNG it matches the Preview's own rendering at 100% (§6 Fidelity); at a smaller size it keeps the Work's proportions (AC-05), and in JPEG or WebP it differs only by compression at the chosen quality. A notice names the saved file. Saving in the dialog is the confirm step, not an extra one (AC-17)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — happy path

> **Given** an image is open and the browser has no "Save as…" dialog
> **When** the Editor chooses Export, picks a format and confirms
> **Then** the file is handed to the browser's downloads under the suggested name, and a notice names the file and says it was handed to the browser's downloads, so the Editor can look for it there. "Handed to the browser's downloads" means the moment the app starts the download of the finished file, after it has been fully produced and checked (AC-12). On this path the only failures the app can see are failures to produce the file (AC-12, AC-13); anything that goes wrong later inside the browser is covered by the §1 decision override
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor exports it
> **Then** the file contains the whole Work at the chosen size, regardless of the zoom level or the visible part, and the View is unchanged afterwards
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the export panel is open
> **When** the Editor chooses JPEG or WebP
> **Then** a quality setting from 1 to 100 appears, set to 90 by default, and a higher value gives a larger file with fewer compression artefacts: for the reference photo in the e2e fixtures, the file at quality 10 is smaller than at 50, which is smaller than at 90. JPEG and WebP share one quality value, so switching between them keeps it. When the Editor chooses PNG, the quality setting is hidden, because PNG is lossless. A typed value outside 1 to 100 snaps to the nearest bound, a fractional value rounds to the nearest whole number, and an empty or non-numeric value returns to the previous value when the Editor leaves the field
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — happy path

> **Given** the export panel is open for a Work of a known size
> **When** the Editor chooses a smaller export size
> **Then** the panel shows the resulting width and height in pixels before the export, the proportions of the Work are kept, and the exported file has exactly those dimensions. The Editor picks a preset (100%, 75%, 50%, 25%) or types the long side in pixels. The long side is the input: a preset sets it to that percentage of the Work's long side, rounded to the nearest whole pixel. The short side is the long side times the Work's proportions, rounded to the nearest whole pixel. An exact half pixel always rounds up (2047.5 becomes 2048, 1536.5 becomes 1537). Proportions count as kept when the short side is within 0.5 px of the exact value, and this holds for every export size, including the smallest (AC-06). The long-side field follows the input rules of AC-04: a fractional value rounds to the nearest whole number, an empty or non-numeric value returns to the previous value, and zero or a negative value counts as too small (AC-06); values are checked and snapped when the Editor leaves the field, not while typing
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — happy path

> **Given** the Work was opened from a file named, for example, `IMG_4021.HEIC`
> **When** the Editor exports it as JPEG
> **Then** the suggested file name is `IMG_4021-edited.jpg`, with an extension that always matches the chosen format. The cleanup uses the strictest rules of Windows, macOS and Linux together, applied to the Source name in this order: (1) the characters `< > : " / \ | ? *` and the control characters U+0000–U+001F and U+007F–U+009F become `_`; (2) leading and trailing dots and spaces are removed; (3) the name is cut to at most 200 bytes in UTF-8 without splitting a character; (4) leading and trailing dots and spaces are removed again; (5) if the part before the first dot, with trailing spaces removed, is a Windows reserved name in any letter case, `_` is added after that part. The reserved names are exactly `CON`, `PRN`, `AUX`, `NUL`, `CONIN$`, `CONOUT$`, `COM0`–`COM9`, `LPT0`–`LPT9`, `COM¹`, `COM²`, `COM³`, `LPT¹`, `LPT²` and `LPT³`; (6) if nothing usable is left (the name is empty or only `_`, dots and spaces), `image` is used. Then `-edited` and the matching extension are added, so the fallback name is `image-edited` with the matching extension. Non-ASCII letters are kept. The Source name is the opened file's name with its last extension removed, but only when that extension is one of `jpg`, `jpeg`, `jpe`, `jfif`, `png`, `webp`, `avif`, `gif`, `heic` or `heif` in any letter case: `IMG_4021.HEIC` gives `IMG_4021`, and `scan.v2` stays `scan.v2`
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — error

> **Given** the browser cannot produce one of the formats (for example WebP in Safari)
> **When** the Editor opens the export panel
> **Then** that format is shown but cannot be chosen, and a one-line hint next to it says it is not available in this browser. Whether a browser can produce a format, and whether a produced file is in the chosen format, is decided by the content the browser actually produces, never by the browser's name or version. If a produced file ever turns out not to be in the chosen format, it is not saved, the Editor is told why, and the Work keeps its Unsaved edits; that format then becomes not selectable, with the same hint, for the rest of the browser session, and the default falls back to PNG (AC-19). The panel then selects PNG straight away, and PNG becomes the remembered format for this Work. The check of every format starts when the first image of the session is opened and runs once per browser session; a check that fails or errors counts as the browser not being able to produce that format. Until the check of a format has finished, that format cannot be chosen; PNG is always available. If the panel opens before the check of the Work's Source format has finished, the format is preset to PNG and stays PNG: the panel never changes the selected format by itself when a check finishes
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — domain invariant

> **Given** the opened photo carried embedded metadata such as capture date, camera model or location
> **When** the Editor exports the Work in any format
> **Then** the exported file contains none of that metadata: no capture date, camera, location, author or text comments, and no Exif, XMP, IPTC or text blocks, and no colour profile other than sRGB. Technical blocks the browser's encoder adds that say nothing about the person or the photo (a JFIF header, pixel density, an sRGB marker) are allowed
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `previewAt100()` and `exportStatus()` test hooks — `src/app/test-hooks.ts`, `e2e/test-hooks.d.ts`
- [ ] Write `e2e/export/helpers.ts`: Save as… stub, export capture, header/dimension assertions, PNG decode + compare on black and white
- [ ] `formats.spec.ts`: each format × engine → content matches the extension and dimensions; WebP on WebKit shown unavailable with its hint (AC-01, AC-02, AC-12)
- [ ] `fidelity.spec.ts`: test-prepared Unsaved edit, zoom + pan, full-size PNG within 2/255 of `previewAt100()`; View equal before/after (AC-01, AC-03)
- [ ] `quality-size.spec.ts`: reference photo at q10 < q50 < q90 bytes; 50% preset and a typed long side give the panel's exact dimensions (AC-04, AC-05)
- [ ] `naming-metadata.spec.ts`: `photo.heic` → `photo-edited.png` suggested; Exif fixture exported in each format has no Exif/XMP/IPTC/text blocks or non-sRGB profile (AC-07, AC-16)

## Edge cases

| Case | Behaviour |
|---|---|
| WebKit asked for WebP | option disabled with the hint; no WebP file is ever produced |
| Chromium | Save as… path via the stub; the native dialog is covered by the manual pass in sad §7 |
| Firefox / WebKit download blocked or prompting | test fails on a missing download event (sad §11 risk 3) |
| JPEG/WebP or smaller-size fidelity | format and dimensions only — no numeric threshold yet (spec §8 OQ 5) |
| JFIF header, pixel density, sRGB marker in the output | allowed (AC-16) |

## Definition of Done

- [ ] `pnpm test:e2e` passes `e2e/export/*.spec.ts` (except `offline` and `perf`) on Chromium, Firefox and WebKit
- [ ] the fidelity spec asserts ≤ 2/255 per channel on black and white and on alpha, and the metadata spec fails on an injected Exif block (checked once by hand)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
