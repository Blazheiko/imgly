---
id: T4
title: "Add Work.drawing (DrawingLayer | null) and the render/drawing layer module: create, copy, release with ledger counts, readRect and hasAnyMark"
layer: "infra"
deps: []
blocks: ["T5", "T6", "T7", "T11"]
acs: ["AC-05", "AC-13"]
files_hint: ["src/core/document.ts", "src/core/document.test.ts", "src/render/drawing/layer.ts", "src/render/drawing/layer.test.ts", "src/render/drawing/index.ts", "src/render/index.ts", "src/shared/bitmap-ledger.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 49 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Add Work.drawing (DrawingLayer | null) and the render/drawing layer module: create, copy, release with ledger counts, readRect and hasAnyMark

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** T5 — Add the painter: paintSegment and paintDot with Brush source-over and Eraser destination-out under setTransform(frameToOriginal) and clip(crop), the dirty rectangle and the alpha-lowered check · T6 — Composite the layer in the shared shader (u_layer, u_draw) and add PreviewRenderer.setLayer and updateLayer with context-loss restore · T7 — Give the tool slot the 'draw' tool: keep Crop and View on open, previewLayer and setPreviewLayer, layerChanged, applyDrawing with the change flag, ExportSnapshot.drawing and the export refusal text · T11 — Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace.
- **Wave:** 1 — alongside T1, T2, T3.
- **Lane:** shares `src/render/drawing/index.ts` with T5 — serialized.

## Why (user story)

> **US-03: Fix mistakes**
>
> **As a** Editor  
> **I want** to erase parts of what I drew, or clear the whole drawing, without touching the photo  
> **So that** a slip of the hand never costs me the image underneath
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It gives the Work its Drawing layer and the only code allowed to create and free that layer, so Clear and a replaced Work free memory at once.

## Inlined context

> **core.** `Work` gains `drawing: DrawingLayer | null`, `null` in `createWork`. `DrawingLayer` holds the layer's `width` and `height` (always the Original's), an `id` from `newId()` that is new for every applied layer, and its `pixels`, which `core` never reads, as with `Original.pixels`.
> **render.** `src/render/drawing/` owns the bitmap: an `OffscreenCanvas` of W₀×H₀ with a `2d` context created with `willReadFrequently: true` … It exposes create, copy, paint (ADR-0002), clear, read a rectangle, and release. Release sets the canvas to 0×0, so the 64 MB backing store is freed at once rather than at the next garbage collection, and it is counted in the bitmap ledger next to `closeBitmap()`.
> **When it exists.** … Clear sets the Draft to `null`. Apply stores the Draft as it stands, so an applied empty layer is `null`.
>
> — `adr/0001 §Decision outcome, How it works, abridged` · full text: [adr/0001](../adr/0001-hold-the-drawing-layer-as-one-bitmap-in-the-original-pixel-space-created-on-the-first-mark.md)

> src/core/document.ts           + Work.drawing: DrawingLayer | null; DrawingLayer { id, width, height, pixels }
> src/render/drawing/            Canvas 2D bitmap (repo ADR 0004)
> ├── layer.ts                   createLayer, copyLayer, releaseLayer (0×0 + ledger), readRect, hasAnyMark
>
> — `sad.md §5, Internal decomposition, abridged` · full text: [sad.md](../sad.md)

> `closeBitmap()` before dropping any `ImageBitmap` (`src/shared/bitmap-ledger.ts`), so e2e can count what is retained
>
> — `sad.md §2, Conventions, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
> `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder — May import: `core`, `shared`
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, table rows + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Compile-coupled (folded in):** adding the required `drawing` field breaks every `Work` literal — fix `createWork` and any test fixture that builds a `Work` by hand in this same task. `DrawingLayer<TPixels = unknown>` mirrors `Original<TPixels>`; `render/drawing` uses `DrawingLayer<OffscreenCanvas>`. The ledger gains `layersCreated` / `layersReleased` counters under the same `TRACKING` guard, and `resetBitmapLedger` zeroes them. happy-dom has no `OffscreenCanvas` 2D: inject a canvas factory (default `new OffscreenCanvas`) so tests can pass a fake, the same way the editor injects `rendererFactory`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (`createLayer(size)`, `copyLayer(layer)`, `releaseLayer(layer)`, `readRect(layer, rect): ImageData`, `hasAnyMark(layer): boolean`.)

## Acceptance criteria

### AC-05 — happy path

> **Given** the "Draw" tool is open on a Work whose Drawing layer has marks
> **When** the Editor chooses Clear
> **Then** every mark disappears from the Preview at once, without a confirmation. Clear empties the whole Drawing layer: the marks applied earlier and the marks hidden outside a narrower Crop (AC-08) are removed too, so widening the Crop after Clear and Apply shows no mark. Clear changes only the Draft: Apply makes the empty Drawing layer the Work's, and Cancel brings back the marks applied before the tool was opened. Strokes drawn after Clear in the same Draft are kept
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — cross-context

> **Given** the "Draw" tool is open with a Draft that is not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with an empty Drawing layer. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `DrawingLayer` type and `Work.drawing`, `null` in `createWork`; update hand-built `Work` fixtures — `src/core/document.ts`, `src/core/document.test.ts`
- [ ] Layer module with an injectable canvas factory, `willReadFrequently: true` — `src/render/drawing/layer.ts`
- [ ] Ledger counters `layersCreated` / `layersReleased` — `src/shared/bitmap-ledger.ts`
- [ ] Barrels — `src/render/drawing/index.ts`, `src/render/index.ts`
- [ ] Tests with a fake 2D canvas — `src/render/drawing/layer.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| copyLayer then paint the copy | the source layer is unchanged (ADR-0004 immutability) |
| releaseLayer twice | second call is a no-op and is not double-counted |
| readRect partly outside the layer | clamped to the layer; an empty rect returns null, not a throw |
| hasAnyMark on a fully transparent layer | false |
| a new Work | `drawing` is `null` (AC-13: the new Work starts with an empty Drawing layer) |

## Definition of Done

- [ ] document and layer tests cover each Edge case row
- [ ] ledger counts are zero in production builds (`TRACKING` false)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
