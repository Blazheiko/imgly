## Summary

Adds **Crop and rotate**, the editor's first editing tool. In one tool the Editor turns the image in
90° steps, flips it as shown on screen, levels it by up to ±45° with no empty corners, and crops it
by frame, by proportion or by exact pixel size. The Geometry is stored as parameters on the Work,
so no pixel is ever lost: reopening the tool widens the Crop again, and Reset clears it. The Preview,
the Export and the status bar all follow the applied Geometry. This is roadmap step 4. See the
[spec](docs/features/crop-rotate/spec.md) and the
[changelog](docs/features/crop-rotate/_ship/changelog.md).

## Acceptance criteria

- AC-01: Drag an edge or corner inwards and Apply. The Preview shows only the Crop, and the status bar shows "W×H, from W₀×H₀". The outside is dimmed, a thirds grid shows while dragging, and the frame can be moved ✓
- AC-02: The frame stops at the image edge, never goes below 1×1 or turns inside out, uses whole pixels, and an odd pixel goes right or down ✓
- AC-03: Exact 90° turns either way. The frame and a locked proportion turn with the image, four turns or one each way give the Geometry back, and nothing is resampled ✓
- AC-04: A Flip mirrors the image as shown at any Rotation, changes the sign of the Straighten angle, two Flips give the Geometry back, and nothing is lost ✓
- AC-05: Straighten from −45° to +45° in 0.1° steps around the frame's centre, with a live Preview, a fine grid, and 0° marked ✓
- AC-06: The frame shrinks to the largest size that fits the turned image, keeping its proportion and its centre, so no empty corner enters the Work ✓
- AC-07: A typed angle snaps to the range, rounds to 0.1°, and reverts when not a number (scientific notation included). Enter applies only the field ✓
- AC-08: Free, Original, 1:1, 4:3, 3:2 and 16:9, landscape or portrait, with long-side rounding as in export AC-05. The choice is remembered for the Work, even after Cancel ✓
- AC-09: The size fields show the frame live, a typed size resizes around the centre, and the size shown is exactly the Work's size after Apply ✓
- AC-10: A typed size is too large, zero, negative, fractional or not a number: it is clamped, rounded or reverted by export AC-04's rules ✓
- AC-11: Cancel or Escape closes the tool and leaves the Geometry and the Unsaved edits unchanged ✓
- AC-12: Reopening shows the whole image with the frame on the Crop, widening it gives the exact pixels back, a remembered proportion refits the frame, and Reset returns to no Geometry ✓
- AC-13: Unsaved edits are raised only when the applied Geometry differs field by field from the Geometry at open ✓
- AC-14: The Export matches the Preview with nothing from outside the Crop. The export panel's sizes count from the Crop, and the transparency hint checks only the Crop ✓
- AC-15: The tool can't open during an export. The button is disabled and C does nothing ✓
- AC-16: Export and Ctrl/Cmd+S are refused while the tool is open, with a hint, and the browser's "Save page" never opens ✓
- AC-17: Opening another image keeps the tool open until the replacement succeeds and is confirmed. A failure or a decline leaves the tool as it was ✓
- AC-18: With no image open, the tool is unavailable and its hint says to open an image first ✓
- AC-19: The View fits the turned image on opening, zoom and pan work inside the tool, and the View fits the Work after Apply or Cancel ✓
- AC-20: The tool is visible next to Export, reachable by Tab, Enter, Space and C. It works fully by keyboard, and rotating once or cropping to a square takes three actions ✓

## Design

- Spec: `docs/features/crop-rotate/spec.md`
- Architecture: `docs/features/crop-rotate/sad.md`
- Decisions: `docs/features/crop-rotate/adr/`
  - [ADR-0001](docs/features/crop-rotate/adr/0001-model-the-geometry-as-integer-parameters-with-one-core-transform.md): integer Geometry parameters with one core transform
  - [ADR-0002](docs/features/crop-rotate/adr/0002-render-the-geometry-in-the-shared-shader-in-one-pass.md): render in the shared shader in one pass from the Original
  - [ADR-0003](docs/features/crop-rotate/adr/0003-open-tools-in-an-active-tool-slot-with-the-draft-in-the-feature-store.md): an `activeTool` slot on the editor store, with the Draft in the feature store
  - [ADR-0004](docs/features/crop-rotate/adr/0004-check-crop-transparency-on-the-gpu-with-the-export-shader.md): the Crop transparency check runs on the GPU
  - [ADR-0005](docs/features/crop-rotate/adr/0005-draw-the-crop-frame-as-a-dom-overlay-over-the-preview.md): the crop frame is a DOM overlay
