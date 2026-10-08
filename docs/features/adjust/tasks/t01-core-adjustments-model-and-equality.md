---
id: T1
title: "Add the Adjustments to the Work: type, fixed key order, ranges, NEUTRAL_ADJUSTMENTS, isNeutral and adjustmentsEquals"
layer: "domain"
deps: []
blocks: ["T2", "T3", "T8"]
acs: ["AC-11", "AC-17"]
files_hint: ["src/core/adjust/types.ts", "src/core/adjust/equality.ts", "src/core/adjust/adjust.test.ts", "src/core/adjust/index.ts", "src/core/document.ts", "src/core/document.test.ts", "src/core/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 43 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Add the Adjustments to the Work: type, fixed key order, ranges, NEUTRAL_ADJUSTMENTS, isNeutral and adjustmentsEquals

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** T2 — Add parseAdjustmentField: plain decimal only, trailing % for grayscale and sepia, snap to range, round half up, revert on empty or non-numeric · T3 — Write the CPU reference of the seven formulas (applyAdjustmentsToPixel) and toUniforms, pinned to ADR-0003's anchor table · T8 — Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments.
- **Wave:** 1 — alongside T11.
- **Lane:** shares `src/core/adjust/index.ts` with T2; shares `src/core/adjust/index.ts` with T3; shares `src/core/adjust/index.ts` with T4 — serialized.

## Why (user story)

> **US-05: Change my mind without losing anything**
>
> **As a** Editor  
> **I want** to cancel my changes, reset one slider or all of them, and come back later to change applied values  
> **So that** trying a look never costs me the original photo
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It gives every later task the one value model: seven always-present whole numbers that a new Work starts neutral with and that Apply compares one by one.

## Inlined context

> - `src/core/adjust/` is a new pure module (no Vue, Pinia or DOM): the `Adjustments` type and `ADJUSTMENT_KEYS` in the fixed order of ADR-0003; `NEUTRAL_ADJUSTMENTS`; `isNeutral(a)`; `adjustmentsEquals(a, b)` (AC-11); the ranges (−100 to 100 for the first five, 0 to 100 for grayscale and sepia); …
> - `Work` gains `adjustments: Adjustments`, set to `NEUTRAL_ADJUSTMENTS` by `createWork()`. A new Work always starts neutral (AC-17, spec §3).
>
> — `adr/0001 §Decision outcome, How it works bullets 1–2, abridged` · full text: [adr/0001](../adr/0001-model-the-adjustments-as-seven-integer-fields-on-the-work.md)

> Seven always-present integers make AC-11's comparison a plain field-by-field equality with no rounding, keep neutral values explicit (0, or 0%), and match the Geometry's style.
>
> — `adr/0001 §Decision outcome, verbatim` · full text: [adr/0001](../adr/0001-model-the-adjustments-as-seven-integer-fields-on-the-work.md)

> | Colour pipeline | … the seven steps run on unpremultiplied stored sRGB values in the fixed order brightness, contrast, saturation, temperature, tint, grayscale, sepia … |
> | Units and rounding | Every value is a whole number: −100 to 100 for the first five, 0 to 100 (shown with a "%" label) for grayscale and sepia. … |
>
> — `sad.md §8, Colour pipeline + Units and rounding rows, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes. May import nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this).
>
> — `CLAUDE.md §Module boundaries, src/core row, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Precedent: `src/core/geometry/` (`types.ts`, `equality.ts` with `geometryEquals`, `index.ts`) — mirror its layout. `ExportSnapshot` / `ExportRequest` are **not** in this task (T7, T8).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (Module surface: `Adjustments`, `AdjustmentKey`, `ADJUSTMENT_KEYS`, `ADJUSTMENT_RANGES`, `NEUTRAL_ADJUSTMENTS`, `isNeutral(a)`, `adjustmentsEquals(a, b)`, `Work.adjustments`.)

## Acceptance criteria

### AC-11 — cross-context

> **Given** an image is open
> **When** the Editor applies the "Adjust" tool
> **Then** the Work has Unsaved edits only when the applied Adjustments differ from the ones the Work had when the tool was opened. The seven values are compared one by one, not by the pixels they produce, and an Apply with no change, or with values changed and then changed back by hand in the same tool, leaves the Unsaved edits as they were. The comparison is only with the values from when the tool was opened: after an Export, changing a value in one Apply and changing it back in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — cross-context

> **Given** the "Adjust" tool is open with a Draft that is not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with neutral Adjustments. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `Adjustments` (seven `number` fields), `AdjustmentKey`, `ADJUSTMENT_KEYS` in the fixed order, `ADJUSTMENT_RANGES` (`{ min, max, neutral }` per key), frozen `NEUTRAL_ADJUSTMENTS` — `src/core/adjust/types.ts`
- [ ] `isNeutral(a)` and `adjustmentsEquals(a, b)` (field by field over `ADJUSTMENT_KEYS`) — `src/core/adjust/equality.ts`
- [ ] Public surface — `src/core/adjust/index.ts`, re-exported from `src/core/index.ts`
- [ ] `Work.adjustments`, set to `NEUTRAL_ADJUSTMENTS` by `createWork()`; fix any Work literal the typecheck flags — `src/core/document.ts`
- [ ] Unit tests — `src/core/adjust/adjust.test.ts`, `src/core/document.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Values changed and changed back to the same seven numbers | `adjustmentsEquals` is true (AC-11: compared one by one, not by pixels) |
| One value differs by 1 | `adjustmentsEquals` is false; `isNeutral` false if it was neutral |
| `createWork()` for a replacing image | the new Work has `NEUTRAL_ADJUSTMENTS` (AC-17) |
| Caller mutates the neutral constant | impossible: `NEUTRAL_ADJUSTMENTS` is frozen |

## Definition of Done

- [ ] Vitest proves `ADJUSTMENT_KEYS` order, the ranges, `isNeutral` and `adjustmentsEquals` (equal, each single field different)
- [ ] `createWork()` sets `NEUTRAL_ADJUSTMENTS` (document test)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
