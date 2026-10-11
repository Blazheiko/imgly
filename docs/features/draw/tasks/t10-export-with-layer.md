---
id: T10
title: "Send the applied layer to the export worker and its window fallback, render it in one or two passes, and make the crop-transparency check include the layer"
layer: "infra"
deps: ["T6", "T7"]
blocks: ["T17", "T19"]
acs: ["AC-07", "AC-10"]
files_hint: ["src/render/export/worker-handler.ts", "src/render/export/worker-handler.test.ts", "src/render/export/client.ts", "src/render/export/client.test.ts", "src/features/export/store.ts", "src/features/export/store.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "S"   # measured: 40 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Send the applied layer to the export worker and its window fallback, render it in one or two passes, and make the crop-transparency check include the layer

## Place in the sequence

- **Blocked by:** T6 — Composite the layer in the shared shader (u_layer, u_draw) and add PreviewRenderer.setLayer and updateLayer with context-loss restore · T7 — Give the tool slot the 'draw' tool: keep Crop and View on open, previewLayer and setPreviewLayer, layerChanged, applyDrawing with the change flag, ExportSnapshot.drawing and the export refusal text.
- **Blocks:** T17 — Add the e2e fidelity suite: reference drawing vs Preview at 100% for each Geometry case and with Adjustments, empty layer = 0, Geometry round trips = 0, image pixels unchanged outside marks, smaller sizes and the transparency hint · T19 — Add the e2e cross-feature suite: Unsaved edits rules, export and Ctrl/Cmd+S refused while drawing, one tool at a time in both directions, Draw refused during an export and with no image, replace while open, and marks in Crop and rotate and Adjust.
- **Wave:** 3 — alongside T8, T11.
- **Lane:** own lane.

## Why (user story)

> **US-06: Export what I see after drawing**
>
> **As a** Editor  
> **I want** the Export and the other tools to show the drawing I applied, exactly as the Preview shows it  
> **So that** the saved file looks exactly like what I approved
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It makes every Export contain the applied marks exactly as the Preview shows them, and the JPEG transparency hint follow the drawn result.

## Inlined context

> - **render/export** (`worker-handler.ts`, `client.ts`): `ExportRequest` and `AlphaRequest` gain `layer: ImageData | null`, transferred. Single-pass rendering now applies only when the Export is full size, or when the Adjustments are neutral and there is no layer. Otherwise the two passes of adjust sad.md §5 run with the layer in the first pass (AC-10).
> - **export** (`store.ts`, `messages.ts`): the snapshot's layer is read with `getImageData` once per export and per alpha check. The alpha check's cache key gains the layer id (ADR-0003).
>
> — `sad.md §5, Cross-feature changes, render/export + export bullets, abridged` · full text: [sad.md](../sad.md)

> **Export.** … The client reads the whole layer once with `getImageData` and transfers its buffer to the worker, and the worker binds it to unit 1 with the same uniforms. A full-size Export samples texel centres 1:1 as the Preview at 100% does. A smaller Export with a layer takes adjust's two-pass path … So a smaller Export is the full-size one, marks included, reduced (AC-10). The window fallback (export ADR-0003) runs the same code.
> **Transparency check.** … Its cache key gains the layer's id, which is new on every Apply. An Original with no transparent pixel still skips the check, because opaque marks cannot add transparency.
>
> — `adr/0003 §Decision outcome, How it works «Export», «Transparency check», abridged` · full text: [adr/0003](../adr/0003-composite-the-drawing-layer-in-the-shared-fragment-shader-after-the-adjustments.md)

> | Brownfield: the export's crop-transparency hint short-cuts to "yes" whenever the Original has a transparent pixel and the Geometry is the identity (`src/features/export/store.ts`, `cropTransparency`). Its cache key is the Work id plus the Geometry. … | Medium | The export task changes both. The identity short-cut applies only when `work.drawing` is `null`, the alpha check renders with the layer (ADR-0003), and the key gains the layer id. The opaque-Original short-cut stays correct, because marks cannot add transparency. …
>
> — `sad.md §11, transparency short-cut risk, abridged` · full text: [sad.md](../sad.md)

**Compile-coupled (folded in):** both request types change in `worker-handler.ts`; the store builds them and the client posts them — all three in this task. Today ``alphaKey = (work) => `${work.id}@${JSON.stringify(work.geometry)}` `` (`src/features/export/store.ts` L255) → append `@${work.drawing?.id ?? 'none'}`. Read the layer with T4's `readRect(layer, full)` and list `layer.data.buffer` in the transfer list. The worker uploads with the premultiply flag and calls T6's `setLayerUniforms`. The format-check probe builds an `ExportRequest` too — pass `layer: null`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (`ExportRequest.layer`, `AlphaRequest.layer`: `ImageData | null`, transferred.)

## Acceptance criteria

### AC-07 — domain invariant

> **Given** an image is open, with or without transparent pixels
> **When** the Editor applies any mix of Brush Strokes, Eraser Strokes and Clear
> **Then** the image's own pixels never change: everywhere no mark lies, the Preview and a full-size PNG Export show exactly the pixels the Work has with an empty Drawing layer, and after Clear and Apply a full-size PNG Export is identical to one made before anything was drawn. Brush marks are fully opaque, so inside a mark every pixel has the mark's colour, and only its smooth edge blends with the image beneath. Where a mark lies over a transparent part of the image, the Preview and the Export show the mark's colour there; everywhere else the image keeps exactly its own transparency. These exact guarantees apply to the Preview and to a full-size PNG Export. A JPEG or WebP Export, or one at a smaller size, is that full-size result encoded or reduced as the export spec defines, so pixels next to a mark may change there
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — cross-context

> **Given** marks have been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry and its Adjustments and the Drawing layer on top, matching the Preview (§6 Fidelity) at full size. The Drawing layer is never adjusted, so a red mark is exported as the same red at any Adjustments, grayscale 100% included. An Export at a smaller size is the full-size Export, marks included, reduced to that size. The transparency hint of export AC-15 is shown exactly when the drawn result still has a transparent pixel inside the Crop. An Export never contains a Draft that has not been applied (AC-15)
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Request types + worker upload to unit 1 + two-pass condition — `src/render/export/worker-handler.ts`, `worker-handler.test.ts`
- [ ] Transfer list includes the layer buffer; window fallback passes it — `src/render/export/client.ts`, `client.test.ts`
- [ ] Store reads the snapshot layer per export and per alpha check, identity short-cut only with no layer, key with layer id — `src/features/export/store.ts`, `store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| full size, neutral Adjustments, layer | one pass with u_draw true |
| smaller size, neutral Adjustments, layer | two passes, layer in the first |
| smaller size, no layer, neutral Adjustments | one pass, as before |
| opaque Original, any layer | alpha check skipped, no hint |
| transparent Original, identity Geometry, layer present | alpha check runs with the layer (no short-cut) |
| transparent Original, identity Geometry, no layer | hint shown via short-cut, as before |
| a new Apply (new layer id) | alpha cache miss, check reruns |

## Definition of Done

- [ ] unit tests cover each Edge case row
- [ ] the snapshot layer, never the Draft, is what reaches the worker (AC-10)
- [ ] pixels proven in T17
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
