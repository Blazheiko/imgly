---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-03"
feature_size: "M"
ticket: "roadmap step 2 — open-and-view"
---

# 0002 — Judge every file by a pure-TypeScript header parser in core before any decoding

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The spec requires that a file is judged by its content, not its name (AC-08); that an image above the size ceiling is refused from the width × height it declares, before its pixels are decoded (AC-09, the decompression-bomb abuse case); that a recognised but unsupported format is named (AC-07); that an animated image keeps its first frame with a notice (AC-11); and that 8 of 8 EXIF orientation test images display upright (spec §7). All of this is answered by the first bytes of the file. This is the only code in the app that interprets untrusted bytes, and the security review is mandatory (spec §6.1).

## Decision drivers

- spec §6.1 abuse cases: decompression bomb, malformed or hostile file, disguised file type
- spec AC-09: refuse based on declared width × height before decoding; unreadable declared dimensions count as unreadable (AC-08)
- spec AC-07: name SVG, BMP, ICO, TIFF, camera RAW/DNG, PSD and HEIC/HEIF where unsupported
- sad.md §2: `src/core` is pure TypeScript and unit-tested without a browser (repo ADR 0002)
- sad.md §1 quality goal 2 (Work integrity under untrusted input)

## Considered options

1. **Own parser in `src/core/image-header/`** — pure functions over a byte window that return format, declared dimensions, animation and orientation, or a typed error.
2. **npm libraries** — `file-type` for the signature and `image-size` for dimensions, with animation and orientation detection written on top.

## Decision outcome

**Chosen:** Option 1. It gives the security review one small, fully visible parser with no third-party code on the untrusted-input path, keeps `core` free of dependencies, and returns exactly the refusal taxonomy the spec needs. Option 2 covers more formats with less code, but adds two dependencies that parse hostile bytes, partly targets Node, and reports formats in its own taxonomy that would still need mapping to our reasons.

How it works:

- `sniffImageHeader(bytes: Uint8Array): Result<ImageHeader, AppError>` with `ImageHeader = { format, width, height, animated, exifOrientation }`.
- It reads at most `HEADER_WINDOW_BYTES` (1 MiB). Declared dimensions not found inside the window mean `UNREADABLE` (AC-08). GIF animation detection may skip further through the block structure by length fields only, without decoding.
- Supported formats: JPEG (SOFn marker; EXIF orientation from APP1), PNG and APNG (IHDR; `acTL` means animated), WebP (VP8, VP8L, VP8X with the animation flag), GIF (logical screen; more than one image descriptor means animated), AVIF (`ftyp` avif/avis; `ispe`), HEIC/HEIF (`ftyp` heic/heix/mif1/msf1; `ispe`).
- Recognised and refused with their name (AC-07): SVG, BMP, ICO, TIFF and TIFF-based camera RAW/DNG (named together as "TIFF or camera RAW"), other camera RAW signatures, PSD. Anything else is `NOT_AN_IMAGE` (AC-08).
- `checkOpenPolicy(header)` in `src/core/open/` applies the size ceiling (sad.md §8) to `width × height` and returns `TOO_LARGE` with both sizes in megapixels (AC-09); the target dimensions for the Downscale limit are computed from the upright decoded size.
- Hardening rules: every read is bounds-checked; no allocation is proportional to a declared size; box and marker walks have iteration caps; hostile input never throws, it returns a `Result`. Unit tests plus a fuzz/property test over truncated and mutated samples.

## Consequences

**Positive**
- The whole refusal path (AC-07, AC-08, AC-09, AC-11) is unit-tested in Vitest with a fixture set, no browser needed.
- One small, auditable place for the security review; no dependency on the untrusted-input path.
- The same parser serves every later intake (paste, "Open with…", gallery re-open).

**Negative**
- About 400–600 lines of format-specific code plus a fixture set to maintain.
- An unusual but valid file can be refused, for example a JPEG with more than 1 MiB of metadata before its frame header; that is accepted as a risk in sad.md §11.
- TIFF and TIFF-based RAW share a signature, so the AC-07 notice names them together rather than precisely.

**Neutral**
- Replacing the internals with a library later is local to `src/core/image-header/`; callers keep the same `Result` contract.

## Links

- Spec: [[../spec.md]] §6.1, AC-07, AC-08, AC-09, AC-11, §7
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-decode-and-downscale-in-a-dedicated-web-worker]]
