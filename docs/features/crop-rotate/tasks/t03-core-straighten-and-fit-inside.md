---
id: T3
title: "Add the Straighten angle rules: setStraighten around the frame's centre and fitCropInside with no empty corner"
layer: "domain"
deps: ["T2"]
blocks: ["T4"]
acs: ["AC-05", "AC-06"]
files_hint: ["src/core/geometry/straighten.ts", "src/core/geometry/straighten.test.ts", "src/core/geometry/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 43 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Add the Straighten angle rules: setStraighten around the frame's centre and fitCropInside with no empty corner

## Place in the sequence

- **Blocked by:** T2 — Keep the Crop inside the turned image: clampCrop, whole-pixel rounding, move and resize by edge or corner.
- **Blocks:** T4 — Add proportions, typed crop sizes and the field input rules (parseAngle, parseCropSize, plain decimal only).
- **Wave:** 3 — alongside T6, T8.
- **Lane:** shares `src/core/geometry/index.ts` with T1; shares `src/core/geometry/index.ts` with T2; shares `src/core/geometry/index.ts` with T4; shares `src/core/geometry/index.ts` with T5 — serialized.

US-04 is the first scope cut if the budget slips (`spec.md` §1); this task and T6's LINEAR rule are what fall away.

## Why (user story)

> **US-04: Level a tilted horizon**
>
> **As a** Editor  
> **I want** to turn the image by a small free angle  
> **So that** a slightly tilted photo looks level, without empty corners
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It is the maths that turns the image by a free angle and shrinks the frame so no empty corner can enter the Work.

## Inlined context

> `setStraighten(g, tenths)` (AC-05: the image turns around the frame's centre, so the centre is re-anchored to the same image content, then AC-06), `fitCropInside(g)` (AC-06: largest rectangle of the frame's proportion around its centre inside the turned image, sizes rounded down, centre moved to the nearest inside point only when it falls outside)
>
> — `adr/0001 §Decision outcome, How it works, abridged` · full text: [adr/0001](../adr/0001-model-the-geometry-as-integer-parameters-with-one-core-transform.md)

> S->>S: turns the image around the frame's centre, keeping that centre on the same image content
> S->>S: shrinks the frame around its centre, same proportion, to the largest that fits inside the turned image, rounded down
> opt the centre itself falls outside the turned image — S->>S: moves the centre to the nearest point inside
> Postcondition: no empty corner inside the frame, and moving back towards 0 never grows the frame by itself
>
> — `sad.md §6, F4 steps 9–12 + postcondition, abridged` · full text: [sad.md](../sad.md)

> | Units | The Straighten angle is stored in integer tenths of a degree and shown in degrees with one decimal. Crop position and size are whole pixels of the image; the overlay works in device pixels through the View | ADR-0001 |
>
> — `sad.md §8, Units, verbatim` · full text: [sad.md](../sad.md)

> AC-06's maths (largest frame of the same proportion inside the turned image, re-anchoring around the frame's centre, whole-pixel rounding) has edge cases: ±45°, a centre that falls outside, a 1×1 Crop, very thin frames — Mitigation: Pure functions in `core/geometry` with property tests: the result is always inside, whole pixels, at least 1×1, with the proportion kept within 0.5 px (AC-08)
>
> — `sad.md §11, risk row 4, verbatim` · full text: [sad.md](../sad.md)

The opacity half of AC-06 is a rendering property, verified by T18 (QG-1b); here it follows from "inside the turned image".

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-05 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor drags the straighten slider or types an angle
> **Then** the image turns by that angle, from −45° to +45° in steps of 0.1°, around the centre of the crop frame, and the Preview follows while the slider moves. A fine grid shows over the image while the angle changes, so the Editor can line up a horizon. A positive angle turns the image clockwise. The angle is shown next to the slider, and 0° is marked on it
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — domain invariant

> **Given** the "Crop and rotate" tool is open on any image
> **When** the Editor sets any Straighten angle
> **Then** the crop frame shrinks automatically around its own centre, keeping its proportions, to the largest size that lies fully inside the turned image, so no empty corner can enter the Work. Its width and height round down to whole pixels. The centre stays where it was; it moves only when the centre itself would fall outside the turned image, and then to the nearest point inside it. When the angle moves back towards 0°, the frame does not grow back by itself; the Editor can widen it again. When the Original has no transparent pixels, every pixel of the Work stays fully opaque, in the Preview and in every Export
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `setStraighten(g, tenths, original)`: clamp to −450…450, re-anchor the Crop so its centre stays on the same Original content under the new angle, then `fitCropInside` — `src/core/geometry/straighten.ts`
- [ ] `fitCropInside(g, original)`: keep the frame's proportion, shrink around the centre to the largest integer rect inside the turned image (round down), move the centre to the nearest inside point only if it is outside; never enlarge — `src/core/geometry/straighten.ts`
- [ ] Reuse T2's `isInsideTurned` / `centreRect` — `src/core/geometry/crop.ts` (read only)
- [ ] Export from `src/core/geometry/index.ts`; property tests in `src/core/geometry/straighten.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| +45° and −45° on a 4096×3072 Original, full Crop | largest inside rect, integer, proportion within 0.5 px |
| Angle moved from 10° back to 2° | frame does not grow; it stays the size it shrank to |
| Frame centred near a corner, then a large angle | centre moves to the nearest point inside, then shrinks |
| 1×1 Crop, any angle | stays 1×1 and inside |
| Very thin frame (1×4000) | stays ≥1 px wide, inside |
| 451 or −451 tenths passed in | clamped to ±450 (typed-value rounding is T4's) |

## Definition of Done

- [ ] Property tests over random angles and Crops prove AC-06: inside, integer, ≥1×1, same proportion within 0.5 px, centre kept unless outside, no growing back
- [ ] Unit tests prove AC-05's range and that the frame's centre maps to the same Original point before and after the turn
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
