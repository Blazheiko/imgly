---
id: T15
title: "Build AdjustControls: seven SliderFields in three groups with neutral marks, press-and-hold Compare, Auto with its hint line, Reset / Cancel / Apply"
layer: "ui"
deps: ["T11", "T13"]
blocks: ["T16"]
acs: ["AC-01", "AC-05", "AC-10", "AC-12", "AC-13"]
files_hint: ["src/features/adjust/AdjustControls.vue", "src/features/adjust/AdjustControls.test.ts", "src/features/adjust/messages.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 79 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T15 — Build AdjustControls: seven SliderFields in three groups with neutral marks, press-and-hold Compare, Auto with its hint line, Reset / Cancel / Apply

## Place in the sequence

- **Blocked by:** T11 — Add an optional 'neutral' to SliderField: double-clicking the range sets it, and register the option in the design system · T13 — Add Compare (held flag, neutral preview, ends on blur and close) and Auto (sampleWork → autoAdjust → four values or the nothing hint) to the adjust store.
- **Blocks:** T16 — Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark.
- **Wave:** 6 — alone in its wave.
- **Lane:** shares `src/features/adjust/messages.ts` with T14; shares `src/features/adjust/AdjustControls.vue` with T20 — serialized.

## Why (user story)

> **US-01: Make a dull photo lighter or punchier**
>
> **As a** Editor  
> **I want** to change the brightness and contrast of the image with sliders and see the result while I drag  
> **So that** a dark or flat photo looks the way I remember it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **US-06: Fix a photo in one click**
>
> **As a** Editor  
> **I want** one action that sets brightness, contrast and colour balance for me  
> **So that** I get a good starting point quickly and can fine-tune it with the sliders
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It is the panel the Editor actually drives — every value, Compare and Auto are one control away.

## Inlined context

> 1. **Light:** `SliderField` "Brightness" and "Contrast", −100 to 100.
> 2. **Colour:** `SliderField` "Saturation", "Temperature" and "Tint", −100 to 100.
> 3. **Effects:** `SliderField` "Grayscale" and "Sepia", 0 to 100, with the unit "%" next to the field (the field holds the bare number).
>
>    Every slider has step 1, a mark at its neutral value (0), and its value in the number field next to it. Double-clicking the slider sets it to neutral (AC-10). Its tooltip is "Double-click to reset".
> 4. **Actions:** `BaseButton` secondary "Compare" (held, shown pressed while held) and `BaseButton` secondary "Auto". Below them is one line of hint text, `role="status"`, in `--font-size-xs` and `--color-text-muted`. It is empty unless Auto found nothing to correct.
> 5. **Footer:** `BaseButton` ghost "Reset" on the left; `BaseButton` secondary "Cancel" and `BaseButton` primary "Apply" on the right.
>
> — `screens.md §SCR-03, panel layout, verbatim` · full text: [screens.md](../screens.md)

> | typing (pending) | … Nothing is checked yet, and the Preview keeps the previous value (AC-05) | `NumberField` pending text | — |
> | validation | … No inline error message, per the canon's §Validation: the corrected value is the feedback | `NumberField` showing the corrected value | — |
> | comparing | Compare held by the mouse, by `Space` or `Enter` on the focused button … Compare shows as pressed. The sliders keep showing the Draft | … `BaseButton` `pressed` | wireframe 03-b |
> | display lost | … "Auto" is `disabled` while the display is lost or being restored (F4). The panel stays, so the sliders, Cancel and Apply still work | … | — |
>
> — `screens.md §SCR-03, states typing / validation / comparing / display lost, abridged` · full text: [screens.md](../screens.md)

> | `Tab` | SCR-03 | Reaches every control in panel order: each slider then its number field, top to bottom, then Compare, Auto, Reset, Cancel, Apply | AC-21 |
> | `Enter` / `Space` held | Compare focused | Holds Compare; releasing the key ends it | AC-08 |
>
> — `screens.md §Keyboard, Tab + Compare rows, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** Styling: plain CSS with `<style scoped>`. Every colour, spacing value and font comes from `var(--…)` in `src/shared/styles/tokens.css`. Don't add a UI kit or CSS framework. Reuse `src/shared/ui/` primitives, and register any new primitive in `docs/design-system.md`.
>
> — `CLAUDE.md §Conventions, Styling, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Hard rule:** `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts`. May import `core`, `infra`, `render`, `shared`. Features never import each other. They coordinate through the `editor` store … Like crop-rotate, its only cross-feature import is `useEditorStore` from `@/features/editor`.
>
> — `CLAUDE.md §Module boundaries + sad.md §5 intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

Reuses `SliderField` (with T11's `neutral`, `marks: [0]`, `unit: '%'` for the last two), `NumberField` via SliderField, `BaseButton` (`pressed`). Compare: `pointerdown` → `startCompare`, `pointerup`/`pointercancel`/`pointerleave` → `endCompare`; `keydown` Space/Enter (not repeat) → start, `keyup` → end; stop those keys from reaching the tool's Enter-applies handler. Auto `disabled` when `editor.display` is not `'ok'`. Field text goes through the store's `setPending` / `commitField` (T12) via SliderField's `normalize` hook. Layout tokens only (`--panel-width` etc.). Keyboard shortcuts outside the panel are T16.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Adjust" tool, drags the brightness slider to +30 and chooses Apply
> **Then** while the slider moves, the Preview shows the Work with the slider's latest value at least 30 times per second (§6); values skipped during a fast drag need not be shown, and the value where the slider stops is always shown. On Apply the tool closes and the Preview keeps showing it. The tool shows seven sliders in this order: brightness, contrast, saturation, temperature and tint from −100 to +100, and grayscale and sepia from 0% to 100%, each with its current value in a number field next to it and its neutral value (0, or 0%) marked. All values are whole numbers. The grayscale and sepia fields hold the bare number with a "%" label next to the field. The tool opens with the Work's current Adjustments, which are neutral for a newly opened Work. After Apply the Work has Unsaved edits (AC-11)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — error

> **Given** the "Adjust" tool is open
> **When** the Editor types a value in a slider's number field that is outside its range, fractional, empty or not a number
> **Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound (−100 or +100, or 0% or 100%), a fractional value rounds to the nearest whole number with an exact half rounding up (2.5 becomes 3, −2.5 becomes −2), and an empty or non-numeric value returns to the previous value. A value is a number under the same rule as crop-rotate AC-07: plain decimal notation with an optional sign and one decimal point or decimal comma, however long; scientific notation such as `1e2` is not a number. In the grayscale and sepia fields a trailing "%" is accepted, so "60%" means 60. Nothing is checked while the Editor is still typing, and pressing Enter in a field only applies the value and does not apply the tool
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — happy path

> **Given** Adjustments were applied earlier to the open Work
> **When** the Editor opens the "Adjust" tool again and resets one slider or all of them
> **Then** the tool shows the applied values. Double-clicking a slider, or typing 0 in its field, sets that slider to its neutral value. Reset sets all seven sliders to their neutral values. Both change only the Draft and take effect on Apply; after Reset and Apply, the Work's pixels are exactly the pixels it had before any Adjustment was applied (AC-06), because the Adjustments never change the Original
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — happy path

> **Given** the "Adjust" tool is open on an image that is not all one colour
> **When** the Editor chooses Auto
> **Then** the brightness, contrast, temperature and tint sliders move to values computed from the pixels inside the Work's Crop, and the Preview shows the result; saturation, grayscale and sepia stay as they were. The values are computed from the Work with its Geometry and without any Adjustments, and they replace the four sliders' values instead of adding to them, so choosing Auto again gives the same values. The Editor can change the values afterwards, and they reach the Work only on Apply. Fully transparent pixels are ignored
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — domain invariant

> **Given** the "Adjust" tool is open
> **When** the Editor chooses Auto
> **Then** the values it sets are whole numbers between −50 and +50, so Auto never pushes a slider to an extreme, and the same Work with the same Geometry always gets the same values in the same browser; between the target browsers each value differs by at most 1. When the pixels inside the Crop that are not fully transparent all have the same colour, or there are none, there is nothing to measure: the sliders stay as they were and a hint says there is nothing to correct automatically
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Three groups, seven SliderFields from `ADJUSTMENT_KEYS` + `ADJUSTMENT_RANGES` — `src/features/adjust/AdjustControls.vue`
- [ ] Compare press-and-hold (pointer + Space/Enter), Auto (disabled when display not ok), hint line — `AdjustControls.vue`
- [ ] Reset / Cancel / Apply footer wired to the store — `AdjustControls.vue`
- [ ] Any copy missing from the catalog — `src/features/adjust/messages.ts`
- [ ] Component tests (happy-dom) for every state above — `src/features/adjust/AdjustControls.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Typing "150" then blur in Contrast | field shows 100; Draft 100 |
| Typing "60%" then Enter in Sepia | field shows 60; tool not applied |
| Double-click Temperature at 35 | Temperature 0 |
| Compare: pointer leaves the button while held | Compare ends |
| Space held on Compare (repeats) | one start, end on keyup |
| Display restoring | Auto disabled; sliders, Cancel, Apply work |
| Auto nothing to correct | hint line shows the copy; clears on the next change |

## Definition of Done

- [ ] Component tests prove the order and ranges, neutral marks, "%" units, field commit rules, double-click reset, Compare hold by pointer and keys, Auto states and the hint line, and the footer buttons
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
