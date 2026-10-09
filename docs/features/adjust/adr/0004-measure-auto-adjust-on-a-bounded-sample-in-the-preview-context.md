---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-08"
feature_size: "M"
ticket: "roadmap step 5 — adjust"
---

# 0004 — Measure Auto adjust on a bounded sample of the Crop in the Preview's WebGL2 context, and compute the values in `core`

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

Auto adjust sets brightness, contrast, temperature and tint from the pixels inside the Work's Crop, read with its Geometry and without any Adjustments (AC-12). It must finish within 300 ms on a 4096×3072 Work, give the same values every time in one browser and differ by at most 1 between browsers, stay within ±50, ignore fully transparent pixels, and report "nothing to correct" when the pixels have one colour or there are none (AC-13). The Original is already a texture in the Preview's WebGL2 context, and only the shared shader knows how the Geometry maps the Crop onto it (crop-rotate ADR-0001 and ADR-0002).

## Decision drivers

- spec §6: from choosing Auto to the sliders and the Preview showing its values p95 ≤ 300 ms
- spec AC-13: deterministic in one browser; at most 1 apart between browsers; whole numbers within ±50
- spec AC-12: the measurement sees the Crop with its Geometry, without Adjustments, ignoring fully transparent pixels
- spec §6: memory after 50 applied changes ≤ 110% of memory after the first Apply
- crop-rotate ADR-0001: one transform from the Crop to the Original, used by every renderer
- sad.md §1 quality goal 3

## Considered options

1. **A bounded sample in the Preview's context** — render the Crop with the shared shader into a small off-screen framebuffer of the Preview's own WebGL2 context, read it back, and compute the values with a pure `core` function.
2. **A full-size measure in the export worker** — a new `measure` message to the export worker, like crop-rotate ADR-0004's transparency check: copy the Original to the worker, render the whole Crop at full size, read it back and compute there.

## Decision outcome

**Chosen:** Option 1. The texture is already on the GPU, so the measure costs one small render and a readback of at most 1 MB on the main thread, tens of milliseconds against a 300 ms budget, with no bitmap copy and no 48 MB readback. Sampling exact texels makes it deterministic. Option 2 pays a worker start, a texture upload and a 12 MP readback on every Auto, which puts the p95 at risk and adds a full-size buffer to memory, for statistics that a 512 px sample already settles to within one slider step.

How it works:

- **Sample.** `PreviewRenderer` gains `sampleCrop(geometry, maxSide): Result<ImageSample, AppError>`. It renders the quad with `u_geometry = cropToOriginalUv(geometry, original)`, `u_adjust` false and `u_flatten` false into a framebuffer whose long side is `min(512, Crop's long side)`, keeping the Crop's proportion. Both filters are `NEAREST`, so every sample is one exact texel of the Original (for a Straighten angle too). It reads the pixels back with `readPixels` as they are rendered, premultiplied (the colour multiplied by its opacity), and returns them unchanged, deletes the framebuffer and restores the filters before the next Preview frame. It returns `DISPLAY_LOST` when the context is not ready. The `editor` store holds the renderer it creates and exposes `sampleWork(): Result<ImageSample, AppError>`, so the adjust feature never touches the renderer.
- **Compute.** `src/core/adjust/auto.ts` exports `autoAdjust(sample): { kind: 'values'; values: Pick<Adjustments, 'brightness' | 'contrast' | 'temperature' | 'tint'> } | { kind: 'nothing' }`, a pure function over the premultiplied 8-bit samples:
  - It skips samples with alpha 0 and divides every other sample's colour by its alpha, so a partly transparent pixel counts at its real colour (AC-12). Doing this in `core` keeps it under plain unit tests. If none remain, or every remaining sample has the same colour, it returns `nothing` (AC-13). "The same colour" is exact on opaque samples and within one stored level on partly transparent ones (amended below).
  - **Brightness** from the median of `L(c)` (ADR-0003's Rec. 709 lightness, in a 256-bin histogram): the exponent that maps the median to 128 / 255, turned back into `b` through ADR-0003's brightness formula.
  - **Contrast** from the 0.5th and 99.5th percentiles after that brightness: the factor that stretches them towards 5 / 255 and 250 / 255 around 128 / 255, turned into `k` through ADR-0003's contrast formula.
  - **Temperature and tint** from the grey-world means of red, green and blue: the `t` that makes the red and blue means equal, and the `m` that brings the green mean to the average of red and blue, through ADR-0003's gains.
  - Every value is rounded half up and clamped to −50…50. The function uses doubles and integer histograms only, so the same sample always gives the same values.
- **Apply to the Draft.** The adjust store replaces the four values of the Draft with the result (AC-12: replace, not add) or shows the "nothing to correct" hint, and the Preview redraws through `editor.previewAdjustments`.

**Amended by adjust (2026-10-09, review N1):** "the same colour" is not an exact match on partly
transparent samples. An 8-bit premultiplied sample stores `c × alpha / 255`, and engines round that
step down, up or to the nearest (the same per-engine difference ADR-0005 records for Export). So a
partly transparent sample pins its colour only to within one stored level: `autoAdjust` keeps, per
channel, the interval `[⌈(s − 1) · 255 / alpha⌉, ⌊(s + 1) · 255 / alpha⌋]` (exact, slack 0, at alpha
255) and returns `nothing` while the intervals of every remaining sample still overlap. An exact
match made a one-colour image with anti-aliased edges get Auto values on Firefox. The cost: a second
colour that appears only on partly transparent pixels and lies within that interval is counted as
the first. Once composited, that is at most about 1.5 visible levels at any alpha, so the only
colours Auto can miss are ones nobody can see. Opaque colours one level apart are still measured.

## Consequences

**Positive**
- Well inside 300 ms, with no allocation that outlives the call, so it adds nothing to the 50-change memory budget.
- Deterministic by construction in one browser. Between engines the sampled texels are the same (nearest sampling of the same transform), and only the colour-space handling of the decoded Original can differ, which the ±1 tolerance covers.
- `autoAdjust` is a pure function with unit tests on synthetic samples: a dark image, a flat one, a blue cast, a single colour, all transparent.

**Negative**
- The statistics come from at most 512 × 512 samples, not every pixel. A photo that is one colour except for a few pixels can be judged as one colour and get "nothing to correct" (§11).
- Auto depends on the Preview's context: while the display is lost or restoring it is unavailable, as the whole canvas already is.
- It is a synchronous readback on the main thread. At this size that is a few milliseconds, but it is not free.

**Neutral**
- If the sample ever proves too coarse, raising `maxSide` is a one-constant change, and option 2 remains possible behind the same `sampleWork()` seam.

## Links

- Spec: [[../spec.md]] §6, AC-12, AC-13
- SAD: [[../sad.md]] §4 (choice 4), §5, §6, §11
- Related ADR: [[0003-define-each-adjustment-by-a-fixed-formula-that-keeps-black-in-place]] (the formulas it inverts); crop-rotate ADR-0001 (the Crop transform) and ADR-0004 (the worker alternative's precedent)
