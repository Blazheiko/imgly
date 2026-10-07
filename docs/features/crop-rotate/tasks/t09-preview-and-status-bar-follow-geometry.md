---
id: T9
title: "Make the Preview and the status bar follow the Geometry, and add the setGeometry test hook"
layer: "wiring"
deps: ["T6", "T8"]
blocks: ["T17", "T18"]
acs: ["AC-01", "AC-14"]
files_hint: ["src/features/editor/components/PreviewCanvas.vue", "src/features/editor/components/PreviewCanvas.test.ts", "src/features/editor/components/EditorStatusBar.vue", "src/features/editor/components/EditorStatusBar.test.ts", "src/features/editor/components/DimensionsReadout.vue", "src/app/test-hooks.ts", "e2e/test-hooks.d.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 46 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Make the Preview and the status bar follow the Geometry, and add the setGeometry test hook

## Place in the sequence

- **Blocked by:** T6 — Render the Geometry in the shared shader (u_geometry) and give the Preview renderer setGeometry(g, 'crop' | 'whole') · T8 — Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View.
- **Blocks:** T17 — Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View · T18 — Add the e2e Geometry fidelity suite: 16 Rotation × Flip, straightened vs Preview, opacity, nothing outside the Crop, lossless round trip.
- **Wave:** 4 — alongside T4, T7.
- **Lane:** own lane.

## Why (user story)

> **US-08: Export what I see after cropping**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Geometry I applied  
> **So that** the saved file, its size and the warnings I get match the cropped and rotated image
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It makes the rest of the app read the Work's size from its Crop and draw the Geometry, and gives e2e a direct way to set any Geometry.

## Inlined context

> - `PreviewCanvas` draws the Work with `work.geometry`, cropped, when no tool is open. While a tool is open it draws `previewGeometry` in **whole-turned-image mode**: `core/geometry`'s `turnedImageToOriginalUv(g, original)` and `turnedBounds(g)` give the same transform as the Crop's but over the bounding box of the whole turned image, so the empty corners render transparent and the overlay draws the Crop over it (AC-12, AC-19). … The renderer takes this as `setGeometry(g, mode)` with `mode` `'crop'` or `'whole'`. `EditorView` gets a `tool` slot over the canvas area for the overlay and the tool's controls.
> - `EditorStatusBar` shows `workSize` followed by "from W×H" of the Original whenever the width or the height differs, compared in order (AC-01). `DimensionsReadout` gains the optional "from" part.
>
> — `sad.md §5, Cross-feature changes bullets 3–4, abridged` · full text: [sad.md](../sad.md)

> - **Status bar** (`EditorStatusBar`): `DimensionsReadout` shows the Work's size from `workSize`, followed by ", from {W} × {H} px" whenever the width or the height differs from the Original's, compared in order (AC-01, AC-14). While the tool is open it still shows the Work as applied, not the Draft: the Draft's size is in the tool's width and height fields.
>
> — `screens.md §Shell changes, Status bar, abridged` · full text: [screens.md](../screens.md)

> | Geometry applied | After Apply with a Geometry (F6, AC-01). The Preview shows only the Crop, the View fits the Work, and the size reads "{w} × {h} px, from {W} × {H} px" whenever width or height differs in order, so a 90° Rotation alone shows it too | as `default`, `DimensionsReadout` with its "from" part | wireframe 01-b |
> | readout | status bar, size differs from the Original | AC-01, AC-14 | {w} × {h} px, from {W} × {H} px |
>
> — `screens.md §SCR-01 row "Geometry applied" + §Message catalog readout row, verbatim` · full text: [screens.md](../screens.md)

> Brownfield: code reads `original.width`/`height` as the Work's size: the status bar, the export store, fit-View and the e2e helpers. A missed call site shows the wrong size only once a Crop is applied — Mitigation: One task moves every reader to `workSize(work)`, guarded by a search in review. The AC-01 and AC-14 tests run with a non-identity Geometry
>
> — `sad.md §11, risk row 3, verbatim` · full text: [sad.md](../sad.md)

> | Test hooks | The e2e build's `window.__imglyTest` gains a way to set a Geometry directly, so the fidelity tests reach all 16 Rotation × Flip combinations and the four angles without driving the UI | repo `CLAUDE.md` §Commands; here |
>
> — `sad.md §8, Test hooks, verbatim` · full text: [sad.md](../sad.md)

Known readers today (from `grep original.width`): `EditorStatusBar.vue:11`, `PreviewCanvas.vue:20–21`, `src/app/test-hooks.ts:93–94` (the `work()` hook should report `workSize` and add `originalWidth/Height`), `store.ts:156` (moved by T8), export store/panel (T10). The `EditorView` tool slot itself is T17. `editor/messages.ts:10` (Downscale notice) is about the Original and stays.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (Test hook added: `window.__imglyTest.setGeometry(g)`; `work()` reports the Work's size and the Original's dimensions separately.)

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Crop and rotate" tool, drags an edge or a corner of the crop frame inwards, and chooses Apply
> **Then** the tool closes, the Preview shows only the area inside the frame, and the size shown for the Work is the Crop's width and height in pixels, followed by the Original's dimensions whenever the width or the height differs, compared in order, so a 90° Rotation alone also shows them (for example "1920×1080, from 4096×3072"), so the Original's dimensions stay visible as open-and-view AC-05 and AC-06 require. While the tool is open, the area outside the frame is dimmed, a rule-of-thirds grid shows inside the frame while it is being dragged, and the whole frame can be moved by dragging inside it. The Work now has Unsaved edits (AC-13)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** a Geometry has been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry, matching the Preview (§6 Fidelity), and no pixel from outside the Crop. The Work's full size in the export panel is the Crop's size in pixels; the size presets and the long-side field of export AC-05 and AC-06 count from it, and a remembered size larger than the new Work snaps to it. Snapping does not replace the remembered size: a remembered long side in pixels comes back, up to the Work's full size, when the Crop is widened again. The transparency hint of export AC-15 is shown only when a pixel inside the Crop is not fully opaque. The size shown for the Work in the status bar is the Crop's size, with the Original's dimensions next to it as in AC-01
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

This task owns the status-bar size of AC-01 and AC-14 and the Preview drawing the applied Geometry. The tool, the frame and the export panel sizes are T10/T15/T17.

## Checklist

- [ ] `DimensionsReadout` optional `from` prop; tokens only, "from" part muted — `src/features/editor/components/DimensionsReadout.vue`
- [ ] Status bar reads `workSize(editor.work)` and passes the Original when width or height differs in order — `src/features/editor/components/EditorStatusBar.vue` (+ test)
- [ ] `PreviewCanvas` watches `work.geometry`, `activeTool`, `previewGeometry` and calls `renderer.setGeometry(…)`; its overflow check uses the shown size — `src/features/editor/components/PreviewCanvas.vue` (+ test)
- [ ] `setGeometry(g)` test hook via `editor.applyGeometry`; `work()` reports `workSize` plus Original dims — `src/app/test-hooks.ts`, `e2e/test-hooks.d.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Identity Geometry | "4096 × 3072 px" with no "from" part |
| 90° Rotation alone on 4096×3072 | "3072 × 4096 px, from 4096 × 3072 px" |
| Crop that keeps the same size after a 180° turn | no "from" part (width and height equal in order) |
| Tool open with a Draft of another size | status bar still shows the applied Work |
| `setGeometry` hook during an export | refused like any edit (no change) |

## Definition of Done

- [ ] Component tests prove the status bar text for identity, 90° Rotation, a Crop, and with a tool open
- [ ] Component tests prove `PreviewCanvas` calls `setGeometry` with `'crop'` / `'whole'` as the slot changes
- [ ] `grep -rn "original\.\(width\|height\)" src/features/editor` finds no reader of the Work's size
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
