---
id: T7
title: "Export with the Geometry in the worker and add the GPU alpha check (checkCropTransparency)"
layer: "infra"
deps: ["T6"]
blocks: ["T10"]
acs: ["AC-14"]
files_hint: ["src/render/export/worker-handler.ts", "src/render/export/worker-handler.test.ts", "src/render/export/client.ts", "src/render/export/client.test.ts", "src/render/export/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "S"   # measured: 39 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Export with the Geometry in the worker and add the GPU alpha check (checkCropTransparency)

## Place in the sequence

- **Blocked by:** T6 — Render the Geometry in the shared shader (u_geometry) and give the Preview renderer setGeometry(g, 'crop' | 'whole').
- **Blocks:** T10 — Size the export from workSize, send the Geometry, and base the transparency hint on the GPU check.
- **Wave:** 4 — alongside T4, T9.
- **Lane:** own lane.

## Why (user story)

> **US-08: Export what I see after cropping**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Geometry I applied  
> **So that** the saved file, its size and the warnings I get match the cropped and rotated image
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It makes the saved file contain exactly the applied Geometry and nothing from outside the Crop, and gives export an exact answer to "is any pixel inside the Crop transparent?".

## Inlined context

> - **Export.** `ExportRequest` gains `geometry`; the worker computes `u_geometry` with the same `core` function and renders at the export size, which now counts from `workSize`.
>
> — `adr/0002 §How it works, bullet 4, verbatim` · full text: [adr/0002](../adr/0002-render-the-geometry-in-the-shared-shader-in-one-pass.md)

> - `src/render/export/`: the worker message union gains `{ kind: 'alpha', request: { bitmap, geometry } }`. The handler renders at `workSize` with the export path, reads the alpha channel back and answers `Result<boolean>`. The window fallback (export ADR-0003) runs the same code. The bitmap copy is closed in every branch, as for an export.
>
> — `adr/0004 §How it works, bullet 1, verbatim` · full text: [adr/0004](../adr/0004-check-crop-transparency-on-the-gpu-with-the-export-shader.md)

> `worker-handler.ts` — renders with geometry at the export size; new 'alpha' check (ADR-0004) · `client.ts` — exportImage(request with geometry); checkCropTransparency(original, geometry)
>
> — `sad.md §5, Internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> | Resource lifetime | The Geometry allocates nothing on the GPU. The transparency check's bitmap copy is closed in every branch, like an export's. The bitmap ledger in the leak tests covers both | open-and-view sad.md §8; ADR-0002, ADR-0004 |
> | Privacy | No pixel from outside the Crop reaches an Export. The shader samples only through the Crop's transform, and the Crop invariant keeps it inside the turned image (AC-14). Nothing about the Geometry is logged or sent anywhere | spec §6.1; ADR-0002 |
>
> — `sad.md §8, Resource lifetime + Privacy, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Data crosses threads only by structured clone or transfer (no `SharedArrayBuffer` on GitHub Pages)
>
> — `sad.md §2, Technical bullet 4, abridged` · full text: [sad.md](../sad.md)

Today: `worker-handler.ts:51` `ExportWorkerMessage = { kind: 'export' } | { kind: 'check' }`; `FULL_QUAD` at line 54; filters at lines 144–146 (`NEAREST` at full size). The Geometry is a plain object, so it structured-clones. Wiring the export *store* to this is T10.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Worker message contract: `ExportRequest.geometry: Geometry`; new `{ kind: 'alpha', request: { bitmap, geometry } }` → `Result<boolean>`.)

## Acceptance criteria

### AC-14 — cross-context

> **Given** a Geometry has been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry, matching the Preview (§6 Fidelity), and no pixel from outside the Crop. The Work's full size in the export panel is the Crop's size in pixels; the size presets and the long-side field of export AC-05 and AC-06 count from it, and a remembered size larger than the new Work snaps to it. Snapping does not replace the remembered size: a remembered long side in pixels comes back, up to the Work's full size, when the Crop is widened again. The transparency hint of export AC-15 is shown only when a pixel inside the Crop is not fully opaque. The size shown for the Work in the status bar is the Crop's size, with the Original's dimensions next to it as in AC-01
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

This task is the renderer half of AC-14: only the Crop is rendered, at a size counted from the Crop, and the alpha answer. Sizes in the panel and the hint itself are T10; pixel checks on real engines are T18.

## Checklist

- [ ] `ExportRequest.geometry`; compute `u_geometry = cropToOriginalUv(geometry, original)`; output size from `workSize` × the chosen scale — `src/render/export/worker-handler.ts`
- [ ] Filter rule: `LINEAR` magnification when `geometry.straighten ≠ 0` (same as the Preview), else today's — `src/render/export/worker-handler.ts`
- [ ] `{ kind: 'alpha' }` branch: render at `workSize`, `readPixels`, scan alpha < 255, answer `Result<boolean>`, close the bitmap in every branch — `src/render/export/worker-handler.ts`
- [ ] `exportImage` sends `geometry`; `checkCropTransparency(original, geometry)` with a timeout; in-window fallback runs the same handler — `src/render/export/client.ts`, `src/render/export/index.ts`
- [ ] Tests — `worker-handler.test.ts`, `client.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Identity Geometry | output identical to before this feature |
| 90° Rotation on 4096×3072 | output 3072×4096 at full size |
| Alpha check on an opaque Original | not called by export (T10); if called, answers `ok(false)` |
| Alpha readback fails / context lost / timeout | `err(...)`; bitmap closed; caller treats as transparent |
| Worker has no WebGL2 | in-window fallback runs the same code path |

## Definition of Done

- [ ] Vitest proves the export request carries and applies the Geometry at a `workSize`-based size, with the filter rule
- [ ] Vitest proves the `alpha` branch's `Result<boolean>` and that the bitmap is closed on success, failure and timeout (worker and in-window)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
