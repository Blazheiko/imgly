---
id: T5
title: "Add the seven-step colour block to the shared shader (u_adjust) and PreviewRenderer.setAdjustments"
layer: "infra"
deps: ["T3"]
blocks: ["T6", "T7", "T9"]
acs: ["AC-06", "AC-07"]
files_hint: ["src/render/shaders.ts", "src/render/shaders.test.ts", "src/render/preview-renderer.ts", "src/render/preview-renderer.test.ts", "src/render/fake-gl.ts", "src/features/editor/fake-renderer.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 45 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Add the seven-step colour block to the shared shader (u_adjust) and PreviewRenderer.setAdjustments

## Place in the sequence

- **Blocked by:** T3 — Write the CPU reference of the seven formulas (applyAdjustmentsToPixel) and toUniforms, pinned to ADR-0003's anchor table.
- **Blocks:** T6 — Add PreviewRenderer.sampleCrop(geometry, maxSide) into a temporary framebuffer and the editor store's sampleWork() · T7 — Send the applied Adjustments to the export worker, set them as uniforms, and reduce smaller adjusted Exports in two passes · T9 — Make PreviewCanvas draw previewAdjustments ?? work.adjustments, and give the e2e hooks setAdjustments and an adjusted previewAt100.
- **Wave:** 3 — alongside T4, T10, T12.
- **Lane:** shares `src/features/editor/fake-renderer.ts`, `src/render/preview-renderer.test.ts`, `src/render/preview-renderer.ts` with T6 — serialized.

## Why (user story)

> **US-01: Make a dull photo lighter or punchier**
>
> **As a** Editor  
> **I want** to change the brightness and contrast of the image with sliders and see the result while I drag  
> **So that** a dark or flat photo looks the way I remember it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It puts the Adjustments on the GPU path the Preview and the export worker share, so a slider move is a uniform change and one frame.

## Inlined context

> - `src/render/shaders.ts`: the fragment shader gains `uniform bool u_adjust` and the uniforms of ADR-0001's `toUniforms` (seven floats, or one `vec4` and one `vec3`). After `texture(u_image, v_uv)` and before the existing `u_flatten` step:
>   - when `u_adjust` is false the colour passes through untouched, so neutral Adjustments are bit for bit today's output …;
>   - otherwise, for `a > 0`: `rgb = color.rgb / color.a`, then the seven steps of ADR-0003 in their fixed order with `clamp(…, 0.0, 1.0)` after each, then `color = vec4(rgb * color.a, color.a)`. A pixel with `a = 0` stays `vec4(0.0)`. Alpha is never written by the steps (AC-06).
> - `u_adjust` is set from `!isNeutral(a)` (ADR-0001) by every caller. The JPEG flatten onto white stays last, after the Adjustments …
> - **Preview.** `PreviewRenderer` gains `setAdjustments(a)`. A change sets uniforms and requests one frame, with no texture upload, so dragging costs one textured quad per frame like a View change. Above 100% zoom the Preview keeps its `NEAREST` magnification, and below it the steps run on the mipmapped sample. …
>
> — `adr/0002 §Decision outcome, How it works, abridged` · full text: [adr/0002](../adr/0002-apply-the-adjustments-in-the-shared-fragment-shader-on-stored-srgb-values.md)

> The Preview draws on `requestAnimationFrame` only after something changed (`src/render/preview-renderer.ts`) …
>
> — `sad.md §2, Technical constraints, abridged` · full text: [sad.md](../sad.md)

> | Resource lifetime | A Preview Adjustment change allocates nothing on the GPU. … |
>
> — `sad.md §8, Resource lifetime row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder. May import `core`, `shared`.
>
> — `CLAUDE.md §Module boundaries, src/render row, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Contract change, folded in (tasks step 5):** `PreviewRenderer` gains `setAdjustments`, so this task also updates its other implementer, `src/features/editor/fake-renderer.ts`. Add a helper `setAdjustmentUniforms(gl, gpu, a)` next to `buildProgram` so the Preview, the export worker (T7) and the test hooks (T9) set the uniforms one way. A bool uniform defaults to false, so callers that never set it render exactly as today. The GLSL steps must match T3's `formula.ts` line for line.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`PreviewRenderer.setAdjustments(a: Adjustments): void`, `GpuProgram` gains the adjust uniform locations, `setAdjustmentUniforms(gl, gpu, a)`.)

## Acceptance criteria

### AC-06 — domain invariant

> **Given** an image is open, with or without transparent pixels
> **When** the Editor applies any Adjustments
> **Then** only colours change: every pixel keeps exactly the transparency it has without Adjustments, the Work keeps its size and its Geometry, and an image with no transparent pixels stays fully opaque, in the Preview and in every Export. With all seven values at their neutral values the Work's pixels are exactly the pixels it would have without any Adjustments, because a neutral value changes no pixel. Every colour rule in AC-02 to AC-04 applies to a pixel's colour independent of its transparency: a partly transparent pixel changes colour exactly as the same fully opaque pixel would, so soft edges get no dark or light fringe
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-07 — domain invariant

> **Given** the "Adjust" tool is open
> **When** the Editor reaches the same seven values by different paths, for example setting contrast before brightness or after it, or dragging a slider far out and back
> **Then** the Preview, and the Work after Apply, are exactly the same, because the Adjustments are always applied in one fixed order that does not depend on the order in which the Editor changed them. A colour channel pushed past white or black stays at white or black and never wraps round to the opposite end
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `u_adjust` + the adjust uniforms + the seven GLSL steps between sampling and `u_flatten`; `GpuProgram` locations; `setAdjustmentUniforms` — `src/render/shaders.ts`
- [ ] `setAdjustments(a)`: store, set uniforms in `draw()`, `invalidate()` once; no texture work — `src/render/preview-renderer.ts`
- [ ] Fake GL records the new uniforms if needed — `src/render/fake-gl.ts`
- [ ] `setAdjustments` on the fake renderer — `src/features/editor/fake-renderer.ts`
- [ ] Tests: program compiles with the new uniforms under fake GL, neutral sets `u_adjust` false, a change requests exactly one frame and uploads no texture — `src/render/shaders.test.ts`, `src/render/preview-renderer.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `setAdjustments(NEUTRAL_ADJUSTMENTS)` | `u_adjust` false: today's output bit for bit |
| Many `setAdjustments` calls before the next animation frame | one frame, drawn with the latest values (skipped values are fine) |
| Context lost / restoring | the values are kept and set again when the program is rebuilt |
| JPEG export path (`u_flatten`) | flatten runs after the steps |

## Definition of Done

- [ ] Unit tests (fake GL) prove the uniform wiring, the neutral bypass and one frame per change with no texture upload
- [ ] Pixel correctness of the GLSL is left to T17 (real GPUs) — noted in the PR
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
