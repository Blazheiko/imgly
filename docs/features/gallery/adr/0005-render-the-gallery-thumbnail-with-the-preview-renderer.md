---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-13"
feature_size: "M"
ticket: "roadmap step 8 — gallery"
---

# 0005 — Render the Gallery thumbnail with the Preview renderer

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Blazheiko (owner), design Socratic walk (medium depth)

## Context

Each Gallery entry shows a thumbnail of the Work with all its edits (AC-01, AC-03). Every save must store a thumbnail that matches the stored state, including a save after a Crop or Adjustment Step, which has p95 ≤ 300 ms to be stored (spec §6). Only the shared WebGL2 program reproduces the Geometry, the Adjustments and the Drawing layer exactly (repo ADR 0004, crop-rotate ADR-0002, draw ADR-0003). Two places run it: the Preview renderer in the window, which already holds the Original and the applied layer as textures, and the export worker, which uploads them for each job (export ADR-0002).

## Decision drivers

- spec §6: Crop or Adjustment Step stored within p95 ≤ 300 ms; longest freeze ≤ 200 ms
- spec AC-01, AC-03: the thumbnail shows the Work with every applied edit
- repo ADR 0004: one program draws the Preview and every Export

## Considered options

1. **The Preview renderer draws the thumbnail into a small framebuffer**, through a new `renderThumbnail(work, maxSide)`.
2. **The export worker renders a small Export as the thumbnail.**

## Decision outcome

**Chosen:** Option 1. The textures are already on the GPU, so drawing a ≤ 512 px thumbnail and reading back a few hundred kilobytes costs a few milliseconds on the main thread. Option 2 copies the 12 MP Original for every save, reads back the whole Drawing layer (50 MB on the reference Work) and uploads both into a fresh WebGL2 context. That costs hundreds of milliseconds per Step, against the 300 ms target, and competes with a real Export.

How it works:

- `renderThumbnail(work, maxSide)` in `src/render/preview-renderer.ts` binds a framebuffer and draws the applied Work, never a Draft, at fit with the shared program. It reduces in passes of at most 2:1 to avoid aliasing, then reads the pixels back into an `ImageData`. Autosave encodes that `ImageData` as a PNG Blob with `OffscreenCanvas.convertToBlob` before the save transaction opens (ADR-0004).
- The renderer's Preview is untouched: the thumbnail pass restores the framebuffer, viewport and uniforms it changed.
- When the display is lost or restoring, no thumbnail can be drawn. Editing is impossible then too (open-and-view AC-19), so Autosave waits for the renderer before preparing the save.

## Consequences

**Positive**
- The thumbnail is exact by construction and cheap enough for every save.
- No change to the export path.

**Negative**
- The Preview renderer, on the main thread, takes on a second job. A slow GPU readback would count against the 200 ms freeze, which the §6 long-task trace measures.

**Neutral**
- The thumbnail's size is set by `screens`. Changing it later affects only newly stored thumbnails.

## Links

- Spec: [[../spec.md]] AC-01, AC-03, §6
- SAD: [[../sad.md]] §5, §10
- Related ADR: [[0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota]], [[0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui]]; repo ADR 0004; export ADR-0002
