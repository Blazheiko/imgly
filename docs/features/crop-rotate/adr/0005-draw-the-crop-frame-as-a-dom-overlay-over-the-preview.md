---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-06"
feature_size: "M"
ticket: "roadmap step 4 — crop-rotate"
---

# 0005 — Draw the crop frame as a DOM overlay over the Preview canvas

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth, accepted assumption)

## Context

While the tool is open, SCR-03 shows a crop frame over the whole turned image. The area outside the frame is dimmed, eight handles sit on the edges and corners, a rule-of-thirds grid shows while dragging (AC-01), and a fine grid shows while straightening (AC-05). The frame must work by mouse and by keyboard: Tab reaches every control, the arrow keys move a focused frame or resize a focused edge or corner by 1 px of the image (10 px with Shift), and Enter and Escape apply and cancel (AC-20). The Preview itself is one WebGL2 canvas (open-and-view ADR-0003, ADR-0002 here).

## Decision drivers

- spec AC-20: every control reachable with Tab; the frame, edges and corners focusable and driven by the arrow keys
- spec §6: Preview update while dragging p95 frame interval ≤ 33 ms
- repo `CLAUDE.md` §Conventions: component tests with `@vue/test-utils` on happy-dom; e2e only for what happy-dom can't do
- `docs/design-system.md`: every action reachable by keyboard; tokens for every colour and spacing

## Considered options

1. **DOM overlay** — absolutely positioned elements over the canvas: four dimming panels, the frame with focusable handle elements, and the grids as CSS lines.
2. **Canvas 2D overlay with hidden focus proxies** — the frame, dimming and grids drawn on a second canvas, with invisible focusable elements placed over the handles for the keyboard.
3. **Draw the frame in the WebGL pass** — dimming and frame lines added to the shader, with hit-testing and focus handled separately in script.

## Decision outcome

**Chosen:** Option 1. Focus, roles, labels, pointer capture and the keyboard come from the platform, so AC-20 is plain DOM. The overlay can be component-tested in happy-dom: drag, arrow keys and Escape assert on the store, with no GPU. Moving a handful of elements per frame is far cheaper than the 33 ms budget, and the WebGL canvas redraws only the image. Option 2 duplicates every handle as a hidden focus target that must be kept in sync with what is drawn. Option 3 mixes interaction chrome into the shader that the Export shares, so the Export would need a flag to keep it out.

How it works:

- `CropOverlay.vue` is placed over the canvas area by `CropRotateTool.vue`, which the app shell mounts in the editor's tool slot. Its positions come from the View and the draft Geometry through `core/geometry`'s overlay maths: the Crop's corners in screen pixels. They are computed with the same View and size the renderer uses, so the frame sits on the pixels the shader draws.
- Pointer drags use pointer capture on the frame or handle. Each move turns the screen delta into image pixels with the same maths, and calls the store, which applies `clampCrop` and the proportion (AC-02, AC-08).
- Colours, line widths and the dimming opacity come from `tokens.css`. Any new primitive (for example a reusable drag handle) is registered in `docs/design-system.md`.

## Consequences

**Positive**
- Keyboard and screen-reader access come from the platform; AC-20 is covered by component tests.
- The WebGL program stays free of interaction chrome, so the Export can never show a frame line.

**Negative**
- The overlay and the canvas are two layers that must agree to the device pixel: a rounding mismatch shows the frame half a pixel off the image edge at high zoom. An e2e screenshot check at 100% and 800% guards it.
- Many DOM nodes update while dragging; positions are written with `transform` only, to avoid layout work.

**Neutral**
- The drawing layer (step 6) is a Canvas 2D bitmap (repo ADR 0004) and does not have to follow this choice; this decision covers tool chrome over the Preview.

## Links

- Spec: [[../spec.md]] AC-01, AC-02, AC-05, AC-08, AC-20, §6
- SAD: [[../sad.md]] §5, §8
- Related ADR: [[0001-model-the-geometry-as-integer-parameters-with-one-core-transform]] (overlay maths); [[0002-render-the-geometry-in-the-shared-shader-in-one-pass]]; [[0003-open-tools-in-an-active-tool-slot-with-the-draft-in-the-feature-store]] (tool slot)
