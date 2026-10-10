---
id: T17
title: "Add the e2e fidelity suite: reference drawing vs Preview at 100% for each Geometry case and with Adjustments, empty layer = 0, Geometry round trips = 0, image pixels unchanged outside marks, smaller sizes and the transparency hint"
layer: "tests"
deps: ["T8", "T10"]
blocks: ["T20"]
acs: ["AC-07", "AC-08", "AC-10", "AC-11"]
files_hint: ["e2e/draw/fidelity.spec.ts", "e2e/draw/helpers.ts", "e2e/fixtures/README.md"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 53 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T17 — Add the e2e fidelity suite: reference drawing vs Preview at 100% for each Geometry case and with Adjustments, empty layer = 0, Geometry round trips = 0, image pixels unchanged outside marks, smaller sizes and the transparency hint

## Place in the sequence

- **Blocked by:** T8 — Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger · T10 — Send the applied layer to the export worker and its window fallback, render it in one or two passes, and make the crop-transparency check include the layer.
- **Blocks:** T20 — Complete the @perf suite: drawing frame interval and latency through the real overlay, tool-ready, Apply / Cancel / Clear and Crop-and-rotate Apply over a full layer, export time with a full layer, and memory after 50 Applies.
- **Wave:** 4 — alongside T9, T13, T14.
- **Lane:** shares `e2e/draw/helpers.ts` with T18; shares `e2e/draw/helpers.ts` with T19 — serialized.

## Why (user story)

> **US-06: Export what I see after drawing**
>
> **As a** Editor  
> **I want** the Export and the other tools to show the drawing I applied, exactly as the Preview shows it  
> **So that** the saved file looks exactly like what I approved
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It proves on all three engines that the saved file is exactly what the Editor approved, and that the photo underneath is never touched.

## Inlined context

> | Fidelity of an Export with marks | each pixel of a full-size PNG Export within 2 of 255 per channel of the Preview's own rendering of the Work at 100%, compared as in export §6 | e2e pixel comparison on Chromium, Firefox and WebKit, for a reference drawing with Strokes at 1, 12 and 200 px in the 10 preset colours plus erased parts, with no Geometry, with each Rotation, with a Flip, a Straighten angle and a Crop, and with all seven Adjustments away from neutral |
> | An empty Drawing layer changes nothing | difference 0 per channel between a full-size PNG Export after Clear and Apply and one of the same Work before anything was drawn | e2e pixel comparison on Chromium, Firefox and WebKit |
> | Marks stay on the image through Geometry round trips | difference 0 per channel between a full-size PNG Export before and after four quarter turns, and before and after two Flips in the same direction | e2e pixel comparison on Chromium, Firefox and WebKit |
>
> — `spec.md §6, NFR fidelity rows, verbatim` · full text: [spec.md](../spec.md)

> *QG-2c. The image itself never changes* … **How verify:** e2e exact comparison outside a mask of the drawn area on all three engines. The Eraser's edge is checked with the 1 px fringe excluded.
> *QG-1d. The transparency hint follows the drawn result* … **How verify:** e2e on all three engines with a transparent fixture: one alpha comparison against the Export without marks, and one check of the hint's state per case.
>
> — `sad.md §10, QG-2c + QG-1d How verify, abridged` · full text: [sad.md](../sad.md)

> | Canvas 2D antialiasing differs between engines … | Medium | Every pixel comparison compares within one engine. … No test compares a layer across engines |
>
> — `sad.md §11, cross-engine AA risk, abridged` · full text: [sad.md](../sad.md)

Reuse `e2e/adjust/fidelity.spec.ts` and `e2e/adjust/helpers.ts` (export capture, PNG decode, per-channel diff) — copy into `e2e/draw/helpers.ts`. Drive drawings with `__imglyTest.setReferenceDrawing()` (T8); for "after Clear and Apply" open the tool and click Clear + Apply. Use `e2e/fixtures/alpha-patches.png` for the transparency cases. A measured engine gap at mark edges is recorded as an engine deviation (as adjust ADR-0005), never a silent tolerance change.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-07 — domain invariant

> **Given** an image is open, with or without transparent pixels
> **When** the Editor applies any mix of Brush Strokes, Eraser Strokes and Clear
> **Then** the image's own pixels never change: everywhere no mark lies, the Preview and a full-size PNG Export show exactly the pixels the Work has with an empty Drawing layer, and after Clear and Apply a full-size PNG Export is identical to one made before anything was drawn. Brush marks are fully opaque, so inside a mark every pixel has the mark's colour, and only its smooth edge blends with the image beneath. Where a mark lies over a transparent part of the image, the Preview and the Export show the mark's colour there; everywhere else the image keeps exactly its own transparency. These exact guarantees apply to the Preview and to a full-size PNG Export. A JPEG or WebP Export, or one at a smaller size, is that full-size result encoded or reduced as the export spec defines, so pixels next to a mark may change there
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — domain invariant

> **Given** the Work has applied marks on its Drawing layer
> **When** the Editor applies any Geometry in "Crop and rotate": a Rotation, a Flip, a Straighten angle or a new Crop
> **Then** every mark stays on the same part of the image: it turns, flips and straightens together with the image and keeps its shape and width relative to it. A mark outside a narrower Crop is hidden, not removed, and shows again when the Crop is widened to include it. Turning the image four quarter turns in either direction, or flipping it twice in the same direction, gives a full-size PNG Export identical to the one made before
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — cross-context

> **Given** marks have been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry and its Adjustments and the Drawing layer on top, matching the Preview (§6 Fidelity) at full size. The Drawing layer is never adjusted, so a red mark is exported as the same red at any Adjustments, grayscale 100% included. An Export at a smaller size is the full-size Export, marks included, reduced to that size. The transparency hint of export AC-15 is shown exactly when the drawn result still has a transparent pixel inside the Crop. An Export never contains a Draft that has not been applied (AC-15)
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — cross-context

> **Given** the Work has applied marks on its Drawing layer
> **When** the Editor opens the "Adjust" tool or the "Crop and rotate" tool, or opens the "Draw" tool on a Work with applied Geometry and Adjustments
> **Then** in the "Adjust" tool the Preview shows the marks over the image unchanged by the Draft, and Compare's "Before" view shows them too, because Adjustments never touch the Drawing layer. The "Crop and rotate" tool shows the whole image with all its marks, including the ones outside the crop frame, so widening the frame shows them where they will be. In the "Draw" tool the Editor draws over the image as it stands with its Geometry and its applied Adjustments
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Helpers (export capture, diff, mask) — `e2e/draw/helpers.ts`
- [ ] Cases: none / 90 / 180 / 270 / Flip / Straighten + Crop / all seven Adjustments; empty-layer 0; round trips 0; outside-mask exact; smaller size; JPEG hint — `e2e/draw/fidelity.spec.ts`
- [ ] Note any new fixture — `e2e/fixtures/README.md`

## Edge cases

| Case | Behaviour |
|---|---|
| grayscale 100% with a red mark | mark exported as the same red (AC-10) |
| mark over a transparent area | mark colour, opaque; elsewhere the image's own alpha (AC-07) |
| marks covering every transparent pixel inside the Crop | no JPEG hint |
| narrow Crop then widen | hidden marks reappear identical (AC-08) |

## Definition of Done

- [ ] suite green on Chromium, Firefox and WebKit
- [ ] any engine deviation recorded, not silenced
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
