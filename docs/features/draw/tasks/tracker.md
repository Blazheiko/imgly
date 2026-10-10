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
| T9 | Spike the hot path: a @perf e2e that paints scripted Strokes through the hooks at 1 px and 200 px, at Fit and at 100%, and records the frame interval and the pointer-to-frame latency | tests | Blazheiko | S | T8 | done |
| T10 | Send the applied layer to the export worker and its window fallback, render it in one or two passes, and make the crop-transparency check include the layer | infra | Blazheiko | M | T6, T7 | done |
| T11 | Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace | app | Blazheiko | M | T2, T4, T7 | done |
| T12 | Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released | app | Blazheiko | M | T3, T5, T9, T11 | done |
| T13 | Add the 'Draw' toolbar action with its hints, the D shortcut and the message catalog, mounted after 'Adjust' | ui | Blazheiko | M | T11 | done |
| T14 | Add an optional swatch to SegmentedControl, register it, and build DrawControls: mode, palette, custom colour, width slider and field, Clear, Cancel and Apply | ui | Blazheiko | M | T11 | done |
| T15 | Build DrawOverlay: pointer capture with coalesced positions into the Stroke session, the width circle at width × zoom, the hidden cursor over the image, Space-drag pass-through and a second touch | ui | Blazheiko | M | T12 | done |
| T16 | Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark | wiring | Blazheiko | M | T8, T13, T14, T15 | done |
| T17 | Add the e2e fidelity suite: reference drawing vs Preview at 100% for each Geometry case and with Adjustments, empty layer = 0, Geometry round trips = 0, image pixels unchanged outside marks, smaller sizes and the transparency hint | tests | Blazheiko | M | T8, T10 | done |
| T18 | Add the e2e tool-flow suite: the live line through every position, a dot, the Eraser, Clear, Apply and Cancel, the clip at the Crop, drag vs pan and zoom in the tool, the keyboard path and the layer ledger | tests | Blazheiko | M | T16 | done |
| T19 | Add the e2e cross-feature suite: Unsaved edits rules, export and Ctrl/Cmd+S refused while drawing, one tool at a time in both directions, Draw refused during an export and with no image, replace while open, and marks in Crop and rotate and Adjust | tests | Blazheiko | M | T10, T16 | done |
| T20 | Complete the @perf suite: drawing frame interval and latency through the real overlay, tool-ready, Apply / Cancel / Clear and Crop-and-rotate Apply over a full layer, export time with a full layer, and memory after 50 Applies | tests | Blazheiko | M | T9, T17, T18, T19 | done |
| T21 | A Stroke takes focus from the tool panel: blur a focused panel control on a main-button pointerdown, committing pending width text; e2e drives real drags instead of leaveField | ui | Blazheiko | S | T16 | done |
| T22 | With Draw open the key right of P (German +) steps the width instead of zooming | wiring | Blazheiko | S | T21 | done |
| T23 | Enter on the focused Custom colour input opens the picker instead of applying the tool | ui | Blazheiko | S | T22 | done |
| T24 | Value-equal points paint a dot, so a tap with a zero-length move leaves a mark on every engine; dot and Eraser-click e2e on all three engines | app | Blazheiko | S | T21 | done |
| T25 | The custom swatch keeps the last custom colour after a preset is picked; the Custom colour accessible-name test can fail | ui | Blazheiko | S | T23 | done |
| T26 | A focused, selected swatch shows both the selected ring and the focus ring | ui | Blazheiko | S | T25 | done |
| T27 | Released layers read as empty without allocating; a fresh empty layer is uploaded zero-filled with no readback | infra | Blazheiko | S | — | done |
| T28 | Context-loss tests cover setLayer and updateLayer while the context is restoring | tests | Blazheiko | S | T27 | done |
| T29 | Work.drawing is typed by the layer's pixel holder, and a refused applyDrawing leaves the Draft with its caller | domain | Blazheiko | S | T27 | done |
| T30 | Fix the @perf drawing measurement: latency to the frame after the renderer draws, move i matched to the draw after i+1, Eraser runs, the 1 px timeouts explained; re-measure | tests | Blazheiko | S | T27, T29 | done |
| T31 | QG-2b oracle: Export after each Rotation, Flip and Straighten equals the layer mapped through frameToOriginal; one case through the real Crop and rotate Apply; a Geometry Apply keeps the layer | tests | Blazheiko | S | T29 | todo |
| T32 | Write the missing test-plan rows for AC-02, 03, 04, 07, 09, 10, 11 and 19, or mark them Narrowed on purpose | tests | Blazheiko | S | T22, T24, T31 | todo |
| T33 | Docs: reword AC-18 to allow the layout re-fit when the panel opens; add SCR ids and the missing AC-04 / AC-06 claims to tasks.json | docs | Blazheiko | S | — | done |

**Total:** 33 tasks, ~26 person-days (S ≈ ½ day, M ≈ 1 day).
