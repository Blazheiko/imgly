---
id: T8
title: "Add renderThumbnail(work, maxSide) to the Preview renderer: the applied Work at fit, reduced in passes of at most 2:1, read back, Preview state restored"
layer: "infra"
deps: []
blocks: ["T11"]
acs: ["AC-01", "AC-03"]
files_hint: ["src/render/preview-renderer.ts", "src/render/preview-renderer.test.ts", "src/render/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 45 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Add renderThumbnail(work, maxSide) to the Preview renderer: the applied Work at fit, reduced in passes of at most 2:1, read back, Preview state restored

## Place in the sequence

- **Blocked by:** nothing.
- **Blocks:** T11 — Compose autosave.ts, which encodes this `ImageData` as the stored thumbnail.
- **Wave:** 1. It needs only the existing shared WebGL2 program.
- **Lane:** has its own lane (`src/render/preview-renderer.ts`).

## Why (user story)

> **As an** Editor
> **I want** to see my recent Works as thumbnails with their names and when I last opened or changed them, newest first
> **So that** I recognise the one I want at a glance
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

This task draws the thumbnail that shows the Work with every applied edit, cheaply enough to run on every save.

## Inlined context

> - `renderThumbnail(work, maxSide)` in `src/render/preview-renderer.ts` binds a framebuffer and draws the applied Work, never a Draft, at fit with the shared program. It reduces in passes of at most 2:1 to avoid aliasing, then reads the pixels back into an `ImageData`. Autosave encodes that `ImageData` as a PNG Blob with `OffscreenCanvas.convertToBlob` before the save transaction opens (ADR-0004).
> - The renderer's Preview is untouched: the thumbnail pass restores the framebuffer, viewport and uniforms it changed.
> - When the display is lost or restoring, no thumbnail can be drawn. Editing is impossible then too (open-and-view AC-19), so Autosave waits for the renderer before preparing the save.
>
> — `adr/0005 §Decision outcome, How it works, verbatim` · full text: [adr/0005](../adr/0005-render-the-gallery-thumbnail-with-the-preview-renderer.md)

> - The stored thumbnail has a **long side of exactly 320 px** (ADR-0005 allows ≤ 512 px). It is shown in a 160 × 160 CSS px box, so it stays sharp at a device pixel ratio of 2.
>
> — `screens.md §Source, Decisions taken here bullet 2, verbatim` · full text: [screens.md](../screens.md)

> | The thumbnail pass reads pixels back on the main thread. A slow GPU readback could eat into the 200 ms freeze budget (ADR-0005) | Low | Thumbnail long side ≤ 512 px, and the long-task trace in QG-3 | Tech Lead |
>
> — `sad.md §11, thumbnail readback row, verbatim` · full text: [sad.md](../sad.md)

> | AC-01 happy | each save prepares a fresh thumbnail of the applied Work | integration | `renderThumbnail` is called with the applied Work for every save; the stored thumbnail is that call's result; the long side is at most 512 px |
>
> — `test-plan.md §AC coverage, AC-01 integration row 3, verbatim` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder — May import: `core`, `shared`. Preview and every Export draw from one shared WebGL2 program (repo ADR 0004).
>
> — `CLAUDE.md §Module boundaries, src/render row + sad.md §2 bullet 5, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or the code contradicts it, read the named file in full ([adr/0005](../adr/0005-render-the-gallery-thumbnail-with-the-preview-renderer.md) · `src/render/preview-renderer.ts` · `src/render/fake-gl.ts`) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. The signatures are a breakdown-time choice:

- `THUMBNAIL_LONG_SIDE = 320`
- `renderer.renderThumbnail(work: EditorWork, maxSide = THUMBNAIL_LONG_SIDE): ImageData | null`. It returns `null` while the display is lost or restoring. The output size is the Work's fitted output (after Geometry) scaled so its long side is `min(maxSide, outputLongSide)`.

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** the Editor has opened a photo and applied a Crop, a change in "Adjust" and a drawing
> **When** the Editor reloads the page, closes and reopens the tab, or opens another image, at least two seconds after the last Apply and at least three seconds after the photo opened
> **Then** the Gallery holds that Work with all three changes, its thumbnail shows the image with all of them, and it is listed first as the most recently opened or changed Work. Autosave stored the Work once when the photo opened and again after each Apply, without the Editor doing anything and without interrupting editing
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-03 (US-03) — happy path

> **Given** the Gallery holds several Works, one of which is open
> **When** the Editor chooses "Gallery" in the top bar
> **Then** the Gallery lists every stored Work, most recently opened or changed first. Each entry shows a thumbnail of the Work with all its edits, its Source name ("Untitled" when the Work has none) and when it was last opened or changed: "Just now" under a minute, "N minutes ago" under an hour, "N hours ago" under a day, and otherwise the date in the browser's language. The open Work's entry is marked "Open", and the Gallery shows how many of the 20 places are used. The Gallery can be closed again without changing anything
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `THUMBNAIL_LONG_SIDE` and `renderThumbnail` (`src/render/preview-renderer.ts`):
  - save the bound framebuffer, viewport and the uniforms it changes;
  - draw the applied Work (its Geometry, Adjustments and applied layer texture, never a Draft) at fit into an offscreen texture-backed framebuffer at the output size;
  - halve into successive framebuffers, never more than 2:1 per pass, until the target size, and do the last pass at the exact target size;
  - `readPixels` into an `ImageData`, flipped to top-down rows;
  - delete the temporary textures and framebuffers, and restore the saved state.
- [ ] Return `null` when the context is lost or restoring.
- [ ] Export the constant (and a type, if needed) from `src/render/index.ts`.
- [ ] Extend `preview-renderer.test.ts` with the recording GL (`fake-gl.ts`):
  - the pass sizes (for example 4096 × 3072 gives 2048 × 1536, then 1024 × 768, 512 × 384 and finally 320 × 240);
  - the uniforms of the applied Work;
  - restoring the state, so the next `draw` records the same calls as before the thumbnail;
  - `null` when lost.

## Edge cases

| Case | Behaviour |
|---|---|
| Work smaller than 320 px on its long side (e.g. 1 × 1) | one pass at the output size; no upscale |
| 4096 × 4096 Original | long side 320; each pass ≤ 2:1 |
| a Draft open in a tool | ignored; the applied Work is drawn |
| a Crop and a 90° Rotation | thumbnail aspect follows the cropped, turned output |
| display lost or restoring | `null`; Preview state untouched |
| no Drawing layer | drawn without a layer texture, as the Preview does |

## Definition of Done

- [ ] Recording-GL tests prove the applied Work, not the Draft, is drawn with its Geometry, Adjustments and layer into an offscreen framebuffer.
- [ ] The tests prove the long side is 320 px, each pass reduces by at most 2:1, and the result is an `ImageData` of that size.
- [ ] The tests prove the framebuffer, viewport and uniforms are restored, so the next Preview draw is unchanged.
- [ ] The tests prove `null` is returned with the display lost.
- [ ] Every Hard Rule inlined above still holds.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean.
