---
id: T5
title: "Extract the shared shader module and build the export worker that renders, flattens, encodes and verifies one export"
layer: "infra"
deps: ["T1"]
blocks: ["T6"]
acs: ["AC-01", "AC-03", "AC-13", "AC-15", "AC-16"]
files_hint: ["src/render/shaders.ts", "src/render/preview-renderer.ts", "src/render/export/"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 84 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Extract the shared shader module and build the export worker that renders, flattens, encodes and verifies one export

## Place in the sequence

- **Blocked by:** T1 — Add the export error codes and the pure file-name rules (Source name, suggested name, extension match).
- **Blocks:** T6 — Add the once-per-session format check and the main-thread export client (worker spawn, transfer, terminate).
- **Wave:** 2 — after T1.
- **Lane:** shares `src/render/export/` with T6 — serialized.

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

It produces the file itself: the whole Work at the chosen size, white under JPEG, pixels only, checked by content before anyone sees it.

## Inlined context

> 1. **A dedicated export worker** — the main thread transfers a copy of the Original (`createImageBitmap(original)`) with the size, format and quality; a short-lived worker renders on an `OffscreenCanvas` with WebGL2 using the shared shader module, flattens onto white for JPEG, encodes with `convertToBlob`, checks the result with `sniffImageHeader`, and is terminated afterwards.
>
> — `adr/0002 §Considered options, option 1, verbatim` · full text: [adr/0002-render-and-encode-exports-in-a-dedicated-web-worker.md](../adr/0002-render-and-encode-exports-in-a-dedicated-web-worker.md)

> **Hard rule:** Every later editing tool's rendering code must run in both the window and a worker: no DOM access, the context passed in, shaders only from `src/render/shaders.ts`.
>
> — `adr/0002 §Consequences, Negative bullet 2, verbatim` · full text: [adr/0002-render-and-encode-exports-in-a-dedicated-web-worker.md](../adr/0002-render-and-encode-exports-in-a-dedicated-web-worker.md)

> | Concept | Convention | Where defined |
> |---|---|---|
> | Colour and alpha | The export renders in sRGB like the Preview (open-and-view ADR-0004), with the same premultiplied texture upload. A full-size render samples at texel centres, 1:1, as the Preview does at 100%; a smaller size uses the mipmapped trilinear sampling the Preview uses below 100%. JPEG is flattened onto white in the shader on the stored sRGB values: colour = premultiplied colour + (1 − opacity) × white (AC-15) | here; ADR-0002 |
> | Privacy | Canvas encoders write pixels only: no Exif, XMP, IPTC, text chunks or non-sRGB profile, verified by a chunk/segment scan in tests (AC-16). The Source name is cleaned by `core/export` before it is ever suggested (AC-07). No file name, pixel or metadata is logged or sent | spec §6.1; here |
> | Resource lifetime | The copy of the Original sent to the worker is transferred and closed there; the worker is terminated after each export and after the format check, which frees its WebGL2 context; a download's object URL is revoked 60 s after `click()`; the bitmap ledger counts the copy so the e2e leak test still ends on one retained Original | open-and-view sad.md §8; here |
>
> — `sad.md §8, verbatim` · full text: [sad.md](../sad.md)

> - Files are encoded only by the browser's own encoders (`HTMLCanvasElement.toBlob` or `OffscreenCanvas.convertToBlob`); no bundled or WASM encoders. Which of PNG, JPEG and WebP a browser can produce is detected, never assumed (spec AC-12)
>
> — `sad.md §2, Technical constraints, verbatim` · full text: [sad.md](../sad.md)

> - Render or encode failure, or the context or size limit hit in the worker → `EXPORT_FAILED`, nothing reaches the disk (AC-13).
> - Produced content is not the chosen format or size → `EXPORT_FORMAT_MISMATCH`; the format is disabled for the session and the panel selects PNG (AC-12).
>
> — `sad.md §6, Failure branches 3–4, verbatim` · full text: [sad.md](../sad.md)

> | Aspect | Target | Measurement |
> |---|---|---|
> | Fidelity of a full-size PNG Export against the Work | max per-channel difference ≤ 2 of 255 against the Preview's own rendering of the Work at 100% zoom (the same rendering the canvas uses, with no transparency backdrop and no display scaling; for a Work with no edits this equals the Original's pixels). The alpha channel is compared on every pixel, and the colour channels after compositing both images onto black and onto white, so the hidden colour of fully transparent pixels does not count | e2e pixel comparison on Chromium, Firefox and WebKit |
>
> — `spec.md §6, NFR, verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:** | `src/render/`             | WebGL2 adjustments, Canvas 2D compositor, export encoder                     | `core`, `shared`                                                        |
>
> — `CLAUDE.md §Module boundaries, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Fixed by this breakdown:** the worker logic sits in a testable `worker-handler.ts` (as the decode worker does) with the canvas factory injected, and `export.worker.ts` is only the entry. The session format check and the main-thread client are T6; this task returns `Result<Blob>` from the handler.
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

