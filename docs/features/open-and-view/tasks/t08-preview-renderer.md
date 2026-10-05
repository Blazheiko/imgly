---
id: T8
title: "Build the WebGL2 preview renderer: mipmapped Original texture, View transform uniform, DPR sizing, draw-on-change"
layer: "infra"
deps: ["T4"]
blocks: ["T9", "T14"]
acs: ["AC-01", "AC-12"]
files_hint: ["src/render/preview-renderer.ts", "src/render/view-transform.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 51 inlined lines
status: "done"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Build the WebGL2 preview renderer: mipmapped Original texture, View transform uniform, DPR sizing, draw-on-change

## Place in the sequence

- **Blocked by:** T4 — Implement the pure View model (Fit, zoom steps, clamp, zoom-at-point, pan clamp, auto-fit) and the Work revision rule.
- **Blocks:** T9 — Handle WebGL context loss: restore from the kept bitmap within the deadline, else report DISPLAY_LOST, T14 — Build SCR-02's PreviewCanvas with the renderer, Fit on open, and the zoom and pan gestures.
- **Wave:** 2 — after T4 (wave 1).
- **Lane:** shares `src/render/preview-renderer.ts` with T9 — serialized.

## Why (user story)

> **US-05: Inspect the image closely**
>
> **As a** Editor  
> **I want** to fit the image to the window, see it at 100%, zoom and pan  
> **So that** I can check details before and while editing
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It draws the Original at any View with a pixel-exact 100% and cheap frames, and marks the first frame after a new Original so the performance suite can time the open.

## Inlined context

> **Chosen:** Option 1. It is the surface the adjustment shader (roadmap step 5) plugs into without a rewrite, gives a pixel-exact 100% and clean zoomed-out images through mipmaps, and costs the same per frame whatever the zoom.
>
> — `adr/0003 §Decision outcome, decision line, abridged` · full text: [adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md](../adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md)

> `src/render/preview-renderer.ts` owns one WebGL2 context on a canvas sized to the canvas area's CSS size × `devicePixelRatio` (a `ResizeObserver`, using `device-pixel-content-box` where available).
> The Original is uploaded once per Work as an RGBA8 texture with mipmaps. The View (zoom, pan) from the pure View model in `src/core/view/` becomes one transform uniform. A frame is drawn with `requestAnimationFrame` only when the View, the Work or the canvas size changed; there is no continuous render loop.
>
> — `adr/0003 §Decision outcome, How it works bullets 1–2, verbatim` · full text: [adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md](../adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md)

> the end is a `performance.mark` the renderer sets on the first frame after a new Original
>
> — `sad.md §10, QG-1 How verify, abridged` · full text: [sad.md](../sad.md)

> SPA->>GPU: uploads the new Original and releases the old one
> The old Original's bitmap and texture are released after the new texture is uploaded, so the Preview never shows an empty frame.
>
> — `sad.md §6, Flow 1, abridged` · full text: [sad.md](../sad.md)

> | Zoom and pan smoothness on a 4096 px Original | ≥ 50 fps |
>
> — `spec.md §6, NFR table row 4, abridged` · full text: [spec.md](../spec.md)

> **Hard rule:** The View maths in `src/core/view/` works in device pixels, so 100% is one image pixel per physical screen pixel (AC-12). Pointer and wheel positions are converted from CSS pixels by `devicePixelRatio` at the component edge, and the canvas is sized with `device-pixel-content-box` where available
>
> — `sad.md §8, Pixel units row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Every `ImageBitmap` is `close()`d as soon as it is no longer needed: intermediates in the worker, the new bitmap on a cancelled replace, the old Original after a replace. The old texture is deleted after the new one is uploaded (§6, flow 1). Each open's worker is terminated when its result arrives or when a newer open starts. Exactly one Original (bitmap + texture) is retained while a Work is open
>
> — `sad.md §8, Resource lifetime row, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** the Editor has no image open
> **When** the Editor chooses a Supported image through the "Open image" action
> **Then** the image is shown at Fit, upright the same way the operating system's photo viewer shows it, and the editor is ready for editing. Fit is the largest zoom at which the whole image fits inside the canvas area (the space left after toolbars and panels), never above 100%, so an image smaller than the canvas area is shown centred at 100% and is never enlarged
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — happy path

> **Given** an image is open
> **When** the Editor pinches on the trackpad, scrolls with Ctrl/Cmd held, or uses the zoom-in and zoom-out controls, "Fit" or "100%"
> **Then** the Preview zooms toward the pointer (or the centre for the controls), the current zoom level is visible, "100%" shows one image pixel per physical screen pixel, and the rest of the app interface never changes size
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Pure `viewToTransform(view, imageSize, canvasSize): Float32Array` (device pixels → clip space) — `src/render/view-transform.ts`
- [ ] `createPreviewRenderer(canvas)` → `{ setOriginal(bitmap), setView(view), resize(deviceW, deviceH), dispose() }`; one program, one quad, RGBA8 texture + `generateMipmap`, `LINEAR_MIPMAP_LINEAR` min / `NEAREST` mag at ≥100% — `src/render/preview-renderer.ts`
- [ ] `setOriginal`: upload the new texture first, then delete the old one; never close the bitmap (the store owns it, T9 needs it for restore)
- [ ] Dirty flag + one `requestAnimationFrame` per change; skip drawing when the canvas is 0×0
- [ ] `performance.mark('imgly:first-frame')` on the first frame drawn after `setOriginal`
- [ ] Vitest for `viewToTransform` (Fit, 100%, zoom-at-point, pan) and the dirty scheduler with a fake rAF — `src/render/*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `setOriginal` while an Original is shown | new texture uploaded before the old one is deleted — no empty frame |
| View unchanged between frames | no draw (no continuous loop) |
| Canvas area 0×0 (hidden) | no draw, no GL error |
| Fractional `devicePixelRatio` (e.g. 1.25) | backing store sized from `device-pixel-content-box`; 100% stays one image pixel per physical pixel |
| Non-power-of-two Original (4096×2731) | mipmaps generated (WebGL2 allows NPOT) |

## Definition of Done

- [ ] Vitest for `viewToTransform` and the draw-on-change scheduler passes
- [ ] Pixel check at 100% on Chromium runs in T14's e2e
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
