---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-08"
feature_size: "M"
ticket: "roadmap step 5 — adjust"
---

# 0003 — Define each Adjustment by a fixed formula that keeps black in place, in one fixed order

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The spec fixes the directions and the neutral values of the seven Adjustments (AC-02 to AC-04), the fixed order and the clamping (AC-07), and leaves to design how strong each slider is at its bounds, whether pure black and white are tinted and which weighting grayscale uses (spec §8, first open question, due before design). The formulas give every stored value its meaning: the Preview, the Export, Auto adjust's inversion (ADR-0004) and, from step 8, every saved Work depend on them, so changing them later changes how saved Works look.

## Decision drivers

- spec AC-02 to AC-04: the directions, mid-grey 128 fixed under contrast, grey at saturation −100 and grayscale 100%, perceived lightness kept by grayscale, red ≥ green ≥ blue at sepia 100%
- spec AC-07: one fixed order, and a channel pushed past white or black stays there
- spec §8 default: ±100 is a strong but still usable change, comparable to common browser editors at the same slider position
- ADR-0002: the steps run on unpremultiplied stored sRGB values in [0, 1]
- sad.md §1 quality goals 1 and 2

## Considered options

1. **Curves that keep black in place** — brightness as a gamma curve, contrast as a linear stretch around 128, saturation as a mix with Rec. 709 lightness, temperature and tint as channel gains, and grayscale and sepia as in CSS filters.
2. **Additive offsets** — brightness, temperature and tint add a constant to the channels; the other four are as in option 1.

## Decision outcome

**Chosen:** Option 1. Gains and a gamma curve leave pure black black and never lift shadows into a muddy grey, and they keep white white under brightness. That is closest to how common browser editors behave at the same slider positions. Additive offsets are simpler to invert, but they clip highlights at +100, turn a black background grey or tinted, and lose more detail at the bounds.

**The formulas.** For each pixel, `c = (r, g, b)` is the unpremultiplied stored colour divided by 255, `L(c) = 0.2126 r + 0.7152 g + 0.0722 b` (Rec. 709 weights, as CSS `grayscale()`), `p = 128 / 255` and `clamp` limits each channel to [0, 1]. The steps run in this order, with `clamp` after each:

1. **Brightness** `b` in −100…100: `c = c ^ (2 ^ (−b / 100))`, an exponent from 2 (at −100) to 0.5 (at +100). Black and white stay where they are, and a higher value never darkens a channel.
2. **Contrast** `k` in −100…100: `f = 1 / (1 − 0.75 k / 100)` for `k ≥ 0` (up to ×4), and `f = 1 + k / 100` for `k < 0` (down to 0); `c = p + (c − p) × f`. The stored value 128 is the exact pivot.
3. **Saturation** `s` in −100…100: `c = L + (c − L) × (1 + s / 100)`, from grey at −100 to ×2 at +100. A grey pixel is unchanged.
4. **Temperature** `t` in −100…100: `r × (1 + 0.2 t / 100)` and `b × (1 − 0.2 t / 100)`.
5. **Tint** `m` in −100…100: `g × (1 − 0.2 m / 100)`, so a higher tint lowers green (magenta) and a lower tint raises it (green).
6. **Grayscale** `g` in 0…100%: `c = mix(c, (L, L, L), g / 100)`.
7. **Sepia** `q` in 0…100%: `S = clamp(M × c)` with the CSS `sepia()` matrix `M = [0.393 0.769 0.189; 0.349 0.686 0.168; 0.272 0.534 0.131]`, then `c = mix(c, S, q / 100)`. Every coefficient in M's first row is at least the one below it, so `S` has red ≥ green ≥ blue for any input, and clamping keeps that order.

**Anchors (answers to spec §8; stored 8-bit values, each step alone, the rest neutral).** These are the unit-test anchors for the CPU reference of ADR-0001 and the e2e fidelity fixtures:

| Setting | Mid-grey 128 | Black 0 | White 255 | Other |
|---|---|---|---|---|
| Brightness +100 / +50 / −50 / −100 | 181 / 157 / 96 / 64 | 0 | 255 | 64 → 128 at +100 |
| Contrast +100 / +50 / −50 / −100 | 128 at every value | 0 / 0 / 64 / 128 | 255 / 255 / 192 / 128 | 64 → 0 at +100, 192 → 230 at +50 |
| Temperature +100 / −100 | (154, 128, 102) / (102, 128, 154) | not tinted | (255, 255, 204) / (204, 255, 255) | — |
| Tint +100 / −100 | (128, 102, 128) / (128, 154, 128) | not tinted | (255, 204, 255) / unchanged | — |
| Grayscale 100% | 128 | 0 | 255 | red 54, green 182, blue 18, yellow 237 |
| Sepia 100% | (173, 154, 120) | 0 | (255, 255, 239) | — |

So pure black is never tinted. Pure white is tinted only by the channel that temperature or tint lowers, and is unchanged by brightness and by contrast at 0 and above.

## Consequences

**Positive**
- Every spec rule is a direct property of a formula and is pinned by the anchor table in unit tests, before any GPU is involved.
- Each step's neutral value is an exact identity, which ADR-0002's neutral path relies on.
- Auto adjust inverts closed-form expressions: the brightness exponent from a median, the contrast factor from a range, and the gains from channel means (ADR-0004).

**Negative**
- Brightness cannot pull a pure black photo up, because black stays black. Contrast at −100 flattens everything to mid-grey, which is strong but is what CSS `contrast(0)` does.
- The formulas are now a stored-data contract: from step 8, changing one changes the look of every saved Work, so a change needs a new formula version stored with the Work.

**Neutral**
- The 0.2 channel gain and the ×4 contrast ceiling are tuning constants. Changing them before step 8 ships is a one-line edit plus new anchors.

## Links

- Spec: [[../spec.md]] AC-02, AC-03, AC-04, AC-07, §8 (first open question)
- SAD: [[../sad.md]] §4 (choice 3), §10, §12
- Related ADR: [[0001-model-the-adjustments-as-seven-integer-fields-on-the-work]], [[0002-apply-the-adjustments-in-the-shared-fragment-shader-on-stored-srgb-values]], [[0004-measure-auto-adjust-on-a-bounded-sample-in-the-preview-context]]
