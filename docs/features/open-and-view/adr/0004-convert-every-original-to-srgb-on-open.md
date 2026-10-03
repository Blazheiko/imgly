---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-03"
feature_size: "M"
ticket: "roadmap step 2 — open-and-view"
---

# 0004 — Convert every Original to sRGB on open

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

Many phone photos are captured in Display P3, a wider colour gamut than standard sRGB, and some files carry other ICC colour profiles. The spec left open whether such images are shown in their own colour space or converted to sRGB, with the default "converted to sRGB" and a deadline of "before `sdd:design` closes" (spec §8). The Original's colour space is inherited by the adjustment shader (roadmap step 5), the export (step 3) and the Originals the gallery will store (step 8).

## Decision drivers

- sad.md §2: the same behaviour in the latest Chromium, Firefox and Safari
- repo ADR 0004: preview and export share one code path, so what you see is what you export
- spec §8 open question on wide gamut, default "converted to sRGB"
- spec §1: the 4–6 week MVP budget

## Considered options

1. **Convert everything to sRGB** — the browser converts the embedded profile to sRGB while decoding; the canvases, the shader and the export all work in sRGB.
2. **Keep Display P3 where the browser supports it** — P3 `OffscreenCanvas` and WebGL drawing buffer, P3-tagged export, sRGB elsewhere.

## Decision outcome

**Chosen:** Option 1. It behaves the same in all three target browsers, keeps the adjustment maths and the export in one colour space, and costs nothing extra in the MVP. Option 2 shows truer colours on P3 screens, but browser support for P3 canvases differs, so the same Work would look and save differently per browser, and every later step would have to track the Original's colour space and double its tests.

How it works: the decode worker calls `createImageBitmap` with `colorSpaceConversion: 'default'`, so the browser applies the file's embedded profile and produces sRGB pixels (ADR-0001). The `OffscreenCanvas` and the WebGL2 drawing buffer keep their default sRGB colour space. Files without a profile are treated as sRGB.

## Consequences

**Positive**
- One colour space for the Preview, the adjustments and the export; no per-browser branches.
- Resolves the spec §8 wide-gamut question without new configuration.

**Negative**
- Colours outside sRGB (very saturated reds and greens in P3 photos) are clipped for this Work, without a notice. The spec's "never degraded without being told" promise is about dimensions; this colour loss is recorded as accepted debt in sad.md §11.

**Neutral**
- Adding wide-gamut support later means a colour-space field on the Original and re-opening the source file; Originals already stored in the gallery stay sRGB.

## Links

- Spec: [[../spec.md]] §8 (wide gamut), §1
- SAD: [[../sad.md]] §4, §11
- Related ADR: [[0001-decode-and-downscale-in-a-dedicated-web-worker]], [[0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform]]
