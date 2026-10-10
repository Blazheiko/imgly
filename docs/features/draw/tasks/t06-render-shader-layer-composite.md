---
id: T6
title: "Composite the layer in the shared shader (u_layer, u_draw) and add PreviewRenderer.setLayer and updateLayer with context-loss restore"
layer: "infra"
deps: ["T4"]
blocks: ["T8", "T10"]
acs: ["AC-07", "AC-10", "AC-11"]
files_hint: ["src/render/shaders.ts", "src/render/shaders.test.ts", "src/render/preview-renderer.ts", "src/render/preview-renderer.test.ts", "src/render/context-loss.test.ts", "src/render/fake-gl.ts", "src/features/editor/fake-renderer.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 47 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Composite the layer in the shared shader (u_layer, u_draw) and add PreviewRenderer.setLayer and updateLayer with context-loss restore

## Place in the sequence

- **Blocked by:** T4 — Add Work.drawing (DrawingLayer | null) and the render/drawing layer module: create, copy, release with ledger counts, readRect and hasAnyMark.
- **Blocks:** T8 — Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger · T10 — Send the applied layer to the export worker and its window fallback, render it in one or two passes, and make the crop-transparency check include the layer.
- **Wave:** 2 — alongside T5, T7.
- **Lane:** own lane.

## Why (user story)

> **US-06: Export what I see after drawing**
>
> **As a** Editor  
> **I want** the Export and the other tools to show the drawing I applied, exactly as the Preview shows it  
> **So that** the saved file looks exactly like what I approved
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It puts the marks over the adjusted image in the one shader every renderer uses, so the Preview, "Adjust", "Crop and rotate" and the Export all agree.

## Inlined context

> **Shader.** The fragment shader gains `uniform sampler2D u_layer` (texture unit 1) and `uniform bool u_draw`. After the Adjustments block and before the flatten: `if (u_draw) { vec4 m = texture(u_layer, v_uv); color = m + (1.0 - m.a) * color; }`. … `u_draw` is false whenever the layer is `null` (ADR-0001), so a Work with no drawing renders exactly as today.
> **Texture.** The layer is uploaded like the Original: premultiplied RGBA8 from straight `ImageData` (the export's WebKit-safe path), with mipmaps. Each draw sets the same minification and magnification filters on both units …
> **Preview.** `PreviewRenderer` gains `setLayer(layer | null)`, which uploads the whole layer only when the bitmap it is given differs from the one it holds (an Apply hands over the Draft's bitmap with a new id and uploads nothing), and `updateLayer(rect)`, which uploads one dirty rectangle with `texSubImage2D` and regenerates the mipmaps when the View is below 100% (ADR-0002). Both request one frame. The renderer keeps the layer handle it was given, so after a lost WebGL context it re-uploads it from the CPU bitmap, as it does the Original. In "Crop and rotate" the shader samples the layer through the whole-image transform … In "Adjust" and in Compare's "Before" view, only `u_adjust` changes, and the layer is composited unadjusted (AC-11).
> **Auto adjust.** `sampleCrop` (adjust ADR-0004) keeps `u_draw` off.
>
> — `adr/0003 §Decision outcome, How it works, abridged` · full text: [adr/0003](../adr/0003-composite-the-drawing-layer-in-the-shared-fragment-shader-after-the-adjustments.md)

> The Original is sampled through the Geometry. Then the Adjustments run on unpremultiplied stored sRGB values, then the layer is composited premultiplied "over" (never adjusted), then JPEG flattens onto white. Every renderer uses this one order.
>
> — `sad.md §8, Pixel pipeline, abridged` · full text: [sad.md](../sad.md)

> | The ±2/255 tolerance between an Export with marks and the Preview at 100% may not hold on every engine. The layer's antialiased edges are partly transparent, and premultiplying them is exactly where WebKit's bitmap path went wrong before … | High | The layer is uploaded as straight `ImageData` with the premultiply flag, the path the export already trusts on all engines (ADR-0003). Both textures are sampled with the same filters, and the Preview and the Export use one shader.
>
> — `sad.md §11, fidelity risk, abridged` · full text: [sad.md](../sad.md)

**Compile-coupled (folded in):** `PreviewRenderer` gains `setLayer(layer: DrawingLayer<OffscreenCanvas> | null)` and `updateLayer(rect)`; update `src/features/editor/fake-renderer.ts` (record calls) in this task. `setLayer` reads the whole layer via T4's `readRect` and uploads it with `UNPACK_PREMULTIPLY_ALPHA_WEBGL`; key "differs" on the canvas object, not on `layer.id`. The shader source stays one string shared with the export worker (`src/render/shaders.ts`) — T10 only wires the worker to it.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (`PreviewRenderer.setLayer(layer | null)`, `PreviewRenderer.updateLayer(rect)`, `setLayerUniforms(gl, program, on)`.)

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

### AC-11 — cross-context

> **Given** the Work has applied marks on its Drawing layer
> **When** the Editor opens the "Adjust" tool or the "Crop and rotate" tool, or opens the "Draw" tool on a Work with applied Geometry and Adjustments
> **Then** in the "Adjust" tool the Preview shows the marks over the image unchanged by the Draft, and Compare's "Before" view shows them too, because Adjustments never touch the Drawing layer. The "Crop and rotate" tool shows the whole image with all its marks, including the ones outside the crop frame, so widening the frame shows them where they will be. In the "Draw" tool the Editor draws over the image as it stands with its Geometry and its applied Adjustments
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `u_layer` (unit 1), `u_draw`, the over block after `u_adjust` and before `u_flatten`; `setLayerUniforms` — `src/render/shaders.ts`, `src/render/shaders.test.ts`
- [ ] `setLayer`, `updateLayer`, shared filters on both units, mipmaps below 100%, re-upload on restore, `sampleCrop` forces `u_draw` false — `src/render/preview-renderer.ts`
- [ ] fake-gl support for unit 1 and `texSubImage2D` if missing — `src/render/fake-gl.ts`
- [ ] Tests — `src/render/preview-renderer.test.ts`, `src/render/context-loss.test.ts`; fake renderer — `src/features/editor/fake-renderer.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| setLayer(null) | `u_draw` false; no texture bound for unit 1 is sampled; output identical to today |
| setLayer with the same canvas, new id (after Apply) | no upload, one frame requested |
| updateLayer at 100% or above | texSubImage2D only, no mipmap regeneration |
| updateLayer below 100% | texSubImage2D + generateMipmap |
| context lost and restored with a layer set | layer re-uploaded from its canvas |
| sampleCrop with a layer set | Auto's sample ignores marks (u_draw false) |

## Definition of Done

- [ ] shader and renderer tests cover each Edge case row
- [ ] an empty layer renders identically to before (u_draw false path)
- [ ] pixel fidelity proven in T17
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
