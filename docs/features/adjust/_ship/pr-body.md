## Summary

Adds **Adjust**, the editor's second editing tool. Seven sliders change brightness, contrast,
saturation, temperature, tint, grayscale and sepia, and the Preview follows them live. Compare shows
the photo before the change, and Auto sets light and colour from the photo itself. The Adjustments
are stored as seven whole numbers on the Work, so no pixel is ever lost: reopening the tool changes
them again, Reset clears them, and transparency, size and Geometry never change. The Preview, every
Export and the "Crop and rotate" tool all show the applied Adjustments. This is roadmap step 5. See
the [spec](docs/features/adjust/spec.md) and the
[changelog](docs/features/adjust/_ship/changelog.md).

## Acceptance criteria

- AC-01: Open the tool, drag brightness to +30 and Apply. The Preview follows the drag at 30 fps or more, the seven sliders show whole numbers with neutral marks, and the Work has Unsaved edits ✓
- AC-02: Brightness lightens or darkens with no channel moving the wrong way. Contrast spreads tones from mid-grey and keeps 128, 128, 128 in place ✓
- AC-03: Saturation −100 gives grey, and a grey pixel stays the same. Temperature warms or cools, and tint moves towards magenta or green ✓
- AC-04: Grayscale 100% gives equal channels that keep perceived lightness. Sepia 100% gives R ≥ G ≥ B. Both act last ✓
- AC-05: A typed value snaps to the range, rounds half up and reverts when not a number (scientific notation included). "60%" is accepted, and Enter applies only the field ✓
- AC-06: Only colour changes. Transparency is exact, size and Geometry stay, soft edges get no fringe, and neutral values change no pixel ✓
- AC-07: One fixed order, so the same values reached by any path give the same pixels, and no channel wraps round ✓
- AC-08: Holding Compare (mouse, Space or Enter on it, or \) shows "Before" with no Adjustments. It ends on release, blur or close, and never changes the Work or the Draft ✓
- AC-09: Cancel or Escape keeps the Adjustments from before, and the Unsaved edits are unchanged ✓
- AC-10: Reopening shows the applied values. A double-click or 0 resets one slider, Reset resets all, and Reset then Apply gives back the exact pixels ✓
- AC-11: Unsaved edits are raised only when the applied values differ one by one from the values at open ✓
- AC-12: Auto sets brightness, contrast, temperature and tint from the Crop with no Adjustments. It replaces those values, leaves the other three alone and ignores fully transparent pixels ✓
- AC-13: Auto's values are whole numbers within ±50, the same every time and within 1 across engines. A one-colour Crop leaves the sliders alone and shows a hint ✓
- AC-14: The Export matches the Preview with the Adjustments, a smaller Export is reduced after them, the transparency hint is unchanged, and a Draft never reaches the file ✓
- AC-15: The tool can't open during an export. The button is disabled and A does nothing ✓
- AC-16: Export and Ctrl/Cmd+S are refused while the tool is open, with a hint, and the browser's "Save page" never opens ✓
- AC-17: Opening another image keeps the tool and its Draft until the replacement succeeds and is confirmed. A failure or a decline leaves the tool as it was ✓
- AC-18: "Crop and rotate" shows the whole image with its Adjustments. Only one tool can be open at a time, with a hint on the other's button and shortcut ✓
- AC-19: With no image open, the tool is unavailable and its hint and A say to open an image first ✓
- AC-20: Opening, zooming, panning, applying and cancelling never change the View or the Draft ✓
- AC-21: "Adjust" is next to "Crop and rotate" and reachable by Tab, Enter, Space and A. The tool works fully by keyboard, and lightening a photo or an automatic fix takes three actions ✓

## Design

- Spec: `docs/features/adjust/spec.md`
- Architecture: `docs/features/adjust/sad.md`
- Decisions: `docs/features/adjust/adr/`
  - [ADR-0001](docs/features/adjust/adr/0001-model-the-adjustments-as-seven-integer-fields-on-the-work.md): seven integer fields on the Work, with their rules in core
  - [ADR-0002](docs/features/adjust/adr/0002-apply-the-adjustments-in-the-shared-fragment-shader-on-stored-srgb-values.md): one pass in the shared shader, on unpremultiplied stored sRGB values
  - [ADR-0003](docs/features/adjust/adr/0003-define-each-adjustment-by-a-fixed-formula-that-keeps-black-in-place.md): fixed formulas that keep black in place, in one fixed order
  - [ADR-0004](docs/features/adjust/adr/0004-measure-auto-adjust-on-a-bounded-sample-in-the-preview-context.md): Auto measures a sample of at most 512 px in the Preview's context, and core computes the values
  - [ADR-0005](docs/features/adjust/adr/0005-record-the-semi-transparent-colour-deviation-on-firefox-and-webkit.md): the semi-transparent colour deviation on Firefox and WebKit is recorded, not hidden by a looser check
