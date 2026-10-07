# Tracker — crop-rotate

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Add the Geometry to the Work: type, identity, geometryEquals, workSize, rotateQuarter and flipOnScreen | domain | Blazheiko | M | — | done |
| T2 | Keep the Crop inside the turned image: clampCrop, whole-pixel rounding, move and resize by edge or corner | domain | Blazheiko | M | T1 | done |
| T3 | Add the Straighten angle rules: setStraighten around the frame's centre and fitCropInside with no empty corner | domain | Blazheiko | M | T2 | done |
| T4 | Add proportions, typed crop sizes and the field input rules (parseAngle, parseCropSize, plain decimal only) | domain | Blazheiko | M | T2, T3 | done |
| T5 | Derive the one transform: cropToOriginalUv, turnedImageToOriginalUv, turnedBounds and the overlay's screen maths | domain | Blazheiko | M | T1 | done |
| T6 | Render the Geometry in the shared shader (u_geometry) and give the Preview renderer setGeometry(g, 'crop' | 'whole') | infra | Blazheiko | M | T5 | done |
| T7 | Export with the Geometry in the worker and add the GPU alpha check (checkCropTransparency) | infra | Blazheiko | M | T6 | done |
| T8 | Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View | app | Blazheiko | M | T1, T5 | done |
| T9 | Make the Preview and the status bar follow the Geometry, and add the setGeometry test hook | wiring | Blazheiko | M | T6, T8 | done |
| T10 | Size the export from workSize, send the Geometry, and base the transparency hint on the GPU check | app | Blazheiko | M | T7, T8 | done |
| T11 | Refuse Export and Ctrl/Cmd+S while a tool is open with the 'apply or cancel the crop first' hint, and report the open panel | app | Blazheiko | S | T8, T10 | done |
| T12 | Extend SliderField (step, decimals, marks), NumberField (signed decimal input) and BaseButton (pressed), and register them | ui | Blazheiko | S | — | done |
| T13 | Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset | app | Blazheiko | M | T4, T8 | todo |
| T14 | Add the 'Crop and rotate' toolbar action, its hints, the C shortcut and the tool's message catalog | ui | Blazheiko | M | T12, T13 | todo |
| T15 | Build CropOverlay: dimmed outside, frame with 8 focusable handles, both grids, pointer drags and arrow keys | ui | Blazheiko | M | T5, T13 | todo |
| T16 | Build CropRotateControls: rotate and flip buttons, straighten slider and field, proportion, width and height, Reset / Cancel / Apply | ui | Blazheiko | M | T12, T13 | todo |
| T17 | Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View | wiring | Blazheiko | M | T9, T14, T15, T16 | todo |
| T18 | Add the e2e Geometry fidelity suite: 16 Rotation × Flip, straightened vs Preview, opacity, nothing outside the Crop, lossless round trip | tests | Blazheiko | M | T9, T10 | todo |
| T19 | Add the e2e tool-flow suite: three-action paths, export refusals, replace while open, View fit and frame alignment | tests | Blazheiko | M | T11, T17 | todo |
| T20 | Add the @perf suite: drag and slider frame interval, action-to-Preview and tool-ready times, memory after 50 Applies, export time with a Geometry | tests | Blazheiko | S | T18, T19 | todo |

**Total:** 20 tasks, ~18.5 person-days (S = ½ day, M = 1 day).
