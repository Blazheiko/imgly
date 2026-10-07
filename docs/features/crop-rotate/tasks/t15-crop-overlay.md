---
id: T15
title: "Build CropOverlay: dimmed outside, frame with 8 focusable handles, both grids, pointer drags and arrow keys"
layer: "ui"
deps: ["T5", "T13"]
blocks: ["T17"]
acs: ["AC-01", "AC-02", "AC-20"]
files_hint: ["src/features/crop-rotate/CropOverlay.vue", "src/features/crop-rotate/CropOverlay.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 59 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T15 — Build CropOverlay: dimmed outside, frame with 8 focusable handles, both grids, pointer drags and arrow keys

## Place in the sequence

- **Blocked by:** T5 — Derive the one transform: cropToOriginalUv, turnedImageToOriginalUv, turnedBounds and the overlay's screen maths · T13 — Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset.
- **Blocks:** T17 — Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View.
- **Wave:** 6 — alongside T11, T14, T16, T18.
- **Lane:** own lane.

## Why (user story)

> **US-01: Cut away what I don't want**
>
> **As a** Editor  
> **I want** to drag a crop frame over the image and apply it  
> **So that** the Work keeps only the part of the photo I care about
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It is the frame the Editor drags — by mouse or keyboard — with the outside dimmed and the grids that help line it up.

## Inlined context

> - `CropOverlay.vue` is placed over the canvas area by `CropRotateTool.vue`, which the app shell mounts in the editor's tool slot. Its positions come from the View and the draft Geometry through `core/geometry`'s overlay maths: the Crop's corners in screen pixels. They are computed with the same View and size the renderer uses, so the frame sits on the pixels the shader draws.
> - Pointer drags use pointer capture on the frame or handle. Each move turns the screen delta into image pixels with the same maths, and calls the store, which applies `clampCrop` and the proportion (AC-02, AC-08).
> - Colours, line widths and the dimming opacity come from `tokens.css`. Any new primitive (for example a reusable drag handle) is registered in `docs/design-system.md`.
>
> — `adr/0005 §How it works, verbatim` · full text: [adr/0005](../adr/0005-draw-the-crop-frame-as-a-dom-overlay-over-the-preview.md)

> Many DOM nodes update while dragging; positions are written with `transform` only, to avoid layout work.
>
> — `adr/0005 §Consequences, Negative bullet 2, verbatim` · full text: [adr/0005](../adr/0005-draw-the-crop-frame-as-a-dom-overlay-over-the-preview.md)

> Canvas area (`CropOverlay` over `PreviewCanvas`): the whole Turned image fitted to the View, with transparent empty corners showing the canvas surround. Outside the frame, four dimming panels in `--color-canvas-surround` at 0.7 opacity, the same dimming the `Dialog` backdrop uses. The frame is a 1 px line in `--color-text` with 8 handles (4 corners, 4 edge midpoints). Each handle and the frame are focusable, showing `--color-focus-ring` when focused.
>
> — `screens.md §SCR-03 canvas area, verbatim` · full text: [screens.md](../screens.md)

> | dragging the frame | An edge, corner or the inside of the frame is dragged (F2, AC-01). A rule-of-thirds grid shows inside the frame while dragging. The frame stops at the image edge and never goes below 1 × 1 px or turns inside out (AC-02). Width and height follow (AC-09) | as `default` + thirds grid in `CropOverlay` | wireframe 03-b |
> | straightening | The slider is dragged, an arrow key moves it, or an angle is applied from its field (F4, AC-05). A fine grid shows over the image while the angle changes. … | as `default` + fine grid in `CropOverlay` | wireframe 03-c |
> | display lost | … `CropOverlay` is part of that area and is hidden with it. The panel stays, so Cancel still works | open-and-view's `CanvasMessage` | — |
>
> — `screens.md §SCR-03 rows dragging / straightening / display lost, abridged` · full text: [screens.md](../screens.md)

> | Arrows (`Shift` ×10) | Frame focused | Move the frame by 1 px of the image (10 px) | AC-20 |
> | Arrows (`Shift` ×10) | Edge or corner focused | Resize by 1 px (10 px); a locked proportion follows | AC-20 |
> label | frame and handles (screen readers) | AC-20 | Crop frame · Top edge · Right edge · Bottom edge · Left edge · Top-left corner · Top-right corner · Bottom-right corner · Bottom-left corner
>
> — `screens.md §Keyboard rows 7–8 + §Message catalog, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** Only `core/geometry` converts between [the three coordinate spaces]: the shader's `u_geometry`, the overlay's positions and drag deltas all come from it.
>
> — `sad.md §8, Coordinate spaces, abridged` · full text: [sad.md](../sad.md)

"While the angle changes" needs a signal from the store (e.g. `straightening` true for a short time after `setAngle`); add a small flag to the store if T13 didn't (it's this task's only store change — keep it within `store.ts` minimal, or derive it locally from a watcher on `draft.straighten`; prefer the local watcher to stay out of T13's lane).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Crop and rotate" tool, drags an edge or a corner of the crop frame inwards, and chooses Apply
> **Then** the tool closes, the Preview shows only the area inside the frame, and the size shown for the Work is the Crop's width and height in pixels, followed by the Original's dimensions whenever the width or the height differs, compared in order, so a 90° Rotation alone also shows them (for example "1920×1080, from 4096×3072"), so the Original's dimensions stay visible as open-and-view AC-05 and AC-06 require. While the tool is open, the area outside the frame is dimmed, a rule-of-thirds grid shows inside the frame while it is being dragged, and the whole frame can be moved by dragging inside it. The Work now has Unsaved edits (AC-13)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — domain invariant

> **Given** the "Crop and rotate" tool is open
> **When** the Editor drags the crop frame, an edge or a corner past the edge of the image, or drags an edge past the opposite edge
> **Then** the frame stops at the edge of the image and never extends beyond it, and it never becomes smaller than 1×1 px of the image or turns inside out, because a Crop always lies fully inside the image and is never empty. The Crop's width, height and position are always whole numbers of pixels of the image as it stands after its Flip, Rotation and Straighten angle. When centring or resizing around a centre leaves an odd pixel, the frame's left and top edges round down, so the extra pixel goes to the right or the bottom
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-20 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to crop or turn it
> **Then** a "Crop and rotate" action is visible in the toolbar next to Export. It can be reached with Tab and activated with Enter or Space, and the C key opens it as well. The C key does nothing while the export panel is open, while the tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With the frame focused, the arrow keys move it by 1 px of the image (10 px with Shift). With a frame edge or corner focused, they resize it by the same step, and with a proportion locked the other side follows as in AC-08. With the straighten slider focused, they change the angle by 0.1° (1° with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-07, AC-10). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Rotating once and keeping it takes three actions (open the tool, rotate, Apply), and cropping to a square takes three actions (open the tool, choose 1:1, Apply)
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

This task owns the frame parts: AC-01's dimming, thirds grid and move-by-dragging-inside; AC-02's stop at the edge as the user sees it; AC-20's arrow keys on the frame and handles. The Apply half of AC-01 is T17; the status bar is T9.

## Checklist

- [ ] Layout: 4 dimming panels, frame, 8 handles (`role="slider"` or button with label from `messages.ts`, `tabindex="0"`), positions from `cropCornersOnScreen` via `transform` — `src/features/crop-rotate/CropOverlay.vue`
- [ ] Pointer: `setPointerCapture`; inside → `store.moveBy`; handle → `store.resizeBy(handle, …)`; deltas via `screenDeltaToImage`; `dragging` flag for the thirds grid — `src/features/crop-rotate/CropOverlay.vue`
- [ ] Keys: arrows on the frame → move by 1/10 px; on a handle → resize by 1/10 px — `src/features/crop-rotate/CropOverlay.vue`
- [ ] Fine grid while the angle changes (local watcher on `draft.straighten`, short timeout) — `src/features/crop-rotate/CropOverlay.vue`
- [ ] Tokens only; tests on happy-dom — `src/features/crop-rotate/CropOverlay.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Drag past the image edge | frame stops (store clamps); pointer may continue |
| Drag an edge past the opposite edge | frame stays ≥1 px, never inside out |
| Shift+Arrow on the Top-left corner with 1:1 locked | both sides change by 10 px together |
| Pointer released outside the window | capture ends the drag; thirds grid hides |
| Zoom/pan during the tool | overlay re-positions; the Draft does not change |
| Display lost | overlay hidden with the canvas area |

## Definition of Done

- [ ] Component tests prove drag/move/resize and arrow keys call the store with image-pixel deltas (AC-01, AC-02, AC-20)
- [ ] Component tests prove the thirds grid only while dragging and the fine grid only while the angle changes
- [ ] Every handle and the frame are focusable with the catalog labels
- [ ] every Hard Rule inlined above still holds (no coordinate maths outside `core`)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
