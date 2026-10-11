---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-09"
feature_size: "M"
ticket: "roadmap step 6 — draw"
---

# 0003 — Composite the Drawing layer in the shared fragment shader, after the Adjustments and before the JPEG flatten

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

One fragment shader (`src/render/shaders.ts`) already draws every rendering of the Work: the Preview, the export worker, its window fallback, the crop-transparency check and the test hooks. It samples the premultiplied Original through `u_geometry` (crop-rotate ADR-0002), runs the Adjustments under `u_adjust` (adjust ADR-0002) and flattens onto white for JPEG under `u_flatten`. Repo ADR 0004 says the drawing layer is composited on top of the adjusted image, and the root glossary says it is never adjusted. The layer of ADR-0001 lies on the Original's pixel grid, so it can be sampled with exactly the coordinates the Original is.

## Decision drivers

- spec §6 Fidelity: each pixel of a full-size PNG Export within 2 of 255 per channel of the Preview's own rendering at 100%, on Chromium, Firefox and WebKit, for every Geometry case and with all seven Adjustments away from neutral
- spec §6 and AC-07: an empty layer changes nothing (difference 0); inside a mark every pixel has the mark's colour; elsewhere the image keeps exactly its own transparency
- spec AC-10: the Drawing layer is never adjusted; a smaller Export is the full-size Export, marks included, reduced; the transparency hint follows the drawn result
- spec AC-11: "Crop and rotate" shows every mark, outside the frame too; "Adjust" and its Compare "Before" view show the marks unadjusted
- spec §6: Apply, Cancel, Clear and a "Crop and rotate" Apply over a full layer to the updated Preview, p95 ≤ 150 ms
- sad.md §1 quality goals 1 and 3

## Considered options

1. **A second texture in the shared fragment shader** — sampled with the same `v_uv` as the Original and composited "over" after the Adjustments, in the same pass.
2. **A second draw call with blending** — after the image quad, the same program draws the layer texture with `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
3. **A separate DOM canvas stacked over the Preview** — the browser composites the layer on screen, and the export composites it separately.

## Decision outcome

**Chosen:** Option 1. It keeps the property every earlier tool relied on: one shader source and one set of inputs for every rendering, so the Preview and the Export cannot drift. Option 2 rounds the image to the 8-bit framebuffer before the layer is blended on. It also has to move the JPEG flatten into a third step, because the flatten must come after the marks, and it repeats this in the Preview and the worker. Option 3 gives up the shared path altogether. The browser's own scaling, CSS clipping and rotation of a DOM canvas follow none of the shader's sampling rules, so the 2/255 bound between Preview and Export could not be promised.

How it works:

- **Shader.** The fragment shader gains `uniform sampler2D u_layer` (texture unit 1) and `uniform bool u_draw`. After the Adjustments block and before the flatten: `if (u_draw) { vec4 m = texture(u_layer, v_uv); color = m + (1.0 - m.a) * color; }`. This is premultiplied "over": inside an opaque mark the result is the mark's colour, at its smooth edge it blends with the image, and where the layer is transparent the result is `color` bit for bit. `u_draw` is false whenever the layer is `null` (ADR-0001), so a Work with no drawing renders exactly as today. Outside the Original (`v_uv` outside 0…1) the shader already returns transparent, and no mark lies there.
- **Texture.** The layer is uploaded like the Original: premultiplied RGBA8 from straight `ImageData` (the export's WebKit-safe path), with mipmaps. Each draw sets the same minification and magnification filters on both units, so the Original and the layer are sampled at the same texels: `NEAREST` at 100% and above without a Straighten angle, `LINEAR` otherwise, and the mipmaps below 100%.
- **Preview.** `PreviewRenderer` gains `setLayer(layer | null)`, which uploads the whole layer only when the bitmap it is given differs from the one it holds (an Apply hands over the Draft's bitmap with a new id and uploads nothing), and `updateLayer(rect)`, which uploads one dirty rectangle with `texSubImage2D` and regenerates the mipmaps when the View is below 100% (ADR-0002). Both request one frame. The renderer keeps the layer handle it was given, so after a lost WebGL context it re-uploads it from the CPU bitmap, as it does the Original. In "Crop and rotate" the shader samples the layer through the whole-image transform, so marks outside the frame show where they will be (AC-11). In "Adjust" and in Compare's "Before" view, only `u_adjust` changes, and the layer is composited unadjusted (AC-11).
- **Export.** `ExportSnapshot` and `ExportRequest` carry the applied layer. The client reads the whole layer once with `getImageData` and transfers its buffer to the worker, and the worker binds it to unit 1 with the same uniforms. A full-size Export samples texel centres 1:1 as the Preview at 100% does. A smaller Export with a layer takes adjust's two-pass path (adjust sad.md §5): the Crop at full size with the Adjustments and the layer into a texture, then that texture reduced through its mipmaps, with the flatten in the last pass. So a smaller Export is the full-size one, marks included, reduced (AC-10). The window fallback (export ADR-0003) runs the same code.
- **Transparency check.** The crop-transparency check (crop-rotate ADR-0004) renders through the same path with the layer, so the export hint appears exactly when the drawn result still has a transparent pixel inside the Crop (AC-10, export AC-15). Its cache key gains the layer's id, which is new on every Apply. An Original with no transparent pixel still skips the check, because opaque marks cannot add transparency.
- **Auto adjust.** `sampleCrop` (adjust ADR-0004) keeps `u_draw` off. Auto measures the photo, and the marks are never adjusted.
- **Test hooks.** `previewAt100()` renders with the Work's layer, so the fidelity comparison stays Preview against Export.

## Consequences

**Positive**
- One pass and one source for every rendering. The fidelity of quality goal 1 rests on the same sampling rules that adjust and crop-rotate already verify on three engines.
- AC-11's three cross-tool rules need no tool-specific code: the transform, `u_adjust` and `u_draw` are independent.
- A "Crop and rotate" Apply over a full layer costs a uniform change and one frame. Nothing is re-rasterised.

**Negative**
- Below 100% zoom, painting a Stroke regenerates the layer's mipmaps once per frame. That is a few milliseconds of GPU time on a 4096×3072 layer (§11 tracks it against the 33 ms budget).
- A smaller Export with marks holds one more full-size texture in the export worker while it renders (adjust sad.md §5), and the layer itself adds up to 64 MB to the transfer.

**Neutral**
- More layers, or blend modes, would extend the same block. Spec §3 rules both out for now.

## Links

- Spec: [[../spec.md]] AC-07, AC-10, AC-11, §6
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-hold-the-drawing-layer-as-one-bitmap-in-the-original-pixel-space-created-on-the-first-mark]], [[0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates]]; repo ADR 0004; crop-rotate ADR-0002 and ADR-0004; adjust ADR-0002 and ADR-0004; export ADR-0002 and ADR-0003
