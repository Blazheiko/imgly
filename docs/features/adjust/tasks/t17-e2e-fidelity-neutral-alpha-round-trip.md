---
id: T17
title: "Add the e2e fidelity suite: each slider at its anchors vs Preview, all seven combined, with and without a Geometry, neutral = 0 difference, exact alpha, lossless round trip, smaller sizes"
layer: "tests"
deps: ["T7", "T9"]
blocks: ["T20"]
acs: ["AC-02", "AC-03", "AC-04", "AC-06", "AC-07", "AC-14"]
files_hint: ["e2e/adjust/fidelity.spec.ts", "e2e/adjust/helpers.ts", "e2e/fixtures/"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 69 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T17 — Add the e2e fidelity suite: each slider at its anchors vs Preview, all seven combined, with and without a Geometry, neutral = 0 difference, exact alpha, lossless round trip, smaller sizes

## Place in the sequence

- **Blocked by:** T7 — Send the applied Adjustments to the export worker, set them as uniforms, and reduce smaller adjusted Exports in two passes · T9 — Make PreviewCanvas draw previewAdjustments ?? work.adjustments, and give the e2e hooks setAdjustments and an adjusted previewAt100.
- **Blocks:** T20 — Add the @perf suite: drag frame interval, Apply / Cancel / Reset / Compare-release and tool-ready times, Auto time, memory after 50 Applies, and export time with all seven set.
- **Wave:** 5 — alongside T13.
- **Lane:** shares `e2e/adjust/helpers.ts` with T18; shares `e2e/adjust/helpers.ts` with T19 — serialized.

## Why (user story)

> **US-07: Export what I see after adjusting**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Adjustments I applied  
> **So that** the saved file looks exactly like the Preview, and other tools show the same image
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It proves on real GPUs in all three engines that what the Editor applies is exactly what the Export contains.

## Inlined context

> | Fidelity of an adjusted Export | each pixel of a full-size PNG Export within 2 of 255 per channel of the Preview's own rendering of the Work at 100%, compared as in export §6 | e2e pixel comparison on Chromium, Firefox and WebKit for each slider at −100, −50, +50 and +100 (0%, 50% and 100% for grayscale and sepia) and for one setting with all seven values away from neutral, with and without a Geometry |
> | Neutral values change nothing | difference 0 per channel between a full-size PNG Export with all values neutral and one of the same Work before any Adjustment was applied | e2e pixel comparison on Chromium, Firefox and WebKit |
> | Transparency is kept | 100% of pixels keep their exact transparency at every setting of the fidelity row; an Original with no transparent pixels stays 100% opaque | e2e check on Chromium, Firefox and WebKit |
>
> — `spec.md §6, fidelity / neutral / transparency rows, verbatim` · full text: [spec.md](../spec.md)

> *QG-1c* — **When:** a fixture with fully transparent, partly transparent (alpha 1, 64, 128 and 254) and opaque pixels, and an opaque fixture, are exported at every setting of QG-1a. …
> *QG-1d* — … One e2e fixture renders the anchor colours through the shader on all three engines and compares with the table within 2 of 255. …
> **QG-2** — … for 100% of reference images, applying any Adjustments, then Reset and Apply, gives a full-size PNG Export with a difference of 0 per channel from the Export made before adjusting … AC-07 is covered by … an e2e comparison of two paths to the same values.
>
> — `sad.md §10, QG-1c, QG-1d, QG-2, abridged` · full text: [sad.md](../sad.md)

> The ±2/255 tolerance … may not hold on every engine. … Linux WebKit already needs 3/255 for any Export of a semi-transparent Original, because it renders in the window (export ADR-0003, `e2e/export/fidelity.spec.ts`) | High | … `plan-tests` decides whether semi-transparent fixtures reuse export's per-engine limit on Linux WebKit or stay opaque. The spec's 2/255 stays the target everywhere else, and a miss is a recorded engine deviation, never a silent loosening
>
> — `sad.md §11, fidelity risk, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Drive settings with the T9 hooks (`setAdjustments`, `setGeometry`, `previewAt100`), not the UI. Reuse the comparison and download helpers of `e2e/export/helpers.ts` and `e2e/crop-rotate/helpers.ts` patterns. The smaller-size check (AC-14) compares a reduced adjusted Export with the full-size adjusted Export reduced — its tolerance follows export's open §8 question; record the measured max difference.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — happy path

> **Given** the "Adjust" tool is open on any image
> **When** the Editor moves the brightness or the contrast slider while the other six values are neutral
> **Then** a higher brightness makes the image lighter, so no colour channel of any pixel gets darker, and a lower brightness makes it darker, so no channel gets lighter. A higher contrast makes the parts lighter than mid-grey lighter and the parts darker than mid-grey darker, while mid-grey itself stays the same; a lower contrast moves every tone towards mid-grey. Mid-grey is the stored pixel value 128, 128, 128, which stays 128, 128, 128 at any contrast, and every direction in AC-02 to AC-04 is judged on the stored pixel values
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — happy path

> **Given** the "Adjust" tool is open on any image
> **When** the Editor moves the saturation, temperature or tint slider while the other six values are neutral
> **Then** a higher saturation makes colours more vivid and a lower one moves them towards grey: at −100 every pixel is a shade of grey, with equal red, green and blue. A pixel that is already grey stays the same at any saturation. A higher temperature makes the image warmer, so on a mid-grey image red rises and blue falls, and a lower temperature does the opposite. A higher tint makes the image more magenta, so on a mid-grey image green falls compared with red and blue, and a lower tint makes it greener. Whether pure black and pure white are tinted is left to design (§8)
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the "Adjust" tool is open on any image
> **When** the Editor sets grayscale or sepia to an amount between 0% and 100%
> **Then** the image moves from its colours towards the effect in proportion to the amount. At grayscale 100% and sepia 0%, every pixel has equal red, green and blue, whatever the other values, and each colour keeps its perceived lightness, so a pure yellow becomes a light grey and a pure blue a dark grey. At sepia 100%, every pixel is a brown tone, with red at least as high as green and green at least as high as blue, whatever the other values, grayscale included. Grayscale and sepia act last and override what the other sliders do to colour, so these two rules hold for any combination of values; how the other sliders combine with one another follows the fixed order of AC-07
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — domain invariant

> **Given** an image is open, with or without transparent pixels
> **When** the Editor applies any Adjustments
> **Then** only colours change: every pixel keeps exactly the transparency it has without Adjustments, the Work keeps its size and its Geometry, and an image with no transparent pixels stays fully opaque, in the Preview and in every Export. With all seven values at their neutral values the Work's pixels are exactly the pixels it would have without any Adjustments, because a neutral value changes no pixel. Every colour rule in AC-02 to AC-04 applies to a pixel's colour independent of its transparency: a partly transparent pixel changes colour exactly as the same fully opaque pixel would, so soft edges get no dark or light fringe
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — domain invariant

> **Given** the "Adjust" tool is open
> **When** the Editor reaches the same seven values by different paths, for example setting contrast before brightness or after it, or dragging a slider far out and back
> **Then** the Preview, and the Work after Apply, are exactly the same, because the Adjustments are always applied in one fixed order that does not depend on the order in which the Editor changed them. A colour channel pushed past white or black stays at white or black and never wraps round to the opposite end
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** Adjustments have been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry and its Adjustments, matching the Preview (§6 Fidelity) at full size. An Export at a smaller size is the full-size adjusted Export reduced to that size, so the Adjustments are applied before the size is reduced; its numeric tolerance follows the export spec's open §8 question on smaller sizes. The transparency hint of export AC-15 is shown exactly when it would be without the Adjustments, because they never change transparency (AC-06). An Export never contains a Draft that has not been applied (AC-16)
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Anchor-colour fixture and a semi-transparent fixture — `e2e/fixtures/`
- [ ] Shared helpers (set adjustments, export PNG, pixel diff) — `e2e/adjust/helpers.ts`
- [ ] Fidelity matrix, neutral = 0, alpha exact, anchors within 2/255, two-paths equality, round trip = 0, smaller size after adjusting — `e2e/adjust/fidelity.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Linux WebKit with semi-transparent fixture | per the §11 risk: recorded engine deviation, not a silent loosening |
| Geometry with a Straighten angle | included in "with a Geometry" runs |
| JPEG at smaller size | flatten applied after the adjust pass (visual check of no dark fringe) |

## Definition of Done

- [ ] `pnpm test:e2e e2e/adjust/fidelity.spec.ts` green on Chromium, Firefox and WebKit (any engine deviation recorded in the spec file with its measured value)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
