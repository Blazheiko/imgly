---
id: T2
title: "Add parseAdjustmentField: plain decimal only, trailing % for grayscale and sepia, snap to range, round half up, revert on empty or non-numeric"
layer: "domain"
deps: ["T1"]
blocks: ["T12"]
acs: ["AC-05"]
files_hint: ["src/core/adjust/parse.ts", "src/core/adjust/parse.test.ts", "src/core/adjust/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 33 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Add parseAdjustmentField: plain decimal only, trailing % for grayscale and sepia, snap to range, round half up, revert on empty or non-numeric

## Place in the sequence

- **Blocked by:** T1 — Add the Adjustments to the Work: type, fixed key order, ranges, NEUTRAL_ADJUSTMENTS, isNeutral and adjustmentsEquals.
- **Blocks:** T12 — Add the adjust store: Draft and values at open, set / commit typed fields, reset one or all, apply and cancel.
- **Wave:** 2 — alongside T3, T8.
- **Lane:** shares `src/core/adjust/index.ts` with T1; shares `src/core/adjust/index.ts` with T3; shares `src/core/adjust/index.ts` with T4 — serialized.

## Why (user story)

> **US-01: Make a dull photo lighter or punchier**
>
> **As a** Editor  
> **I want** to change the brightness and contrast of the image with sliders and see the result while I drag  
> **So that** a dark or flat photo looks the way I remember it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It is the one pure rule every typed value goes through, so the Draft only ever holds whole numbers in range.

## Inlined context

> `parseAdjustmentField(text, key, previous)` for AC-05 (plain decimal notation with an optional sign and one decimal point or comma, however long; a trailing "%" in the grayscale and sepia fields; snap to the bound; round half up, so 2.5 → 3 and −2.5 → −2; empty or non-numeric → previous)
>
> — `adr/0001 §Decision outcome, How it works bullet 1, abridged` · full text: [adr/0001](../adr/0001-model-the-adjustments-as-seven-integer-fields-on-the-work.md)

> | Field input | Checked only when the field is left or Enter is pressed in it, never while typing, and Enter in a field never applies the tool. Only plain decimal notation, with one decimal point or comma, counts as a number, and a trailing "%" is accepted in the grayscale and sepia fields (AC-05). … |
> | Error handling | … The field rules never fail: out-of-range values snap, fractional values round half up, and empty or non-numeric values revert (AC-05). … |
>
> — `sad.md §8, Field input + Error handling rows, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes. May import nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this).
>
> — `CLAUDE.md §Module boundaries, src/core row, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Reuse `parseDecimal(text)` from `src/core/geometry/parse.ts` (crop-rotate AC-07's plain-decimal rule, same module boundary) rather than a second regex. Round half up is `Math.floor(x + 0.5)` (2.5 → 3, −2.5 → −2); normalise `-0` to `0`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`parseAdjustmentField(text: string, key: AdjustmentKey, previous: number): number`.)

## Acceptance criteria

### AC-05 — error

> **Given** the "Adjust" tool is open
> **When** the Editor types a value in a slider's number field that is outside its range, fractional, empty or not a number
> **Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound (−100 or +100, or 0% or 100%), a fractional value rounds to the nearest whole number with an exact half rounding up (2.5 becomes 3, −2.5 becomes −2), and an empty or non-numeric value returns to the previous value. A value is a number under the same rule as crop-rotate AC-07: plain decimal notation with an optional sign and one decimal point or decimal comma, however long; scientific notation such as `1e2` is not a number. In the grayscale and sepia fields a trailing "%" is accepted, so "60%" means 60. Nothing is checked while the Editor is still typing, and pressing Enter in a field only applies the value and does not apply the tool
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `parseAdjustmentField` over `parseDecimal`, `%` stripped only for `grayscale` / `sepia`, clamp to `ADJUSTMENT_RANGES[key]`, round half up — `src/core/adjust/parse.ts`
- [ ] Export it — `src/core/adjust/index.ts`
- [ ] Table-driven tests for every row below — `src/core/adjust/parse.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `"2.5"` / `"-2.5"` | 3 / −2 |
| `"150"` in brightness, `"-7"` in sepia | 100 / 0 |
| `"1e2"`, `"abc"`, `""`, `"-"` | previous value |
| `"60%"` in grayscale or sepia | 60 |
| `"60%"` in brightness | previous value (the "%" is accepted only in grayscale and sepia) |
| `"1,5"` (decimal comma) | 2 |
| `"00000000000000000000012"` (very long) | 12 |
| `"-0.4"` | 0 (never `-0`) |
| `"0"` in any field | the neutral value (AC-10 relies on it) |

## Definition of Done

- [ ] Table tests prove every edge row above, for each of the seven keys where it applies
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
