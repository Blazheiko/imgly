---
id: T3
title: "Write the CPU reference of the seven formulas (applyAdjustmentsToPixel) and toUniforms, pinned to ADR-0003's anchor table"
layer: "domain"
deps: ["T1"]
blocks: ["T4", "T5"]
acs: ["AC-02", "AC-03", "AC-04", "AC-06", "AC-07"]
files_hint: ["src/core/adjust/formula.ts", "src/core/adjust/uniforms.ts", "src/core/adjust/formula.test.ts", "src/core/adjust/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 86 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Write the CPU reference of the seven formulas (applyAdjustmentsToPixel) and toUniforms, pinned to ADR-0003's anchor table

## Place in the sequence

- **Blocked by:** T1 — Add the Adjustments to the Work: type, fixed key order, ranges, NEUTRAL_ADJUSTMENTS, isNeutral and adjustmentsEquals.
- **Blocks:** T4 — Add autoAdjust(sample): unpremultiply, median and percentiles of Rec. 709 lightness, grey-world gains, rounded half up within ±50, or nothing · T5 — Add the seven-step colour block to the shared shader (u_adjust) and PreviewRenderer.setAdjustments.
- **Wave:** 2 — alongside T2, T8.
- **Lane:** shares `src/core/adjust/index.ts` with T1; shares `src/core/adjust/index.ts` with T2; shares `src/core/adjust/index.ts` with T4 — serialized.

## Why (user story)

> **US-02: Fix the colours**
>
> **As a** Editor  
> **I want** to change the saturation, temperature and tint of the image  
> **So that** washed-out, too blue or too yellow colours look natural, or as vivid as I want
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

> **US-03: Give the photo a black-and-white or vintage look**
>
> **As a** Editor  
> **I want** to turn the image grayscale or sepia, fully or partly  
> **So that** I get a classic look without leaving the app
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It fixes what each value means — the oracle the shader (T5), Auto (T4) and the e2e fidelity fixtures (T17) are checked against.

## Inlined context

> For each pixel, `c = (r, g, b)` is the unpremultiplied stored colour divided by 255, `L(c) = 0.2126 r + 0.7152 g + 0.0722 b` (Rec. 709 weights, as CSS `grayscale()`), `p = 128 / 255` and `clamp` limits each channel to [0, 1]. The steps run in this order, with `clamp` after each:
>
> 1. **Brightness** `b` in −100…100: `c = c ^ (2 ^ (−b / 100))`, an exponent from 2 (at −100) to 0.5 (at +100). …
> 2. **Contrast** `k` in −100…100: `f = 1 / (1 − 0.75 k / 100)` for `k ≥ 0` (up to ×4), and `f = 1 + k / 100` for `k < 0` (down to 0); `c = p + (c − p) × f`. The stored value 128 is the exact pivot.
> 3. **Saturation** `s` in −100…100: `c = L + (c − L) × (1 + s / 100)`, from grey at −100 to ×2 at +100. A grey pixel is unchanged.
> 4. **Temperature** `t` in −100…100: `r × (1 + 0.2 t / 100)` and `b × (1 − 0.2 t / 100)`.
> 5. **Tint** `m` in −100…100: `g × (1 − 0.2 m / 100)`, so a higher tint lowers green (magenta) and a lower tint raises it (green).
> 6. **Grayscale** `g` in 0…100%: `c = mix(c, (L, L, L), g / 100)`.
> 7. **Sepia** `q` in 0…100%: `S = clamp(M × c)` with the CSS `sepia()` matrix `M = [0.393 0.769 0.189; 0.349 0.686 0.168; 0.272 0.534 0.131]`, then `c = mix(c, S, q / 100)`. …
>
> — `adr/0003 §Decision outcome, The formulas, abridged` · full text: [adr/0003](../adr/0003-define-each-adjustment-by-a-fixed-formula-that-keeps-black-in-place.md)

> | Setting | Mid-grey 128 | Black 0 | White 255 | Other |
> |---|---|---|---|---|
> | Brightness +100 / +50 / −50 / −100 | 181 / 157 / 96 / 64 | 0 | 255 | 64 → 128 at +100 |
> | Contrast +100 / +50 / −50 / −100 | 128 at every value | 0 / 0 / 64 / 128 | 255 / 255 / 192 / 128 | 64 → 0 at +100, 192 → 230 at +50 |
> | Temperature +100 / −100 | (154, 128, 102) / (102, 128, 154) | not tinted | (255, 255, 204) / (204, 255, 255) | — |
> | Tint +100 / −100 | (128, 102, 128) / (128, 154, 128) | not tinted | (255, 204, 255) / unchanged | — |
> | Grayscale 100% | 128 | 0 | 255 | red 54, green 182, blue 18, yellow 237 |
> | Sepia 100% | (173, 154, 120) | 0 | (255, 255, 239) | — |
>
> — `adr/0003 §Decision outcome, Anchors table, verbatim` · full text: [adr/0003](../adr/0003-define-each-adjustment-by-a-fixed-formula-that-keeps-black-in-place.md)

> - otherwise, for `a > 0`: `rgb = color.rgb / color.a`, then the seven steps of ADR-0003 in their fixed order with `clamp(…, 0.0, 1.0)` after each, then `color = vec4(rgb * color.a, color.a)`. A pixel with `a = 0` stays `vec4(0.0)`. Alpha is never written by the steps (AC-06).
> - `u_adjust` is set from `!isNeutral(a)` (ADR-0001) by every caller. …
> - **Neutral in a step.** Each step is written so that its neutral value is an exact identity (for example brightness skips `pow` when its exponent is 1) …
>
> — `adr/0002 §Decision outcome, How it works, abridged` · full text: [adr/0002](../adr/0002-apply-the-adjustments-in-the-shared-fragment-shader-on-stored-srgb-values.md)

> `toUniforms(a)`, which packs the values for the shader; and `applyAdjustmentsToPixel(rgba, a)`, a CPU reference of ADR-0003's formulas that unit tests use to pin the directions of AC-02 to AC-04.
>
> — `adr/0001 §Decision outcome, How it works bullet 1, abridged` · full text: [adr/0001](../adr/0001-model-the-adjustments-as-seven-integer-fields-on-the-work.md)

> **Hard rule:** `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes. May import nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this).
>
> — `CLAUDE.md §Module boundaries, src/core row, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

The CPU reference mirrors the shader exactly: premultiplied RGBA 0–255 in, unpremultiply for `a > 0`, seven steps with a clamp after each, premultiply back, alpha untouched. Anchors are compared after `Math.round`. `toUniforms(a)` returns `{ enabled: !isNeutral(a), … }` with the values pre-scaled for the shader (seven floats, or one `vec4` + one `vec3`). Property tests: seeded `mulberry32` from `src/core/geometry/test-helpers.ts` (no fast-check in the repo).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`applyAdjustmentsToPixel(rgba, a)`, `toUniforms(a)`, `lightness(r, g, b)` for T4.)

