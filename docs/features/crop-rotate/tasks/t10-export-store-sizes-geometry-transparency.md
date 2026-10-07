---
id: T10
title: "Size the export from workSize, send the Geometry, and base the transparency hint on the GPU check"
layer: "app"
deps: ["T7", "T8"]
blocks: ["T11", "T18"]
acs: ["AC-14"]
files_hint: ["src/features/export/store.ts", "src/features/export/store.test.ts", "src/features/export/ExportPanel.vue", "src/features/export/ExportPanel.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "S"   # measured: 38 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Size the export from workSize, send the Geometry, and base the transparency hint on the GPU check

## Place in the sequence

- **Blocked by:** T7 — Export with the Geometry in the worker and add the GPU alpha check (checkCropTransparency) · T8 — Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View.
- **Blocks:** T11 — Refuse Export and Ctrl/Cmd+S while a tool is open with the 'apply or cancel the crop first' hint, and report the open panel · T18 — Add the e2e Geometry fidelity suite: 16 Rotation × Flip, straightened vs Preview, opacity, nothing outside the Crop, lossless round trip.
- **Wave:** 5 — alongside T13.
- **Lane:** shares `src/features/export/store.test.ts`, `src/features/export/store.ts` with T11 — serialized.

## Why (user story)

> **US-08: Export what I see after cropping**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Geometry I applied  
> **So that** the saved file, its size and the warnings I get match the cropped and rotated image
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It makes the export panel's sizes, the file and the JPEG transparency hint follow the applied Geometry.

## Inlined context

> - The export store sizes from `workSize(work)`. A remembered long side that is larger than the Work snaps to it for display but stays remembered, and comes back when the Crop is widened (AC-14). The request carries `geometry`, and `transparencyHint` uses the GPU check of ADR-0004.
>
> — `sad.md §5, Cross-feature changes bullet 5, abridged` · full text: [sad.md](../sad.md)

> - `src/features/export/store.ts`: `transparencyHint` uses `original.hasTransparency` when it is false or the Geometry is the identity. Otherwise it uses the check's result, cached by `(work id, revision)`. While the check runs, the hint stays hidden. If the check fails, the hint is shown, because showing it is the safe side.
>
> — `adr/0004 §How it works, bullet 2, verbatim` · full text: [adr/0004](../adr/0004-check-crop-transparency-on-the-gpu-with-the-export-shader.md)

> | remembered size snapped | A remembered long side larger than the Work (after a tighter Crop). The field shows the Work's full size, but the remembered value is kept and comes back when the Crop is widened again (AC-14) | `NumberField` (long side) showing the snapped value | — |
> | transparency check running | JPEG selected, the Original has transparent pixels and the Work has a Geometry (F7, ADR-0004). The hint stays hidden until the check answers | as `default`, no hint | — |
> | transparency hint | The check found a pixel inside the Crop that is not fully opaque, or the check failed (the safe side) (AC-14) | export's JPEG transparency hint, unchanged copy | export screens.md 03-a |
> | no transparency hint | The check found every pixel inside the Crop opaque, for example the transparent corner was cropped away (AC-14) | as `default`, no hint | — |
>
> — `screens.md §SCR-04, rows 2–5, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** Features never import each other … Import other modules only through their `index.ts`. (export reads the Geometry from `editor.work`; it never imports crop-rotate.)
>
> — `CLAUDE.md §Module boundaries, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Today: `store.ts:183` and `ExportPanel.vue:50` read `original.width/height`; `longSide` at 196; `transparencyHint` at 217; `setLongSide` normalizes with `normalizeLongSide(…, workSize.value)` (a local `workSize` computed already exists — repoint it to `core`'s `workSize(work)`); `setExporter` / `setBitmapCopier` are the injection seams for tests. The Ctrl/Cmd+S and Export refusals while the tool is open are T11.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-14 — cross-context

> **Given** a Geometry has been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry, matching the Preview (§6 Fidelity), and no pixel from outside the Crop. The Work's full size in the export panel is the Crop's size in pixels; the size presets and the long-side field of export AC-05 and AC-06 count from it, and a remembered size larger than the new Work snaps to it. Snapping does not replace the remembered size: a remembered long side in pixels comes back, up to the Work's full size, when the Crop is widened again. The transparency hint of export AC-15 is shown only when a pixel inside the Crop is not fully opaque. The size shown for the Work in the status bar is the Crop's size, with the Original's dimensions next to it as in AC-01
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

This task owns the panel half of AC-14 (sizes, the request's Geometry, the hint). The status bar is T9; pixel checks are T18.

## Checklist

- [ ] Full size from `workSize(editor.work)`; presets and long side count from it — `src/features/export/store.ts`, `src/features/export/ExportPanel.vue`
- [ ] Remembered long side: keep the remembered px, display `min(remembered, full long side)` — `src/features/export/store.ts`
- [ ] `exportImage` request includes `editor.work.geometry` — `src/features/export/store.ts`
- [ ] `transparencyHint`: shortcut on `!hasTransparency || isIdentity(geometry)`; else `checkCropTransparency` cached by `(id, revision)`, hidden while pending, shown on error — `src/features/export/store.ts`
- [ ] Tests with a non-identity Geometry — `store.test.ts`, `ExportPanel.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Remembered long side 4096, Crop to 1000×800, then widen to 3000×2000 | shows 1000, then 3000 |
| Opaque Original, any Geometry | no check runs; no hint |
| Transparent corner cropped away | check answers false → no hint |
| Check fails or times out | hint shown |
| Revision changes while a check runs | stale answer ignored; new check for the new revision |
| PNG selected | no hint, no check |

## Definition of Done

- [ ] Store tests prove sizes count from `workSize` and the snap-and-return of a remembered long side (AC-14)
- [ ] Store tests prove the request carries the Geometry
- [ ] Store tests prove the hint's four states: shortcut, running (hidden), answered, failed (shown), with the `(id, revision)` cache
- [ ] `grep -rn "original\.\(width\|height\)" src/features/export` finds no reader of the Work's size
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
