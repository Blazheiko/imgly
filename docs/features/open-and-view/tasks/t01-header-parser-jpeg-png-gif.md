---
id: T1
title: "Add the open error codes and the header parser for JPEG, PNG/APNG, GIF and the refused formats"
layer: "domain"
deps: []
blocks: ["T2", "T3", "T9"]
acs: ["AC-07", "AC-08", "AC-11"]
files_hint: ["src/core/result.ts", "src/core/image-header/"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 55 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Add the open error codes and the header parser for JPEG, PNG/APNG, GIF and the refused formats

## Place in the sequence

- **Blocked by:** nothing — can start immediately.
- **Blocks:** T2 — Extend the header parser to WebP, AVIF and HEIC/HEIF and add the property/fuzz test, T3 — Implement the open policy: size ceiling, Downscale-limit target size, reduction steps and drop-candidate order, T9 — Handle WebGL context loss: restore from the kept bitmap within the deadline, else report DISPLAY_LOST.
- **Wave:** 1 — no deps, starts in the first wave.
- **Lane:** shares `src/core/image-header/` with T2 — serialized.

## Why (user story)

> **US-04: Understand why an image won't open**
>
> **As a** Editor  
> **I want** a plain-language reason whenever a file can't be opened or opens differently from how I expect  
> **So that** I know what to do next instead of facing an empty canvas
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It recognises a file by its first bytes, so every later stage can refuse it with the right named reason or know it is animated, before any pixel is decoded. WebP, AVIF and HEIC/HEIF follow in T2.

## Inlined context

> **Chosen:** Option 1. It gives the security review one small, fully visible parser with no third-party code on the untrusted-input path, keeps `core` free of dependencies, and returns exactly the refusal taxonomy the spec needs.
>
> — `adr/0002 §Decision outcome, decision line, verbatim` · full text: [adr/0002-parse-image-headers-in-core-before-decoding.md](../adr/0002-parse-image-headers-in-core-before-decoding.md)

> `sniffImageHeader(bytes: Uint8Array): Result<ImageHeader, AppError>` with `ImageHeader = { format, width, height, animated, exifOrientation }`.
> It reads at most `HEADER_WINDOW_BYTES` (1 MiB). Declared dimensions not found inside the window mean `UNREADABLE` (AC-08). GIF animation detection may skip further through the block structure by length fields only, without decoding.
> Supported formats: JPEG (SOFn marker; EXIF orientation from APP1), PNG and APNG (IHDR; `acTL` means animated), […] GIF (logical screen; more than one image descriptor means animated), […]
> Recognised and refused with their name (AC-07): SVG, BMP, ICO, TIFF and TIFF-based camera RAW/DNG (named together as "TIFF or camera RAW"), other camera RAW signatures, PSD. Anything else is `NOT_AN_IMAGE` (AC-08).
>
> — `adr/0002 §Decision outcome, How it works bullets 1–4, abridged (WebP/AVIF/HEIC cut → T2)` · full text: [adr/0002-parse-image-headers-in-core-before-decoding.md](../adr/0002-parse-image-headers-in-core-before-decoding.md)

> Hardening rules: every read is bounds-checked; no allocation is proportional to a declared size; box and marker walks have iteration caps; hostile input never throws, it returns a `Result`. Unit tests plus a fuzz/property test over truncated and mutated samples.
>
> — `adr/0002 §Decision outcome, How it works bullet 6, verbatim` · full text: [adr/0002-parse-image-headers-in-core-before-decoding.md](../adr/0002-parse-image-headers-in-core-before-decoding.md)

> **Hard rule:** `core` and `infra` return `Result<T, AppError>`; hostile input never throws. New codes: `FILE_NOT_PERMITTED` (AC-10), `NOT_AN_IMAGE`, `UNREADABLE` (declared size not found in the header window) and `DECODE_FAILED` (AC-08, one message), `UNSUPPORTED_FORMAT` with the format name (AC-07), `TOO_LARGE` with both sizes in megapixels (AC-09), `UNSUPPORTED_BROWSER` (AC-18), `DISPLAY_LOST` (AC-19b). The worker posts errors as plain `{ code, details }` objects. A superseded open is not an error: `decodeImage` resolves it as `Superseded` and the store ignores it
>
> — `sad.md §8, Error handling row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** The Original holds pixels only: no EXIF or other metadata is copied into the Work (spec §6.1); the header parser reads orientation and nothing else. No image data, file name or metadata is logged, sent or stored
>
> — `sad.md §8, Privacy row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Functional core with feature folders: `src/core/` is pure TypeScript with no Vue, Pinia or DOM; imports flow `features → core | render | infra | shared`; features never import each other and coordinate through the `editor` store — repo ADR 0002
>
> — `sad.md §2, Technical constraints, verbatim (link dropped)` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

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

### AC-11 — error

> **Given** an animated image
> **When** the Editor opens it
> **Then** its first frame opens as the Original, and a notice says only the first frame is kept
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add the eight new `AppError` codes to `src/core/result.ts` (`FILE_NOT_PERMITTED`, `NOT_AN_IMAGE`, `UNREADABLE`, `DECODE_FAILED`, `UNSUPPORTED_FORMAT` with `details.format`, `TOO_LARGE` with `details.{width,height,megapixels,ceilingMegapixels}`, `UNSUPPORTED_BROWSER`, `DISPLAY_LOST`) — all codes land here so later tasks never re-open the union
- [ ] Define `ImageFormat`, `ImageHeader`, `HEADER_WINDOW_BYTES = 1024 * 1024` — `src/core/image-header/types.ts`
- [ ] Write a bounds-checked big/little-endian byte reader that returns `undefined` past the end instead of throwing — `src/core/image-header/reader.ts`
- [ ] Signature dispatch `sniffImageHeader` — `src/core/image-header/index.ts`
- [ ] JPEG: walk markers with an iteration cap to the first SOFn (width/height); read EXIF orientation (tag `0x0112`) from APP1, default 1, out-of-range → 1 — `src/core/image-header/jpeg.ts`
- [ ] PNG/APNG: IHDR size; `acTL` before the first `IDAT` → `animated: true` — `src/core/image-header/png.ts`
- [ ] GIF: logical screen size; count image descriptors by skipping blocks via length fields only, stop at 2 → animated — `src/core/image-header/gif.ts`
- [ ] Refused signatures → `UNSUPPORTED_FORMAT` with the display name: SVG (`<svg` / `<?xml … <svg` in the first bytes), BMP, ICO, TIFF (`II*\0` / `MM\0*`) as "TIFF or camera RAW", PSD (`8BPS`), other camera RAW signatures; anything else `NOT_AN_IMAGE` — `src/core/image-header/refused.ts`
- [ ] Co-located Vitest suites with byte-array fixtures built in the test (no binary files needed) — `src/core/image-header/*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Empty or 3-byte input | `NOT_AN_IMAGE`, no throw |
| JPEG truncated before its SOFn marker | `UNREADABLE` (shown as the AC-08 message) |
| JPEG with > 1 MiB of metadata before SOFn | `UNREADABLE` — accepted risk, sad.md §11 |
| PNG bytes in a file named `.jpg` | `format: 'png'` — the name is never read (AC-08) |
| EXIF orientation tag missing or outside 1–8 | `exifOrientation: 1` |
| GIF with a single image descriptor | `animated: false` |
| Marker/segment length pointing past the window | `UNREADABLE`, the walk stops; no allocation by declared length |
| Animated GIF whose second descriptor lies beyond the window | `animated: false` (first frame is all that opens anyway) |

## Definition of Done

- [ ] Vitest suites for JPEG, PNG/APNG, GIF and every refused signature pass, including the truncated and mis-named cases above
- [ ] No test input makes `sniffImageHeader` throw
- [ ] `src/core/` still imports nothing from Vue, Pinia, DOM or other `src/*` modules (S4 lint rule passes)
