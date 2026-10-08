# Tracker — adjust

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | Add the Adjustments to the Work: type, fixed key order, ranges, NEUTRAL_ADJUSTMENTS, isNeutral and adjustmentsEquals | domain | Blazheiko | S | — | done |
| T2 | Add parseAdjustmentField: plain decimal only, trailing % for grayscale and sepia, snap to range, round half up, revert on empty or non-numeric | domain | Blazheiko | S | T1 | done |
| T3 | Write the CPU reference of the seven formulas (applyAdjustmentsToPixel) and toUniforms, pinned to ADR-0003's anchor table | domain | Blazheiko | M | T1 | done |
| T4 | Add autoAdjust(sample): unpremultiply, median and percentiles of Rec. 709 lightness, grey-world gains, rounded half up within ±50, or nothing | domain | Blazheiko | M | T3 | done |
| T5 | Add the seven-step colour block to the shared shader (u_adjust) and PreviewRenderer.setAdjustments | infra | Blazheiko | M | T3 | todo |
| T6 | Add PreviewRenderer.sampleCrop(geometry, maxSide) into a temporary framebuffer and the editor store's sampleWork() | infra | Blazheiko | M | T4, T5, T8 | todo |
| T7 | Send the applied Adjustments to the export worker, set them as uniforms, and reduce smaller adjusted Exports in two passes | infra | Blazheiko | M | T5, T8 | todo |
| T8 | Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments | app | Blazheiko | M | T1 | done |
| T9 | Make PreviewCanvas draw previewAdjustments ?? work.adjustments, and give the e2e hooks setAdjustments and an adjusted previewAt100 | wiring | Blazheiko | S | T5, T8 | todo |
| T10 | Make the export refusal name the open tool and make 'Crop and rotate' and C hint 'apply or cancel the open tool first' while Adjust is open | app | Blazheiko | S | T8 | todo |
| T11 | Add an optional 'neutral' to SliderField: double-clicking the range sets it, and register the option in the design system | ui | Blazheiko | S | — | done |
| T12 | Add the adjust store: Draft and values at open, set / commit typed fields, reset one or all, apply and cancel | app | Blazheiko | M | T2, T8 | todo |
| T13 | Add Compare (held flag, neutral preview, ends on blur and close) and Auto (sampleWork → autoAdjust → four values or the nothing hint) to the adjust store | app | Blazheiko | S | T6, T12 | todo |
| T14 | Add the 'Adjust' toolbar action with its hints, the A shortcut and the tool's message catalog, mounted next to 'Crop and rotate' | ui | Blazheiko | M | T12 | todo |
| T15 | Build AdjustControls: seven SliderFields in three groups with neutral marks, press-and-hold Compare, Auto with its hint line, Reset / Cancel / Apply | ui | Blazheiko | M | T11, T13 | todo |
| T16 | Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark | wiring | Blazheiko | M | T9, T14, T15 | todo |
| T17 | Add the e2e fidelity suite: each slider at its anchors vs Preview, all seven combined, with and without a Geometry, neutral = 0 difference, exact alpha, lossless round trip, smaller sizes | tests | Blazheiko | M | T7, T9 | todo |
| T18 | Add the e2e tool-flow suite: three-action paths, live Preview on drag, Compare by mouse, keys and backslash, Cancel and Reset, Auto values and the nothing hint, keyboard-only use | tests | Blazheiko | M | T16 | todo |
| T19 | Add the e2e cross-feature suite: Unsaved edits, export and crop refusals in both directions, replace while open, no-image hint, View untouched, Crop and rotate shows the adjusted image | tests | Blazheiko | M | T10, T16 | todo |
| T20 | Add the @perf suite: drag frame interval, Apply / Cancel / Reset / Compare-release and tool-ready times, Auto time, memory after 50 Applies, and export time with all seven set | tests | Blazheiko | S | T17, T18, T19 | todo |

**Total:** 20 tasks, ~16.5 person-days (S ≈ ½ day, M ≈ 1 day).
