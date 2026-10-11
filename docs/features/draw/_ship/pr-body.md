## Summary

Adds **Draw**, the editor's third editing tool. The Editor draws freehand with a Brush or removes
marks with an Eraser, picks one of 10 preset colours or a custom one, and sets one width from 1 to
200 px. The line follows the pointer live, and Clear empties the layer. The marks live on one
Drawing layer attached to the Original, so no pixel of the image is ever lost: the Eraser and Clear
uncover exactly the image beneath, and every later crop, turn, flip or straighten carries the marks
along. The layer is painted over the adjusted image and is never adjusted itself. Every Export
contains it, matching the Preview. This is roadmap step 6 and closes decision D3. See the
[spec](docs/features/draw/spec.md) and the
[changelog](docs/features/draw/_ship/changelog.md).

## Acceptance criteria

- AC-01: Open the tool, drag with the Brush and Apply. The Stroke follows every reported (coalesced) position at 30 fps or more as one smooth line with round ends, a click paints a dot, and the tool opens on the Brush with the last colour and width (red, 12 px the first time) ✓
- AC-02: 10 preset colours in order plus a custom one, a width of 1–200 image px shared by both modes, a width circle at the current zoom, and colour and width kept until reload without counting as edits ✓
- AC-03: A typed width snaps to the range, rounds half up, reverts when not a number (scientific notation included), accepts "px" in any case, and Enter applies only the field ✓
- AC-04: The Eraser removes only marks along its path (or a dot on a click), never a pixel of the image ✓
- AC-05: Clear empties the whole layer, hidden marks included. Cancel brings back what was applied before ✓
- AC-06: Cancel or Escape keeps the layer from before, and the Unsaved edits are unchanged ✓
- AC-07: The image's own pixels never change, marks are fully opaque, and Clear then Apply gives an identical Export ✓
- AC-08: Marks follow every Rotation, Flip, Straighten angle and Crop. They are hidden, not removed, under a narrower Crop, and four quarter turns or two Flips give an identical Export ✓
- AC-09: A Stroke drawn at full width and clipped to the Crop leaves no mark outside it ✓
- AC-10: The Export contains the unadjusted marks over the adjusted image, matching the Preview at full size, reduced for smaller sizes, with a transparency hint that follows the drawn result ✓
- AC-11: "Crop and rotate" shows every mark, "Adjust" and its "Before" show the marks unchanged, and Draw draws over the image as it stands ✓
- AC-12: Unsaved edits are raised only by a real change in the applied Draft ✓
- AC-13: Opening another image keeps the tool and its Draft until the replacement succeeds and is confirmed ✓
- AC-14: Draw can't open during an export. The button is disabled and D does nothing ✓
- AC-15: Export and Ctrl/Cmd+S are refused while Draw is open, with a hint, and the browser's "Save page" never opens ✓
- AC-16: Only one of "Crop and rotate", "Adjust" and "Draw" can be open, with a hint on the others' buttons and shortcuts ✓
- AC-17: With no image open, Draw is unavailable and its hint and D say to open an image first ✓
- AC-18: Opening, zooming, panning, applying and cancelling leave the View alone (apart from the panel's re-fit). A drag draws, the other View controls still work, and the unshifted `+` right of P steps the width on layouts that have one ✓
- AC-19: "Draw" is next to "Adjust" and reachable by Tab, Enter, Space and D. B, E, [ and ] work by character or key position, and circling something takes three actions ✓

## Design

- Spec: `docs/features/draw/spec.md`
- Architecture: `docs/features/draw/sad.md`
- Decisions: `docs/features/draw/adr/`
  - [ADR-0001](docs/features/draw/adr/0001-hold-the-drawing-layer-as-one-bitmap-in-the-original-pixel-space-created-on-the-first-mark.md): one bitmap on the Original's pixel grid, created on the first mark
  - [ADR-0002](docs/features/draw/adr/0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates.md): Catmull–Rom segments painted straight into the Draft in Original coordinates, clipped to the Crop
  - [ADR-0003](docs/features/draw/adr/0003-composite-the-drawing-layer-in-the-shared-fragment-shader-after-the-adjustments.md): composited in the shared shader after the Adjustments, for the Preview and the Export alike
  - [ADR-0004](docs/features/draw/adr/0004-hold-the-draft-as-a-full-copy-of-the-layer-and-hand-it-to-the-work-on-apply.md): the Draft is a full copy, handed to the Work on Apply
  - [ADR-0005](docs/features/draw/adr/0005-make-one-apply-of-the-draw-tool-one-undo-step.md): one Apply is one future undo step
- UX: `docs/features/draw/ux-flows.md` and `docs/features/draw/screens.md`
- Test plan: `docs/features/draw/test-plan.md`
- Data model and migration: none, because the Drawing layer is in memory only
- API: none (client-only)

## Tasks

These commits carry `SDD-Task` and `SDD-AC` trailers. Their task ids come from `docs/features/draw/tasks/tracker.md`.

| Task | Commit | Subject |
|---|---|---|
| T1 | b2b3ada | refactor(draw): extract the editor tool slot into tool-slot.ts |
| T2 | 2340808 | feat(draw): add core/draw rules — palette, width parsing, curve and footprint |
| T3 | 888d5e1 | feat(draw): add frameToOriginal and deviceToFrame coordinate maps |
| T4 | 02a03cd | feat(draw): add Work.drawing and the render/drawing layer lifecycle |
| T5 | 53f7dc4 | feat(draw): add the painter — Brush and Eraser segments and dots |
| T6 | 7f87f20 | feat(draw): composite the Drawing layer in the shared shader |
| T7 | 8dbe41d | feat(draw): give the editor tool slot the draw tool and applyDrawing |
| T8 | eb44e91 | feat(draw): show the Draft or the Work's layer in the Preview, add e2e hooks |
| T9 | 6a14c74 | test(draw): spike the drawing hot path with a @perf e2e |
| T10 | 1b8c0ea | feat(draw): export the applied Drawing layer and check transparency with it |
| T11 | 882c624 | feat(draw): add the draw store — Draft, settings, Clear, Apply and Cancel |
| T12 | bc5fb3a | feat(draw): add the Stroke session and T9's mipmap fallback |
| T13 | 5bdf089 | feat(draw): add the Draw toolbar action, the D shortcut and the message catalog |
| T14 | 214b30a | feat(draw): add swatch options to SegmentedControl and build DrawControls |
| T15 | 192f401 | feat(draw): add DrawOverlay — pointer capture, coalesced points, width circle |
| T16 | 9dd6777 | feat(draw): mount the draw tool with its overlay and in-tool keys |
| T17 | 3aa95c0 | test(draw): add the e2e fidelity and invariant suite |
| T18 | 120a14f | test(draw): add the e2e tool-flow suite |
| T19 | 51aa9b2 | test(draw): add the e2e cross-feature suite |
| T20 | ed3419d | test(draw): complete the @perf suite (overlay rows open) |
| T21 | 67f295f | fix(draw): a Stroke takes focus off the tool panel |
| T22 | 6c23ac4 | fix(draw): with Draw open the German + key steps the width, not the zoom |
| T23 | 3b0f87b | fix(draw): Enter on Custom colour opens the picker instead of applying |
| T24 | b4c2bfe | fix(draw): a press whose move stays put still paints its dot |
| T25 | 8919eeb | fix(draw): the custom swatch keeps the last custom colour |
| T26 | 87fe1fc | fix(shared): a focused, selected swatch shows both rings |
| T27 | b17ee62 | perf(draw): allocate a new Draft's texture zero-filled; released layers read empty |
| T28 | a3a1111 | test(draw): cover setLayer and updateLayer while the context is restoring |
| T29 | 4e1ec26 | refactor(draw): type Work.drawing by its pixel holder; a refused Apply keeps the Draft |
| T33 | 54aceec | docs(draw): AC-18 allows the panel's layout re-fit; trace SCR states in tasks.json |
| T30, T20 | d801e53 | test(draw): measure drawing on the GPU, to the right frame, Brush and Eraser |
| T31, T32 | e738625 | test(draw): an independent QG-2b oracle and the missing test-plan rows |
| T34 | 8d9df40 | fix(draw): only an unshifted + right of P leaves zoom to the width keys |
| T35 | 74c2cb9 | test(draw): the clip at a straightened Crop, in the painter and in a browser |
| T37 | 59b7e3c | fix(shared): keep the selected swatch ring in forced-colors mode |
| T36 | 134b879 | docs(draw): carry AC-18's re-fit into the flows, screens and SAD; claim the last states |
| T40 | 602ebea | fix(shared): swatch fills keep their colour in forced-colors mode |
| T39 | eea262e | docs(draw): AC-18 names the layouts whose zoom-in is numpad + and the controls |
| T38, T20 | 36743d0 | test(draw): run the drawing rows at the reference 60 Hz in stable Chrome |
| T42 | 3801926 | fix(shared): swatch frames use the system text colour in forced-colors mode |
| T41 | 72f32f8 | docs(draw): AC-18's zoom exception as a rule; numpad + test; claim Geometry applied |

T1–T20 are the planned breakdown. T21–T40 come from review rounds 1–3, and T41–T42 from the closing round.

## Verification

Verified at `e491a01` on 2026-10-10 (Apple M1 Pro, latest Playwright browsers).

- Unit: `pnpm test` passes 1767 of 1767 (82 files).
- Lint and vet: `pnpm lint` and `pnpm typecheck` are clean.
- Build: `pnpm build` is clean, and the production `dist/` has no `__imglyTest` hooks.
- e2e: `pnpm test:e2e` on Chromium, Firefox and WebKit has 866 passing, 19 skipped and none failing (6.7 min). The run covers every suite, so open-and-view, export, crop-rotate and adjust still pass beside the new draw suites. The 19 skips are conditional: Chromium-only checks on Firefox and WebKit (draw's AC-01 path rules and its canvas-pixel reads, by sad §11, plus the earlier features' WebGL pixel and context-loss checks), the offline reload on WebKit, and export formats an engine can't encode. `@perf` is filtered out without `PERF=1`.
- Perf (`PERF=1`, recorded by review task T38 on 2026-10-10 at 60 Hz in stable Chrome 154, 4096×3072 Work, see `docs/features/draw/tasks/_epic.md`). All 22 rows pass the spec §6 targets:
  - Drawing frame interval, Brush and Eraser, 1 and 200 px, at Fit and at 100%: p95 17.4–20.2 ms (≤ 33).
  - Pointer move to the frame that shows it: p95 22.0–24.7 ms (≤ 50).
  - Tool ready after "Draw": 56 ms (≤ 150).
  - Apply, Cancel and Clear over a full layer: 31, 60 and 28 ms (≤ 150).
  - Apply in "Crop and rotate" with a full layer: 29 ms (≤ 150).
  - Memory after 50 Applies: 100% of the first, with 1 layer retained (≤ 110%).
  - Export with a full layer (T20, headless): JPEG q90 509 ms (≤ 1000) and PNG 593 ms (≤ 2000).
- Ran the feature by hand. A separate Playwright script drove the **production** `dist/` with no test hooks, through the UI only, on Chromium with `photo.png` (320×240). It observed:
  - AC-17: with no image open, "Draw" is disabled, and D shows "Open an image first to draw on it."
  - AC-19 and AC-01: D opens the tool with focus on Brush. A curved drag and Enter apply it and close the tool. The full-size PNG Export has 2031 changed pixels, and 1674 of them are exactly #E53935 (±2). The rest are the smooth edge.
  - AC-15: Ctrl+S with the tool open shows "Apply or cancel the drawing first, then export." and opens no Export dialog.
  - AC-16: with Draw open, A shows "Apply or cancel the open tool first.", and "Adjust" is disabled.
  - AC-06: a second Stroke and then Escape give an Export identical to the one before (largest difference 0).
  - AC-03: Width "250" becomes 200, "1e2" reverts, "2.5" becomes 3 and "20PX" becomes 20. The tool stays open after each Enter.
  - AC-19: E pressed while the Width field has focus does nothing, and the Brush stays selected.
  - AC-04 and AC-07: the Eraser at 60 px over the same path, then Apply, gives an Export identical to the one before anything was drawn (largest difference 0, no pixel changed).
  - AC-01 and AC-02: reopening the tool selects Brush and keeps the 60 px width.
  - AC-08: four "Rotate right" Applies in "Crop and rotate" give a 320×240 Export identical to the one before (largest difference 0).
  - AC-10: after Grayscale 100% in "Adjust", 8707 pixels of the mark are still exactly #E53935, and the photo is grey.
  - AC-05: Clear and Apply leave no pixel that is not grey, so no mark is left.
  - No page errors.
- Not verified here: the spec's reference machine is an M1 MacBook Air. The perf numbers come from an M1 Pro, with the refresh rate, browser and pixel ratio matching the reference.
- Review: four rounds. Rounds 1–3 had 29 findings, all resolved. Round 4 (`docs/features/draw/_review/review-2026-10-10-4.md`) returned **PASS**, and its four non-blocking findings were fixed.

## Operational notes

- Migration: none, because IndexedDB isn't touched. Rollback is to revert the merge and redeploy
  GitHub Pages.
- Feature flag or config: none. The shared shader, the Preview renderer and the export worker
  changed, so clients pick up the new precache on their next service-worker update.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
