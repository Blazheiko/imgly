---
id: T16
title: "Build CropRotateControls: rotate and flip buttons, straighten slider and field, proportion, width and height, Reset / Cancel / Apply"
layer: "ui"
deps: ["T12", "T13"]
blocks: ["T17"]
acs: ["AC-03", "AC-04", "AC-05", "AC-07", "AC-08", "AC-09", "AC-10"]
files_hint: ["src/features/crop-rotate/CropRotateControls.vue", "src/features/crop-rotate/CropRotateControls.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 78 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T16 — Build CropRotateControls: rotate and flip buttons, straighten slider and field, proportion, width and height, Reset / Cancel / Apply

## Place in the sequence

- **Blocked by:** T12 — Extend SliderField (step, decimals, marks), NumberField (signed decimal input) and BaseButton (pressed), and register them · T13 — Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset.
- **Blocks:** T17 — Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View.
- **Wave:** 6 — alongside T11, T14, T15, T18.
- **Lane:** own lane.

## Why (user story)

> **US-06: Crop to an exact size**
>
> **As a** Editor  
> **I want** to see and type the crop size in pixels  
> **So that** the result meets an exact size a website or a form asks for
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It is the tool panel: every turn, flip, angle, proportion and exact size the Editor can set, plus the three footer actions.

## Inlined context

> 1. **Rotate and flip:** four `BaseButton` ghost icon buttons in a row, each with an `aria-label` and tooltip: "Rotate left", "Rotate right", "Flip horizontal", "Flip vertical".
> 2. **Straighten:** `SliderField` from −45 to 45 in steps of 0.1, unit "°", with a tick at 0. The number field shows one decimal (AC-05).
> 3. **Proportion:** `SegmentedControl` Free · Original · 1:1 · 4:3 · 3:2 · 16:9, then a second `SegmentedControl` Landscape · Portrait. Orientation is disabled for Free and 1:1, where it has no meaning (AC-08).
> 4. **Size:** two `NumberField`s "Width" and "Height", unit "px", side by side (AC-09).
> 5. **Footer:** `BaseButton` ghost "Reset" on the left; `BaseButton` secondary "Cancel" and `BaseButton` primary "Apply" on the right.
>
> — `screens.md §SCR-03 panel layout, verbatim` · full text: [screens.md](../screens.md)

> | turned or mirrored | Rotate or flip chosen (F3, AC-03, AC-04). Image and frame turn or mirror together, width and height swap on a turn, a locked 4:3 becomes 3:4, and after a flip the slider shows the angle with its sign changed | as `default` | wireframe 03-a |
> | proportion locked | A proportion other than Free is chosen (F5, AC-08). The frame becomes the largest of that proportion inside the current frame and keeps it while dragged or resized, until Free | as `default`, `SegmentedControl` selection, orientation enabled except for 1:1 | wireframe 03-a |
> | typing (pending) | The Editor is typing in the angle, width or height field. Nothing is checked yet (AC-07, AC-10) | `NumberField` pending text | — |
> | validation | The Editor leaves a field or presses `Enter` in it (F4, F5). Out of range snaps to the bound, a fraction rounds, zero or negative size becomes 1, a too-large size becomes the largest that fits, and empty or non-numeric text (including `1e2`) reverts. No inline error message, per the canon's §Validation: the corrected value is the feedback | `NumberField` showing the corrected value | — |
>
> — `screens.md §SCR-03 state rows, verbatim` · full text: [screens.md](../screens.md)

> | `Enter` | Angle, width or height field | Applies the typed value. Never applies the tool | AC-07, AC-10 |
>
> — `screens.md §Keyboard, row 11, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** Reuse `src/shared/ui/` primitives … Every colour, spacing value and font comes from `var(--…)` in `src/shared/styles/tokens.css`.
>
> — `CLAUDE.md §Conventions (Styling), abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

The controls are thin: every rule is in `core` (T1–T4) behind the store (T13). Degrees ↔ tenths conversion happens here at the edge (ADR-0001 Negative). Enter-applies-the-tool and Escape-cancels are T17's container handler; this component only stops Enter from a field from reaching it.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

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

### AC-05 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor drags the straighten slider or types an angle
> **Then** the image turns by that angle, from −45° to +45° in steps of 0.1°, around the centre of the crop frame, and the Preview follows while the slider moves. A fine grid shows over the image while the angle changes, so the Editor can line up a horizon. A positive angle turns the image clockwise. The angle is shown next to the slider, and 0° is marked on it
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

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

This task owns the panel's part of each AC: the control exists, shows the Draft's value, and calls the store; the maths is T1–T4, the pixels T18.

## Checklist

- [ ] Five groups in order with headings in `--font-size-xs`, `--color-text-muted`, labels from `messages.ts` — `src/features/crop-rotate/CropRotateControls.vue`
- [ ] Rotate/flip ghost icon buttons → `store.rotate` / `store.flip` — same file
- [ ] `SliderField` (step 0.1, decimals 1, marks [0]) + angle `NumberField` (decimal) bound to `draft.straighten / 10`; commit through `store.commitField('angle')` — same file
- [ ] Two `SegmentedControl`s → `store.chooseProportion`; orientation disabled for Free and 1:1 — same file
- [ ] Width/Height `NumberField`s showing the Draft's size live; pending text via `store.setPending`, commit on blur/Enter — same file
- [ ] Footer Reset (ghost) · Cancel (secondary) · Apply (primary) → store — same file
- [ ] Tests — `src/features/crop-rotate/CropRotateControls.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Flip with +5.0° | slider and field show −5.0° |
| Rotate with 4:3 landscape selected | selection shows Portrait (3:4) |
| Typing "12" then dragging the frame | pending text kept until blur/Enter (no live check) |
| Enter in the Width field | value committed; tool stays open |
| "1e2" typed in the angle field, then blur | field shows the previous angle |
| Proportion 1:1 selected | orientation control disabled |

## Definition of Done

- [ ] Component tests prove each control calls the right store action and shows the Draft (AC-03, AC-04, AC-05, AC-08, AC-09)
- [ ] Component tests prove fields commit only on blur/Enter and Enter never applies the tool (AC-07, AC-10)
- [ ] every Hard Rule inlined above still holds (primitives + tokens only)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