- UX: `docs/features/adjust/ux-flows.md` and `docs/features/adjust/screens.md`
- Test plan: `docs/features/adjust/test-plan.md`
- Data model and migration: none, because the Adjustments are in memory only
- API: none (client-only)

## Tasks

These commits carry `SDD-AC` trailers. Their task ids come from `docs/features/adjust/tasks/tracker.md`.

| Task | Commit | Subject |
|---|---|---|
| T1 | 60e973d | feat(adjust): add the Adjustments to the Work |
| T2 | e94e5ad | feat(adjust): add parseAdjustmentField for typed slider values |
| T3 | 6015de5 | feat(adjust): add the CPU reference of the seven formulas and toUniforms |
| T4 | da623f7 | feat(adjust): add autoAdjust over a premultiplied sample |
| T5 | 63fad9d | feat(adjust): add the seven-step colour block to the shared shader |
| T6 | 69f3270 | feat(adjust): sample the Work's Crop for Auto in the Preview context |
| T7 | 1b2fa4a | feat(adjust): export the applied Adjustments, reducing smaller sizes after them |
| T8 | 684d762 | feat(adjust): give the editor's tool slot the adjust tool |
| T9 | 61eb5d1 | feat(adjust): colour the Preview with the Draft or the Work's Adjustments |
| T10 | ab8df45 | feat(adjust): name the open tool in the export and crop hints |
| T11 | 2834a66 | feat(adjust): let SliderField reset to a neutral value on double-click |
| T12 | 05a28b7 | feat(adjust): add the adjust store with its Draft, fields, reset, apply and cancel |
| T13 | c4a6fc0 | feat(adjust): add Compare and Auto to the adjust store |
| T14 | 124253e | feat(adjust): add the Adjust toolbar action, the A shortcut and the copy catalog |
| T15 | 68c5cf1 | feat(adjust): build the AdjustControls panel |
| T16 | 50ab6c2 | feat(adjust): mount the adjust tool with its keys, Before label and focus |
| T17 | 5f14f71 | test(adjust): add the e2e fidelity suite on three engines |
| T18 | 41b7785 | test(adjust): add the e2e tool-flow suite on three engines |
| T19 | 5b04199 | test(adjust): add the e2e cross-feature suite on three engines |
| T20 | ba0b39c | test(adjust): add the @perf suite |
| R1, R2 | 1ba853d | fix(adjust): measure Auto's tint after the clamped temperature and see soft edges as one colour |
| R3 | 40786e9 | fix(export): keep the crop transparency answer across Adjustment changes |
| R4 | fca9a0f | test(adjust): pan across the tool's canvas resize in the AC-20 e2e |
| R5 | c87326d | test(adjust): cover "Open image" and a cancelled file dialog while Adjust is open |
| R6 | cf4a058 | test(adjust): fill the AC-06, AC-07 and AC-12 test-plan rows that had no test |
| R7 | 44798eb | test(adjust): time the Preview renderer's draws while dragging each of the seven sliders |
| R8 | bb112f9 | test(adjust): compare Auto across engines inside ±50 and on the reduced sample |
| R9 | 9e12472 | test(adjust): double-click the slider away from neutral in the reset e2e |
| R10 | 54cc22d | fix(ui): announce a SliderField's unit through aria-valuetext |
| R11 | b92c855 | refactor(export): give each tool its own export-refusal text by type |
| R12 | cde66fd | refactor(adjust): drop the store's dead atOpen and pending state |
| R13 | 3cc269c | docs(adjust): register AdjustBeforeLabel in screens.md and sad §5 |
| N1 | d124d46 | fix(adjust): let Auto see soft edges stored one level off as one colour |
| N2 | 75b7e45 | test(adjust): check alpha at every fidelity setting, with and without a Geometry |
| N3 | b20a8a0 | test(adjust): fill the AC-10, AC-11, AC-12 and AC-21 component rows |
| N4–N6 | 8e016d3 | docs(adjust): index ADR-0005 and catch the docs up with the review fixes |
| N7 | 5fe1958 | refactor(adjust): drop the store's unreachable resetOne |
| F1, F3–F7 | ca3b6ed | docs(adjust): record Auto's soft-edge rule in ADR-0004 and catch the docs up with review 2 |
| F2 | ee924a7 | test(adjust): run the fidelity and round-trip checks on every reference image |
| F8 | 433e0e3 | test(adjust): drop the AC-07 "any order" test that could not fail |
| G3 | 9c2ffa7 | fix(adjust): return focus into the tool after a declined replace |
| G4, G5 | 2806889 | test(adjust): drive AC-07's two paths through the tool and assert a declined replace's focus |
| G1, G2 | 2fa0cc3 | docs(adjust): catch the docs up with review 3 |
| H1 | f9b884a | fix(adjust): keep the tool open when Esc declines the replace |
| H3 | 69a9e21 | test(adjust): check that AC-07's slider keys reach the ends |
| H2 | 0404c2c | docs(adjust): record review 4, let T15 claim AC-11 and catch the test plan up |
| I4 | df20d62 | fix(adjust): round long typed values from their digits |
| I3 | 4588cad | test(adjust): check the tool removes its window listeners when it closes |
| I1, I2 | 027524c | docs(adjust): record review 5, let T14 and T16 claim AC-17 and quote T15's ACs |
| J1 | 8f860a0 | test(adjust): check a smaller adjusted Export keeps its orientation |

