---
id: T13
title: "Add Compare (held flag, neutral preview, ends on blur and close) and Auto (sampleWork → autoAdjust → four values or the nothing hint) to the adjust store"
layer: "app"
deps: ["T6", "T12"]
blocks: ["T15"]
acs: ["AC-08", "AC-12", "AC-13"]
files_hint: ["src/features/adjust/store.ts", "src/features/adjust/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 62 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Add Compare (held flag, neutral preview, ends on blur and close) and Auto (sampleWork → autoAdjust → four values or the nothing hint) to the adjust store

## Place in the sequence

- **Blocked by:** T6 — Add PreviewRenderer.sampleCrop(geometry, maxSide) into a temporary framebuffer and the editor store's sampleWork() · T12 — Add the adjust store: Draft and values at open, set / commit typed fields, reset one or all, apply and cancel.
- **Blocks:** T15 — Build AdjustControls: seven SliderFields in three groups with neutral marks, press-and-hold Compare, Auto with its hint line, Reset / Cancel / Apply.
- **Wave:** 5 — alongside T17.
- **Lane:** shares `src/features/adjust/store.test.ts`, `src/features/adjust/store.ts` with T12 — serialized.

## Why (user story)

> **US-04: See before and after**
>
> **As a** Editor  
> **I want** to hold a control and see the photo without any adjustments, then let go to see my changes again  
> **So that** I can judge whether my changes actually improve it
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

> **US-06: Fix a photo in one click**
>
> **As a** Editor  
> **I want** one action that sets brightness, contrast and colour balance for me  
> **So that** I get a good starting point quickly and can fine-tune it with the sliders
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It makes before/after and the one-click fix pure state changes the UI only has to trigger.

## Inlined context

> The Preview reads `editor.previewAdjustments`, which the adjust store sets to the Draft, or to neutral values while Compare is held (AC-08).
>
> — `sad.md §4, decided inline, abridged` · full text: [sad.md](../sad.md)

> S->>S: marks Compare as held, the Draft and the Work stay as they are
> S->>R: draws with neutral uniforms
> … the Draft changes while Compare is held … S->>S: changes the Draft … UI-->>U: Preview still shows Before
> … released / the window loses focus / the tool closes … S->>S: marks Compare as released
> S->>R: draws the current Draft, or the Work if the tool closed
>
> — `sad.md §6, F3 steps, abridged` · full text: [sad.md](../sad.md)

> S->>R: asks for a sample of the Crop with the Work's Geometry and no Adjustments
> …
> alt no pixel left, or all one colour: S-->>UI: nothing to measure, the Draft is unchanged
> else: S->>S: replaces those four values in the Draft, saturation, grayscale and sepia stay
> S->>R: draws the new Draft, unless Compare is held (F3)
>
> — `sad.md §6, F4 steps, abridged` · full text: [sad.md](../sad.md)

> | empty (nothing to correct) | … the hint line reads "Nothing to correct automatically." It clears on the next change to the Draft |
>
> — `screens.md §SCR-03, empty (nothing to correct) row, abridged` · full text: [screens.md](../screens.md)

State: `comparing: boolean`, `nothingToCorrect: boolean`. `startCompare()` / `endCompare()`; while comparing every push to the editor is `NEUTRAL_ADJUSTMENTS`, and `endCompare()` pushes the current Draft. The `activeTool` watcher (T12) also ends Compare. `auto()`: `editor.sampleWork()` → on `err` (DISPLAY_LOST) do nothing (the UI disables Auto); on `nothing` set `nothingToCorrect`; on `values` replace the four keys. Any other Draft change clears `nothingToCorrect`. Window blur is wired by the UI (T16), calling `endCompare()`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`comparing`, `startCompare()`, `endCompare()`, `auto()`, `nothingToCorrect`.)

## Acceptance criteria

### AC-08 — happy path

> **Given** the "Adjust" tool is open with any Draft
> **When** the Editor holds the Compare button (with the mouse, or with Space or Enter while it has focus), or holds the \ key while no text field has focus. The \ key is the key in that position on a US keyboard, whatever the keyboard layout
> **Then** while it is held, the Preview shows the Work with its Geometry and no Adjustments at all, and a "Before" label is shown over it; when it is released, the Preview shows the Draft again. Compare also ends when the window loses focus or the tool closes. Any change to the Draft while Compare is held (moving a slider, typing a value, Auto, Reset or a per-slider reset) changes the Draft, but the Preview keeps showing "Before" until Compare is released. Compare never changes the Work, the Draft or the Unsaved edits
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] Compare state and the neutral/Draft push rule — `src/features/adjust/store.ts`
- [ ] `auto()` over `editor.sampleWork()` + `autoAdjust`; `nothingToCorrect` set/cleared — `src/features/adjust/store.ts`
- [ ] Tests with the fake renderer's configurable sample — `src/features/adjust/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Slider moved while comparing | Draft changes; `previewAdjustments` stays neutral until `endCompare()` |
| Auto while comparing | four values replaced; Preview stays "Before" |
| Tool closes while comparing (Apply, Cancel, replace) | Compare ends; nothing about the Work changes because of Compare |
| Auto twice | same four values (replace, not add) |
| Auto with saturation −40, sepia 30% | those stay −40 and 30 |
| Auto on one colour / all transparent | Draft unchanged, `nothingToCorrect` true; next change clears it |
| Auto with the display lost | `sampleWork` errs → no change, no hint |

## Definition of Done

- [ ] Store tests prove Compare never changes the Work, the Draft or the revision, Draft changes during Compare stay hidden until release, and close ends it
- [ ] Store tests prove Auto replaces only the four values, is idempotent, and sets/clears the nothing hint
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
