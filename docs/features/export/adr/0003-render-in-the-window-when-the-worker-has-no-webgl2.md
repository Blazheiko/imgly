---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-06"
feature_size: "S"
ticket: "CI: export fails on Linux WebKit"
---

# 0003 — Render the export in the window when the export worker has no WebGL2

- **Status:** Accepted
- **Date:** 2026-10-06
- **Deciders:** Blazheiko (owner)
- **Amends:** [[0002-render-and-encode-exports-in-a-dedicated-web-worker]] (its neutral consequence "present in every target browser")

## Context

ADR-0002 renders every export on a WebGL2 `OffscreenCanvas` inside a worker and assumed every target browser has one. WebKit on Linux (the Playwright build CI runs, and the GTK/WPE browsers built on it) gives WebGL2 to a page but returns `null` for `getContext('webgl2')` on an `OffscreenCanvas` in a worker; 2D, `convertToBlob` and bitmaps all work there. The start-up gate checks only 2D in a worker, so the editor opened and then every export failed with `EXPORT_FAILED`, and the session check reported JPEG and WebP unavailable.

## Decision drivers

- An editor that opens must be able to save (spec AC-13 allows a plain failure, not a permanent one)
- spec §6 freeze limit of 200 ms, met in the worker on every engine that has worker WebGL2
- One rendering path: the shaders, flattening, encoding and content check must stay the same code
- The bitmap is transferred to the worker and closed there, so the fallback must be chosen before an export, not after it fails

## Considered options

1. **Fall back to the window** — the session check also reports whether the worker can make a WebGL2 context; without it, the client runs the same `handleCheck` / `handleExport` in the window, on an `OffscreenCanvas` there — which has WebGL2 on Linux WebKit — so the pixels match the worker's. A DOM `<canvas>` was tried first and missed the 2/255 fidelity limit: WebKit un-premultiplies it differently when copying into 2D.
2. **Refuse honestly** — add worker WebGL2 to the check and tell the user export is unavailable in this browser.
3. **Raise the start-up gate** — treat a browser without worker WebGL2 as unsupported (SCR-04).

## Decision outcome

**Chosen:** Option 1. It keeps one code path (`worker-handler.ts` runs unchanged in both places with the same `ExportEnv`) and lets these browsers save, at the cost of a freeze during their exports only. Options 2 and 3 take saving or the whole editor away from a browser that can render the Preview.

## Consequences

**Positive**
- Export works on every engine that renders the Preview; CI covers WebKit export again
- Engines with worker WebGL2 are unchanged: same worker, same timings

**Negative**
- On an engine without worker WebGL2, a large export blocks the interface while it renders and reads back, so the §6 freeze limit is not met there. Zoom and pan wait for it
- The session check costs one more 1×1 WebGL2 context in the worker

**Neutral**
- An export confirmed before the session check settles waits for it; in practice the check starts with the first open and is done long before
- A crashed or silent check keeps the worker path, as before

## Links

- Code: `src/render/export/client.ts` (`InWindowExport`), `src/render/export/worker-handler.ts` (`canRender`), `src/render/export/index.ts`
- Related ADR: [[0002-render-and-encode-exports-in-a-dedicated-web-worker]]