- UX: `docs/features/crop-rotate/ux-flows.md` and `docs/features/crop-rotate/screens.md`
- Test plan: `docs/features/crop-rotate/test-plan.md`
- Data model and migration: none, because the Geometry is in memory only
- API: none (client-only)

## Tasks (SDD-Task trailers)

| Task | Commit | Subject |
|---|---|---|
| T1 | 822535e | feat(crop-rotate): add the Geometry to the Work with quarter turns and on-screen flips |
| T2 | 4c2cc40 | feat(crop-rotate): keep the Crop inside the turned image when it moves or resizes |
| T3 | e231baf | feat(crop-rotate): straighten around the frame's centre and fit the Crop inside |
| T4 | e8ee694 | feat(crop-rotate): add proportions, typed crop sizes and the field input rules |
| T5 | 6d5afa7 | feat(crop-rotate): derive the one Crop-to-Original transform and the overlay maths |
| T6 | a847825 | feat(crop-rotate): render the Geometry in the shared shader with crop and whole modes |
| T7 | fa892bb | feat(crop-rotate): export with the Geometry and add the GPU crop transparency check |
| T8 | 293fbf0 | feat(crop-rotate): add the editor store's tool slot |
| T9 | 02fdde1 | feat(crop-rotate): make the Preview and the status bar follow the Geometry |
| T10 | ca7c6c0 | feat(crop-rotate): size the export from the Crop and check its transparency on the GPU |
| T11 | 82aa3bb | feat(crop-rotate): refuse Export and Ctrl/Cmd+S while a tool is open |
| T12 | c6fd7ce | feat(crop-rotate): extend SliderField, NumberField and BaseButton for the tool |
| T13 | a44464a | feat(crop-rotate): add the crop-rotate store with the Draft, proportion memory and fields |
| T14 | 00b1917 | feat(crop-rotate): add the "Crop and rotate" action, the C shortcut and the message catalog |
| T15 | 4e9562b | feat(crop-rotate): build CropOverlay with dimming, focusable handles, grids, drags and keys |
| T16 | 11bc68e | feat(crop-rotate): build CropRotateControls for turns, flips, angle, proportion and size |
| T17 | 40ec272 | feat(crop-rotate): mount the tool in EditorView's tool slots with Enter, Escape and focus |
| T18 | c3d7a82 | test(crop-rotate): add the e2e Geometry fidelity suite |
| T19 | f2aa8ed | test(crop-rotate): add the e2e tool-flow suite |
| T20 | deae65a | test(crop-rotate): add the @perf suite for the tool and exports with a Geometry |
| T21 | fb2fdc9 | fix(crop-rotate): let Space press the action and the tool's buttons instead of panning |
| T22 | 0c76a9b | fix(crop-rotate): let Escape, Enter and the zoom keys leave a focused handle |
| T23 | a524190 | fix(crop-rotate): keep wheel and pinch zoom and space-pan working over the crop frame |
| T24 | 7a5dc63 | fix(crop-rotate): straighten from an unrounded anchor and keep the frame still on screen |
| T25 | 043246b | fix(crop-rotate): remember the proportion the tool applies with |
| T26 | eb14525 | fix(crop-rotate): apply with Enter on the slider, and make C layout-proof and repeat-safe |
| T27 | cdaf2d2 | fix(crop-rotate): refuse to open the tool under the export panel or the replace dialog |
| T28 | 1add1bf | fix(export): run the GPU crop transparency check only while the panel is open |
| T29 | 115dcb0 | docs(crop-rotate): say in AC-06 that AC-08's short-side rounding takes precedence |
| T30 | e84621c | test(crop-rotate): add the keyboard-only AC-20 e2e paths and align the test plan |
| T31 | 05085c9 | fix(crop-rotate): offset the pan by the Crop centre only for an angle step |
| T32 | 96b1361 | fix(crop-rotate): let Space start space-pan while the Straighten slider has focus |
| T33 | 389b0a4 | fix(crop-rotate): straighten keeps the frame's own proportion unless it matches the lock |
| T34 | ce0e5cb | test(crop-rotate): make the keyboard-only e2e paths real and stop the test plan overclaiming |
| T35 | a76e9ce | fix(crop-rotate): Enter on an input of type button, submit or reset presses only that input |
| T36 | e2548dd | test(crop-rotate): pin that straightening keeps an off-centre frame still through the crop-rotate store |
| T37 | ef132d5 | test(crop-rotate): pin that Space pans and the zoom keys zoom from the export Quality slider |
| T38 | 4be642d | test(crop-rotate): pin that Reset at an angle offsets the pan only by the turned bounds |
| T39 | c3aa70f | test(crop-rotate): pin that Reset at an angle returns the Draft to no Geometry |
| T40 | 71eac90 | test(crop-rotate): close the AC-12 Reset and reopen test gaps |
| fix | b190ac1 | fix: crop-rotate reopen fits the frame to a remembered proportion (`SDD-Fix: 2026-10-07-remembered-lock-unfitted`) |

