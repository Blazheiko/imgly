---
id: T5
title: "Build the decode worker pipeline and the main-thread decodeImage client with supersede and error mapping"
layer: "infra"
deps: ["T2", "T3"]
blocks: ["T6", "T11", "T18"]
acs: ["AC-05", "AC-06", "AC-08", "AC-09", "AC-10", "AC-16b"]
files_hint: ["src/infra/image-decode/"]
owner: "Blazheiko"
estimate: "L"
context_budget: "M"   # measured: 88 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Build the decode worker pipeline and the main-thread decodeImage client with supersede and error mapping

## Place in the sequence

- **Blocked by:** T2 — Extend the header parser to WebP, AVIF and HEIC/HEIF and add the property/fuzz test, T3 — Implement the open policy: size ceiling, Downscale-limit target size, reduction steps and drop-candidate order.
- **Blocks:** T6 — Add the worker's orientation and HEIC capability probes and the EXIF-orientation fallback, T11 — Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions, T18 — Precache the decode worker for offline opens, run e2e on three engines in CI, and record the widened rules.
- **Wave:** 3 — after T2, T3 (wave 2).
- **Lane:** shares `src/infra/image-decode/` with T6, T20 — serialized.

## Why (user story)

> **US-01: Open an image from disk**
>
> **As a** Editor  
> **I want** to choose an image file from my computer with an "Open image" action  
> **So that** I can start editing it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **US-03: Know when an image was reduced**
>
> **As a** Editor  
> **I want** to be told when my image was reduced to the Downscale limit, and from what size to what size  
> **So that** I know what resolution I am editing and exporting
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It turns a chosen or dropped `Blob` into a finished, upright-as-decoded, sRGB, downscaled `ImageBitmap` with its facts — off the main thread, cancellable, and with every failure typed.

## Inlined context

> **Chosen:** Option 1. It is the only option that keeps the heavy reduction off the main thread in all three target browsers and that can really cancel a superseded open: terminating the worker frees its decode memory at once.
>
> — `adr/0001 §Decision outcome, decision line, abridged` · full text: [adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md](../adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md)

> `src/infra/image-decode/` exposes `decodeImage(file): Promise<Result<DecodedImage, AppError> | Superseded>` on the main thread and owns `decode.worker.ts` (a module worker bundled by Vite). One worker serves one open; a new open terminates the previous worker, and the superseded promise resolves as `Superseded`, which the caller ignores.
> Inside the worker: read the header window (`file.slice(0, HEADER_WINDOW_BYTES)`) → `sniffImageHeader` + the open policy from `src/core` (ADR-0002; ceiling check before any decode) → `createImageBitmap(file, { imageOrientation: 'from-image', colorSpaceConversion: 'default' })` (sRGB per ADR-0004) → apply EXIF orientation only when the browser did not (see the probe below) → reduce on an `OffscreenCanvas` 2D context with `imageSmoothingQuality = 'high'`, halving while the image is more than twice the target and finishing with one step to the exact target (long side 4096 px, short side rounded, at least 1 px) → `transferToImageBitmap()` → post the bitmap as a transferable together with the facts (`sourceWidth`, `sourceHeight`, `width`, `height`, `format`, `animated`, `downscaled`). Every intermediate bitmap is `close()`d.
> File read refusals (`NotReadableError`, `NotFoundError`, `SecurityError`) become `FILE_NOT_PERMITTED` (AC-10); every other failure maps to a typed `AppError` code (sad.md §8).
>
> — `adr/0001 §Decision outcome, How it works bullets 1, 2, 4, verbatim (probes → T6)` · full text: [adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md](../adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md)

> the decode worker calls `createImageBitmap` with `colorSpaceConversion: 'default'`, so the browser applies the file's embedded profile and produces sRGB pixels (ADR-0001). The `OffscreenCanvas` and the WebGL2 drawing buffer keep their default sRGB colour space. Files without a profile are treated as sRGB.
>
> — `adr/0004 §Decision outcome, How it works, verbatim` · full text: [adr/0004-convert-every-original-to-srgb-on-open.md](../adr/0004-convert-every-original-to-srgb-on-open.md)

> Vite emits the decode worker as a separate hashed module script (`new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' })`)
>
> — `sad.md §7, Deployment view, abridged` · full text: [sad.md](../sad.md)

