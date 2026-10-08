---
id: T6
title: "Render the Geometry in the shared shader (u_geometry) and give the Preview renderer setGeometry(g, 'crop' | 'whole')"
layer: "infra"
deps: ["T5"]
blocks: ["T7", "T9"]
acs: ["AC-05", "AC-12"]
files_hint: ["src/render/shaders.ts", "src/render/shaders.test.ts", "src/render/preview-renderer.ts", "src/render/preview-renderer.test.ts", "src/render/fake-gl.ts", "src/render/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 43 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Render the Geometry in the shared shader (u_geometry) and give the Preview renderer setGeometry(g, 'crop' | 'whole')

## Place in the sequence

- **Blocked by:** T5 — Derive the one transform: cropToOriginalUv, turnedImageToOriginalUv, turnedBounds and the overlay's screen maths.
- **Blocks:** T7 — Export with the Geometry in the worker and add the GPU alpha check (checkCropTransparency) · T9 — Make the Preview and the status bar follow the Geometry, and add the setGeometry test hook.
- **Wave:** 3 — alongside T3, T8.
- **Lane:** own lane.

## Why (user story)

> **US-04: Level a tilted horizon**
>
> **As a** Editor  
> **I want** to turn the image by a small free angle  
> **So that** a slightly tilted photo looks level, without empty corners
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It makes the Preview draw the Original through the Geometry in one pass — cropped for the Work, whole for the tool — with no extra texture or bitmap.

## Inlined context

> - `src/render/shaders.ts`: the vertex shader gains `uniform mat3 u_geometry` and computes `v_uv = (u_geometry * vec3(a_position, 1.0)).xy`. The unit quad now stands for the Crop: `u_transform` places it on screen (the View, sized by `workSize`) or on the whole canvas (export's `FULL_QUAD`), and `u_geometry = cropToOriginalUv(g, original)` from `core` (ADR-0001). The identity Geometry gives the identity mapping, so today's rendering is unchanged.
> - The fragment shader outputs transparent for a `v_uv` outside the Original. That only happens in the tool, which draws the whole turned image through `turnedImageToOriginalUv` (the same mapping over the turned image's bounding box instead of the Crop, ADR-0001 and ADR-0003) and the empty corners around it; an applied Crop always lies inside the turned image (AC-06).
> - **Sampling.** With a Straighten angle of 0, Rotation, Flip and whole-pixel Crop offsets map pixel centres onto pixel centres, so the existing filters stay exact (`NEAREST` magnification at zoom ≥ 1 and in a full-size Export). With any other angle, magnification is `LINEAR` in the Preview and in the Export alike, so the full-size Export equals the Preview at 100%. Minification keeps the existing mipmapped filter. `CLAMP_TO_EDGE` (already set) keeps the bilinear samples next to the turned image's edge opaque for an opaque Original.
>
> — `adr/0002 §How it works, bullets 1–3, verbatim` · full text: [adr/0002](../adr/0002-render-the-geometry-in-the-shared-shader-in-one-pass.md)

> `PreviewCanvas` draws the Work with `work.geometry`, cropped, when no tool is open. While a tool is open it draws `previewGeometry` in **whole-turned-image mode** … The renderer takes this as `setGeometry(g, mode)` with `mode` `'crop'` or `'whole'`.
>
> — `sad.md §5, Cross-feature changes bullet 3, abridged` · full text: [sad.md](../sad.md)

> `preview-renderer.ts` — setGeometry(g, mode) with mode 'crop' or 'whole'; LINEAR magnification while straightened; quad sized by the shown size
>
> — `sad.md §5, Internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Memory stays flat by construction: the only image on the GPU is the Original's texture, as before. … The Preview redraws with a new transform only, so nothing is allocated per change (ADR-0002).
>
> — `adr/0002 §Consequences + sad.md §6 Critical flow 1 prose, abridged` · full text: [adr/0002](../adr/0002-render-the-geometry-in-the-shared-shader-in-one-pass.md)

Today: `src/render/shaders.ts` has `u_transform`, `u_image`, `u_flatten`; `preview-renderer.ts:116` picks `NEAREST` at zoom ≥ 1; the export worker uses `FULL_QUAD` (T7 wires export). The renderer still draws only when something changed (open-and-view ADR-0003). `PreviewCanvas` calling `setGeometry` is T9.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Renderer interface change: `PreviewRenderer.setGeometry(g: Geometry, mode: 'crop' | 'whole')`.)

## Acceptance criteria

### AC-05 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor drags the straighten slider or types an angle
> **Then** the image turns by that angle, from −45° to +45° in steps of 0.1°, around the centre of the crop frame, and the Preview follows while the slider moves. A fine grid shows over the image while the angle changes, so the Editor can line up a horizon. A positive angle turns the image clockwise. The angle is shown next to the slider, and 0° is marked on it
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — domain invariant

> **Given** a Crop was applied earlier to the open Work
> **When** the Editor opens the "Crop and rotate" tool again
> **Then** the tool shows the whole image with the current Rotation, Flip and Straighten angle, and the crop frame where the Crop is, so the Editor can widen it. Widening the frame back to the whole image and applying gives exactly the pixels the Work had before the Crop, because the Geometry never removes pixels from the Original. Reset in the tool returns to no Geometry (no Rotation, no Flip, a Straighten angle of 0° and the Crop covering the whole image), sets the proportion to Free, and takes effect only on Apply
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

This task is the renderer half: the Preview can show the straightened image (AC-05) and the whole turned image with the Crop's position (AC-12). Pixel fidelity on real GPUs is T18.

## Checklist

- [ ] Vertex shader `u_geometry`; fragment shader transparent outside 0…1 UV; uniform location in the program record — `src/render/shaders.ts` (+ `shaders.test.ts`)
- [ ] `setGeometry(g, mode)`: compute `u_geometry` via `cropToOriginalUv` / `turnedImageToOriginalUv`, size the quad from `workSize` / `turnedBounds`, schedule one redraw — `src/render/preview-renderer.ts`
- [ ] Magnification filter: `LINEAR` when `g.straighten ≠ 0`, else today's zoom rule — `src/render/preview-renderer.ts`
- [ ] Fake GL records `u_geometry` uploads — `src/render/fake-gl.ts`; tests in `src/render/preview-renderer.test.ts`
- [ ] Re-export anything new from `src/render/index.ts`; restore after context loss re-applies the last Geometry

## Edge cases

| Case | Behaviour |
|---|---|
| No `setGeometry` call yet (identity) | same uniforms and output as before this feature |
| `'whole'` mode with straighten 20° | quad = turned bounds; corners outside the Original are transparent |
| straighten changes 0 → 5 → 0 | filter goes NEAREST → LINEAR → NEAREST (at zoom ≥ 1) |
| WebGL context lost and restored | the last Geometry and mode are re-applied |
| Repeated `setGeometry` while dragging | no texture or buffer allocation per call |

## Definition of Done

- [ ] Vitest (fake GL) proves the `u_geometry` upload for both modes, the filter rule and the unchanged identity path
- [ ] Vitest proves no new texture/buffer is created per `setGeometry`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
