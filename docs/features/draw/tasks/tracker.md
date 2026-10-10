# Tracker — draw

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Extract the tool slot from the editor store into tool-slot.ts, with the store's public API and its tests unchanged | app | Blazheiko | M | — | done |
| T2 | Add src/core/draw: palette and defaults, parseWidth and stepWidth, Catmull–Rom segments, segment bounds and footprintReachesCrop | domain | Blazheiko | M | — | done |
| T3 | Add frameToOriginal to the Geometry transform and deviceToFrame to the View, both unit-tested against the existing UV transform | domain | Blazheiko | S | — | done |
| T4 | Add Work.drawing (DrawingLayer | null) and the render/drawing layer module: create, copy, release with ledger counts, readRect and hasAnyMark | infra | Blazheiko | M | — | done |
| T5 | Add the painter: paintSegment and paintDot with Brush source-over and Eraser destination-out under setTransform(frameToOriginal) and clip(crop), the dirty rectangle and the alpha-lowered check | infra | Blazheiko | M | T2, T3, T4 | done |
| T6 | Composite the layer in the shared shader (u_layer, u_draw) and add PreviewRenderer.setLayer and updateLayer with context-loss restore | infra | Blazheiko | M | T4 | done |
| T7 | Give the tool slot the 'draw' tool: keep Crop and View on open, previewLayer and setPreviewLayer, layerChanged, applyDrawing with the change flag, ExportSnapshot.drawing and the export refusal text | app | Blazheiko | M | T1, T4 | done |
| T8 | Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger | wiring | Blazheiko | M | T5, T6, T7 | done |
| T9 | Spike the hot path: a @perf e2e that paints scripted Strokes through the hooks at 1 px and 200 px, at Fit and at 100%, and records the frame interval and the pointer-to-frame latency | tests | Blazheiko | S | T8 | todo |
| T10 | Send the applied layer to the export worker and its window fallback, render it in one or two passes, and make the crop-transparency check include the layer | infra | Blazheiko | M | T6, T7 | todo |
| T11 | Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace | app | Blazheiko | M | T2, T4, T7 | todo |
| T12 | Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released | app | Blazheiko | M | T3, T5, T9, T11 | todo |
| T13 | Add the 'Draw' toolbar action with its hints, the D shortcut and the message catalog, mounted after 'Adjust' | ui | Blazheiko | M | T11 | todo |
| T14 | Add an optional swatch to SegmentedControl, register it, and build DrawControls: mode, palette, custom colour, width slider and field, Clear, Cancel and Apply | ui | Blazheiko | M | T11 | todo |
| T15 | Build DrawOverlay: pointer capture with coalesced positions into the Stroke session, the width circle at width × zoom, the hidden cursor over the image, Space-drag pass-through and a second touch | ui | Blazheiko | M | T12 | todo |
| T16 | Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark | wiring | Blazheiko | M | T8, T13, T14, T15 | todo |
| T17 | Add the e2e fidelity suite: reference drawing vs Preview at 100% for each Geometry case and with Adjustments, empty layer = 0, Geometry round trips = 0, image pixels unchanged outside marks, smaller sizes and the transparency hint | tests | Blazheiko | M | T8, T10 | todo |
| T18 | Add the e2e tool-flow suite: the live line through every position, a dot, the Eraser, Clear, Apply and Cancel, the clip at the Crop, drag vs pan and zoom in the tool, the keyboard path and the layer ledger | tests | Blazheiko | M | T16 | todo |
| T19 | Add the e2e cross-feature suite: Unsaved edits rules, export and Ctrl/Cmd+S refused while drawing, one tool at a time in both directions, Draw refused during an export and with no image, replace while open, and marks in Crop and rotate and Adjust | tests | Blazheiko | M | T10, T16 | todo |
| T20 | Complete the @perf suite: drawing frame interval and latency through the real overlay, tool-ready, Apply / Cancel / Clear and Crop-and-rotate Apply over a full layer, export time with a full layer, and memory after 50 Applies | tests | Blazheiko | M | T9, T17, T18, T19 | todo |

**Total:** 20 tasks, ~19 person-days (S ≈ ½ day, M ≈ 1 day).
