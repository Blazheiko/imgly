# Tracker — adjust

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Add the Adjustments to the Work: type, fixed key order, ranges, NEUTRAL_ADJUSTMENTS, isNeutral and adjustmentsEquals | domain | Blazheiko | S | — | done |
| T2 | Add parseAdjustmentField: plain decimal only, trailing % for grayscale and sepia, snap to range, round half up, revert on empty or non-numeric | domain | Blazheiko | S | T1 | done |
| T3 | Write the CPU reference of the seven formulas (applyAdjustmentsToPixel) and toUniforms, pinned to ADR-0003's anchor table | domain | Blazheiko | M | T1 | done |
| T4 | Add autoAdjust(sample): unpremultiply, median and percentiles of Rec. 709 lightness, grey-world gains, rounded half up within ±50, or nothing | domain | Blazheiko | M | T3 | done |
| T5 | Add the seven-step colour block to the shared shader (u_adjust) and PreviewRenderer.setAdjustments | infra | Blazheiko | M | T3 | done |
| T6 | Add PreviewRenderer.sampleCrop(geometry, maxSide) into a temporary framebuffer and the editor store's sampleWork() | infra | Blazheiko | M | T4, T5, T8 | done |
| T7 | Send the applied Adjustments to the export worker, set them as uniforms, and reduce smaller adjusted Exports in two passes | infra | Blazheiko | M | T5, T8 | done |
| T8 | Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments | app | Blazheiko | M | T1 | done |
| T9 | Make PreviewCanvas draw previewAdjustments ?? work.adjustments, and give the e2e hooks setAdjustments and an adjusted previewAt100 | wiring | Blazheiko | S | T5, T8 | done |
| T10 | Make the export refusal name the open tool and make 'Crop and rotate' and C hint 'apply or cancel the open tool first' while Adjust is open | app | Blazheiko | S | T8 | done |
| T11 | Add an optional 'neutral' to SliderField: double-clicking the range sets it, and register the option in the design system | ui | Blazheiko | S | — | done |
| T12 | Add the adjust store: Draft and values at open, set / commit typed fields, reset one or all, apply and cancel | app | Blazheiko | M | T2, T8 | done |
| T13 | Add Compare (held flag, neutral preview, ends on blur and close) and Auto (sampleWork → autoAdjust → four values or the nothing hint) to the adjust store | app | Blazheiko | S | T6, T12 | done |
| T14 | Add the 'Adjust' toolbar action with its hints, the A shortcut and the tool's message catalog, mounted next to 'Crop and rotate' | ui | Blazheiko | M | T12 | done |
| T15 | Build AdjustControls: seven SliderFields in three groups with neutral marks, press-and-hold Compare, Auto with its hint line, Reset / Cancel / Apply | ui | Blazheiko | M | T11, T13 | done |
| T16 | Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark | wiring | Blazheiko | M | T9, T14, T15 | done |
| T17 | Add the e2e fidelity suite: each slider at its anchors vs Preview, all seven combined, with and without a Geometry, neutral = 0 difference, exact alpha, lossless round trip, smaller sizes | tests | Blazheiko | M | T7, T9 | done |
| T18 | Add the e2e tool-flow suite: three-action paths, live Preview on drag, Compare by mouse, keys and backslash, Cancel and Reset, Auto values and the nothing hint, keyboard-only use | tests | Blazheiko | M | T16 | done |
| T19 | Add the e2e cross-feature suite: Unsaved edits, export and crop refusals in both directions, replace while open, no-image hint, View untouched, Crop and rotate shows the adjusted image | tests | Blazheiko | M | T10, T16 | done |
| T20 | Add the @perf suite: drag frame interval, Apply / Cancel / Reset / Compare-release and tool-ready times, Auto time, memory after 50 Applies, and export time with all seven set | tests | Blazheiko | S | T17, T18, T19 | done |

**Total:** 20 tasks, ~16.5 person-days (S ≈ ½ day, M ≈ 1 day).

## Review follow-ups (review-2026-10-08)

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| R1 | Auto takes tint from the clamped temperature, so a strong cast keeps the right tint sign | domain | Blazheiko | S | — | done |
| R2 | Auto treats anti-aliased edges of one colour as that colour (premultiply quantization) | domain | Blazheiko | S | — | done |
| R3 | Key the crop transparency answer on Work id + Geometry so Adjustment changes keep it | app | Blazheiko | S | — | done |
| R4 | AC-20 e2e: pan across the open/close resize and assert the full View | tests | Blazheiko | S | — | done |
| R5 | AC-17 e2e: "Open image" while open, and a cancelled file dialog | tests | Blazheiko | S | — | done |
| R6 | Fill the AC-06 / AC-07 / AC-12 test-plan rows with no test behind them | tests | Blazheiko | S | — | done |
| R7 | Perf drag over all seven sliders, timing the renderer's draws, 20 runs after 2 warm-ups | tests | Blazheiko | S | — | done |
| R8 | Cross-engine Auto: a mild-cast fixture and one over 512 px; regenerate the expected values | tests | Blazheiko | S | R1, R2 | done |
| R9 | Double-click reset e2e away from neutral | tests | Blazheiko | S | — | done |
| R10 | SliderField announces the unit through aria-valuetext | ui | Blazheiko | S | — | done |
| R11 | infoToolOpen as Record<ToolId, string> | app | Blazheiko | S | — | done |
| R12 | Remove the adjust store's dead atOpen and pending state | app | Blazheiko | S | — | done |
| R13 | Register AdjustBeforeLabel in screens.md and sad §5 | docs | Blazheiko | S | — | done |

## Review follow-ups (review-2026-10-09)

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| N1 | Auto's same-colour check allows ±1 stored level below full alpha (exact at 255), with a floor-rounded unit case and a soft-edge "nothing to correct" e2e | domain | Blazheiko | S | — | done |
| N2 | AC-06 alpha e2e at every fidelity setting, with and without a Geometry | tests | Blazheiko | S | — | done |
| N3 | Component tests: fields after Auto, Unsaved edits after Apply, field text after Reset, Space on the Adjust action | tests | Blazheiko | S | — | todo |
| N4 | Index ADR-0005 in sad §9 and link it from §11 | docs | Blazheiko | S | — | todo |
| N5 | Note the transparency cache's Work id + Geometry key in crop-rotate ADR-0004, crop-rotate sad and adjust sad | docs | Blazheiko | S | — | todo |
| N6 | screens.md SCR-03 comparing row names AdjustBeforeLabel in #tool-canvas | docs | Blazheiko | S | — | todo |
| N7 | Route the slider double-click reset through tool.resetOne | ui | Blazheiko | S | — | todo |
