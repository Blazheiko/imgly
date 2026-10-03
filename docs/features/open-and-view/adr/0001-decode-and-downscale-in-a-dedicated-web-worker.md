---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-03"
feature_size: "M"
ticket: "roadmap step 2 — open-and-view"
---

# 0001 — Decode, orient and downscale every opened image in a dedicated Web Worker

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

Opening an image means reading an untrusted file completely, checking it, decoding it, turning it upright and reducing it to the Downscale limit (4096 px) before it may replace the open Work (sad.md §3, §4). A 48 MP photo decodes to about 190 MB of pixels, and reducing it is heavy pixel work. The spec caps the longest interface freeze while opening at 200 ms and requires that a newer open abandons an older, unfinished one (AC-16b). The app is static with no special response headers, so `SharedArrayBuffer` is unavailable and data crosses threads only by copy or transfer (sad.md §2).

## Decision drivers

- spec §6: longest interface freeze while opening any accepted image ≤ 200 ms (loading indicator keeps animating)
- spec §6: time to first Preview p95 ≤ 1.5 s (12 MP JPEG) and ≤ 3 s (48 MP JPEG, downscale path)
- spec §6: memory after 10 consecutive opens of the 48 MP image ≤ 110% of memory after the first open
- spec AC-16b: only the most recently chosen file can open; the current Work stays zoomable and pannable meanwhile
- sad.md §2: browser decoders only; latest Chromium, Firefox and Safari; no `SharedArrayBuffer`
- sad.md §1 quality goals 1 (open responsiveness) and 2 (Work integrity under untrusted input)

## Considered options

1. **Dedicated Web Worker** — a worker receives the `File`, runs read → header check → `createImageBitmap` decode → orientation → stepwise downscale on an `OffscreenCanvas`, and transfers the finished `ImageBitmap` back.
2. **Main thread with `createImageBitmap`** — the store calls `createImageBitmap(file)` directly and reduces it with its resize options or a `drawImage` onto a regular canvas.
3. **Worker with WebCodecs `ImageDecoder`** — as option 1, but decoding through `ImageDecoder` for explicit frame and cancellation control.

## Decision outcome

**Chosen:** Option 1. It is the only option that keeps the heavy reduction off the main thread in all three target browsers and that can really cancel a superseded open: terminating the worker frees its decode memory at once. Option 2 blocks the main thread for hundreds of milliseconds on a 48 MP `drawImage`, and its resize options are supported unevenly and ignored silently. Option 3 is not available in all three target browsers, so it would need option 1 as a fallback anyway.

How it works:

- `src/infra/image-decode/` exposes `decodeImage(file): Promise<Result<DecodedImage, AppError> | Superseded>` on the main thread and owns `decode.worker.ts` (a module worker bundled by Vite). One worker serves one open; a new open terminates the previous worker, and the superseded promise resolves as `Superseded`, which the caller ignores.
- Inside the worker: read the header window (`file.slice(0, HEADER_WINDOW_BYTES)`) → `sniffImageHeader` + the open policy from `src/core` (ADR-0002; ceiling check before any decode) → `createImageBitmap(file, { imageOrientation: 'from-image', colorSpaceConversion: 'default' })` (sRGB per ADR-0004) → apply EXIF orientation only when the browser did not (see the probe below) → reduce on an `OffscreenCanvas` 2D context with `imageSmoothingQuality = 'high'`, halving while the image is more than twice the target and finishing with one step to the exact target (long side 4096 px, short side rounded, at least 1 px) → `transferToImageBitmap()` → post the bitmap as a transferable together with the facts (`sourceWidth`, `sourceHeight`, `width`, `height`, `format`, `animated`, `downscaled`). Every intermediate bitmap is `close()`d.
- **Capability probes**, run once per session in the worker: decoding an embedded 2×1 px JPEG tagged with EXIF orientation 6 tells whether the browser applies orientation itself (a 1×2 result) or the worker must; decoding an embedded tiny HEIC tells whether this browser decodes HEIC/HEIF, so that a HEIC decode failure is reported as "not supported here" (AC-07) in a browser without support and as "could not be read" (AC-08) in one with support.
- File read refusals (`NotReadableError`, `NotFoundError`, `SecurityError`) become `FILE_NOT_PERMITTED` (AC-10); every other failure maps to a typed `AppError` code (sad.md §8).

## Consequences

**Positive**
- The main thread only posts a message and later uploads one texture, so the ≤ 200 ms freeze budget is spent on the texture upload and first draw, not on decoding.
- AC-16b is a real cancel, not an ignored result: the superseded worker and all its pixel memory disappear immediately.
- One entry point for every future intake: paste and "Open with…" (roadmap step 10) and gallery re-open (step 8) hand a `Blob` to the same `decodeImage`.
- The pure parts (header parsing, ceiling and target-size math) stay in `src/core` and are unit-tested without a browser.

**Negative**
- About 100–150 lines of message plumbing, and a worker start-up of a few tens of milliseconds on every open.
- Peak memory during an open is the full decoded size inside the worker (up to the size ceiling × 4 bytes), which is why the size ceiling (sad.md §8) matters.
- `createImageBitmap`, `OffscreenCanvas` and worker behaviour cannot be exercised in happy-dom; they are covered by Playwright e2e only.
- The worker script is a separate build asset that the service worker must precache for offline opens (sad.md §7).

**Neutral**
- Switching the decoder to `ImageDecoder` later is internal to `decode.worker.ts`; callers keep the same `decodeImage` contract.

## Links

- Spec: [[../spec.md]] §6, AC-07, AC-10, AC-16b
- SAD: [[../sad.md]] §4
- Related ADR: [[0002-parse-image-headers-in-core-before-decoding]], [[0004-convert-every-original-to-srgb-on-open]]
