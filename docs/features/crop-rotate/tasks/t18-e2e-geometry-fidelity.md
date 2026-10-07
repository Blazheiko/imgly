---
id: T18
title: "Add the e2e Geometry fidelity suite: 16 Rotation × Flip, straightened vs Preview, opacity, nothing outside the Crop, lossless round trip"
layer: "tests"
deps: ["T9", "T10"]
blocks: ["T20"]
acs: ["AC-03", "AC-04", "AC-06", "AC-12", "AC-14"]
files_hint: ["e2e/crop-rotate/fidelity.spec.ts", "e2e/crop-rotate/helpers.ts", "e2e/fixtures/"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 66 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T18 — Add the e2e Geometry fidelity suite: 16 Rotation × Flip, straightened vs Preview, opacity, nothing outside the Crop, lossless round trip

## Place in the sequence

- **Blocked by:** T9 — Make the Preview and the status bar follow the Geometry, and add the setGeometry test hook · T10 — Size the export from workSize, send the Geometry, and base the transparency hint on the GPU check.
- **Blocks:** T20 — Add the @perf suite: drag and slider frame interval, action-to-Preview and tool-ready times, memory after 50 Applies, export time with a Geometry.
- **Wave:** 6 — alongside T11, T14, T15, T16.
- **Lane:** shares `e2e/crop-rotate/helpers.ts` with T19; shares `e2e/crop-rotate/helpers.ts` with T20 — serialized.

Runs without the tool UI: it sets Geometries through `window.__imglyTest.setGeometry` (T9), so it starts as soon as the Preview, the status bar and the export store follow the Geometry.

## Why (user story)

> **US-08: Export what I see after cropping**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Geometry I applied  
> **So that** the saved file, its size and the warnings I get match the cropped and rotated image
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It proves on real GPUs in all three engines that what is applied is exactly what every Export contains.

## Inlined context

> | Fidelity of Rotation, Flip and Crop without a Straighten angle | each pixel of a full-size PNG Export is within 2 of 255 per channel of the Original pixel it comes from | e2e pixel comparison on Chromium, Firefox and WebKit for all 16 Rotation × Flip combinations (4 Rotations × no Flip, horizontal, vertical, both), with and without a Crop |
> | Fidelity with a Straighten angle | full-size PNG Export within 2 of 255 per channel of the Preview's own rendering of the Work at 100%, compared as in export §6 | e2e pixel comparison on Chromium, Firefox and WebKit at −45°, −0.1°, +1° and +45° |
> | Opaque images stay opaque | 100% of pixels fully opaque after any Straighten angle, for an Original with no transparent pixels | e2e check on Chromium, Firefox and WebKit at the same angles |
>
> — `spec.md §6, NFR rows 5–7, verbatim` · full text: [spec.md](../spec.md)

> - **Lossless round trip** — baseline: 0, target: for 100% of reference images, applying a Crop, then Reset and Apply, gives a full-size PNG Export within 2 of 255 per channel of the Export made before the Crop, by ship.
>
> — `spec.md §7, KPI 3, verbatim` · full text: [spec.md](../spec.md)

> *QG-1a* How verify: … A test hook sets each Geometry directly (§8). The test decodes the Export and compares every pixel with the Original pixel that `core`'s inverse mapping names, which is computed independently in the test, not by the shader.
> *QG-1b* How verify: e2e pixel comparison on Chromium, Firefox and WebKit at those four angles, reading back the Preview at 100% through the existing test hook (export sad.md §10). An alpha check runs on the same Exports. The Crop's edge pixels are included, not masked out (spec §8 open question, §11).
> *QG-1c* When: a Work whose Original has a distinctly coloured band outside the Crop is exported, with and without a Straighten angle. Then: the Export contains no pixel from outside the Crop (AC-14), and its size is exactly the Crop's width and height shown in the tool (AC-09). How verify: e2e on all three engines: assert the Export's dimensions, and that no pixel has the band's colour.
>
> — `sad.md §10, QG-1a/1b/1c, abridged` · full text: [sad.md](../sad.md)

> **Hard rule (tolerance):** Linux WebKit already needs 3/255 for any Export of a semi-transparent Original … `plan-tests` decides whether QG-1a, QG-1b and QG-2 reuse export's per-engine limit for semi-transparent fixtures on Linux WebKit or keep those fixtures opaque; the spec's 2/255 stays the target everywhere else. A miss is a recorded engine deviation, never a silent loosening of the spec
>
> — `sad.md §11, risk row 1, abridged` · full text: [sad.md](../sad.md)

> e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions (Tests), verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Reuse `e2e/export/helpers.ts` (open a fixture, export to a buffer, decode) and `fidelity.spec.ts`'s per-engine tolerance pattern; `previewAt100` and `originalPixel` hooks exist in `src/app/test-hooks.ts`. Follow `plan-tests`' decision on fixtures (spec §8 OQ 2) if it exists by then; otherwise use opaque fixtures and record any engine deviation.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-03 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor chooses rotate clockwise or rotate counter-clockwise
> **Then** the image turns by exactly 90° in that direction, and the crop frame turns with it, so the same part of the photo stays inside the frame. The width and height of the image and of the frame swap, and a locked proportion turns with it (4:3 becomes 3:4). Four turns in the same direction, or one turn each way, give back the Geometry from before. A Rotation keeps every pixel: nothing is resampled or lost
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the "Crop and rotate" tool is open, with any Rotation
> **When** the Editor chooses flip horizontal or flip vertical
> **Then** the image is mirrored as it is currently shown on screen, so flip horizontal always swaps left and right as the Editor sees them, whatever the Rotation, and the crop frame is mirrored with it, keeping the same part of the photo inside. A Flip also changes the sign of the Straighten angle, so a level horizon stays level: an image straightened by +5° shows −5° on the slider after a Flip. Flipping twice the same way gives back the Geometry from before, and a Flip keeps every pixel
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — domain invariant

> **Given** the "Crop and rotate" tool is open on any image
> **When** the Editor sets any Straighten angle
> **Then** the crop frame shrinks automatically around its own centre, keeping its proportions, to the largest size that lies fully inside the turned image, so no empty corner can enter the Work. Its width and height round down to whole pixels. The centre stays where it was; it moves only when the centre itself would fall outside the turned image, and then to the nearest point inside it. When the angle moves back towards 0°, the frame does not grow back by itself; the Editor can widen it again. When the Original has no transparent pixels, every pixel of the Work stays fully opaque, in the Preview and in every Export
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — domain invariant

> **Given** a Crop was applied earlier to the open Work
> **When** the Editor opens the "Crop and rotate" tool again
> **Then** the tool shows the whole image with the current Rotation, Flip and Straighten angle, and the crop frame where the Crop is, so the Editor can widen it. Widening the frame back to the whole image and applying gives exactly the pixels the Work had before the Crop, because the Geometry never removes pixels from the Original. Reset in the tool returns to no Geometry (no Rotation, no Flip, a Straighten angle of 0° and the Crop covering the whole image), sets the proportion to Free, and takes effect only on Apply
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** a Geometry has been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry, matching the Preview (§6 Fidelity), and no pixel from outside the Crop. The Work's full size in the export panel is the Crop's size in pixels; the size presets and the long-side field of export AC-05 and AC-06 count from it, and a remembered size larger than the new Work snaps to it. Snapping does not replace the remembered size: a remembered long side in pixels comes back, up to the Work's full size, when the Crop is widened again. The transparency hint of export AC-15 is shown only when a pixel inside the Crop is not fully opaque. The size shown for the Work in the status bar is the Crop's size, with the Original's dimensions next to it as in AC-01
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

This task proves the pixel halves: lossless turns/flips (AC-03, AC-04), opacity (AC-06), the widen-back/Reset round trip (AC-12) and AC-14's "matching the Preview, no pixel from outside the Crop".

## Checklist

- [ ] Helpers: `setGeometry` via hook, export full-size PNG to a buffer, decode, independent inverse mapping — `e2e/crop-rotate/helpers.ts`
- [ ] QG-1a: 16 combos × {no Crop, Crop} vs the Original — `e2e/crop-rotate/fidelity.spec.ts`
- [ ] QG-1b + opacity: four angles vs `previewAt100`, alpha all 255 — same file
- [ ] QG-1c: banded fixture, with and without an angle; dimensions = Crop — same file (+ a generated fixture in `e2e/fixtures/` via `generate.sh` if needed)
- [ ] QG-2: Crop → Reset → Apply round trip — same file

## Edge cases

| Case | Behaviour |
|---|---|
| Crop 1 px wide at the right edge, rotation 270 + flipV | exact pixel match |
| +45° on a non-square Original | Crop edge pixels included in the comparison |
| Engine needs a wider tolerance | recorded as an engine deviation (per `plan-tests`), never silently loosened |
| Transparent fixture | only if `plan-tests` chose it; otherwise opaque |

## Definition of Done

- [ ] `pnpm test:e2e e2e/crop-rotate/fidelity.spec.ts` passes on Chromium, Firefox and WebKit
- [ ] Every comparison uses an independently computed expected pixel, not the shader's mapping
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
