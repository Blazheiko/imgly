---
id: T3
title: "Implement the open policy: size ceiling, Downscale-limit target size, reduction steps and drop-candidate order"
layer: "domain"
deps: ["T1"]
blocks: ["T5", "T12"]
acs: ["AC-03", "AC-05", "AC-06", "AC-09"]
files_hint: ["src/core/open/"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 62 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Implement the open policy: size ceiling, Downscale-limit target size, reduction steps and drop-candidate order

## Place in the sequence

- **Blocked by:** T1 — Add the open error codes and the header parser for JPEG, PNG/APNG, GIF and the refused formats.
- **Blocks:** T5 — Build the decode worker pipeline and the main-thread decodeImage client with supersede and error mapping, T12 — Add drop sequencing, the messages catalog and the notices raised by each open.
- **Wave:** 2 — after T1 (wave 1).
- **Lane:** own lane.

## Why (user story)

> **US-03: Know when an image was reduced**
>
> **As a** Editor  
> **I want** to be told when my image was reduced to the Downscale limit, and from what size to what size  
> **So that** I know what resolution I am editing and exporting
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It owns the numbers: what is too large to open, what size the Original becomes, and in what order dropped files are tried — all pure and unit-tested.

## Inlined context

> **Size ceiling:** 100 MP, measured as the declared width × height and checked before any decode (AC-09). No separate limit on file size in bytes or on the length of one side: intermediate canvases in the worker never exceed 16 384 px per side, so a very elongated image within the ceiling is reduced in a first, larger step instead of being refused, and a file the browser itself cannot decode ends as AC-08.
>
> — `sad.md §8, Size ceiling row, abridged` · full text: [sad.md](../sad.md)

> `checkOpenPolicy(header)` in `src/core/open/` applies the size ceiling (sad.md §8) to `width × height` and returns `TOO_LARGE` with both sizes in megapixels (AC-09); the target dimensions for the Downscale limit are computed from the upright decoded size.
>
> — `adr/0002 §Decision outcome, How it works bullet 5, verbatim` · full text: [adr/0002-parse-image-headers-in-core-before-decoding.md](../adr/0002-parse-image-headers-in-core-before-decoding.md)

> reduce on an `OffscreenCanvas` 2D context with `imageSmoothingQuality = 'high'`, halving while the image is more than twice the target and finishing with one step to the exact target (long side 4096 px, short side rounded, at least 1 px)
>
> — `adr/0001 §Decision outcome, How it works bullet 2, abridged` · full text: [adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md](../adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md)

> Downscale limit — the maximum length, in pixels, of an image's long side once it is opened (4096 px); larger images are reduced to it proportionally on open.
>
> — `CONTEXT.md §Glossary, Downscale limit, abridged` · full text: [CONTEXT.md](../../../../CONTEXT.md)

> ED->>ED: keeps only files, skipping folders and links
> […] loop each file in browser order, until one is read successfully
>
> — `sad.md §6, Flow 3 steps, abridged` · full text: [sad.md](../sad.md)

> The size ceiling is one constant in `src/core/open/`
>
> — `sad.md §11, mobile memory risk row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** Functional core with feature folders: `src/core/` is pure TypeScript with no Vue, Pinia or DOM; imports flow `features → core | render | infra | shared`; features never import each other and coordinate through the `editor` store — repo ADR 0002
>
> — `sad.md §2, Technical constraints, verbatim (link dropped)` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-03 — error

> **Given** the app is open
> **When** the Editor drops several files at once
> **Then** the files are tried in the order the browser lists them, each judged by its content, and the first one that is read successfully opens (subject to AC-15 and AC-16 when a Work is open). A short notice says the editor works with one image at a time and the other files were ignored. If none of the files can be opened, nothing is replaced and the reason shown is the one for the first image file (or the AC-04 notice when the drop held no image files at all)
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

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

### AC-09 — domain invariant

> **Given** an image whose pixel count exceeds the size ceiling the editor can safely handle
> **When** the Editor tries to open it
> **Then** the editor refuses it based on the width × height the file declares, before decoding its pixels. Nothing is replaced, and a notice states the image's width × height in pixels with its megapixels, and the largest size the editor accepts in megapixels. A file whose declared dimensions can't be read is treated as unreadable (AC-08)
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `SIZE_CEILING_PIXELS = 100_000_000`, `DOWNSCALE_LIMIT = 4096`, `MAX_INTERMEDIATE_SIDE = 16384` — `src/core/open/constants.ts`
- [ ] `checkOpenPolicy(header): Result<ImageHeader, AppError>` → `TOO_LARGE` with `{ width, height, megapixels, ceilingMegapixels }`, megapixels rounded to one decimal — `src/core/open/policy.ts`
- [ ] `targetSize(uprightWidth, uprightHeight): { width, height, downscaled }` — long side → 4096, short side `Math.round`, `Math.max(1, …)` — `src/core/open/target-size.ts`
- [ ] `reductionSteps(source, target): Size[]` — halve while > 2× target, first step capped to 16 384 px per side, last step exactly `target` — same file
- [ ] `orderDropCandidates(items)` — keep files in browser order, count the non-file items, so the store can try them one by one and report the ignored count — `src/core/open/drop.ts`
- [ ] Co-located Vitest suites — `src/core/open/*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Declared exactly 100 000 000 px | accepted (the AC says *exceeds*) |
| Declared 100 000 001 px | `TOO_LARGE`, both sizes in MP |
| 6000×4000 | 4096×2731, `downscaled: true` (AC-05 example) |
| Long side exactly 4096 | unchanged, `downscaled: false` (AC-06) |
| 100000×3 (within ceiling) | 4096×1 — short side never below 1 px; first reduction step ≤ 16 384 px |
| Portrait 3000×6000 | 2048×4096 — long side is the height |
| Drop of 0 files + 2 links | empty candidate list, `nonFileCount: 2` → AC-04 path in T12 |

## Definition of Done

- [ ] Vitest proves the ceiling boundary, the AC-05 example, the ≤1 px floor, portrait inputs and the 16 384 px intermediate cap
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
