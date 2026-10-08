---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-08"
feature_size: "M"
ticket: "roadmap step 5 — adjust, T17 (QG-1c)"
---

# 0005 — Record the semi-transparent colour deviation on Firefox and WebKit instead of loosening QG-1c

- **Status:** Accepted
- **Date:** 2026-10-08
- **Deciders:** Blazheiko (owner), during `implement` T17

## Context

The test plan checks QG-1c (AC-06) on the semi-transparent fixture `alpha-patches.png`. Alpha must be
kept exactly on every engine. Colour at alpha 64 or more must match the Preview at 100% within
export's per-engine limit: 3/255 on Linux WebKit and 2/255 elsewhere.

T17 measured the largest Export-to-Preview colour difference per alpha level on macOS. Chromium
shows 0 at every level and every setting. Firefox and WebKit already differ **with neutral values**:

| Setting (Firefox / WebKit) | alpha 64 | alpha 128 | alpha 254 | alpha 255 |
|---|---|---|---|---|
| neutral | 4 / 4 | 2 / 2 | 1 / 1 | 0 / 0 |
| brightness −100 | 8 / 8 | 4 / 4 | 2 / 1 | 0 / 0 |
| contrast +100 | 12 / 16 | 6 / 8 | 4 / 4 | 0 / 0 |
| sepia 100% | 8 / 4 | 4 / 2 | 1 / 1 | 0 / 0 |

The gap comes from the export path, not from the Adjustments. The export reads the Original through
a 2D canvas (export ADR-0003, `worker-handler.ts` `readPixels`), and the Preview uploads the
`ImageBitmap`. On these two engines the two routes round a semi-transparent colour to different 8-bit
premultiplied steps, about 255 / alpha apart. Each Adjustment then multiplies that one-step input
difference by its slope, up to ×4 for contrast +100. Alpha is never affected.

## Decision drivers

- Never loosen a limit silently (test-plan §Decisions, `sad.md` §11).
- Alpha must stay exact everywhere (AC-06), and it is.
- Opaque fidelity (QG-1a) holds at 2/255 on every engine.
- Fixing the root cause changes open-and-view and export, not this feature.

## Considered options

1. **Record the deviation.** Keep alpha exact on every engine and colour at alpha ≥ 64 within 2/255
   on Chromium. On Firefox and WebKit, check colour only on opaque pixels (alpha 255) within the
   per-engine limit, and record the gap below alpha 255 here. (A first version checked alpha ≥ 254,
   but contrast +100 reaches 4/255 there: one step times slope 4.)
2. **An alpha-scaled bound:** `2 + (255 / alpha) × slope` on Firefox and WebKit.
3. **Fix the root cause:** upload the Preview's Original through a 2D canvas as the export does. This
   costs a full-size readback on every open and changes two other features.
4. **Drop the colour check** on Firefox and WebKit.

## Decision outcome

**Chosen:** Option 1 (owner's choice in T17). `e2e/adjust/fidelity.spec.ts` QG-1c checks alpha
exactly everywhere. It checks colour at alpha ≥ 64 on Chromium and on opaque pixels only (alpha 255)
on Firefox and WebKit, within `semiTransparentLimit`. Colour below those alphas is held by the CPU reference unit
tests (`formula.test.ts`, AC-06 "no fringe"), which unpremultiply exactly.

## Consequences

- Positive: the suite is honest. Every engine checks alpha exactly and opaque colour at 2/255, and
  this record shows the measured gap.
- Negative: on Firefox and WebKit, a soft edge (alpha 1–254) in an adjusted Export can differ from
  the Preview by up to 16/255 in colour. With neutral values it differs by up to 4/255, as today.
- Follow-up: option 3 fixes the gap at its source. It belongs to open-and-view or export, with its
  own perf check on open.

## Links

- Related ADR: [[0002-apply-the-adjustments-in-the-shared-fragment-shader-on-stored-srgb-values]];
  export ADR-0003 (the window fallback and Linux WebKit's 3/255)
- test-plan.md §Decisions (fidelity tolerance); `sad.md` §11 (fidelity risk)
