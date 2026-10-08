---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-08"
feature_size: "M"
ticket: "roadmap step 5 — adjust"
---

# 0001 — Model the Adjustments as seven integer fields on the Work, with their rules in `core`

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The Work gains its seven colour values (root CONTEXT "Adjustments"). The `editor` store compares them for Unsaved edits (AC-11), the adjust tool edits and resets them (AC-05, AC-10), the shared shader and the export worker render them (AC-14), Auto adjust writes four of them (AC-12), and the gallery (roadmap step 8) will persist them with the Original, as repo ADR 0003 plans. The shape chosen now is the shape that reaches IndexedDB, and changing it then needs a migration step.

## Decision drivers

- spec AC-11: Unsaved edits change only when the applied values differ, compared one by one, not by pixels
- spec AC-07: the same seven values reached by any path give exactly the same Preview and Work
- spec AC-05, AC-13: every value is a whole number in its range; Auto stays within ±50
- repo ADR 0003: the Work is persisted as Original plus parameters; crop-rotate ADR-0001 set the precedent of integer parameters with the rules in `core`
- sad.md §1 quality goal 2

## Considered options

1. **Seven integer fields** — `Adjustments = { brightness, contrast, saturation, temperature, tint, grayscale, sepia }`, each a whole number, always all present.
2. **An ordered list of operations** — `[{ kind: 'brightness', value: 30 }, …]`, holding only the non-neutral values, like a filter stack.

## Decision outcome

**Chosen:** Option 1. AC-07 fixes one order that does not depend on how the Editor got there, so a list would be normalised and sorted on every comparison and every render anyway, and the shader takes seven fixed uniforms either way. Seven always-present integers make AC-11's comparison a plain field-by-field equality with no rounding, keep neutral values explicit (0, or 0%), and match the Geometry's style. More adjustments are a non-goal (spec §3), so the list's extensibility buys nothing in this roadmap.

How it works:

- `src/core/adjust/` is a new pure module (no Vue, Pinia or DOM): the `Adjustments` type and `ADJUSTMENT_KEYS` in the fixed order of ADR-0003; `NEUTRAL_ADJUSTMENTS`; `isNeutral(a)`; `adjustmentsEquals(a, b)` (AC-11); the ranges (−100 to 100 for the first five, 0 to 100 for grayscale and sepia); `parseAdjustmentField(text, key, previous)` for AC-05 (plain decimal notation with an optional sign and one decimal point or comma, however long; a trailing "%" in the grayscale and sepia fields; snap to the bound; round half up, so 2.5 → 3 and −2.5 → −2; empty or non-numeric → previous); `toUniforms(a)`, which packs the values for the shader; and `applyAdjustmentsToPixel(rgba, a)`, a CPU reference of ADR-0003's formulas that unit tests use to pin the directions of AC-02 to AC-04.
- `Work` gains `adjustments: Adjustments`, set to `NEUTRAL_ADJUSTMENTS` by `createWork()`. A new Work always starts neutral (AC-17, spec §3).
- `ExportSnapshot` and `ExportRequest` gain `adjustments`. The crop-rotate transparency check does not, because Adjustments never change transparency (AC-06, AC-14).

## Consequences

**Positive**
- AC-11 is one pure function with exhaustive unit tests, and the editor stays a thin caller.
- Step 8 persists seven plain integers next to the Geometry, a trivial schema for its migration step and for a `fake-indexeddb` test.
- Step 7's undo can store and compare whole `Adjustments` values like Geometries.

**Negative**
- A future slider means a new field, a new uniform and a forward migration step for saved Works.
- Neutral values are stored explicitly, so every Work carries all seven fields even when untouched (a few bytes).

**Neutral**
- The formulas that give the values their meaning live in ADR-0003. This ADR fixes only the shape and the rules of the values.

## Links

- Spec: [[../spec.md]] AC-05, AC-07, AC-10, AC-11, AC-13, AC-17
- SAD: [[../sad.md]] §4 (choice 1), §5, §8
- Related ADR: [[0002-apply-the-adjustments-in-the-shared-fragment-shader-on-stored-srgb-values]], [[0003-define-each-adjustment-by-a-fixed-formula-that-keeps-black-in-place]]; crop-rotate ADR-0001 (the Geometry's integer model); repo ADR 0003 (persistence as Original plus parameters)