## Verification

Verified at `b190ac1` on 2026-10-07 (Apple M1 Pro, latest Playwright browsers).

- Unit: `pnpm test` passes 1043 of 1043 (61 files).
- Lint and vet: `pnpm lint` and `pnpm typecheck` are clean.
- Build: `pnpm build` is clean, and the production `dist/` has no `__imglyTest` hooks.
- e2e: `pnpm test:e2e` on Chromium, Firefox and WebKit has 380 passing, 13 skipped and none failing. No review round had run e2e, so this is its first full run on the branch. The skips are `@perf` outside `PERF=1` and the ones export and open-and-view already document. The fidelity suite passes in all three engines:
  - QG-1a: all 16 Rotation × Flip combinations, with and without a Crop, are within 2/255 of the Original.
  - QG-1b: a straightened Export at −45°, −0.1°, +1° and +45° matches the Preview, and an opaque image stays opaque.
  - QG-1c: no pixel from outside the Crop reaches the file.
  - QG-2: a Crop, then Reset and Apply, gives back the Export from before.
- Perf (`PERF=1`, Chromium), against the spec §6 targets:
  - Tool ready: p95 2 ms (≤ 150).
  - Rotate, Flip, Reset, Apply and Cancel to the updated Preview: p95 28–33 ms (≤ 150).
  - Frame interval while dragging the slider or the frame: p95 16.8 ms (≤ 33).
  - Memory after 50 Applies: 103% of the first (≤ 110%).
  - Export with a Geometry: JPEG q90 p95 284 ms (≤ 1000) and PNG p95 297 ms (≤ 2000).
- Ran the feature by hand. A separate Playwright script drove the **production** `dist/` with no test hooks, through the UI only, on `photo.png` (320×240). It observed:
  - AC-03 and AC-13: four "Rotate right" clicks and Apply leave the readout at "320 × 240 px", with no "from".
  - AC-01: dragging the right edge 60 px inwards shows the thirds grid and four dim panels while the drag is on. After Apply the readout is "260 × 240 px, from 320 × 240 px".
  - AC-16: Ctrl/Cmd+S with the tool open shows "Apply or cancel the crop first, then export.", opens no Export dialog and starts no download.
  - AC-08 and AC-14: choosing 1:1, rotating and applying gives "240 × 240 px, from 320 × 240 px". The PNG Export is a 240×240 file, `photo-edited.png`, checked from its IHDR.
  - AC-12: reopening shows Width 240. Reset and Apply give back "320 × 240 px", and the Export is 320×240 again.
- Not verified here: the spec's reference machine is an M1 MacBook Air, and these numbers come from an M1 Pro. Every result has wide headroom.
- Review: seven rounds. Rounds 1–6 had 24 findings, all fixed in T21–T40. Round 7 (`_review/review-2026-10-07-7.md`) returned **PASS**. One `/sdd:fix` came after it (b190ac1, `_fixes/2026-10-07-remembered-lock-unfitted.md`), and its pinning test is in the green suite above.

## Operational notes

- Migration: none, because IndexedDB isn't touched. Rollback is to revert the merge and redeploy
  GitHub Pages.
- Feature flag or config: none. The shared shader and the export worker changed, so clients pick up
  the new precache on their next service-worker update.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