## Acceptance criteria

### AC-02 — happy path

> **Given** the "Adjust" tool is open on any image
> **When** the Editor moves the brightness or the contrast slider while the other six values are neutral
> **Then** a higher brightness makes the image lighter, so no colour channel of any pixel gets darker, and a lower brightness makes it darker, so no channel gets lighter. A higher contrast makes the parts lighter than mid-grey lighter and the parts darker than mid-grey darker, while mid-grey itself stays the same; a lower contrast moves every tone towards mid-grey. Mid-grey is the stored pixel value 128, 128, 128, which stays 128, 128, 128 at any contrast, and every direction in AC-02 to AC-04 is judged on the stored pixel values
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — happy path

> **Given** the "Adjust" tool is open on any image
> **When** the Editor moves the saturation, temperature or tint slider while the other six values are neutral
> **Then** a higher saturation makes colours more vivid and a lower one moves them towards grey: at −100 every pixel is a shade of grey, with equal red, green and blue. A pixel that is already grey stays the same at any saturation. A higher temperature makes the image warmer, so on a mid-grey image red rises and blue falls, and a lower temperature does the opposite. A higher tint makes the image more magenta, so on a mid-grey image green falls compared with red and blue, and a lower tint makes it greener. Whether pure black and pure white are tinted is left to design (§8)
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — happy path

> **Given** the "Adjust" tool is open on any image
> **When** the Editor sets grayscale or sepia to an amount between 0% and 100%
> **Then** the image moves from its colours towards the effect in proportion to the amount. At grayscale 100% and sepia 0%, every pixel has equal red, green and blue, whatever the other values, and each colour keeps its perceived lightness, so a pure yellow becomes a light grey and a pure blue a dark grey. At sepia 100%, every pixel is a brown tone, with red at least as high as green and green at least as high as blue, whatever the other values, grayscale included. Grayscale and sepia act last and override what the other sliders do to colour, so these two rules hold for any combination of values; how the other sliders combine with one another follows the fixed order of AC-07
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] The seven steps in `ADJUSTMENT_KEYS` order, clamp after each, neutral = exact identity per step; `lightness()` (Rec. 709) exported for T4 — `src/core/adjust/formula.ts`
- [ ] `toUniforms(a)` with the `enabled` flag — `src/core/adjust/uniforms.ts`
- [ ] Export both — `src/core/adjust/index.ts`
- [ ] Anchor-table tests, direction property tests (AC-02–AC-04), alpha/transparency tests (AC-06), order/path tests (AC-07) — `src/core/adjust/formula.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| All seven neutral | output equals input bit for bit; `toUniforms(NEUTRAL_ADJUSTMENTS).enabled === false` (QG-1b) |
| Pixel with alpha 0 | stays (0, 0, 0, 0) |
| Partly transparent pixel (alpha 64, 128, 254) | same unpremultiplied colour as the opaque pixel, alpha exactly unchanged (AC-06) |
| Grayscale 100% + sepia 0% with any other values | r = g = b |
| Sepia 100% with any other values, grayscale included | r ≥ g ≥ b |
| Contrast +100 pushes 64 below black | clamped to 0, never wraps (AC-07) |
| Black under temperature or tint ±100 | stays black (not tinted) |

## Definition of Done

- [ ] Every cell of the ADR-0003 anchor table is a passing test
- [ ] Seeded property tests prove the AC-02–AC-04 directions over random colours and random other values, and AC-06 alpha invariance
- [ ] A test proves `toUniforms(NEUTRAL_ADJUSTMENTS)` turns the bypass on
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