## Verification

Verified at `48791f7` on 2026-10-09 (Apple M1 Pro, latest Playwright browsers).

- Unit: `pnpm test` passes 1505 of 1505 (71 files).
- Lint and vet: `pnpm lint` and `pnpm typecheck` are clean.
- Build: `pnpm build` is clean, and the production `dist/` has no `__imglyTest` hooks.
- e2e: `pnpm test:e2e` on Chromium, Firefox and WebKit has 665 passing, 13 skipped and none failing. Earlier review rounds ran only `e2e/adjust/`, so this is the first full run on the branch, and it shows the open-and-view, export and crop-rotate suites still pass. The skips are `@perf` outside `PERF=1` and the ones the earlier features already document.
- Perf (`PERF=1`, Chromium, 4096×3072 Work), against the spec §6 targets:
  - Tool ready: p95 2 ms (≤ 150).
  - Apply, Cancel, Reset and Compare release to the updated Preview: p95 25–30 ms (≤ 150).
  - Interval between Preview draws while dragging each of the seven sliders: p95 16.9–17.5 ms (≤ 33).
  - Auto to the sliders and the Preview: p95 31 ms (≤ 300).
  - Memory after 50 applied changes: 102% of the first (≤ 110%).
  - Export with all seven Adjustments: JPEG q90 p95 507 ms (≤ 1000) and PNG p95 353 ms (≤ 2000).
- Ran the feature by hand. A separate Playwright script drove the **production** `dist/` with no test hooks, through the UI only, on Chromium with `photo.png` (320×240) and `mild-cast.png` (160×120). It observed:
  - AC-19: with no image open, "Adjust" is disabled, and A shows "Open an image first to adjust it."
  - AC-21 and AC-01: A opens the tool with focus on Brightness, and the sliders are in the order Brightness, Contrast, Saturation, Temperature, Tint, Grayscale, Sepia. Shift+→ three times sets the field to 30, and the live Preview's mean brightness rises from 103.9 to 122.4.
  - AC-08: while Compare is held, "Before" is shown and the Preview equals the unadjusted one exactly (largest difference 0). After release, the label goes and the Preview equals the adjusted one again.
  - AC-16: Ctrl/Cmd+S with the tool open shows "Apply or cancel the adjustments first, then export." and opens no Export dialog.
  - AC-05: Contrast "250" becomes 100, "1e2" reverts, "-2.5" becomes -2 and Sepia "60%" becomes 60. The tool stays open after each Enter.
  - AC-14 and AC-06: after Apply, the full-size PNG Export is 320×240. No channel of any pixel is darker than in the unadjusted Export, and alpha is the same everywhere.
  - AC-09: brightness −80 and Escape, then reopening, shows the applied 30.
  - AC-10: Reset and Apply give an Export identical to the unadjusted one (largest difference 0).
  - AC-18: with "Crop and rotate" open, "Adjust" is disabled and A shows "Apply or cancel the open tool first."
  - AC-12 and AC-13: Auto on `mild-cast.png` with Saturation 20 sets Brightness 16, Contrast 46, Temperature −40 and Tint −17, which are exactly the committed `e2e/adjust/auto-expected.json` values. Saturation stays 20, and a second Auto gives the same values.
  - No page errors.
- Not verified here: the spec's reference machine is an M1 MacBook Air, and these numbers come from an M1 Pro.
- Review: seven rounds. Rounds 1–6 had 41 findings, all done. Round 7 (`_review/review-2026-10-09-7.md`) returned **PASS** with no findings.

## Operational notes

- Migration: none, because IndexedDB isn't touched. Rollback is to revert the merge and redeploy
  GitHub Pages.
- Feature flag or config: none. The shared shader, the Preview renderer and the export worker
  changed, so clients pick up the new precache on their next service-worker update.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
