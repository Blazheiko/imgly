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
| T13 | Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset | app | Blazheiko | M | T4, T8 | done |
| T14 | Add the 'Crop and rotate' toolbar action, its hints, the C shortcut and the tool's message catalog | ui | Blazheiko | M | T12, T13 | done |
| T15 | Build CropOverlay: dimmed outside, frame with 8 focusable handles, both grids, pointer drags and arrow keys | ui | Blazheiko | M | T5, T13 | done |
| T16 | Build CropRotateControls: rotate and flip buttons, straighten slider and field, proportion, width and height, Reset / Cancel / Apply | ui | Blazheiko | M | T12, T13 | done |
| T17 | Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View | wiring | Blazheiko | M | T9, T14, T15, T16 | done |
| T18 | Add the e2e Geometry fidelity suite: 16 Rotation × Flip, straightened vs Preview, opacity, nothing outside the Crop, lossless round trip | tests | Blazheiko | M | T9, T10 | done |
| T19 | Add the e2e tool-flow suite: three-action paths, export refusals, replace while open, View fit and frame alignment | tests | Blazheiko | M | T11, T17 | done |
| T20 | Add the @perf suite: drag and slider frame interval, action-to-Preview and tool-ready times, memory after 50 Applies, export time with a Geometry | tests | Blazheiko | S | T18, T19 | done |
| T21 | Let Space press the Crop and rotate action and the tool panel buttons instead of starting space-pan (review R1) | wiring | Blazheiko | S | — | done |
| T22 | Stop swallowing Escape, Enter and zoom keys on the crop handles (review R2) | ui | Blazheiko | S | — | done |
| T23 | Keep wheel and pinch zoom and space-pan working over the crop frame (review R3) | wiring | Blazheiko | S | T22 | done |
| T24 | Straighten from an unrounded anchor so the locked proportion and the frame centre hold, and keep an off-centre frame still on screen (review R4, R8) | domain | Blazheiko | M | — | done |
| T25 | Remember the proportion the tool applies with, so a Rotate or a Reset carries over (review R5) | app | Blazheiko | S | T24 | done |
| T26 | Apply with Enter on the Straighten slider, and make C layout-independent and ignore repeats (review R6) | ui | Blazheiko | S | — | done |
| T27 | Refuse to open a tool while the export panel or the replace dialog is open (review R7) | app | Blazheiko | S | T26 | done |
| T28 | Run the GPU crop transparency check only while the export panel is open (review R9) | app | Blazheiko | S | — | done |
| T29 | Note in AC-06 that AC-08 short-side rounding takes precedence (review R10) | docs | Blazheiko | S | — | done |
| T30 | Align the test plan with the tests that exist and add the keyboard-only AC-20 e2e test (review R11) | tests | Blazheiko | S | T21, T22, T26 | done |
| T31 | Offset the pan by the Crop centre only for an angle step, so Flip and Reset at an angle keep the image in place (re-review N1) | app | Blazheiko | S | — | done |
| T32 | Let Space start space-pan while the Straighten slider has focus (re-review N2) | wiring | Blazheiko | S | — | done |
| T33 | Straighten keeps the frame's own proportion unless it already matches the locked one (re-review N3) | domain | Blazheiko | S | T31 | done |
| T34 | Make the keyboard-only e2e paths real and stop the test plan overclaiming (re-review N4, N5, N6) | tests | Blazheiko | S | T32 | todo |
| T35 | Enter on an input of type button, submit or reset presses only that input (re-review N7) | ui | Blazheiko | S | — | todo |

**Total:** 35 tasks (T21–T30 from review 2026-10-07, T31–T35 from its re-review), ~26.5 person-days (S = ½ day, M = 1 day).
