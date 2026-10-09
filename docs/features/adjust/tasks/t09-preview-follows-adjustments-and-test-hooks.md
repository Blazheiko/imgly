---
id: T9
title: "Make PreviewCanvas draw previewAdjustments ?? work.adjustments, and give the e2e hooks setAdjustments and an adjusted previewAt100"
layer: "wiring"
deps: ["T5", "T8"]
blocks: ["T16", "T17"]
acs: ["AC-01", "AC-18"]
files_hint: ["src/features/editor/components/PreviewCanvas.vue", "src/features/editor/components/PreviewCanvas.test.ts", "src/app/test-hooks.ts", "e2e/test-hooks.d.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 35 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Make PreviewCanvas draw previewAdjustments ?? work.adjustments, and give the e2e hooks setAdjustments and an adjusted previewAt100

## Place in the sequence

- **Blocked by:** T5 — Add the seven-step colour block to the shared shader (u_adjust) and PreviewRenderer.setAdjustments · T8 — Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments.
- **Blocks:** T16 — Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark · T17 — Add the e2e fidelity suite: each slider at its anchors vs Preview, all seven combined, with and without a Geometry, neutral = 0 difference, exact alpha, lossless round trip, smaller sizes.
- **Wave:** 4 — alongside T6, T7, T14.
- **Lane:** own lane.

## Why (user story)

> **US-07: Export what I see after adjusting**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Adjustments I applied  
> **So that** the saved file looks exactly like the Preview, and other tools show the same image
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It connects the Draft and the applied values to the screen — including inside "Crop and rotate" — and lets e2e reach any setting without the UI.

## Inlined context

> `PreviewCanvas` passes `previewAdjustments ?? work.adjustments` to `renderer.setAdjustments`. Because of that, "Crop and rotate" shows the applied Adjustments over the whole turned image with no new code there (AC-18).
>
> — `sad.md §5, Cross-feature changes, PreviewCanvas bullet, abridged` · full text: [sad.md](../sad.md)

> | Test hooks | The e2e build's `window.__imglyTest` gains a way to set Adjustments directly, so the fidelity tests reach every slider at −100, −50, +50 and +100 (0%, 50% and 100%), with and without a Geometry, without driving the UI. The existing `previewAt100()` hook (the Preview's own rendering at 100%, `src/app/test-hooks.ts`) renders with the Work's Adjustments too, so the fidelity comparison stays Preview against Export |
>
> — `sad.md §8, Test hooks row, verbatim` · full text: [sad.md](../sad.md)

`previewAt100` today builds its own program in `renderAt100()`; set the uniforms there with T5's `setAdjustmentUniforms`. `setAdjustments(a)` goes through `editor.applyAdjustments(a)` (an edit, like the existing `setGeometry` hook). Also expose `adjustments` on the `work()` snapshot.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`window.__imglyTest.setAdjustments(a)`, `work().adjustments`; `previewAt100()` now adjusted.)

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Adjust" tool, drags the brightness slider to +30 and chooses Apply
> **Then** while the slider moves, the Preview shows the Work with the slider's latest value at least 30 times per second (§6); values skipped during a fast drag need not be shown, and the value where the slider stops is always shown. On Apply the tool closes and the Preview keeps showing it. The tool shows seven sliders in this order: brightness, contrast, saturation, temperature and tint from −100 to +100, and grayscale and sepia from 0% to 100%, each with its current value in a number field next to it and its neutral value (0, or 0%) marked. All values are whole numbers. The grayscale and sepia fields hold the bare number with a "%" label next to the field. The tool opens with the Work's current Adjustments, which are neutral for a newly opened Work. After Apply the Work has Unsaved edits (AC-11)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** an image is open with applied Adjustments
> **When** the Editor opens the "Crop and rotate" tool, or tries to open one tool while the other is open
> **Then** the "Crop and rotate" tool shows the whole image with its applied Adjustments, including the area outside the crop frame, so widening the frame never shows a seam, and any Geometry the Editor applies keeps the Adjustments as they are. Only one of the two tools can be open at a time: while one is open, the other's button is unavailable with a hint to apply or cancel the open tool first, and its keyboard shortcut shows the same hint, except while a text field has focus, when the shortcut does nothing (AC-21, crop-rotate AC-20)
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Watch `previewAdjustments ?? work.adjustments` → `renderer.setAdjustments` (immediate) — `src/features/editor/components/PreviewCanvas.vue`
- [ ] Component test with the fake renderer: Work values, Draft wins while set, back to Work after close, crop-rotate open still uses Work values — `PreviewCanvas.test.ts`
- [ ] `setAdjustments` hook, `adjustments` in `work()`, uniforms in `renderAt100` — `src/app/test-hooks.ts`, `e2e/test-hooks.d.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Crop and rotate open on an adjusted Work | the whole turned image is drawn with `work.adjustments` (AC-18) |
| Adjust tool closed by Cancel | renderer gets `work.adjustments` again |
| Renderer recreated after a lost context | current values set again |

## Definition of Done

- [ ] PreviewCanvas tests prove which Adjustments reach the renderer in each tool state
- [ ] Typecheck covers the new hook in `e2e/test-hooks.d.ts`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
