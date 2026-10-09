---
id: T6
title: "Add PreviewRenderer.sampleCrop(geometry, maxSide) into a temporary framebuffer and the editor store's sampleWork()"
layer: "infra"
deps: ["T4", "T5", "T8"]
blocks: ["T13"]
acs: ["AC-12"]
files_hint: ["src/render/preview-renderer.ts", "src/render/preview-renderer.test.ts", "src/features/editor/fake-renderer.ts", "src/features/editor/store.ts", "src/features/editor/store.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "S"   # measured: 35 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Add PreviewRenderer.sampleCrop(geometry, maxSide) into a temporary framebuffer and the editor store's sampleWork()

## Place in the sequence

- **Blocked by:** T4 — Add autoAdjust(sample): unpremultiply, median and percentiles of Rec. 709 lightness, grey-world gains, rounded half up within ±50, or nothing · T5 — Add the seven-step colour block to the shared shader (u_adjust) and PreviewRenderer.setAdjustments · T8 — Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments.
- **Blocks:** T13 — Add Compare (held flag, neutral preview, ends on blur and close) and Auto (sampleWork → autoAdjust → four values or the nothing hint) to the adjust store.
- **Wave:** 4 — alongside T7, T9, T14.
- **Lane:** shares `src/features/editor/fake-renderer.ts`, `src/render/preview-renderer.test.ts`, `src/render/preview-renderer.ts` with T5; shares `src/features/editor/store.test.ts`, `src/features/editor/store.ts` with T8 — serialized.

## Why (user story)

> **US-06: Fix a photo in one click**
>
> **As a** Editor  
> **I want** one action that sets brightness, contrast and colour balance for me  
> **So that** I get a good starting point quickly and can fine-tune it with the sliders
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It gives Auto its input: the Crop with its Geometry and without Adjustments, read back from the Preview's own context.

## Inlined context

> **Sample.** `PreviewRenderer` gains `sampleCrop(geometry, maxSide): Result<ImageSample, AppError>`. It renders the quad with `u_geometry = cropToOriginalUv(geometry, original)`, `u_adjust` false and `u_flatten` false into a framebuffer whose long side is `min(512, Crop's long side)`, keeping the Crop's proportion. Both filters are `NEAREST`, so every sample is one exact texel of the Original (for a Straighten angle too). It reads the pixels back with `readPixels` as they are rendered, premultiplied …, and returns them unchanged, deletes the framebuffer and restores the filters before the next Preview frame. It returns `DISPLAY_LOST` when the context is not ready. The `editor` store holds the renderer it creates and exposes `sampleWork(): Result<ImageSample, AppError>`, so the adjust feature never touches the renderer.
>
> — `adr/0004 §Decision outcome, How it works, Sample, abridged` · full text: [adr/0004](../adr/0004-measure-auto-adjust-on-a-bounded-sample-in-the-preview-context.md)

> | Resource lifetime | … Auto's framebuffer and its texture are deleted before `sampleCrop` returns, in every branch. … |
>
> — `sad.md §8, Resource lifetime row, abridged` · full text: [sad.md](../sad.md)

> `sampleWork()`, which asks the renderer it created for Auto's sample (ADR-0004)
>
> — `sad.md §5, Cross-feature changes, editor store bullet, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder. May import `core`, `shared`.
>
> — `CLAUDE.md §Module boundaries, src/render row, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Contract change, folded in:** `PreviewRenderer` gains `sampleCrop`, so the fake renderer is updated here too (configurable sample for tests). `sampleWork()` passes the **Work's** Geometry (not `previewGeometry`) and returns `DISPLAY_LOST` when no renderer exists or no Work is open. No new `AppError` code (`sad.md` §5).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`PreviewRenderer.sampleCrop(geometry, maxSide): Result<ImageSample, AppError>`; `editor.sampleWork(): Result<ImageSample, AppError>`.)

## Acceptance criteria

### AC-12 — happy path

> **Given** the "Adjust" tool is open on an image that is not all one colour
> **When** the Editor chooses Auto
> **Then** the brightness, contrast, temperature and tint sliders move to values computed from the pixels inside the Work's Crop, and the Preview shows the result; saturation, grayscale and sepia stay as they were. The values are computed from the Work with its Geometry and without any Adjustments, and they replace the four sliders' values instead of adding to them, so choosing Auto again gives the same values. The Editor can change the values afterwards, and they reach the Work only on Apply. Fully transparent pixels are ignored
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `sampleCrop`: framebuffer + texture sized `min(maxSide, long side)` keeping proportion, NEAREST filters, `u_adjust`/`u_flatten` false, `readPixels`, delete + restore in `finally` — `src/render/preview-renderer.ts`
- [ ] `sampleCrop` on the fake — `src/features/editor/fake-renderer.ts`
- [ ] `sampleWork()` using the held renderer and `work.geometry` — `src/features/editor/store.ts`
- [ ] Tests: size and proportion, filters restored, framebuffer deleted in success and error branches, `DISPLAY_LOST` when not ready; store test via the fake — `src/render/preview-renderer.test.ts`, `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Crop 300×200 (smaller than 512) | sample 300×200, one texel per pixel |
| Crop 4096×1024 | sample 512×128 |
| Context lost or restoring | `err(DISPLAY_LOST)`, nothing allocated |
| readPixels throws | framebuffer and texture still deleted; error returned |
| Preview frame after a sample | drawn with the Preview's own filters and Adjustments (restored) |

## Definition of Done

- [ ] Fake-GL tests prove sizing, NEAREST sampling, cleanup in every branch and `DISPLAY_LOST`
- [ ] Store test proves `sampleWork()` delegates with the Work's Geometry
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
