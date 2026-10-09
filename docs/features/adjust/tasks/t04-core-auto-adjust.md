---
id: T4
title: "Add autoAdjust(sample): unpremultiply, median and percentiles of Rec. 709 lightness, grey-world gains, rounded half up within ±50, or nothing"
layer: "domain"
deps: ["T3"]
blocks: ["T6"]
acs: ["AC-12", "AC-13"]
files_hint: ["src/core/adjust/auto.ts", "src/core/adjust/auto.test.ts", "src/core/adjust/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 49 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Add autoAdjust(sample): unpremultiply, median and percentiles of Rec. 709 lightness, grey-world gains, rounded half up within ±50, or nothing

## Place in the sequence

- **Blocked by:** T3 — Write the CPU reference of the seven formulas (applyAdjustmentsToPixel) and toUniforms, pinned to ADR-0003's anchor table.
- **Blocks:** T6 — Add PreviewRenderer.sampleCrop(geometry, maxSide) into a temporary framebuffer and the editor store's sampleWork().
- **Wave:** 3 — alongside T5, T10, T12.
- **Lane:** shares `src/core/adjust/index.ts` with T1; shares `src/core/adjust/index.ts` with T2; shares `src/core/adjust/index.ts` with T3 — serialized.

## Why (user story)

> **US-06: Fix a photo in one click**
>
> **As a** Editor  
> **I want** one action that sets brightness, contrast and colour balance for me  
> **So that** I get a good starting point quickly and can fine-tune it with the sliders
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It computes the four values Auto puts on the sliders, deterministically, as a pure function the store can call on any sample.

## Inlined context

> `src/core/adjust/auto.ts` exports `autoAdjust(sample): { kind: 'values'; values: Pick<Adjustments, 'brightness' | 'contrast' | 'temperature' | 'tint'> } | { kind: 'nothing' }`, a pure function over the premultiplied 8-bit samples:
> - It skips samples with alpha 0 and divides every other sample's colour by its alpha, so a partly transparent pixel counts at its real colour (AC-12). … If none remain, or every remaining sample has the same colour, it returns `nothing` (AC-13).
> - **Brightness** from the median of `L(c)` (ADR-0003's Rec. 709 lightness, in a 256-bin histogram): the exponent that maps the median to 128 / 255, turned back into `b` through ADR-0003's brightness formula.
> - **Contrast** from the 0.5th and 99.5th percentiles after that brightness: the factor that stretches them towards 5 / 255 and 250 / 255 around 128 / 255, turned into `k` through ADR-0003's contrast formula.
> - **Temperature and tint** from the grey-world means of red, green and blue: the `t` that makes the red and blue means equal, and the `m` that brings the green mean to the average of red and blue, through ADR-0003's gains.
> - Every value is rounded half up and clamped to −50…50. The function uses doubles and integer histograms only, so the same sample always gives the same values.
>
> — `adr/0004 §Decision outcome, Compute, abridged` · full text: [adr/0004](../adr/0004-measure-auto-adjust-on-a-bounded-sample-in-the-preview-context.md)

> 1. **Brightness** … `c = c ^ (2 ^ (−b / 100))` …
> 2. **Contrast** … `f = 1 / (1 − 0.75 k / 100)` for `k ≥ 0` …, and `f = 1 + k / 100` for `k < 0` …; `c = p + (c − p) × f`.
> 4. **Temperature** … `r × (1 + 0.2 t / 100)` and `b × (1 − 0.2 t / 100)`.
> 5. **Tint** … `g × (1 − 0.2 m / 100)` …
>
> — `adr/0003 §Decision outcome, The formulas 1, 2, 4, 5, abridged` · full text: [adr/0003](../adr/0003-define-each-adjustment-by-a-fixed-formula-that-keeps-black-in-place.md)

> F4 (Auto adjust) is kept as drawn, but the owner marked it for review … Points to check: the "display lost" branch, which the spec does not name, the 512 px sample, and the order of "ignore fully transparent pixels, then unpremultiply" (ADR-0004). — owner: Blazheiko, due: before `/sdd:plan-tests adjust`
>
> — `sad.md §6, Open question from this stage, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes. May import nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this).
>
> — `CLAUDE.md §Module boundaries, src/core row, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

`ImageSample = { width: number; height: number; data: Uint8Array | Uint8ClampedArray }` (premultiplied RGBA, row-major) is defined here, in `core`, so `render` (T6) can return it. Use T3's `lightness()` and invert T3's formulas rather than re-deriving them.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`ImageSample`, `autoAdjust(sample)` → `{ kind: 'values', values } | { kind: 'nothing' }`.)

## Acceptance criteria

### AC-12 — happy path

> **Given** the "Adjust" tool is open on an image that is not all one colour
> **When** the Editor chooses Auto
> **Then** the brightness, contrast, temperature and tint sliders move to values computed from the pixels inside the Work's Crop, and the Preview shows the result; saturation, grayscale and sepia stay as they were. The values are computed from the Work with its Geometry and without any Adjustments, and they replace the four sliders' values instead of adding to them, so choosing Auto again gives the same values. The Editor can change the values afterwards, and they reach the Work only on Apply. Fully transparent pixels are ignored
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — domain invariant

> **Given** the "Adjust" tool is open
> **When** the Editor chooses Auto
> **Then** the values it sets are whole numbers between −50 and +50, so Auto never pushes a slider to an extreme, and the same Work with the same Geometry always gets the same values in the same browser; between the target browsers each value differs by at most 1. When the pixels inside the Crop that are not fully transparent all have the same colour, or there are none, there is nothing to measure: the sliders stay as they were and a hint says there is nothing to correct automatically
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `ImageSample` type and `autoAdjust` — `src/core/adjust/auto.ts`
- [ ] Export them — `src/core/adjust/index.ts`
- [ ] Synthetic-sample tests: dark, flat, blue cast, yellow cast, single colour, all transparent, partly transparent edge, determinism, the ±50 clamp — `src/core/adjust/auto.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Every sample alpha 0, or a 0×0 sample | `{ kind: 'nothing' }` |
| All remaining samples one colour | `{ kind: 'nothing' }` (compare the unpremultiplied colours exactly, as ADR-0004 says; if T19's fixture disagrees, raise it — do not invent a tolerance) |
| A very dark photo whose ideal brightness is > +50 | brightness 50 (clamped) |
| A grey image with a few colour pixels | `values` with temperature and tint ≈ 0 |
| Same sample twice | identical values (AC-12, AC-13) |
| Saturation, grayscale, sepia | never part of the result |

## Definition of Done

- [ ] Vitest on synthetic samples proves the directions (dark → brightness > 0, blue cast → temperature > 0, green cast → tint > 0), whole numbers within ±50, the two `nothing` cases, alpha-0 skipping and determinism
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
