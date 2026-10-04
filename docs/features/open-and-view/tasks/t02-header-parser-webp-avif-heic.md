---
id: T2
title: "Extend the header parser to WebP, AVIF and HEIC/HEIF and add the property/fuzz test"
layer: "domain"
deps: ["T1"]
blocks: ["T5"]
acs: ["AC-07", "AC-08", "AC-09"]
files_hint: ["src/core/image-header/"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 52 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Extend the header parser to WebP, AVIF and HEIC/HEIF and add the property/fuzz test

## Place in the sequence

- **Blocked by:** T1 — Add the open error codes and the header parser for JPEG, PNG/APNG, GIF and the refused formats.
- **Blocks:** T5 — Build the decode worker pipeline and the main-thread decodeImage client with supersede and error mapping.
- **Wave:** 2 — after T1 (wave 1).
- **Lane:** shares `src/core/image-header/` with T1 — serialized.

## Why (user story)

> **US-04: Understand why an image won't open**
>
> **As a** Editor  
> **I want** a plain-language reason whenever a file can't be opened or opens differently from how I expect  
> **So that** I know what to do next instead of facing an empty canvas
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It completes the content judgement for the remaining Supported formats and proves the parser cannot be hung, crashed or made to allocate by hostile bytes — the decompression-bomb defence starts here.

## Inlined context

> Supported formats: […] WebP (VP8, VP8L, VP8X with the animation flag), […] AVIF (`ftyp` avif/avis; `ispe`), HEIC/HEIF (`ftyp` heic/heix/mif1/msf1; `ispe`).
>
> — `adr/0002 §Decision outcome, How it works bullet 3, abridged (JPEG/PNG/GIF done in T1)` · full text: [adr/0002-parse-image-headers-in-core-before-decoding.md](../adr/0002-parse-image-headers-in-core-before-decoding.md)

> Hardening rules: every read is bounds-checked; no allocation is proportional to a declared size; box and marker walks have iteration caps; hostile input never throws, it returns a `Result`. Unit tests plus a fuzz/property test over truncated and mutated samples.
>
> — `adr/0002 §Decision outcome, How it works bullet 6, verbatim` · full text: [adr/0002-parse-image-headers-in-core-before-decoding.md](../adr/0002-parse-image-headers-in-core-before-decoding.md)

> HEIC counts as a Supported image only where the worker's probe found that this browser decodes it; elsewhere it takes the first branch.
>
> — `sad.md §6, Flow 4 note, verbatim` · full text: [sad.md](../sad.md)

> Vitest units with the fixture set for `sniffImageHeader` and `checkOpenPolicy`, plus a property test over truncated and mutated samples asserting that it always returns a `Result`, never throws and never allocates in proportion to a declared size (ADR-0002).
>
> — `sad.md §10, QG-2 How verify, abridged` · full text: [sad.md](../sad.md)

> The hand-written header parser is the only code reading untrusted bytes; a bug could hang the worker or misjudge a file | Medium | Bounds-checked reads, iteration caps and no allocation proportional to a declared size; property and fuzz tests over truncated and mutated samples (ADR-0002, §10 QG-2); mandatory security review before ship
>
> — `sad.md §11, risk row 2, abridged` · full text: [sad.md](../sad.md)

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

### AC-09 — domain invariant

> **Given** an image whose pixel count exceeds the size ceiling the editor can safely handle
> **When** the Editor tries to open it
> **Then** the editor refuses it based on the width × height the file declares, before decoding its pixels. Nothing is replaced, and a notice states the image's width × height in pixels with its megapixels, and the largest size the editor accepts in megapixels. A file whose declared dimensions can't be read is treated as unreadable (AC-08)
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] WebP: RIFF/`WEBP` container; VP8 (frame header), VP8L (14-bit packed size), VP8X (canvas size + animation flag) — `src/core/image-header/webp.ts`
- [ ] ISOBMFF box walker with an iteration cap and depth cap; handle `size == 0` (to end of window) and `size == 1` (64-bit largesize, bounded by the window) — `src/core/image-header/isobmff.ts`
- [ ] AVIF: `ftyp` brands `avif` / `avis` (`avis` → `animated: true`); size from `meta › iprp › ipco › ispe` — same file
- [ ] HEIC/HEIF: `ftyp` brands `heic` / `heix` / `mif1` / `msf1`; size from `ispe`; returned as `format: 'heic'` (recognised, not refused — support is decided by the worker probe in T6)
- [ ] Property/fuzz suite: every fixture truncated at every length and with seeded random byte mutations returns a `Result`, never throws, finishes under a fixed time budget — `src/core/image-header/fuzz.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `ispe` missing inside the window | `UNREADABLE` |
| Box size larger than the remaining window | `UNREADABLE`, no allocation |
| Box walk exceeds its iteration cap (crafted loop) | `UNREADABLE` |
| WebP VP8X with animation flag set | `animated: true` |
| HEIC file | `format: 'heic'` with declared size — never refused by the parser |
| Declared size 50000×50000 in a 200-byte file | parser returns the declared size; the ceiling refusal is T3's `checkOpenPolicy` |

## Definition of Done

- [ ] Vitest suites for WebP (VP8/VP8L/VP8X), AVIF, AVIS and HEIC fixtures pass
- [ ] Fuzz suite passes: no throw, no hang, no allocation proportional to a declared size
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
