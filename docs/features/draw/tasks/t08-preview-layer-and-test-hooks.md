---
id: T8
title: "Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger"
layer: "wiring"
deps: ["T5", "T6", "T7"]
blocks: ["T9", "T16", "T17"]
acs: ["AC-05", "AC-10", "AC-11"]
files_hint: ["src/features/editor/components/PreviewCanvas.vue", "src/features/editor/components/PreviewCanvas.test.ts", "src/app/test-hooks.ts", "e2e/test-hooks.d.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 44 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger

## Place in the sequence

- **Blocked by:** T5 — Add the painter: paintSegment and paintDot with Brush source-over and Eraser destination-out under setTransform(frameToOriginal) and clip(crop), the dirty rectangle and the alpha-lowered check · T6 — Composite the layer in the shared shader (u_layer, u_draw) and add PreviewRenderer.setLayer and updateLayer with context-loss restore · T7 — Give the tool slot the 'draw' tool: keep Crop and View on open, previewLayer and setPreviewLayer, layerChanged, applyDrawing with the change flag, ExportSnapshot.drawing and the export refusal text.
- **Blocks:** T9 — Spike the hot path: a @perf e2e that paints scripted Strokes through the hooks at 1 px and 200 px, at Fit and at 100%, and records the frame interval and the pointer-to-frame latency · T16 — Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark · T17 — Add the e2e fidelity suite: reference drawing vs Preview at 100% for each Geometry case and with Adjustments, empty layer = 0, Geometry round trips = 0, image pixels unchanged outside marks, smaller sizes and the transparency hint.
- **Wave:** 3 — alongside T10, T11.
- **Lane:** own lane.

## Why (user story)

> **US-06: Export what I see after drawing**
>
> **As a** Editor  
> **I want** the Export and the other tools to show the drawing I applied, exactly as the Preview shows it  
> **So that** the saved file looks exactly like what I approved
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It shows the Drawing layer in the Preview and lets every pixel test reach any drawing without scripting the pointer.

## Inlined context

> - **editor `PreviewCanvas.vue`**: passes `activeTool === 'draw' ? previewLayer : work.drawing` to `renderer.setLayer()`, so an empty Draft after Clear shows no marks at once (AC-05) and closing the tool shows the Work's layer again.
>
> — `sad.md §5, Cross-feature changes, PreviewCanvas bullet, abridged` · full text: [sad.md](../sad.md)

> The e2e build's `window.__imglyTest` gains a way to put a reference drawing on the Work directly: Strokes at 1, 12 and 200 px in the 10 preset colours plus erased parts, painted through the same painter. The fidelity, round-trip and memory tests then reach every case without scripting the pointer. `previewAt100()` renders with the Work's layer, so the comparison stays Preview against Export. Scripted pointer moves at 120 per second drive only the timing and the AC-01 path tests
>
> — `sad.md §8, Test hooks, verbatim` · full text: [sad.md](../sad.md)

> The bitmap ledger counts created and released layers in DEV and e2e builds, so e2e can assert that exactly one applied layer, or none, is retained after Apply, Cancel and replacing the Work (ADR-0004).
>
> — `sad.md §7, Monitoring, ledger bullet, verbatim` · full text: [sad.md](../sad.md)

Hooks go through the editor store, never around it: `setReferenceDrawing()` builds a layer with T4/T5 and calls the store so `work.drawing` is set as an Apply would (`applyDrawing(layer, true)`); `paintStroke(points, style)` paints through the painter into a fresh layer for the T9 spike and calls `layerChanged` per segment. Mirror how `setAdjustments` was added (`src/app/test-hooks.ts` L113–L150).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (e2e-only `window.__imglyTest` additions: `setReferenceDrawing()`, `paintStroke(points, style)`, `layerLedger()`; `previewAt100()` now includes the layer.)

## Acceptance criteria

### AC-05 — happy path

> **Given** the "Draw" tool is open on a Work whose Drawing layer has marks
> **When** the Editor chooses Clear
> **Then** every mark disappears from the Preview at once, without a confirmation. Clear empties the whole Drawing layer: the marks applied earlier and the marks hidden outside a narrower Crop (AC-08) are removed too, so widening the Crop after Clear and Apply shows no mark. Clear changes only the Draft: Apply makes the empty Drawing layer the Work's, and Cancel brings back the marks applied before the tool was opened. Strokes drawn after Clear in the same Draft are kept
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — cross-context

> **Given** marks have been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry and its Adjustments and the Drawing layer on top, matching the Preview (§6 Fidelity) at full size. The Drawing layer is never adjusted, so a red mark is exported as the same red at any Adjustments, grayscale 100% included. An Export at a smaller size is the full-size Export, marks included, reduced to that size. The transparency hint of export AC-15 is shown exactly when the drawn result still has a transparent pixel inside the Crop. An Export never contains a Draft that has not been applied (AC-15)
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — cross-context

> **Given** the Work has applied marks on its Drawing layer
> **When** the Editor opens the "Adjust" tool or the "Crop and rotate" tool, or opens the "Draw" tool on a Work with applied Geometry and Adjustments
> **Then** in the "Adjust" tool the Preview shows the marks over the image unchanged by the Draft, and Compare's "Before" view shows them too, because Adjustments never touch the Drawing layer. The "Crop and rotate" tool shows the whole image with all its marks, including the ones outside the crop frame, so widening the frame shows them where they will be. In the "Draw" tool the Editor draws over the image as it stands with its Geometry and its applied Adjustments
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Watch `activeTool`, `previewLayer`, `work.drawing` → `renderer.setLayer(...)` — `src/features/editor/components/PreviewCanvas.vue`
- [ ] Tests with the fake renderer: draw open → Draft; null Draft → setLayer(null); close → work.drawing — `PreviewCanvas.test.ts`
- [ ] Hooks + `previewAt100` with layer — `src/app/test-hooks.ts`; types — `e2e/test-hooks.d.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| draw open and Draft null (after Clear) | setLayer(null) although work.drawing has marks (AC-05) |
| 'adjust' open on a Work with marks | setLayer(work.drawing) — marks visible, unadjusted (AC-11) |
| 'crop-rotate' open | setLayer(work.drawing) sampled through the whole-image transform (AC-11) |
| hooks in a production build | absent (VITE_E2E_HOOKS guard unchanged) |

## Definition of Done

- [ ] PreviewCanvas tests cover each Edge case row
- [ ] hooks typecheck in `e2e/test-hooks.d.ts`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
