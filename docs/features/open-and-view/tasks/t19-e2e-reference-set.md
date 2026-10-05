---
id: T19
title: "Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal"
layer: "tests"
deps: ["T6", "T14", "T15", "T16", "T17", "T18"]
blocks: ["T20"]
acs: ["AC-01", "AC-07", "AC-08", "AC-09", "AC-11", "AC-16"]
files_hint: ["e2e/open-and-view/reference-set.spec.ts", "e2e/fixtures/"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 67 inlined lines
status: "done"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T19 — Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal

## Place in the sequence

- **Blocked by:** T6 — Add the worker's orientation and HEIC capability probes and the EXIF-orientation fallback, T14 — Build SCR-02's PreviewCanvas with the renderer, Fit on open, and the zoom and pan gestures, T15 — Build the status bar: Original dimensions readout, zoom controls with the live zoom level, and the zoom shortcuts, T16 — Build SCR-03, the replace confirmation dialog, on the store's confirming phase, T17 — Add the start-up capability gate and the blocking screens SCR-04, SCR-05 plus SCR-02's restoring state, T18 — Precache the decode worker for offline opens, run e2e on three engines in CI, and record the widened rules.
- **Blocks:** T20 — Add the @perf suite: time to first Preview, long tasks, zoom/pan frame rate and memory after 10 opens.
- **Wave:** 9 — after T6, T14, T15, T16, T17, T18 (wave 8).
- **Lane:** own lane.

## Why (user story)

> **US-04: Understand why an image won't open**
>
> **As a** Editor  
> **I want** a plain-language reason whenever a file can't be opened or opens differently from how I expect  
> **So that** I know what to do next instead of facing an empty canvas
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It proves the feature's KPIs end to end: every reference file ends in a correct Preview or a plain reason, orientation is right in every engine, and no refusal ever touches the open Work.

## Inlined context

> **When:** each file of the reference test set (JPEG, PNG, WebP, AVIF, animated GIF, HEIC, damaged, truncated, oversize, mis-named files, spec §7) and the 8 EXIF orientation images is opened, once with no Work and once over a Work with Unsaved edits; plus a decompression bomb (a small file declaring dimensions above the size ceiling […]) and fuzzed headers
> **Then:** 100% of files end in either a correct Preview or a plain-language reason, with 0 blank canvases or tab crashes (spec §7); 8 of 8 orientation images display upright (spec §7); on every refusal the open Work stays exactly as it was and no confirmation is asked (AC-16); the bomb is refused before any pixel is decoded (AC-09)
> **How verify:** […] Playwright e2e on Chromium, Firefox and WebKit runs the whole set and asserts the outcome, the message text from the catalog, and that the Work's `id` and `revision` are unchanged after each refusal; for the bomb it asserts that the worker reported `TOO_LARGE` without reaching its decode stage. The HEIC files are opened by hand in real Safari before release (§7)
>
> — `sad.md §10, QG-2, abridged` · full text: [sad.md](../sad.md)

> - **Honest outcome rate on the reference test set** […] target: 100% of files end in either a correct Preview or a plain-language reason, with 0 blank canvases or tab crashes, by ship.
> - **Orientation correctness** — baseline: 0, target: 8 of 8 EXIF orientation test images display upright by ship.
>
> — `spec.md §7, KPIs 2–3, abridged` · full text: [spec.md](../spec.md)

> HEIC decoding can be checked only in real Safari, because WebKit on Linux does not decode it (§7) | Low | Manual open of the HEIC samples in Safari in the pre-release pass; CI covers the HEIC refusal path (AC-07)
>
> — `sad.md §11, risk row 7, verbatim` · full text: [sad.md](../sad.md)

> A valid JPEG with more than 1 MiB of metadata before its frame header is refused as unreadable (ADR-0002) | Low | Keep such a sample in the reference set
>
> — `sad.md §11, risk row 6, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** the Editor has no image open
> **When** the Editor chooses a Supported image through the "Open image" action
> **Then** the image is shown at Fit, upright the same way the operating system's photo viewer shows it, and the editor is ready for editing. Fit is the largest zoom at which the whole image fits inside the canvas area (the space left after toolbars and panels), never above 100%, so an image smaller than the canvas area is shown centred at 100% and is never enlarged
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

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

### AC-11 — error

> **Given** an animated image
> **When** the Editor opens it
> **Then** its first frame opens as the Original, and a notice says only the first frame is kept
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — domain invariant

> **Given** an image is open
> **When** the Editor opens another file that turns out to be unreadable, unsupported, refused or not permitted
> **Then** no confirmation is asked, the open Work stays exactly as it was, and the matching reason is shown — the open Work is only ever replaced by an image that has been read successfully
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Fixture set in `e2e/fixtures/`: 12 MP and 48 MP JPEG, PNG, WebP, AVIF, animated GIF, HEIC, truncated JPEG, corrupt PNG, PNG renamed `.jpg`, `.txt` renamed `.png`, SVG, BMP, TIFF, PSD, a > 1 MiB-metadata JPEG, a bomb (valid PNG IHDR declaring 20000×20000 in a few hundred bytes), the 8 EXIF orientation images; source + licence of each in `e2e/fixtures/README.md`
- [ ] Table-driven spec: for each fixture, open with no Work and over a Work prepared with `__imglyTest.applyEdit()`; assert Preview + readout, or the exact catalog message; on refusal assert `work().id` and `revision` unchanged and no dialog
- [ ] Orientation: each of the 8 images opens with the upright aspect and a known corner colour (Chromium pixel check; aspect check on all engines)
- [ ] Bomb: worker's dev stage log (or a test-hook counter) shows `TOO_LARGE` with no decode stage
- [ ] Animated GIF: Preview + "only the first frame was kept" notice
- [ ] Record the manual Safari HEIC check as a `ship` checklist item in `e2e/fixtures/README.md`

## Edge cases

| Case | Behaviour |
|---|---|
| HEIC on Chromium/Firefox CI | AC-07 HEIC message asserted |
| HEIC on WebKit (Linux) | refusal path asserted; real decode checked by hand in Safari |
| > 1 MiB-metadata JPEG | AC-08 message (accepted risk) — asserted so a change is noticed |
| Refusal over a Work with Unsaved edits | no confirmation, Work id + revision unchanged (AC-16) |

## Definition of Done

- [ ] `e2e/open-and-view/reference-set.spec.ts` passes on Chromium, Firefox and WebKit with 100% honest outcomes and 8/8 orientations
- [ ] Fixture sources and licences are recorded
- [ ] lint + typecheck clean
