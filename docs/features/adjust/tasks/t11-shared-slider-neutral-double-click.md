---
id: T11
title: "Add an optional 'neutral' to SliderField: double-clicking the range sets it, and register the option in the design system"
layer: "ui"
deps: []
blocks: ["T15"]
acs: ["AC-10"]
files_hint: ["src/shared/ui/SliderField.vue", "src/shared/ui/primitives.test.ts", "docs/design-system.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 35 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Add an optional 'neutral' to SliderField: double-clicking the range sets it, and register the option in the design system

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** T15 — Build AdjustControls: seven SliderFields in three groups with neutral marks, press-and-hold Compare, Auto with its hint line, Reset / Cancel / Apply.
- **Wave:** 1 — alongside T1.
- **Lane:** own lane.

## Why (user story)

> **US-05: Change my mind without losing anything**
>
> **As a** Editor  
> **I want** to cancel my changes, reset one slider or all of them, and come back later to change applied values  
> **So that** trying a look never costs me the original photo
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It gives each Adjust slider its per-slider reset without a second slider primitive.

## Inlined context

> | `SliderField` (extended: `neutral`) | Double-clicking a slider sets it to its neutral value (AC-10). `SliderField` has no double-click behaviour. An optional `neutral` prop (double-click emits it) keeps one slider primitive, and later sliders such as brush width can leave it out | pending (update its row) |
>
> — `screens.md §New components, SliderField row, verbatim` · full text: [screens.md](../screens.md)

> Every slider has step 1, a mark at its neutral value (0), and its value in the number field next to it. Double-clicking the slider sets it to neutral (AC-10). Its tooltip is "Double-click to reset".
>
> — `screens.md §SCR-03, panel layout item 3, verbatim` · full text: [screens.md](../screens.md)

> | SliderField | `src/shared/ui/SliderField.vue:1` | default / dragging / focus-visible / disabled | The canon's clamped slider paired with a number field: a range (`min`, `max`, `step` (default 1), `aria-label` = `label`) and a `NumberField` on one `v-model`. `decimals` rounds and shows the value …, `marks` adds tick marks (a `datalist`), and the arrow keys move one step, ten with Shift. … |
>
> — `docs/design-system.md §Component inventory, SliderField row, abridged` · full text: [design-system.md](../../../design-system.md)

> **Hard rule:** Styling: plain CSS with `<style scoped>`. Every colour, spacing value and font comes from `var(--…)` in `src/shared/styles/tokens.css`. Don't add a UI kit or CSS framework. Reuse `src/shared/ui/` primitives, and register any new primitive in `docs/design-system.md`.
>
> — `CLAUDE.md §Conventions, Styling, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

The tooltip copy belongs to the caller (adjust `messages.ts`); accept it as an optional prop or pass-through `title` on the range. No new primitive.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`SliderField` prop `neutral?: number`.)

## Acceptance criteria

### AC-10 — happy path

> **Given** Adjustments were applied earlier to the open Work
> **When** the Editor opens the "Adjust" tool again and resets one slider or all of them
> **Then** the tool shows the applied values. Double-clicking a slider, or typing 0 in its field, sets that slider to its neutral value. Reset sets all seven sliders to their neutral values. Both change only the Draft and take effect on Apply; after Reset and Apply, the Work's pixels are exactly the pixels it had before any Adjustment was applied (AC-06), because the Adjustments never change the Original
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `neutral?: number`; `dblclick` on the range emits `update:modelValue` with it (only when set and not disabled) — `src/shared/ui/SliderField.vue`
- [ ] Tests: double-click emits neutral; no prop → no emit; disabled → no emit — `src/shared/ui/primitives.test.ts`
- [ ] Update the SliderField row — `docs/design-system.md`

## Edge cases

| Case | Behaviour |
|---|---|
| No `neutral` prop (export quality, straighten) | double-click does nothing new |
| Already at neutral | no emit (no-op) |
| Disabled | no emit |

## Definition of Done

- [ ] Primitive tests prove the three behaviours
- [ ] `docs/design-system.md` SliderField row mentions `neutral`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
