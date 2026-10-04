---
id: T6
title: "Add the worker's orientation and HEIC capability probes and the EXIF-orientation fallback"
layer: "infra"
deps: ["T5"]
blocks: ["T19"]
acs: ["AC-01", "AC-07", "AC-08"]
files_hint: ["src/infra/image-decode/"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 59 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Add the worker's orientation and HEIC capability probes and the EXIF-orientation fallback

## Place in the sequence

- **Blocked by:** T5 — Build the decode worker pipeline and the main-thread decodeImage client with supersede and error mapping.
- **Blocks:** T19 — Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal.
- **Wave:** 4 — after T5 (wave 3).
- **Lane:** shares `src/infra/image-decode/` with T5, T20 — serialized.

## Why (user story)

> **US-01: Open an image from disk**
>
> **As a** Editor  
> **I want** to choose an image file from my computer with an "Open image" action  
> **So that** I can start editing it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **US-04: Understand why an image won't open**
>
> **As a** Editor  
> **I want** a plain-language reason whenever a file can't be opened or opens differently from how I expect  
> **So that** I know what to do next instead of facing an empty canvas
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It makes "upright the same way the operating system's photo viewer shows it" true in every engine, and splits a HEIC failure into "not supported here" vs "could not be read".

## Inlined context

> **Capability probes**, run once per session in the worker: decoding an embedded 2×1 px JPEG tagged with EXIF orientation 6 tells whether the browser applies orientation itself (a 1×2 result) or the worker must; decoding an embedded tiny HEIC tells whether this browser decodes HEIC/HEIF, so that a HEIC decode failure is reported as "not supported here" (AC-07) in a browser without support and as "could not be read" (AC-08) in one with support.
>
> — `adr/0001 §Decision outcome, How it works bullet 3, verbatim` · full text: [adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md](../adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md)

> the worker's per-session probes (does the browser apply EXIF orientation, does it decode HEIC). Results are cached for the session. No user-agent sniffing
>
> — `sad.md §8, Capability detection row, abridged` · full text: [sad.md](../sad.md)

> The capability probes' sample images are embedded in the worker script, so the probes never fetch anything.
>
> — `sad.md §7, Deployment view, verbatim` · full text: [sad.md](../sad.md)

> A Portfolio reviewer on Firefox or Safari sees a photo rotated twice or not at all, because engines differ on applying EXIF orientation […] | Medium | The worker probes orientation once per session instead of assuming it (ADR-0001); the 8 orientation images run in e2e on Chromium, Firefox and WebKit
>
> — `sad.md §11, risk row 1, abridged` · full text: [sad.md](../sad.md)

> the target dimensions for the Downscale limit are computed from the upright decoded size.
>
> — `adr/0002 §Decision outcome, How it works bullet 5, abridged` · full text: [adr/0002-parse-image-headers-in-core-before-decoding.md](../adr/0002-parse-image-headers-in-core-before-decoding.md)

> **Hard rule:** `core` and `infra` return `Result<T, AppError>`; hostile input never throws. New codes: `FILE_NOT_PERMITTED` (AC-10), `NOT_AN_IMAGE`, `UNREADABLE` (declared size not found in the header window) and `DECODE_FAILED` (AC-08, one message), `UNSUPPORTED_FORMAT` with the format name (AC-07), `TOO_LARGE` with both sizes in megapixels (AC-09), `UNSUPPORTED_BROWSER` (AC-18), `DISPLAY_LOST` (AC-19b). The worker posts errors as plain `{ code, details }` objects. A superseded open is not an error: `decodeImage` resolves it as `Superseded` and the store ignores it
>
> — `sad.md §8, Error handling row, verbatim` · full text: [sad.md](../sad.md)

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

## Checklist

- [ ] Embed a 2×1 px JPEG with EXIF orientation 6 and a tiny HEIC (generated once at implement time, e.g. with `sips`/libheif; keep each under 2 KB, record the command in a comment) as base64 constants — `src/infra/image-decode/probes.ts`
- [ ] Run both probes in the first worker of the session; the worker returns the results with its first answer; the client caches them and passes them into every later worker's request (one worker per open, so "once per session" lives on the main thread) — `src/infra/image-decode/index.ts`, `decode.worker.ts`
- [ ] When the browser did not apply orientation: draw the first reduction step with the EXIF transform for orientations 2–8, swapping width/height for 5–8 before `targetSize` — `src/infra/image-decode/orient.ts`
- [ ] HEIC: probe says unsupported → `UNSUPPORTED_FORMAT` `{ format: 'HEIC' }` without decoding; probe says supported and decode fails → `DECODE_FAILED` — `decode.worker.ts`
- [ ] Vitest for the pure orientation transform table (8 orientations → matrix + output size) and the probe-cache handoff in the client — `src/infra/image-decode/*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Browser applies EXIF orientation itself (probe returns 1×2) | no extra transform — never rotated twice |
| Orientation 6 photo, browser does not apply it | worker rotates; upright size swapped before the 4096 target |
| HEIC in Chromium/Firefox without HEIC decode | `UNSUPPORTED_FORMAT` `HEIC` → AC-07 HEIC message |
| Damaged HEIC in Safari (decodes HEIC) | `DECODE_FAILED` → AC-08 message |
| A probe itself throws | orientation: treated as "browser applies it" (all three target engines do today); HEIC: treated as unsupported — breakdown decision, revisit if e2e shows otherwise |

## Definition of Done

- [ ] Vitest for the orientation table and the probe-cache handoff passes
- [ ] 8 of 8 EXIF orientation images display upright on Chromium, Firefox and WebKit — asserted in T19
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
