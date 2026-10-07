---
id: T4
title: "Add proportions, typed crop sizes and the field input rules (parseAngle, parseCropSize, plain decimal only)"
layer: "domain"
deps: ["T2", "T3"]
blocks: ["T13"]
acs: ["AC-07", "AC-08", "AC-09", "AC-10"]
files_hint: ["src/core/geometry/proportion.ts", "src/core/geometry/size.ts", "src/core/geometry/parse.ts", "src/core/geometry/proportion.test.ts", "src/core/geometry/parse.test.ts", "src/core/geometry/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 64 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Add proportions, typed crop sizes and the field input rules (parseAngle, parseCropSize, plain decimal only)

## Place in the sequence

- **Blocked by:** T2 — Keep the Crop inside the turned image: clampCrop, whole-pixel rounding, move and resize by edge or corner · T3 — Add the Straighten angle rules: setStraighten around the frame's centre and fitCropInside with no empty corner.
- **Blocks:** T13 — Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset.
- **Wave:** 4 — alongside T7, T9.
- **Lane:** shares `src/core/geometry/index.ts` with T1; shares `src/core/geometry/index.ts` with T2; shares `src/core/geometry/index.ts` with T3; shares `src/core/geometry/index.ts` with T5 — serialized.

## Why (user story)

> **US-05: Crop to a set shape**
>
> **As a** Editor  
> **I want** to lock the crop frame to a common proportion such as 1:1 or 16:9  
> **So that** the result fits an avatar, a post or a screen without manual measuring
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

> **US-06: Crop to an exact size**
>
> **As a** Editor  
> **I want** to see and type the crop size in pixels  
> **So that** the result meets an exact size a website or a form asks for
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It is every rule behind the proportion control, the width and height fields and the angle field — pure, so the store and the controls only call it.

## Inlined context

> `clampCrop` and the rounding rules of AC-02, the proportion and size maths of AC-08 and AC-09, the input rules of AC-07 and AC-10 (plain decimal notation only)
>
> — `adr/0001 §Decision outcome, How it works, abridged` · full text: [adr/0001](../adr/0001-model-the-geometry-as-integer-parameters-with-one-core-transform.md)

> | Field input | Checked only when the field is left or Enter is pressed in it, never while typing. Enter in a field never applies the tool, and Escape anywhere cancels the tool and discards a value still being typed (AC-07, AC-10, AC-20). Only plain decimal notation counts as a number | export AC-04; here |
>
> — `sad.md §8, Field input, verbatim` · full text: [sad.md](../sad.md)

> S->>S: Original means the image's proportions after its current Rotation
> S->>S: largest frame of that proportion inside the current frame, centred on it
> S->>S: long side is the input, short side rounded to the nearest pixel, a half rounds up
> … alt empty or not plain decimal notation → returns to the previous value · else zero or negative → becomes 1 · else fractional → rounds to the nearest whole number · else larger than fits at the current Straighten angle → becomes the largest size that fits, with the locked proportion if there is one
> alt a proportion is locked → the other side follows from the typed side, rounded, a half rounds up · else Free → the other side stays as it is
> S->>S: resizes around the frame's centre, moving it only as far as needed to stay inside
>
> — `sad.md §6, F5 steps, abridged` · full text: [sad.md](../sad.md)

> AC-03: … a locked proportion turns with it (4:3 becomes 3:4).
>
> — `spec.md §5, AC-03, abridged` · full text: [spec.md](../spec.md)

Remembering the proportion per Work and the pending field text are store state (T13); this task is the stateless maths. `normalizeLongSide` in `src/core/export/size.ts` already implements export AC-04's number rule — reuse its parsing idea, but AC-07/AC-10 allow a sign and a decimal comma and reject `1e2`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-07 — error

> **Given** the "Crop and rotate" tool is open
> **When** the Editor types a Straighten angle outside −45° to +45°, with more than one decimal place, or a value that is empty or not a number
> **Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound, extra decimals round to the nearest 0.1°, and an empty or non-numeric value returns to the previous angle. A value is a number when it is written in plain decimal notation: digits with an optional sign and one decimal point or decimal comma, however long. Anything else, including scientific notation such as `1e2`, is not a number. Pressing Enter in the field only applies the value and does not apply the tool
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor chooses a proportion: Free, Original, 1:1, 4:3, 3:2 or 16:9, optionally switched between landscape and portrait
> **Then** the crop frame becomes the largest frame of that proportion that fits inside the current frame, centred on it, and keeps that proportion while it is dragged or resized until the Editor chooses Free. Free is the default when the tool opens for a Work for the first time. Original always means the proportions of the image as it stands after its current Rotation, so it follows a later Rotation or Reset. The frame's long side is the input: the short side is the long side divided by the proportion, rounded to the nearest whole pixel, and an exact half pixel rounds up, the same rule as export AC-05. A proportion is kept when the short side is within 0.5 px of the exact value. The tool remembers the chosen proportion and its landscape or portrait orientation for the same Work until the Work is replaced. It is remembered as soon as it is chosen, even if the tool is then cancelled
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor looks at the size fields, or types a width or a height in pixels
> **Then** the fields always show the crop frame's current width and height in whole pixels, and they update while the frame is dragged. A typed value resizes the frame around its centre, moving it only as far as needed to stay inside the image. With a proportion locked, the side the Editor typed is the input, whether it is the long or the short side, and the other side is the typed side multiplied or divided by the proportion, rounded to the nearest whole pixel with an exact half pixel rounding up, as in AC-08. The width and height shown are exactly the size the Work has after Apply, and exactly the size of a full-size Export
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — error

> **Given** the "Crop and rotate" tool is open
> **When** the Editor types a width or height that is larger than fits, zero or negative, fractional, empty or not a number
> **Then** the value is checked when the Editor leaves the field or presses Enter in it, following the input rules of export AC-04: a fractional value rounds to the nearest whole number, an empty or non-numeric value returns to the previous value, zero or a negative value becomes 1, and a value larger than fits becomes the largest size that fits inside the image at the current Straighten angle, with the locked proportion if there is one. With no proportion locked, the other side stays as it is and only the typed side is limited. A value is a number under the same rule as AC-07. Nothing is checked while the Editor is still typing. Pressing Enter in a field only applies the value and does not apply the tool
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `Proportion` type (`free | original | 1:1 | 4:3 | 3:2 | 16:9`, orientation `landscape | portrait`), `ratioOf(p, g, original)` with Original = turned image after Rotation — `src/core/geometry/proportion.ts`
- [ ] `applyProportion(g, p, original)`: largest frame of that ratio inside the current frame, centred (odd pixel right/bottom), long side input, short side half-up — `src/core/geometry/proportion.ts`
- [ ] `resizeCropLocked(g, handle, dx, dy, p, original)` wrapping T2's `resizeCrop` so the other side follows — `src/core/geometry/proportion.ts`
- [ ] `setCropSize(g, side, px, p, original)`: typed side is input, other side follows or stays (Free), resize around centre, move only as needed, clamp to largest that fits at the current angle — `src/core/geometry/size.ts`
- [ ] `parseAngle(text, previous)` → tenths; `parseCropSize(text, previous)` → integer or previous; regex for plain decimal (sign, digits, one `.` or `,`) — `src/core/geometry/parse.ts`
- [ ] Export from `src/core/geometry/index.ts`; tests in `proportion.test.ts`, `parse.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `"1e2"`, `"abc"`, `""`, `"  "` in either field | previous value |
| `"-3,46"` angle | −3.5° (−35 tenths): decimal comma accepted, rounded to the nearest 0.1° |
| `"+2.04"` angle | 2.0° (20 tenths) |
| `"99"` angle | snaps to 45.0° |
| `"0"` or `"-3"` size | 1 |
| `"12.5"` size | 13 |
| `"999999999999999999999"` size | a number; becomes the largest that fits |
| 16:9 portrait on a 4096×3072 full Crop | 1728×3072 centred (long side 3072, short 3072/16·9 = 1728) |
| Original proportion after a 90° turn | ratio is H:W of the Original |
| Typed width with 4:3 locked, too large | largest 4:3 that fits at the current angle |

## Definition of Done

- [ ] Vitest proves every AC-07 and AC-10 input branch (snap, round, revert, 1, largest that fits, `1e2`)
- [ ] Vitest proves AC-08's largest-centred frame, half-up short side and 0.5 px tolerance for every proportion × orientation, and that Original follows Rotation
- [ ] Vitest proves AC-09's typed-side-is-input rule with a proportion locked and with Free
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
