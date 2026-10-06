---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-05"
feature_size: "S"
ticket: "roadmap step 3 — export"
---

# 0002 — Render and encode every export in a dedicated Web Worker with the Preview's shader code

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

An Export is the Work rendered with all its edits at the full or a chosen smaller size, then encoded as PNG, JPEG or WebP. The Preview already renders the Work in one WebGL2 canvas with a premultiplied, mipmapped texture (open-and-view ADR-0003), and later tools add WebGL2 adjustments and a Canvas 2D drawing layer (repo ADR 0004). The export must match that rendering, must not freeze the interface while a 12 MP file is encoded, and must not leak memory across repeated exports. Where this happens also sets a rule for every later editing tool's rendering code.

## Decision drivers

- spec §6: export time p95 ≤ 1 s (JPEG q90) and ≤ 2 s (PNG) for a 4096×3072 Work; longest interface freeze ≤ 200 ms; memory after 10 exports ≤ 110% of memory after the first
- spec §6 Fidelity: a full-size PNG within 2 of 255 per channel of the Preview's own rendering at 100%
- spec AC-11: the file holds the Work as it was at confirm; zoom and pan stay live during the export
- spec AC-12: the produced file is judged by content
- sad.md §2: no `SharedArrayBuffer` (no COOP/COEP on GitHub Pages); data crosses threads by transfer; the decode worker already sets the pattern (open-and-view ADR-0001)

## Considered options

1. **A dedicated export worker** — the main thread transfers a copy of the Original (`createImageBitmap(original)`) with the size, format and quality; a short-lived worker renders on an `OffscreenCanvas` with WebGL2 using the shared shader module, flattens onto white for JPEG, encodes with `convertToBlob`, checks the result with `sniffImageHeader`, and is terminated afterwards.
2. **Render in the Preview's context, encode in a worker** — draw into an offscreen framebuffer of the Preview's own WebGL2 context, read the pixels back with `readPixels` on the main thread, and encode them in a short-lived worker with a 2D `OffscreenCanvas`.
3. **Everything on the main thread** — draw into a canvas and call `canvas.toBlob(type, quality)`.

## Decision outcome

**Chosen:** Option 1. It is the only option where the 200 ms freeze limit does not depend on how each engine schedules its encoder (option 3) or on a synchronous GPU readback of a 12 MP buffer (option 2). Terminating the worker frees its WebGL2 context and buffers deterministically, which serves the memory target. Sharing the shader module keeps the export pixel-identical to the Preview without tying it to the Preview's context, so a lost display does not block a save.

## Consequences

**Positive**
- The interface stays responsive in every engine; zoom and pan keep working during an export (AC-11)
- The export does not depend on the Preview's WebGL2 context being alive
- The same worker runs the session's format check, so "can this browser produce WebP" is answered by the exact code path that later exports it (AC-12)

**Negative**
- A second WebGL2 context exists for the length of each export, and the tab briefly holds about three more image-sized buffers (≈ 150 MB at 4096 × 3072, sad.md §7)
- Every later editing tool's rendering code must run in both the window and a worker: no DOM access, the context passed in, shaders only from `src/render/shaders.ts`. The drawing layer must be handed over as a transferable bitmap (sad.md §11)
- Rendering the same Work in two contexts means two code paths to keep in step; a test compares them (sad.md §10 QG-2)

**Neutral**
- Depends on `OffscreenCanvas` with WebGL2 in workers, present in every target browser; a browser without it fails every export with a plain reason (AC-13) — amended by [[0003-render-in-the-window-when-the-worker-has-no-webgl2]]: Linux WebKit has none, and exports there render in the window
- Moving to option 2 later would touch only `src/render/export/`; the panel, the store and the save path would not change

## Links

- Spec: [[../spec.md]] §6, AC-03, AC-11, AC-12, AC-13, AC-15, AC-16
- SAD: [[../sad.md]] §4 (choice 2), §5, §7, §8
- Related ADR: [[0001-encode-and-verify-before-the-save-dialog]]; open-and-view ADR-0001 (decode worker), ADR-0003 (WebGL2 Preview)
