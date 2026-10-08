---
id: T12
title: "Add the adjust store: Draft and values at open, set / commit typed fields, reset one or all, apply and cancel"
layer: "app"
deps: ["T2", "T8"]
blocks: ["T13", "T14"]
acs: ["AC-05", "AC-09", "AC-10", "AC-11", "AC-17"]
files_hint: ["src/features/adjust/store.ts", "src/features/adjust/store.test.ts", "src/features/adjust/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 60 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Add the adjust store: Draft and values at open, set / commit typed fields, reset one or all, apply and cancel

## Place in the sequence

- **Blocked by:** T2 — Add parseAdjustmentField: plain decimal only, trailing % for grayscale and sepia, snap to range, round half up, revert on empty or non-numeric · T8 — Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments.
- **Blocks:** T13 — Add Compare (held flag, neutral preview, ends on blur and close) and Auto (sampleWork → autoAdjust → four values or the nothing hint) to the adjust store · T14 — Add the 'Adjust' toolbar action with its hints, the A shortcut and the tool's message catalog, mounted next to 'Crop and rotate'.
- **Wave:** 3 — alongside T4, T5, T10.
- **Lane:** shares `src/features/adjust/store.test.ts`, `src/features/adjust/store.ts` with T13; shares `src/features/adjust/index.ts` with T14; shares `src/features/adjust/index.ts` with T16 — serialized.

## Why (user story)

> **US-05: Change my mind without losing anything**
>
> **As a** Editor  
> **I want** to cancel my changes, reset one slider or all of them, and come back later to change applied values  
> **So that** trying a look never costs me the original photo
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It holds the Draft apart from the Work, so Cancel, Reset and a replace never touch the applied values.

## Inlined context

> **The Draft and Compare live in the new `adjust` store.** The Preview reads `editor.previewAdjustments`, which the adjust store sets to the Draft, or to neutral values while Compare is held (AC-08). With no adjust tool open, `previewAdjustments` is null and the Preview draws `work.adjustments` …
> **No undo and no persistence.** The tool keeps the Adjustments from when it opened for Cancel (AC-09). …
>
> — `sad.md §4, decided inline, abridged` · full text: [sad.md](../sad.md)

> `store.ts` — `adjust` store: Draft, Adjustments at open, Compare held, field state, apply / cancel / reset / reset one / auto
>
> — `sad.md §5, Internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> Two stores must stay in step: the tool store's watcher on `activeTool` is the only thing that discards a draft after a replace, and a missed watcher shows a stale draft on the next open. A store test covers it.
>
> — `crop-rotate adr/0003 §Consequences, Negative bullet 1, verbatim` · full text: [crop-rotate adr/0003](../../crop-rotate/adr/0003-open-tools-in-an-active-tool-slot-with-the-draft-in-the-feature-store.md)

> **Hard rule:** `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts`. May import `core`, `infra`, `render`, `shared`. Features never import each other. They coordinate through the `editor` store … Like crop-rotate, its only cross-feature import is `useEditorStore` from `@/features/editor`.
>
> — `CLAUDE.md §Module boundaries + sad.md §5 intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

Mirror `src/features/crop-rotate/store.ts`: `open()` calls `editor.openTool('adjust')` and returns its refusal; on success copy `work.adjustments` to `draft` and `atOpen`; every change pushes `editor.setPreviewAdjustments(draft)`. Field state: `pending: Partial<Record<AdjustmentKey, string>>`; `commitField(key)` runs `parseAdjustmentField`. `apply()` → `editor.applyAdjustments(draft)` then `closeTool()`; `cancel()` → drop pending, `closeTool()`. A `watch(() => editor.activeTool, …, { flush: 'sync' })` drops Draft and pending when it is no longer `'adjust'`. Compare and Auto are T13 (same file).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`useAdjustStore`: `open()`, `draft`, `setValue(key, n)`, `setPending(key, text)`, `commitField(key)`, `resetOne(key)`, `reset()`, `apply()`, `cancel()`.)

## Acceptance criteria

### AC-05 — error

> **Given** the "Adjust" tool is open
> **When** the Editor types a value in a slider's number field that is outside its range, fractional, empty or not a number
> **Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound (−100 or +100, or 0% or 100%), a fractional value rounds to the nearest whole number with an exact half rounding up (2.5 becomes 3, −2.5 becomes −2), and an empty or non-numeric value returns to the previous value. A value is a number under the same rule as crop-rotate AC-07: plain decimal notation with an optional sign and one decimal point or decimal comma, however long; scientific notation such as `1e2` is not a number. In the grayscale and sepia fields a trailing "%" is accepted, so "60%" means 60. Nothing is checked while the Editor is still typing, and pressing Enter in a field only applies the value and does not apply the tool
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — happy path

> **Given** the Editor has changed one or more sliders in the open "Adjust" tool
> **When** the Editor chooses Cancel or presses Escape
> **Then** the tool closes and the Work keeps the Adjustments it had before the tool was opened, with its Unsaved edits unchanged
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — happy path

> **Given** Adjustments were applied earlier to the open Work
> **When** the Editor opens the "Adjust" tool again and resets one slider or all of them
> **Then** the tool shows the applied values. Double-clicking a slider, or typing 0 in its field, sets that slider to its neutral value. Reset sets all seven sliders to their neutral values. Both change only the Draft and take effect on Apply; after Reset and Apply, the Work's pixels are exactly the pixels it had before any Adjustment was applied (AC-06), because the Adjustments never change the Original
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] Setup store `useAdjustStore` with `open`, `draft`, `atOpen`, `setValue`, `resetOne`, `reset`, `apply`, `cancel` — `src/features/adjust/store.ts`
- [ ] Pending text per key + `commitField` through `parseAdjustmentField` — `src/features/adjust/store.ts`
- [ ] `activeTool` watcher drops Draft and pending — `src/features/adjust/store.ts`
- [ ] Public `useAdjustStore` — `src/features/adjust/index.ts`
- [ ] Tests against a real editor store (Pinia testing) — `src/features/adjust/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `open()` with no Work / during export / crop-rotate open | returns the refusal reason; no Draft |
| Change then Cancel | Work and revision unchanged (AC-09) |
| Reset then Cancel | Work keeps its applied values |
| Reset then Apply on an adjusted Work | Work gets `NEUTRAL_ADJUSTMENTS`; revision raised |
| Change and change back by hand, then Apply | revision unchanged (AC-11) |
| Typing pending, then Cancel | pending discarded, nothing committed |
| Replace succeeds while open | watcher drops the Draft; reopening shows the new Work's neutral values (AC-17) |
| Replace declined or read fails | Draft kept (no `activeTool` change) |
| `commitField` with `"0"` | that key goes neutral (AC-10) |

## Definition of Done

- [ ] Store tests prove AC-09, AC-10, AC-11 (incl. change-and-back), AC-17 (Draft dropped only when the slot closes) and AC-05 commit behaviour
- [ ] Every Draft change reaches `editor.previewAdjustments`; the Work changes only on `apply()`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
