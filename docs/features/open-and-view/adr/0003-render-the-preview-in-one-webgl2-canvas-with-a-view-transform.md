---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-03"
feature_size: "M"
ticket: "roadmap step 2 — open-and-view"
---

# 0003 — Render the Preview in one WebGL2 canvas, with the Original as a mipmapped texture and the View as a shader transform

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The Preview must show an Original of up to 4096 px at Fit, at 100% (one image pixel per physical screen pixel) and at any zoom between the smaller of Fit and 10% and 800%, with pan stopping at the image edge (AC-12, AC-12b, AC-13). Later steps put adjustments (a WebGL2 shader, repo ADR 0004), crop and a drawing layer onto the same Preview, and the spec's goal is that they build on this View unchanged. The browser can interrupt the GPU (sleep and wake, graphics switch), and the Preview must come back by itself or say honestly that it cannot (AC-19, AC-19b). A browser without WebGL2 gets a full-canvas message (AC-18).

## Decision drivers

- spec §6: zoom and pan smoothness on a 4096 px Original ≥ 50 fps
- spec §2: the View feels smooth on trackpad and mouse "so later tools can build on it unchanged"
- repo ADR 0004: adjustments are a WebGL2 shader, and preview and export share one code path
- spec AC-12: "100%" shows one image pixel per physical screen pixel
- spec AC-18, AC-19, AC-19b: capability gate and recovery after a graphics interruption
- sad.md §1 quality goal 3 (smooth, stable View)

## Considered options

1. **One WebGL2 canvas with a View transform** — the canvas covers the canvas area at physical-pixel resolution; the Original is a mipmapped texture; zoom and pan are one matrix uniform; a frame is drawn only when something changed.
2. **Full-size canvas moved by CSS transform** — the Work is rendered once at the Original's size and the browser compositor scales and translates the element.
3. **Canvas 2D now, WebGL2 later** — `drawImage` with `setTransform` per frame in this step, replaced by WebGL2 when adjustments arrive.

## Decision outcome

**Chosen:** Option 1. It is the surface the adjustment shader (roadmap step 5) plugs into without a rewrite, gives a pixel-exact 100% and clean zoomed-out images through mipmaps, and costs the same per frame whatever the zoom. Option 2 is the smoothest to write, but has no mipmaps (zoomed-out images shimmer), blurs at 100% on fractional device-pixel ratios, and would force step 5 to re-render the full-size image on every slider move. Option 3 contradicts the spec's "unchanged" goal: step 5 would rewrite this code and re-verify the View.

How it works:

- `src/render/preview-renderer.ts` owns one WebGL2 context on a canvas sized to the canvas area's CSS size × `devicePixelRatio` (a `ResizeObserver`, using `device-pixel-content-box` where available).
- The Original is uploaded once per Work as an RGBA8 texture with mipmaps. The View (zoom, pan) from the pure View model in `src/core/view/` becomes one transform uniform. A frame is drawn with `requestAnimationFrame` only when the View, the Work or the canvas size changed; there is no continuous render loop.
- **Capability gate at start-up** (`src/render/capabilities.ts`): a WebGL2 context, `MAX_TEXTURE_SIZE` ≥ 4096, `createImageBitmap` and `OffscreenCanvas` 2D in a worker. Any missing → SCR-04 (AC-18). The window-level drop guard is installed before the gate, so a drop never navigates away even on SCR-04.
- **Context loss**: `webglcontextlost` is `preventDefault()`ed; on `webglcontextrestored` the renderer rebuilds its program and re-uploads the texture from the Original `ImageBitmap`, which is retained for this reason, with the Work and View untouched (AC-19). If the context is not restored within a restore deadline, or recreating it fails, the renderer reports `DISPLAY_LOST` and the editor shows SCR-05 (AC-19b). The deadline is a tactical value set in `tasks`.

## Consequences

**Positive**
- Roadmap step 5 adds uniforms and a GLSL block to the same program; step 6 composites the drawing layer as a second texture in the same canvas.
- Pixel-exact 100% and smooth minification; the per-frame cost does not grow with zoom.
- The View math stays pure TypeScript in `src/core/view/`, unit-tested without a GPU.

**Negative**
- The Original is held twice while a Work is open: as an `ImageBitmap` for context restore (about 64 MB at 4096 × 4096) and as a GPU texture with mipmaps (about 85 MB). This is acceptable on the desktop target and must be released on every replace (sad.md §8, resource lifetime).
- WebGL output cannot be tested in happy-dom; pixel and frame-rate checks live in Playwright e2e.
- Context-loss handling is extra code that only real or simulated GPU loss exercises (`WEBGL_lose_context` in e2e).

**Neutral**
- A CPU fallback for browsers without WebGL2 can be added later behind the same renderer interface (repo ADR 0004, Neutral).

## Links

- Spec: [[../spec.md]] §2, §6, AC-12, AC-12b, AC-13, AC-18, AC-19, AC-19b
- SAD: [[../sad.md]] §4
- Related ADR: [[0004-convert-every-original-to-srgb-on-open]]; repo [[../../../adr/0004-render-adjustments-on-webgl2-and-drawing-on-canvas2d]]
