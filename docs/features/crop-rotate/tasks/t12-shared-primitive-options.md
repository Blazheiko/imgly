---
id: T12
title: "Extend SliderField (step, decimals, marks), NumberField (signed decimal input) and BaseButton (pressed), and register them"
layer: "ui"
deps: []
blocks: ["T14", "T16"]
acs: ["AC-05", "AC-07"]
files_hint: ["src/shared/ui/SliderField.vue", "src/shared/ui/NumberField.vue", "src/shared/ui/BaseButton.vue", "src/shared/ui/primitives.test.ts", "docs/design-system.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 43 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Extend SliderField (step, decimals, marks), NumberField (signed decimal input) and BaseButton (pressed), and register them

## Place in the sequence

- **Blocked by:** — (none).
- **Blocks:** T14 — Add the 'Crop and rotate' toolbar action, its hints, the C shortcut and the tool's message catalog · T16 — Build CropRotateControls: rotate and flip buttons, straighten slider and field, proportion, width and height, Reset / Cancel / Apply.
- **Wave:** 1 — alongside T1.
- **Lane:** own lane.

No dependencies — it can start on day one, beside T1.

## Why (user story)

> **US-04: Level a tilted horizon**
>
> **As a** Editor  
> **I want** to turn the image by a small free angle  
> **So that** a slightly tilted photo looks level, without empty corners
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It gives the tool's angle slider, angle field and pressed toolbar button the small options they need, without a second slider or field primitive.

## Inlined context

> | `SliderField` (extended: `step`, `decimals`, `marks`) | The straighten slider needs 0.1° steps, one decimal shown and a tick at 0 (AC-05). Today `SliderField` is step 1 with whole numbers. An option keeps one slider primitive instead of a second one | pending (update its row) |
> | `NumberField` (extended: decimal and signed input) | The angle field accepts a sign and one decimal point or comma (AC-07); today it is `inputmode="numeric"`. Its caller's `normalize` already decides what is a number | pending (update its row) |
> | `BaseButton` (extended: `pressed`) | "Crop and rotate" shows as pressed (`aria-pressed`) while the tool is open; `BaseButton` has no pressed state | pending (update its row) |
>
> — `screens.md §New components, rows 1–3, verbatim` · full text: [screens.md](../screens.md)

> 2. **Straighten:** `SliderField` from −45 to 45 in steps of 0.1, unit "°", with a tick at 0. The number field shows one decimal (AC-05).
>
> — `screens.md §SCR-03 panel layout item 2, verbatim` · full text: [screens.md](../screens.md)

> | Arrows (`Shift` ×10) | Straighten slider focused | Change the angle by 0.1° (1°) | AC-20 |
>
> — `screens.md §Keyboard, row 9, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** plain CSS with `<style scoped>`. Every colour, spacing value and font comes from `var(--…)` in `src/shared/styles/tokens.css`. Don't add a UI kit or CSS framework. Reuse `src/shared/ui/` primitives, and register any new primitive in `docs/design-system.md`. `src/shared/` may import `core` (types) only — never `features`, `infra`, `render`.
>
> — `CLAUDE.md §Conventions (Styling) + §Module boundaries, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

The angle field's *rules* (snap, round, revert, `1e2`) are `core`'s `parseAngle` (T4) passed in as the caller's `normalize`; the primitive only allows the characters and commits on blur/Enter. Export's existing uses (quality slider, long-side field) must render and behave exactly as before with the defaults.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [screens.md](../screens.md) · [docs/design-system.md](../../../design-system.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Component props added: `SliderField` `step`, `decimals`, `marks`; `NumberField` `decimal`; `BaseButton` `pressed`.)

## Acceptance criteria

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

This task is only the primitives' part: 0.1 steps, one decimal shown, the 0 mark (AC-05) and accepting signed decimal text that is checked on leave/Enter (AC-07). The angle rules are T4; the wiring is T16.

## Checklist

- [ ] `SliderField`: `step` (default 1), `decimals` (default 0), `marks: number[]`; arrow keys by `step`, Shift ×10; value text with `decimals` — `src/shared/ui/SliderField.vue`
- [ ] `NumberField`: `decimal` option → `inputmode="decimal"`, allow `+ - . ,`; still commit only on blur/Enter through `normalize` — `src/shared/ui/NumberField.vue`
- [ ] `BaseButton`: `pressed?: boolean` → `aria-pressed` + pressed style from tokens — `src/shared/ui/BaseButton.vue`
- [ ] Tests — `src/shared/ui/primitives.test.ts`
- [ ] Update the three inventory rows — `docs/design-system.md`

## Edge cases

| Case | Behaviour |
|---|---|
| Slider at 44.95 with Shift+→ | clamps at max 45.0 |
| Float drift (0.1 × 3) | value rounded to `decimals` before emit (0.3, not 0.30000000000000004) |
| Enter in NumberField | commits value; event does not bubble as "apply the tool" (stopPropagation or a flag the tool reads) |
| Escape in NumberField | pending text discarded; the event reaches the tool so it can cancel (AC-20) |
| `pressed` undefined | no `aria-pressed` attribute (unchanged buttons) |

## Definition of Done

- [ ] Primitive tests prove the new options and that defaults leave existing behaviour unchanged
- [ ] `docs/design-system.md` rows for `SliderField`, `NumberField`, `BaseButton` describe the new options
- [ ] every Hard Rule inlined above still holds (tokens only, no feature import)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