> Decision override: the decode worker in `src/infra/image-decode/` calls pure `core` functions (`sniffImageHeader`, `checkOpenPolicy`, the target-size maths), not only `core` types. This widens the repo rule "`infra → core` (types only)" (repo ADR 0002, `docs/architecture-map.md` §Module inventory) to "types and pure, side-effect-free functions" — rationale: the worker must run exactly the checks the unit tests cover, so the security review reads one parser in one place (ADR-0001, ADR-0002).
>
> — `sad.md §1, Decision override 1, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Every `ImageBitmap` is `close()`d as soon as it is no longer needed: intermediates in the worker, the new bitmap on a cancelled replace, the old Original after a replace. The old texture is deleted after the new one is uploaded (§6, flow 1). Each open's worker is terminated when its result arrives or when a newer open starts. Exactly one Original (bitmap + texture) is retained while a Work is open
>
> — `sad.md §8, Resource lifetime row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Latest open wins: the store gives every open an increasing id and accepts a result only if its id is still the latest; the previous worker is terminated at once (AC-16b). The View stays live during an open; the Work is swapped in one synchronous store action
>
> — `sad.md §8, Concurrency row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** `core` and `infra` return `Result<T, AppError>`; hostile input never throws. New codes: `FILE_NOT_PERMITTED` (AC-10), `NOT_AN_IMAGE`, `UNREADABLE` (declared size not found in the header window) and `DECODE_FAILED` (AC-08, one message), `UNSUPPORTED_FORMAT` with the format name (AC-07), `TOO_LARGE` with both sizes in megapixels (AC-09), `UNSUPPORTED_BROWSER` (AC-18), `DISPLAY_LOST` (AC-19b). The worker posts errors as plain `{ code, details }` objects. A superseded open is not an error: `decodeImage` resolves it as `Superseded` and the store ignores it
>
> — `sad.md §8, Error handling row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** The Original holds pixels only: no EXIF or other metadata is copied into the Work (spec §6.1); the header parser reads orientation and nothing else. No image data, file name or metadata is logged, sent or stored
>
> — `sad.md §8, Privacy row, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

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

### AC-16b — cross-context

> **Given** an image is still being read after the Editor chose or dropped it
> **When** the Editor chooses or drops another file before that read finishes
> **Then** the earlier open is abandoned and never replaces the Work. Only the most recently chosen file can open. While a read is in progress, the current Work stays on screen and can still be zoomed and panned
>
> — `spec.md §5, AC-16b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Types: `DecodedImage = { bitmap, sourceWidth, sourceHeight, width, height, format, animated, downscaled }`, `Superseded` sentinel, worker request/response message shapes (errors as plain `{ code, details }`) — `src/infra/image-decode/types.ts`
- [ ] Pure `mapReadError(name: string): AppErrorCode` (`NotReadableError` / `NotFoundError` / `SecurityError` → `FILE_NOT_PERMITTED`) — `src/infra/image-decode/errors.ts`
- [ ] Worker: header window → `sniffImageHeader` → `checkOpenPolicy` → `createImageBitmap(file, { imageOrientation: 'from-image', colorSpaceConversion: 'default' })` (decode failure → `DECODE_FAILED`; HEIC failure also `DECODE_FAILED` until T6) → `targetSize` + `reductionSteps` on `OffscreenCanvas` (`imageSmoothingQuality = 'high'`), closing each intermediate → transfer — `src/infra/image-decode/decode.worker.ts`
- [ ] Client `decodeImage(blob)`: one worker per call created with `new URL('./decode.worker.ts', import.meta.url)`; a new call terminates the previous worker and resolves its promise as `Superseded`; terminate on result — `src/infra/image-decode/index.ts`
- [ ] Development builds only: log stage timings to the console (sad.md §8 Logging) — never file names or pixels
- [ ] Vitest: client with a fake `Worker` (supersede, terminate on result, error passthrough), `mapReadError`, message (de)serialisation — `src/infra/image-decode/*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Second `decodeImage` before the first resolves | first worker terminated, first promise → `Superseded` (AC-16b) |
| Cloud placeholder / permission refused on `file.slice().arrayBuffer()` | `FILE_NOT_PERMITTED` (AC-10) |
| Header says PNG but bytes are truncated | `createImageBitmap` rejects → `DECODE_FAILED` (AC-08) |
| Declared size above 100 MP | `TOO_LARGE` returned before `createImageBitmap` is called (AC-09) |
| Long side ≤ 4096 | no reduction step, `downscaled: false` (AC-06) |
| Worker script fails to load / `error` event | `DECODE_FAILED`; worker terminated; no raw error text in `details` |
| Animated GIF/WebP/APNG | `createImageBitmap` yields frame 1; `animated: true` passed through (AC-11 notice in T12) |

## Definition of Done

- [ ] Vitest suites for the client (supersede + terminate), `mapReadError` and the message shapes pass
- [ ] The real worker path (decode, downscale, refusal codes) is asserted end-to-end in T19's reference-set e2e — happy-dom has no `createImageBitmap` (adr/0001 §Consequences)
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
