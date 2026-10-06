---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-06"
feature_size: "M"
ticket: "roadmap step 4 — crop-rotate"
---

# 0001 — Model the Geometry as integer parameters on the Work, with every rule and one transform in core

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth, accepted assumption)

## Context

crop-rotate adds the Work's Geometry: its Flip, Rotation, Straighten angle and Crop, applied in that order (CONTEXT "Geometry"). Several places must agree on it exactly: the tool that edits it, the Preview, the export worker, the status bar, the export panel's sizes, and the Unsaved-edits rule, which compares two Geometries field by field, not by their pixels (AC-13). Later, the drawing layer (step 6) follows the Geometry and the gallery (step 8) persists it. The ux-flows design input asks for one place that turns an on-screen action into a change of the stored fields, because a Flip changes the sign of the Straighten angle (AC-04).

## Decision drivers

- spec AC-13: two Geometries are compared field by field; four quarter turns or two equal Flips give back an equal Geometry
- spec AC-02, AC-09: the Crop is whole pixels of the image after its Flip, Rotation and Straighten angle, and its size is exactly the Work's and a full-size Export's size
- spec AC-05, AC-07: Straighten angle from −45° to +45° in steps of 0.1°
- sad.md §1 quality goals 1 (fidelity) and 2 (non-destructive, exact)
- repo ADR 0002: domain rules are pure TypeScript in `core`; repo ADR 0003: a Work is stored as its Original plus parameters

## Considered options

1. **Integer parameters on the Work; every rule and the one transform in `core/geometry`** — the fields are stored as chosen, in whole units, and one pure module owns every rule and derives the one matrix all renderers use.
2. **Parameters with a floating-point angle; each consumer composes its own transform** — the Preview renderer, the export worker and the tool overlay each build their matrix from the fields, and the angle is a float in degrees compared with a tolerance.

## Decision outcome

**Chosen:** Option 1. Integers make AC-13's comparison and AC-02's whole-pixel rule exact with no tolerance to choose, and one derived transform means the Preview, the export worker and the overlay cannot disagree about where a pixel lands, which is quality goal 1. Option 2 is less code up front but spreads the same maths over three places, where a half-pixel or sign slip shows up only as an e2e pixel mismatch on one engine.

How it works:

- `src/core/document.ts`: `Work` gains `geometry: Geometry`; `createWork` sets the identity Geometry (no Flip, rotation 0, straighten 0, Crop covering the whole Original).
- `Geometry = { flipH: boolean, flipV: boolean, rotation: 0 | 90 | 180 | 270, straighten: number /* integer tenths of a degree, −450…450 */, crop: { x, y, width, height } /* integers */ }`.
- **Coordinate frame of the Crop.** The image after its Flip and Rotation is W×H pixels (the Original's size, swapped for 90° and 270°). The Straighten angle turns it clockwise around its centre (W/2, H/2). The Crop is an axis-aligned rectangle in that frame, so with no Straighten angle it is plain pixel coordinates of the turned image; with one, `x` or `y` can be negative, and the invariant is that the rectangle lies fully inside the turned image (CONTEXT invariant).
- **`src/core/geometry/`** (pure, unit-tested): `identityGeometry(original)`, `geometryEquals(a, b)` (AC-13), `workSize(work)` (the Crop's size), `rotateQuarter(g, dir)` (AC-03, the frame turns with the image), `flipOnScreen(g, axis)` (AC-04: a screen-horizontal flip is a stored vertical Flip at 90° and 270°, the Crop is mirrored, the angle changes sign), `setStraighten(g, tenths)` (AC-05: the image turns around the frame's centre, so the centre is re-anchored to the same image content, then AC-06), `fitCropInside(g)` (AC-06: largest rectangle of the frame's proportion around its centre inside the turned image, sizes rounded down, centre moved to the nearest inside point only when it falls outside), `clampCrop` and the rounding rules of AC-02, the proportion and size maths of AC-08 and AC-09, the input rules of AC-07 and AC-10 (plain decimal notation only), and `cropToOriginalUv(g, original): mat3`, the transform from a Crop pixel to an Original texture coordinate.
- Everything outside `core` reads the Work's size through `workSize(work)` and renders through `cropToOriginalUv`; no other module composes Flip, Rotation or Straighten itself.

## Consequences

**Positive**
- AC-13 is one pure function; AC-03's "four turns give back the same Geometry" and AC-04's "two Flips give back the same Geometry" are exact equalities in unit tests.
- Every geometric rule is unit-tested without a browser; the e2e tests only check that the renderers apply the one matrix.
- The Geometry is a small plain object: it crosses to the export worker by structured clone, and step 8 can store it as is.

**Negative**
- The tool must convert between tenths and degrees at the edges (slider, field, display), and the Crop's negative coordinates under a Straighten angle are a little surprising to read.
- `Work` changes shape, so open-and-view and export code that read `original.width`/`height` as the Work's size must move to `workSize(work)`; a missed call site shows the wrong size only once a Crop is applied.

**Neutral**
- Persisting the Geometry in step 8 is a new forward migration that adds the field to `WorkRecord` (repo ADR 0003); nothing here changes the schema.
- Changing the angle step later (for example 0.05°) means changing the unit of `straighten`, which is local to `core/geometry` and the tool's field.

## Links

- Spec: [[../spec.md]] AC-02 to AC-10, AC-12, AC-13, §6
- SAD: [[../sad.md]] §4 (choice 1), §5, §8
- Related ADR: [[0002-render-the-geometry-in-the-shared-shader-in-one-pass]] (consumes the transform); open-and-view ADR-0005 (revision counter); repo ADR 0003 (Original plus parameters)