### AC-03 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor exports it
> **Then** the file contains the whole Work at the chosen size, regardless of the zoom level or the visible part, and the View is unchanged afterwards
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — error

> **Given** an image is open
> **When** the export fails, for example because the device's graphics were interrupted or the browser cannot produce an image of that size
> **Then** no blank, black or partial file is saved: a file the Editor chose to overwrite in the "Save as…" dialog is left as it was, and an empty file the dialog may have created is not reported as saved. This holds for every refusal after the "Save as…" dialog (AC-01b, AC-12, AC-13, AC-14): the app removes such an empty file when the browser allows, and when it cannot, the notice says that an empty file with that name may be left in the chosen folder. Where the browser itself empties or replaces the chosen file when the dialog closes, so that a file chosen for overwrite can no longer be left as it was, the notice says that the file with that name may now be empty. A notice explains in plain language that the export failed and suggests trying again or choosing a smaller size, and the Work and its Unsaved edits are unchanged
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — error

> **Given** the Work has transparent areas, meaning at least one pixel is not fully opaque, whatever format the Work was opened from
> **When** JPEG is selected in the export panel, whether the Editor chose it or it was preset or remembered (AC-19)
> **Then** the panel says in one line that JPEG has no transparency and transparent areas will become white, and suggests PNG or WebP to keep them. In the exported JPEG every pixel looks as it would on a white background: its colour is opacity × the pixel's colour + (1 − opacity) × white, computed on the stored sRGB values (as the Preview would show it on white), so a fully transparent pixel becomes white. A Work with no transparent pixels shows no such hint
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — domain invariant

> **Given** the opened photo carried embedded metadata such as capture date, camera model or location
> **When** the Editor exports the Work in any format
> **Then** the exported file contains none of that metadata: no capture date, camera, location, author or text comments, and no Exif, XMP, IPTC or text blocks, and no colour profile other than sRGB. Technical blocks the browser's encoder adds that say nothing about the person or the photo (a JFIF header, pixel density, an sRGB marker) are allowed
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Move the Preview's vertex/fragment sources and program build into `src/render/shaders.ts`; `preview-renderer.ts` imports them, its tests stay green
- [ ] Add the JPEG flatten to the shared fragment path as a uniform: colour = premultiplied colour + (1 − opacity) × white, opacity 1 — `src/render/shaders.ts`
- [ ] Write `handleExport({ bitmap, width, height, format, quality })`: WebGL2 `OffscreenCanvas` at the export size, premultiplied texture upload, 1:1 texel-centre sampling at full size and mipmapped trilinear below, upright output — `src/render/export/worker-handler.ts`
- [ ] Encode with `convertToBlob({ type, quality: quality / 100 })`; read the header with `sniffImageHeader`; format ≠ asked or size ≠ requested → `EXPORT_FORMAT_MISMATCH { asked, produced }`; no context, lost context or a rejected encode → `EXPORT_FAILED` — `src/render/export/worker-handler.ts`
- [ ] Close the transferred bitmap in every branch; log stage timings only when `import.meta.env.DEV` — `src/render/export/export.worker.ts`
- [ ] Vitest with `fake-gl` + a fake encoder for every branch — `src/render/export/worker-handler.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| WebGL2 context unavailable in the worker | `EXPORT_FAILED` (sad §11 risk 6), no Blob |
| `webglcontextlost` mid-render | `EXPORT_FAILED` |
| Encoder returns PNG when asked for WebP (Safari) | `EXPORT_FORMAT_MISMATCH { asked: 'webp', produced: 'png' }` |
| Produced dimensions differ from the request | `EXPORT_FORMAT_MISMATCH` |
| Fully transparent pixel exported as JPEG | pure white |
| PNG / WebP of a transparent Work | alpha kept, no flatten |
| Any branch | the bitmap copy is closed exactly once |

## Definition of Done

- [ ] Vitest proves the handler returns a verified Blob, `EXPORT_FAILED` for no/lost context and encode rejection, and `EXPORT_FORMAT_MISMATCH` for a wrong format or size, closing the bitmap each time
- [ ] Vitest proves the flatten uniform is set only for JPEG, and the Preview renderer still passes its tests with the extracted shaders
- [ ] every Hard Rule inlined above still holds (no DOM in the render path; only `core` + `shared` imports)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
