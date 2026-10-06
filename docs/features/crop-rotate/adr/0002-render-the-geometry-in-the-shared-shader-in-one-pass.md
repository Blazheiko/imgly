---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-06"
feature_size: "M"
ticket: "roadmap step 4 — crop-rotate"
---

# 0002 — Render the Geometry in the shared shader in one pass, sampling the Original directly

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The Preview is one WebGL2 canvas that draws the Original texture through a View `mat3` (open-and-view ADR-0003), and the export worker draws it with the same shader source at the export size (export ADR-0002). The Geometry now has to appear identically in both: lossless for Rotation, Flip and Crop, matching the Preview at 100% for a Straighten angle, and following the crop frame and the slider at 30 or more updates per second on a 4096×3072 Work. Adjustments (step 5) and the drawing layer (step 6) build on the same rendering path.

## Decision drivers

- spec §6: Preview update while dragging p95 frame interval ≤ 33 ms; rotate, flip, Apply, Cancel or Reset to the updated Preview p95 ≤ 150 ms
- spec §6: Rotation, Flip and Crop within 2 of 255 per channel of the Original pixel; with a Straighten angle within 2 of 255 of the Preview's rendering at 100%; opaque images stay 100% opaque
- spec §6: memory after 50 applied Geometry changes ≤ 110% of memory after the first Apply
- repo ADR 0004 and export ADR-0002: Preview and Export share one shader source
- sad.md §1 quality goals 1 and 3

## Considered options

1. **One pass, transform in the shader** — a second matrix `u_geometry` maps each output pixel to its Original texture coordinate; every frame samples the Original directly.
2. **Bake on Apply** — render the Geometry once into a new full-size bitmap per Apply and draw that through the View; the tool still needs a live path for the uncropped image.
3. **Two passes every frame** — render the Work with its Geometry into a full-size off-screen texture, then draw that texture through the View.

## Decision outcome

**Chosen:** Option 1. It adds no texture and no bitmap, so 50 applied changes cannot grow memory, and the per-frame cost stays one textured quad whatever the angle or zoom. It is also the only option with a single code path for the tool's live view and the applied Work. Option 2 allocates and frees about 50 MB per Apply and still needs option 1 inside the tool. Option 3 keeps crisp pixel blocks above 100% on a straightened image, but holds a second full-size GPU texture for the Work's lifetime and renders 12 MP on every slider move.

How it works:

- `src/render/shaders.ts`: the vertex shader gains `uniform mat3 u_geometry` and computes `v_uv = (u_geometry * vec3(a_position, 1.0)).xy`. The unit quad now stands for the Crop: `u_transform` places it on screen (the View, sized by `workSize`) or on the whole canvas (export's `FULL_QUAD`), and `u_geometry = cropToOriginalUv(g, original)` from `core` (ADR-0001). The identity Geometry gives the identity mapping, so today's rendering is unchanged.
- The fragment shader outputs transparent for a `v_uv` outside the Original. That only happens in the tool, which draws the whole turned image and the empty corners around it; an applied Crop always lies inside the turned image (AC-06).
- **Sampling.** With a Straighten angle of 0, Rotation, Flip and whole-pixel Crop offsets map pixel centres onto pixel centres, so the existing filters stay exact (`NEAREST` magnification at zoom ≥ 1 and in a full-size Export). With any other angle, magnification is `LINEAR` in the Preview and in the Export alike, so the full-size Export equals the Preview at 100%. Minification keeps the existing mipmapped filter. `CLAMP_TO_EDGE` (already set) keeps the bilinear samples next to the turned image's edge opaque for an opaque Original.
- **Export.** `ExportRequest` gains `geometry`; the worker computes `u_geometry` with the same `core` function and renders at the export size, which now counts from `workSize`.

## Consequences

**Positive**
- Memory stays flat by construction: the only image on the GPU is the Original's texture, as before.
- Preview and Export cannot drift: same shader, same matrix function, same filter rule.
- Step 5's adjustments add uniforms to the same fragment shader, and step 6's drawing layer, anchored to the Original by default (spec §8, D3), is a second texture sampled through the same `u_geometry`.

**Negative**
- Above 100% zoom, a straightened image looks slightly soft (bilinear) instead of showing pixel blocks; at and below 100% this is invisible.
- Fidelity and frame rate can only be verified in Playwright e2e on real GPUs, not in happy-dom.

**Neutral**
- If step 5 needs a multi-pass effect (a blur, for example), an intermediate texture can be introduced then, behind the same renderer interface; this decision does not prevent it.

## Links

- Spec: [[../spec.md]] §6, AC-03, AC-04, AC-05, AC-06, AC-14
- SAD: [[../sad.md]] §4 (choice 2), §5, §10
- Related ADR: [[0001-model-the-geometry-as-integer-parameters-with-one-core-transform]]; open-and-view ADR-0003 (WebGL2 Preview); export ADR-0002 and ADR-0003 (export worker and window fallback)
