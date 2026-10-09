---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-08"
feature_size: "M"
ticket: "roadmap step 5 — adjust"
---

# 0002 — Apply the Adjustments in the shared fragment shader, in one pass, on unpremultiplied stored sRGB values

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

Repo ADR 0004 decided that colour adjustments run on WebGL2, and crop-rotate ADR-0002 made the Preview and the export worker draw the Work with one shader that samples the Original through `u_geometry` in one pass. The Original is a texture of premultiplied 8-bit sRGB values: each colour is stored already multiplied by its opacity, and the numbers are the stored sRGB values, not linear light (open-and-view ADR-0003 and ADR-0004). The seven Adjustments now have to join that path so that the Preview follows a dragged slider live, the Export matches the Preview at 100%, neutral values change no pixel, and partly transparent pixels change colour exactly as opaque ones would.

## Decision drivers

- spec §6: Preview update while dragging p95 frame interval ≤ 33 ms; Apply, Cancel, Reset or releasing Compare to the updated Preview p95 ≤ 150 ms
- spec §6: an adjusted full-size PNG Export within 2 of 255 per channel of the Preview's own rendering at 100%; neutral values give a difference of 0; 100% of pixels keep their exact transparency
- spec AC-02 to AC-04: every direction is judged on the stored pixel values, and mid-grey is the stored value 128, 128, 128
- spec AC-06: a partly transparent pixel changes colour exactly as the same opaque pixel would, with no fringe
- spec §6: memory after 50 applied changes ≤ 110% of memory after the first Apply
- sad.md §1 quality goals 1 and 3

## Considered options

1. **One pass on stored sRGB values** — after sampling, the fragment shader unpremultiplies, applies the seven steps in ADR-0003's fixed order on the stored sRGB values, clamps after each step and premultiplies again.
2. **One pass in linear light** — the same place in the shader, but the colour is converted from sRGB to linear light before the seven steps and back after them.

## Decision outcome

**Chosen:** Option 1. The spec judges every rule on the stored values (contrast keeps 128 at 128, brightness never darkens a channel), so applying the steps to exactly those values makes each rule a direct property of the formula. Linear light would need the mid-grey pivot and every anchor translated into another space, and an 8-bit round trip through it loses precision in dark tones that the 2-of-255 tolerance across three engines has to absorb. Comparable browser editors and CSS filters also work on the stored values.

How it works:

- `src/render/shaders.ts`: the fragment shader gains `uniform bool u_adjust` and the uniforms of ADR-0001's `toUniforms` (seven floats, or one `vec4` and one `vec3`). After `texture(u_image, v_uv)` and before the existing `u_flatten` step:
  - when `u_adjust` is false the colour passes through untouched, so neutral Adjustments are bit for bit today's output (spec §6 "Neutral values change nothing");
  - otherwise, for `a > 0`: `rgb = color.rgb / color.a`, then the seven steps of ADR-0003 in their fixed order with `clamp(…, 0.0, 1.0)` after each, then `color = vec4(rgb * color.a, color.a)`. A pixel with `a = 0` stays `vec4(0.0)`. Alpha is never written by the steps (AC-06).
- `u_adjust` is set from `!isNeutral(a)` (ADR-0001) by every caller. The JPEG flatten onto white stays last, after the Adjustments, so the transparency hint and the flattened result are what they were without Adjustments (AC-14, export AC-15).
- **Preview.** `PreviewRenderer` gains `setAdjustments(a)`. A change sets uniforms and requests one frame, with no texture upload, so dragging costs one textured quad per frame like a View change. Above 100% zoom the Preview keeps its `NEAREST` magnification, and below it the steps run on the mipmapped sample. Only the Preview at 100% is held to the Export, as spec §6 measures.
- **Export.** The worker sets the same uniforms from `ExportRequest.adjustments`. A full-size Export samples texel centres 1:1 as the Preview at 100% does, so both run the same steps on the same texels. Smaller sizes are §5's two-pass reduction.
- **Neutral in a step.** Each step is written so that its neutral value is an exact identity (for example brightness skips `pow` when its exponent is 1), so a Draft with only one value away from neutral changes nothing but that value's effect.

## Consequences

**Positive**
- No new texture, framebuffer or bitmap for the Preview, so memory stays flat by construction, as with the Geometry.
- The Preview and the Export cannot drift: same shader source, same uniforms from the same `core` function.
- The drawing layer (step 6) composites over the adjusted image in the same program and is never adjusted itself (root CONTEXT "Adjustments").

**Negative**
- Unpremultiplying an 8-bit premultiplied texel loses colour precision for very transparent pixels. This is the existing texture format, and the error stays below one level of the visible result.
- Pixel fidelity and frame rate can only be verified in Playwright e2e on real GPUs, not in happy-dom. The CPU reference of ADR-0001 covers the formulas in units.

**Neutral**
- A future multi-pass effect (a blur, for example) would need an intermediate texture behind the same renderer interface. Nothing here prevents it.

## Links

- Spec: [[../spec.md]] §6, AC-01, AC-02 to AC-04, AC-06, AC-07, AC-14
- SAD: [[../sad.md]] §4 (choice 2), §5, §8, §10
- Related ADR: [[0001-model-the-adjustments-as-seven-integer-fields-on-the-work]], [[0003-define-each-adjustment-by-a-fixed-formula-that-keeps-black-in-place]]; crop-rotate ADR-0002 (one-pass shader); repo ADR 0004 (WebGL2 for adjustments); open-and-view ADR-0003 (premultiplied texture)
