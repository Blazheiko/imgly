---
id: T18
title: "Add the e2e tool-flow suite: three-action paths, live Preview on drag, Compare by mouse, keys and backslash, Cancel and Reset, Auto values and the nothing hint, keyboard-only use"
layer: "tests"
deps: ["T16"]
blocks: ["T20"]
acs: ["AC-01", "AC-08", "AC-09", "AC-10", "AC-12", "AC-13", "AC-21"]
files_hint: ["e2e/adjust/tool.spec.ts", "e2e/adjust/helpers.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 69 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T18 — Add the e2e tool-flow suite: three-action paths, live Preview on drag, Compare by mouse, keys and backslash, Cancel and Reset, Auto values and the nothing hint, keyboard-only use

## Place in the sequence

- **Blocked by:** T16 — Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark.
- **Blocks:** T20 — Add the @perf suite: drag frame interval, Apply / Cancel / Reset / Compare-release and tool-ready times, Auto time, memory after 50 Applies, and export time with all seven set.
- **Wave:** 8 — alongside T19.
- **Lane:** shares `e2e/adjust/helpers.ts` with T17; shares `e2e/adjust/helpers.ts` with T19 — serialized.

## Why (user story)

> **US-08: Adjust on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the adjust tool and use it by mouse or keyboard without instructions  
> **So that** I can judge the colour tools in the open, edit and save flow
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It checks in real browsers the paths a reviewer takes — mouse and keyboard — end to end.

## Inlined context

> - AC-13 is covered by `autoAdjust` unit tests and an e2e test that records Auto's values for the reference images on all three engines and compares them within 1.
> - Spec §7's "≤ 3 actions" KPI is the e2e tool flow of AC-21.
>
> — `sad.md §10, QG-3 How verify, abridged` · full text: [sad.md](../sad.md)

> The ±1 cross-engine check uses sRGB fixtures without embedded profiles, and a differing engine is a recorded deviation in the test plan
>
> — `sad.md §11, Auto cross-engine risk, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Only what happy-dom cannot show: real pointer drags and the rendered Preview, held keys across engines, Auto on real sampled pixels. Logic already unit-tested (T12–T16) is not re-proved here. Auto's cross-engine ±1: write each engine's values to the test output and compare against a checked-in expectation per fixture.

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

### AC-08 — happy path

> **Given** the "Adjust" tool is open with any Draft
> **When** the Editor holds the Compare button (with the mouse, or with Space or Enter while it has focus), or holds the \ key while no text field has focus. The \ key is the key in that position on a US keyboard, whatever the keyboard layout
> **Then** while it is held, the Preview shows the Work with its Geometry and no Adjustments at all, and a "Before" label is shown over it; when it is released, the Preview shows the Draft again. Compare also ends when the window loses focus or the tool closes. Any change to the Draft while Compare is held (moving a slider, typing a value, Auto, Reset or a per-slider reset) changes the Draft, but the Preview keeps showing "Before" until Compare is released. Compare never changes the Work, the Draft or the Unsaved edits
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

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

### AC-21 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to change its light or colour
> **Then** an "Adjust" action is visible in the toolbar next to "Crop and rotate". It can be reached with Tab and activated with Enter or Space, and the A key opens it as well. The A key does nothing while the export panel is open, while the "Adjust" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With a slider focused, the arrow keys change it by 1 (10 with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-05). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Lightening a photo and keeping it takes three actions (open the tool, drag brightness, Apply), and an automatic fix takes three actions (open the tool, Auto, Apply)
>
> — `spec.md §5, AC-21, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Three-action paths (Adjust → drag brightness → Apply; Adjust → Auto → Apply) — `e2e/adjust/tool.spec.ts`
- [ ] Compare by mouse, Space, Enter and backslash; "Before" label; blur ends it — `tool.spec.ts`
- [ ] Cancel / Escape, Reset, double-click reset, typed values — `tool.spec.ts`
- [ ] Auto: values within ±50, idempotent, ±1 across engines, one-colour fixture hint — `tool.spec.ts` (+ fixtures)
- [ ] Keyboard-only: Tab to Adjust, A, arrows ±1/±10, Enter applies — `tool.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Fast drag | last value always shown in the Preview |
| Backslash on a non-US layout | covered by `code` (one engine with a remapped key event) |

## Definition of Done

- [ ] `pnpm test:e2e e2e/adjust/tool.spec.ts` green on Chromium, Firefox and WebKit
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
