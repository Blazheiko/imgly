---
id: T14
title: "Add an optional swatch to SegmentedControl, register it, and build DrawControls: mode, palette, custom colour, width slider and field, Clear, Cancel and Apply"
layer: "ui"
deps: ["T11"]
blocks: ["T16"]
acs: ["AC-02", "AC-03", "AC-05", "AC-19"]
files_hint: ["src/shared/ui/SegmentedControl.vue", "src/shared/ui/primitives.test.ts", "docs/design-system.md", "src/features/draw/DrawControls.vue", "src/features/draw/DrawControls.test.ts", "src/features/draw/messages.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 62 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — Add an optional swatch to SegmentedControl, register it, and build DrawControls: mode, palette, custom colour, width slider and field, Clear, Cancel and Apply

## Place in the sequence

- **Blocked by:** T11 — Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace.
- **Blocks:** T16 — Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark.
- **Wave:** 4 — alongside T9, T13, T17.
- **Lane:** shares `src/features/draw/messages.ts` with T13 — serialized.

## Why (user story)

> **US-02: Pick the colour and width**
>
> **As a** Editor  
> **I want** to choose the brush colour from a palette or any colour I like, and set the line width  
> **So that** my marks stand out on the photo and are as thick or thin as I need
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It is the panel where the Editor picks the colour and the width and chooses Clear, Cancel or Apply.

## Inlined context

> 1. **Mode:** `SegmentedControl` "Mode" with "Brush" and "Eraser". It opens on "Brush" every time (AC-01).
> 2. **Colour:** `SegmentedControl` "Colour" with the 10 preset colours as `swatch` options, in the order of AC-02 …, wrapping onto two rows of five. Each swatch is a square filled with its colour inside a `--color-border` frame, with its name as its accessible name and tooltip. The chosen one shows the selected ring. When the colour is a custom one that matches no preset, no swatch is selected (`modelValue: null`). Next to the group is **"Custom colour"**: the browser's native colour input, drawn as a swatch of the current custom colour (or a neutral dashed square before one is chosen), with that label. … It shows the selected ring when the current colour is a custom one.
> 3. **Width:** `SliderField` "Width", 1 to 200, step 1, unit "px", with no neutral mark. The number field accepts a trailing "px" in any case, with or without spaces (AC-03). Its tooltip is "Width ([ and ], Shift for 10)".
> 4. **Footer:** `BaseButton` ghost "Clear" on the left; `BaseButton` secondary "Cancel" and `BaseButton` primary "Apply" on the right.
> The colour controls stay enabled with the Eraser selected …
>
> — `screens.md §SCR-03, panel layout, abridged` · full text: [screens.md](../screens.md)

> | `SegmentedControl` (extended: `swatch`) | … It has no way to show a colour instead of text. An optional `swatch` (a CSS colour) on an option renders a filled square in a `--color-border` frame, keeps `label` as the accessible name and tooltip, and lets the group wrap as it already does. One radiogroup primitive stays | pending |
>
> — `screens.md §New components, SegmentedControl row, abridged` · full text: [screens.md](../screens.md)

> | typing (pending) | The Editor is typing in the width field. Nothing is checked yet, and the width stays as before (AC-03) | `NumberField` pending text | — |
> | validation | The Editor leaves the width field or presses `Enter` in it (F3, AC-03). … No inline error message, per the canon's §Validation: the corrected value is the feedback | `NumberField` showing the corrected width | — |
> | cleared | "Clear" chosen (F4, AC-05). Every mark disappears from the Preview at once, with no confirmation …
>
> — `screens.md §SCR-03, typing/validation/cleared rows, abridged` · full text: [screens.md](../screens.md)

> **Hard rule:**
> **Styling:** plain CSS with `<style scoped>`. Every colour, spacing value and font comes from
> `var(--…)` in `src/shared/styles/tokens.css`. Don't add a UI kit or CSS framework. Reuse
> `src/shared/ui/` primitives, and register any new primitive in `docs/design-system.md`.
>
> — `CLAUDE.md §Conventions, Styling, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

The swatch fill is the only inline colour allowed (it is data, not styling). Check how `SliderField`/`NumberField` already parse — the adjust panel passes its own parse function; pass `commitWidthText` from the store. Mirror `src/features/adjust/AdjustControls.vue` for layout and tests.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — happy path

> **Given** the "Draw" tool is open
> **When** the Editor picks a colour from the palette or from the custom colour picker, or sets the width with its slider or number field
> **Then** every Stroke made afterwards uses that colour and width, and Strokes already made keep theirs. The palette shows 10 preset colours in this order: black #000000, white #FFFFFF, red #E53935 (the first-time colour), orange #FB8C00, yellow #FDD835, green #43A047, cyan #00ACC1, blue #1E88E5, purple #8E24AA and pink #D81B60. The chosen colour is marked when it is one of them, and the custom picker offers any fully opaque colour. The width is a whole number of image pixels from 1 to 200, so a Stroke looks thicker when the Editor zooms in and has exactly that width in a full-size Export. Over the image the pointer shows a circle outline of the current width at the current zoom. The Brush and the Eraser share the width. The colour and the width are remembered as soon as they are chosen, whether the tool is then applied or cancelled, until the app is reloaded, also when another image is opened. They are tool settings, not edits, and never count as Unsaved edits. The mode is not remembered: the tool always opens on the Brush (AC-01)
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — error

> **Given** the "Draw" tool is open
> **When** the Editor types a width that is outside 1 to 200, fractional, empty or not a number
> **Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound (1 or 200), a fractional value rounds to the nearest whole number with an exact half rounding up (2.5 becomes 3), and an empty or non-numeric value returns to the previous width. A value is a number under the same rule as crop-rotate AC-07 and adjust AC-05: plain decimal notation with an optional sign and one decimal point or decimal comma, however long; scientific notation such as `1e2` is not a number. A trailing "px" is accepted in any letter case and with or without spaces before it, so "20px", "20 px" and "20PX" all mean 20. Nothing is checked while the Editor is still typing, and pressing Enter in the field only applies the value and does not apply the tool
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — happy path

> **Given** the "Draw" tool is open on a Work whose Drawing layer has marks
> **When** the Editor chooses Clear
> **Then** every mark disappears from the Preview at once, without a confirmation. Clear empties the whole Drawing layer: the marks applied earlier and the marks hidden outside a narrower Crop (AC-08) are removed too, so widening the Crop after Clear and Apply shows no mark. Clear changes only the Draft: Apply makes the empty Drawing layer the Work's, and Cancel brings back the marks applied before the tool was opened. Strokes drawn after Clear in the same Draft are kept
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to draw on it
> **Then** a "Draw" action is visible in the toolbar next to "Adjust". It can be reached with Tab and activated with Enter or Space, and the D key opens it as well, under the same rule as the A key for "Adjust": the letter d, or the D key itself on a layout that types no Latin letter there. The D key does nothing while the export panel is open, while the "Draw" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab; B selects the Brush and E selects the Eraser under the same letter-first rule, silent in a text field. [ and ] make the width 1 smaller or larger, and 10 with Shift held. Each is recognised by the character it types ([ or ]) or, on a layout that does not type that character there, by its key position (the two keys right of P), so Shift+[ works although it types "{" and the German ü and + keys work too. Holding the key repeats the change, the result stays within 1 to 200 (195 plus 10 gives 200), and both are silent in a text field. Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-03). Escape cancels the tool from anywhere in it, including a field. Drawing a mark itself needs a mouse, a pen or a finger. Circling something and keeping it takes three actions: open the tool, draw, Apply
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `swatch?: string` on `SegmentedOption`; render + tests — `src/shared/ui/SegmentedControl.vue`, `primitives.test.ts`
- [ ] Register the option — `docs/design-system.md` §Component inventory
- [ ] Panel per SCR-03 order bound to the draw store — `src/features/draw/DrawControls.vue`
- [ ] Labels from the catalog — `src/features/draw/messages.ts`; tests — `DrawControls.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| custom colour equal to a preset (#1E88E5) | that preset swatch is selected |
| custom colour not a preset | no preset selected, custom swatch ringed |
| Enter in the width field | commits the width; does not apply the tool |
| Eraser selected | colour controls stay enabled |
| Tab order | mode, palette, custom colour, slider, field, Clear, Cancel, Apply |

## Definition of Done

- [ ] primitive and panel tests cover each Edge case row
- [ ] design-system.md lists the `swatch` option
- [ ] no hard-coded colours except swatch fills
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
