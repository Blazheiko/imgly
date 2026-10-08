---
status: Draft
owner: "Blazheiko"
reviewers: ["Blazheiko (implementing engineer)", "Tech Lead"]
updated_at: "2026-10-08"
feature_size: "M"
---

# Test plan — adjust

One "Adjust" tool sets seven whole-number Adjustments (brightness, contrast, saturation, temperature,
tint, grayscale, sepia) on the open Work. The Preview follows the Draft live, Apply keeps it, Cancel
restores it, Reset and the per-slider reset return to neutral, Compare shows "Before" while held and
Auto sets four sliders from the Crop's pixels. Neutral values change no pixel, transparency is never
touched, and every Export matches the Preview at 100% on Chromium, Firefox and WebKit.

Inputs: `spec.md` §5 (AC-01 to AC-21), §6 and §7; `sad.md` §6 (F1 to F7), §8, §10 (QG-1a to QG-3) and
§11; ADR-0001 to ADR-0004 (ADR-0003's anchor table); `ux-flows.md` (the e2e-through-UI scripts);
`screens.md` SCR-03 (the component states and the keyboard table); `tasks.json` (T1 to T20).
`target_surfaces: [web-frontend]`, so the frontend tiers apply.

## Decisions taken in this plan

- **Fidelity tolerance (closes the `sad.md` §11 High risk).** Two limits, never a silent loosening.
  - The Preview-to-Export fidelity rows (QG-1a: each slider at its anchors and the combined setting,
    with and without a Geometry) use **opaque fixtures only**, with a limit of **2 of 255 per channel
    on every engine**, Linux WebKit included.
  - The semi-transparent fixture (QG-1c) checks **alpha exactly** (difference 0) on every engine. It
    checks colour only for pixels with alpha 64 or more, against the Preview, at **export's
    per-engine limit**: 3 of 255 on Linux WebKit (export ADR-0003), 2 of 255 elsewhere. Colour below
    alpha 64 is held by the CPU reference unit test (`sad.md` §11, Medium risk on unpremultiplying).
  - An engine that misses 2/255 on an opaque fixture is recorded as an engine deviation with its own
    ADR, as export ADR-0003 does.
  - **Recorded deviation (T17, [adr/0005](adr/0005-record-the-semi-transparent-colour-deviation-on-firefox-and-webkit.md)).**
    On Firefox and WebKit the Export already differs from the Preview at alpha 64 by 4/255 with
    neutral values, and Adjustments scale that gap up to 16/255 (4/255 even at alpha 254). QG-1c
    therefore checks colour on opaque pixels only on those two engines, and from alpha 64 on Chromium.
    Alpha stays exact everywhere.
- **Anchor tolerance (confirms `sad.md` QG-1d).** The CPU reference (`applyAdjustmentsToPixel`)
  must give ADR-0003's anchor table **exactly** after rounding to whole numbers: the table is its
  output, so changing a formula means changing the table on purpose. The real shader on each engine
  must give the table **within 2 of 255** per channel.
- **Auto's look (closes spec §8, second open question).** No KPI judges whether Auto's result looks
  good; that stays a non-goal (spec §3). The `autoAdjust` unit tests do pin Auto's **directions**: a
  dark sample gets a positive brightness, a flat one a positive contrast, a blue cast a positive
  temperature and a green cast a positive tint. That catches a flipped sign without judging taste.
  The owner should tick the spec's §8 checkbox.
- **Auto flow review (closes the `sad.md` §6 open question on F4).** Each of the three points has its
  own row: the "display lost" branch (AC-12, integration), the sample of at most 512 px freed in
  every branch (AC-12, integration against a recording GL), and the order "skip alpha 0, then
  unpremultiply" (AC-12, unit). The owner should tick the SAD's open question.
- **Levels (chosen by the owner).** Every group runs at every level that has something to check:
  - Colour rules (AC-02 to AC-04, AC-06, AC-07): unit (anchor table plus property tests),
    integration (the shader's uniforms against a recording GL), component (the Preview receives the
    Draft) and e2e-through-UI (the real shader on three engines).
  - Tool flows (AC-01, AC-05, AC-08 to AC-13, AC-20, AC-21): unit, integration, component and
    e2e-through-UI.
  - Cross-feature (AC-14 to AC-19): unit (the hint catalog), integration, component and
    e2e-through-UI.
- **No visual-regression (chosen by the owner).** The Preview's colour is checked by pixel
  comparisons with a stated tolerance, and the panel's layout by component tests. No baseline images
  are kept.

## Levels

| Level | Scope | Strategy (generic — no tool names) |
|---|---|---|
| Unit | Pure `src/core/adjust` rules: keys in the fixed order, ranges, neutral values, `adjustmentsEquals`, `parseAdjustmentField`, `toUniforms`, the CPU reference of ADR-0003's formulas and `autoAdjust`. Also the hint catalogs in `messages.ts`. | In memory, no DOM. Example tests for ADR-0003's anchor table and the named cases, plus **property tests** that generate hundreds of random colours, alphas, Adjustments and samples and assert each invariant. |
| Integration | (a) The render layer against a **recording GL** (`src/render/fake-gl.ts`): the uniforms the shader gets, the neutral bypass, `sampleCrop`'s framebuffer and its release, the export worker's one-pass or two-pass choice. (b) The adjust store working with the **real** editor, export and crop-rotate stores: Draft, values at open, Apply, Cancel, Reset, Compare, Auto, Unsaved edits, the tool slot and its refusals, replacing the Work. | (a) The recording GL records calls and returns set pixels; real WebGL is checked only in e2e-through-UI. (b) A fresh set of real stores per test, never a mocked store. Nothing is persisted, so there is no datastore to spin up. The renderer and the export worker are the only boundaries replaced, by a recording fake (`src/features/editor/fake-renderer.ts`). |
| Contract | <!-- N/A: the only cross-participant boundary is the main thread ↔ export worker message, which now carries `adjustments`; both sides import one shared TypeScript type, so the typecheck gate is the contract check, and the e2e fidelity rows exercise the real message. --> | — |
| E2E | Covered by E2E-through-UI: every flow in this feature is driven through the UI. | — |
| Load | Spec §6 timing and memory NFRs, on the reference machine. | The load/perf tool already in your repo (the existing `@perf`-tagged browser suite, run by hand with the perf switch), or e.g. k6 or Locust. |
| Component | `AdjustAction`, `AdjustControls`, `AdjustTool`, the extended `SliderField` (optional neutral, double-click), `PreviewCanvas`, and the changed `CropRotateAction` and `ExportAction`. Each SCR-03 state in `screens.md` is a case. | Mount the component with real stores, without booting the app or using WebGL. Assert the rendered output, focus order, keyboard handling and store calls. |
| Visual-regression | <!-- N/A: decided by the owner; colour is checked by pixel comparisons with a stated tolerance, layout by component tests. --> | — |
| E2E-through-UI | The `ux-flows.md` flows in a real browser on Chromium, Firefox and WebKit: the WebGL Preview with the Adjustments, a real Export download decoded back to pixels, file open and drop, keyboard shortcuts, the held `\` key, window blur, zoom and pan. | The app's own hooks-enabled build. Fixtures are opened through the real open path, and the `setAdjustments` test hook (T9) sets Adjustments directly where a test needs many settings. `previewAt100()` reads the Preview's own rendering with the Work's Adjustments. Each test gets a fresh browser context. |

## AC coverage

Test names are intent-based. Level tokens: `unit`, `integration`, `component`, `e2e-through-UI`.

**Narrowed on purpose** marks a row with no test at its level. The repo's convention limits e2e to
what a simulated DOM can't do (WebGL, real downloads, real focus and hit-testing), so these ACs are
held by the rows named in the cell.

| AC (spec.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 happy | the seven Adjustments have a fixed order, their ranges and neutral values, and a new Work starts neutral | unit | keys in the order brightness, contrast, saturation, temperature, tint, grayscale, sepia; −100..100 for the first five and 0..100 for the last two; every neutral value 0; a freshly created Work equals the neutral Adjustments |
| AC-01 happy | opening copies the Work's Adjustments into the Draft, every Draft change reaches the Preview, and Apply stores the Draft | integration | the Draft at open equals the Work's Adjustments; the Preview's Adjustments equal the latest Draft after each change; after Apply the Work holds the Draft, the tool is closed and Unsaved edits are raised |
| AC-01 happy | the panel shows seven sliders in order, each with its value field and neutral mark | component | three groups (Light, Colour, Effects) in AC-01's order; step 1; a mark at 0; the number field shows the value; Grayscale and Sepia show a "%" label beside a field holding the bare number |
| AC-01 happy | the Preview draws the Draft while the tool is open and the Work's Adjustments otherwise | component | the renderer gets the Preview's Adjustments when they are set, and the Work's Adjustments when they are not |
| AC-01 happy | open, drag brightness to +30, Apply | e2e-through-UI | the field shows 30; the Preview's mid-tones get lighter while dragging; after Apply the tool is closed, the Preview keeps the lighter image and Unsaved edits are raised |
| AC-02 happy | brightness and contrast give ADR-0003's anchor values | unit | brightness +100/+50/−50/−100 turns 128 into 181/157/96/64; contrast keeps 128 at every value; black and white follow the table; exact after rounding |
| AC-02 happy | a higher brightness never darkens any channel, a lower one never lightens (property) | unit | for random colours and two brightness values a < b, every channel at b ≥ the channel at a |
| AC-02 happy | contrast moves tones away from or towards mid-grey and keeps 128 in place (property) | unit | above 128 rises and below 128 falls for a higher contrast; every tone moves towards 128 for a lower one; 128 stays 128 |
| AC-02 happy | brightness and contrast reach the shader as `toUniforms` packs them | integration | the recorded uniforms equal `toUniforms(draft)` after each change |
| AC-02 happy | moving the brightness or contrast slider sends the new value to the Preview | component | the Preview's Adjustments carry the slider's value after the change |
| AC-02 happy | the real shader gives the brightness and contrast anchors | e2e-through-UI | the anchor fixture rendered at each anchor is within 2/255 per channel of ADR-0003's table, on all three engines (QG-1d) |
| AC-03 happy | saturation, temperature and tint give ADR-0003's anchor values | unit | temperature ±100 turns 128 into (154, 128, 102) / (102, 128, 154); tint ±100 into (128, 102, 128) / (128, 154, 128); black is never tinted; exact after rounding |
| AC-03 happy | saturation −100 gives equal channels and a grey pixel stays grey at any saturation (property) | unit | at −100 R = G = B for any colour; a pixel with R = G = B is unchanged at every saturation |
| AC-03 happy | a higher temperature warms and a higher tint adds magenta on mid-grey (property) | unit | for rising temperature, red rises and blue falls; for rising tint, green falls against red and blue; the reverse for falling values |
| AC-03 happy | saturation, temperature and tint reach the shader as `toUniforms` packs them | integration | the recorded uniforms equal `toUniforms(draft)` |
| AC-03 happy | moving the saturation, temperature or tint slider sends the new value to the Preview | component | the Preview's Adjustments carry the slider's value |
| AC-03 happy | the real shader gives the saturation, temperature and tint anchors | e2e-through-UI | within 2/255 of ADR-0003's table on all three engines (QG-1d) |
| AC-04 happy | grayscale and sepia give ADR-0003's anchor values | unit | grayscale 100% turns red, green, blue and yellow into 54, 182, 18 and 237; sepia 100% turns 128 into (173, 154, 120); exact after rounding |
| AC-04 happy | grayscale 100% with sepia 0% gives equal channels whatever the other values (property) | unit | for random colours and random other Adjustments, R = G = B |
| AC-04 happy | sepia 100% gives red ≥ green ≥ blue whatever the other values, grayscale included (property) | unit | for random colours and random other Adjustments, R ≥ G ≥ B |
| AC-04 happy | grayscale and sepia move towards the effect in proportion to the amount | unit | at 50% each channel lies between its value at 0% and at 100%, within 1 of the midpoint |
| AC-04 happy | grayscale and sepia reach the shader as `toUniforms` packs them | integration | the recorded uniforms equal `toUniforms(draft)` |
| AC-04 happy | setting grayscale or sepia, by slider or by its "%" field, sends the amount to the Preview | component | the Preview's Adjustments carry the amount |
| AC-04 happy | the real shader gives the grayscale and sepia anchors | e2e-through-UI | within 2/255 of ADR-0003's table on all three engines (QG-1d) |
| AC-05 error | a typed value out of range snaps to the nearest bound | unit | "150" gives 100 and "−300" gives −100 in brightness; "120%" gives 100 and "−5" gives 0 in sepia |
| AC-05 error | a fractional value rounds half up | unit | "2.5" gives 3; "−2.5" gives −2; "2.4" gives 2; "2,5" (decimal comma) gives 3 |
| AC-05 error | an empty, non-numeric or scientific-notation value returns to the previous value | unit | "", "abc" and "1e2" keep the previous value; a very long plain decimal snaps to the range |
| AC-05 error | a trailing "%" is a number only in the grayscale and sepia fields | unit | "60%" gives 60 in grayscale and sepia; in the five −100..100 fields it is not a number and the previous value returns |
| AC-05 error | a corrected value reaches the Draft only on commit | integration | the Draft changes only when the field is left or Enter is pressed, and holds the corrected value |
| AC-05 error | the field checks only on leaving or Enter, and Enter in it never applies the tool | component | while typing nothing changes and the Preview keeps the previous value; the corrected value shows after leaving or Enter; Enter in the field leaves the tool open |
| AC-05 error | typing an out-of-range value in a real browser snaps it | e2e-through-UI | "150" then Enter in brightness shows 100; "1e2" then Tab shows the previous value; the tool stays open |
| AC-06 invariant | neutral values are an exact identity and switch the shader's bypass on | unit | the CPU reference returns every input colour unchanged at neutral; `toUniforms` of the neutral Adjustments turns the bypass on |
| AC-06 invariant | no setting changes alpha (property) | unit | for random colours, alphas and Adjustments, the output alpha equals the input alpha |
| AC-06 invariant | a partly transparent pixel changes colour exactly as the same opaque pixel would (property) | unit | for alpha 1 to 254, the unpremultiplied colour of the result equals the opaque result |
| AC-06 invariant | neutral Adjustments draw with the bypass on, and Apply keeps the Work's size and Geometry | integration | the recorded uniforms carry the bypass for neutral values; after Apply the Work's size and Geometry are unchanged |
| AC-06 invariant | the status bar reads the same size before and after Apply | component | the dimensions text is unchanged by any Adjustments |
| AC-06 invariant | neutral values give the same Export as before any Adjustment | e2e-through-UI | a full-size PNG Export after setting every value away and back to neutral and applying has difference 0 per channel from the Export before adjusting, on all three engines (QG-1b) |
| AC-06 invariant | transparency is kept exactly at every fidelity setting | e2e-through-UI | on the semi-transparent fixture, every pixel's alpha equals the neutral Export's (difference 0); colour at alpha ≥ 64 within the per-engine limit; the opaque fixture stays 100% opaque; all three engines (QG-1c) |
| AC-07 invariant | each step clamps, so a channel pushed past white or black never wraps (property) | unit | for random colours and Adjustments every channel stays in 0..255; 250 at brightness +100 and contrast +100 gives 255 |
| AC-07 invariant | the result depends only on the seven values, in one fixed order | unit | building the same Adjustments in any order of field assignment gives the same output for random colours |
| AC-07 invariant | two paths to the same values give the same Draft and the same uniforms | integration | contrast before brightness, brightness before contrast, and a slider dragged to +100 and back give equal Drafts and equal recorded uniforms |
| AC-07 invariant | dragging a slider far out and back leaves the Draft as it was | component | after moving to the end and back to the start value, the Draft equals the Draft before |
| AC-07 invariant | two paths to the same values give the same pixels in a real browser | e2e-through-UI | the Preview at 100% and a full-size PNG Export are identical (difference 0) for both paths, on all three engines |
| AC-08 happy | while Compare is held the Preview gets neutral values, and the Draft keeps changing underneath | integration | the Preview's Adjustments are neutral while held; a slider, a typed value, Auto, Reset or a per-slider reset change the Draft but not the Preview's Adjustments; on release they equal the Draft |
| AC-08 happy | Compare ends on release, window blur and tool close, and never changes the Work, Draft or Unsaved edits | integration | each of the three ends Compare; the Work's Adjustments, the Draft and the revision are as before |
| AC-08 happy | Compare is held by the mouse, by Space or Enter on the button, or by the `\` key outside a text field | component | held: the button shows pressed and the "Before" label shows; released: both go; the `\` key is matched by its key code on any layout; in a text field `\` does nothing; key repeats do not toggle |
| AC-08 happy | holding Compare in a real browser shows the Work without Adjustments | e2e-through-UI | by mouse, Space, Enter and `\`: while held, the Preview's pixels equal the Work rendered with no Adjustments and "Before" is visible; on release the Draft's pixels return |
| AC-09 happy | Cancel restores the Adjustments at open and leaves Unsaved edits unchanged | integration | after changing several sliders and cancelling, the Work's Adjustments and revision are as before |
| AC-09 happy | Cancel and Escape close the tool from anywhere, including a field mid-typing | component | Escape in a field discards the pending text and cancels; the Cancel button cancels; focus returns to the "Adjust" action |
| AC-09 happy | cancelling in a real browser shows the Work as before | e2e-through-UI | after Escape, the Preview's pixels and Unsaved edits equal those from before the tool opened |
| AC-10 happy | reopening shows the applied values, and resetting one or all changes only the Draft | integration | the Draft at open equals the applied Adjustments; a per-slider reset and Reset set neutral values in the Draft; the Work is unchanged until Apply; Cancel after Reset keeps the old values |
| AC-10 happy | double-clicking a slider with a neutral value sets it to neutral | component | the shared slider sets its neutral value on double-click and does nothing on double-click without one |
| AC-10 happy | typing 0 resets one slider, and Reset sets all seven to neutral | component | after "0" and Enter that slider shows 0; after Reset all seven show 0 |
| AC-10 happy | applying, then Reset and Apply, gives back the pixels from before | e2e-through-UI | for every reference fixture a full-size PNG Export has difference 0 per channel from the Export made before adjusting, on all three engines (spec §7, QG-2) |
| AC-10 happy | double-clicking a slider in a real browser resets it | e2e-through-UI | the slider and its field show 0 and the Preview follows |
| AC-11 cross-context | Adjustments are equal only when all seven fields are equal (property) | unit | changing any one field makes them unequal; equal fields are equal whatever the object identity |
| AC-11 cross-context | Apply raises Unsaved edits only when a value differs from the values at open | integration | Apply with no change, or with values changed and changed back in the same tool, leaves Unsaved edits as they were; any differing field raises them |
| AC-11 cross-context | the comparison is with the values at open, not with those at the last Export | integration | after an Export, changing a value in one Apply and changing it back in a later Apply still leaves Unsaved edits |
| AC-11 cross-context | pressing Apply with an unchanged Draft closes the tool without an edit | component | the tool closes; Unsaved edits are unchanged; after a change, Apply raises them |
| AC-11 cross-context | after an applied change, opening another image asks to confirm, and an Export clears Unsaved edits | e2e-through-UI | the replace confirmation shows; after a successful Export it no longer does |
| AC-12 happy | `autoAdjust` corrects in the right direction | unit | a dark sample gets brightness > 0; a light one < 0; a flat one contrast > 0; a blue cast temperature > 0; a green cast tint > 0 |
| AC-12 happy | `autoAdjust` skips alpha 0 first, then unpremultiplies the rest | unit | adding fully transparent pixels of any colour changes nothing; a partly transparent pixel counts as the opaque pixel of the same colour (F4 review) |
| AC-12 happy | `autoAdjust` gives the same values for the same sample | unit | two calls on equal samples give equal results |
| AC-12 happy | the sample is the Crop with its Geometry and no Adjustments, at most 512 px, and its framebuffer is always freed | integration | the recorded draw uses the Geometry and neutral uniforms; the framebuffer's long side is at most 512; its framebuffer and texture are deleted on success and on failure (F4 review) |
| AC-12 happy | Auto replaces only brightness, contrast, temperature and tint, and repeats exactly | integration | those four take the computed values; saturation, grayscale and sepia stay; choosing Auto twice gives the same Draft; the sample ignores a non-neutral Draft; the Work is unchanged until Apply |
| AC-12 happy | a sample that fails with the display lost leaves the tool as it was | integration | the sliders are unchanged, the tool stays open, open-and-view's display-lost path handles it and no new error appears (F4 review) |
| AC-12 happy | Auto updates the sliders and is unavailable while the display is lost | component | after Auto the four sliders and fields show the values; the Auto button is disabled while the display is lost or being restored |
| AC-12 happy | choosing Auto in a real browser moves four sliders and the Preview follows | e2e-through-UI | on a reference photo the four sliders change and the other three don't; the Preview's pixels change; a second Auto gives the same values |
| AC-13 invariant | Auto's values are whole numbers within ±50, rounded half up (property) | unit | for random samples every value is an integer in −50..50 |
| AC-13 invariant | a one-colour sample, or one with no pixel above alpha 0, has nothing to correct | unit | the result is "nothing to correct" for one colour, for all-transparent and for an empty sample |
| AC-13 invariant | "nothing to correct" leaves the Draft and sets the hint, which clears on the next change | integration | the Draft is unchanged; the hint flag is set and cleared by the next Draft change |
| AC-13 invariant | the hint line shows "Nothing to correct automatically." and clears on the next change | component | the status line reads the hint; it is empty again after a slider moves |
| AC-13 invariant | Auto on a one-colour image in a real browser shows the hint | e2e-through-UI | the sliders are unchanged and the hint is visible |
| AC-13 invariant | Auto's values agree within 1 between engines | e2e-through-UI | for each sRGB reference fixture without an embedded profile, each value differs by at most 1 between Chromium, Firefox and WebKit; a differing engine is recorded as a deviation |
| AC-14 cross-context | the export request carries the applied Adjustments, never the Draft | integration | the snapshot holds the Work's Adjustments; an unapplied Draft never reaches it |
| AC-14 cross-context | the export worker sets the same uniforms as the Preview | integration | for the same Adjustments the recorded uniforms are equal in the Preview renderer and the worker |
| AC-14 cross-context | a smaller adjusted Export is reduced after adjusting; full size or neutral stays one pass | integration | two recorded passes (full-size adjusted texture, then mipmapped reduction) for a smaller size with non-neutral values; one pass otherwise |
| AC-14 cross-context | the transparency hint ignores the Adjustments | integration | the hint's answer is the same with and without Adjustments, and the cached answer survives an Adjustment change |
| AC-14 cross-context | the export panel shows the same sizes after adjusting | component | the full-size label and presets are unchanged — **Narrowed on purpose:** the export panel is unchanged by this feature; the integration rows hold what it reads |
| AC-14 cross-context | an adjusted Export matches the Preview at 100% | e2e-through-UI | for each slider at −100, −50, +50, +100 (0%, 50%, 100% for grayscale and sepia) and the combined setting, with and without a Geometry, each pixel of a full-size PNG Export is within 2/255 per channel of `previewAt100()` on the opaque fixtures, on all three engines (QG-1a) |
| AC-14 cross-context | a smaller adjusted Export is the full-size adjusted Export reduced | e2e-through-UI | a smaller Export matches the full-size adjusted Export reduced to that size within the tolerance export uses for smaller sizes today; a semi-transparent Work shows the transparency hint exactly as without Adjustments |
| AC-15 authorization | the tool refuses to open while an export is in progress | integration | the request is refused and not queued; the tool doesn't open when the export ends |
| AC-15 authorization | the action is disabled and A does nothing during an export | component | the button is truly disabled; pressing A changes nothing |
| AC-15 authorization | during a real export the tool can't be opened | e2e-through-UI | the tool stays closed and the Export holds the Work as confirmed — **Narrowed on purpose:** held by the integration and component rows; an export in a real browser is too short to aim a key press at reliably |
| AC-16 cross-context | the export refusal names the open tool | unit | for adjust the text is "Apply or cancel the adjustments first, then export."; for crop-rotate the crop text is kept |
| AC-16 cross-context | Export is refused while the tool is open | integration | the export does not start; the adjust hint is raised |
| AC-16 cross-context | Export is unavailable and Ctrl/Cmd+S shows the hint while the tool is open | component | Export shows unavailable; the shortcut's default is prevented and the hint toast shows |
| AC-16 cross-context | Ctrl/Cmd+S with the tool open never opens "Save page" or downloads | e2e-through-UI | no download and no browser save dialog; the hint toast is visible |
| AC-17 cross-context | the tool stays open until the new image is read and the replacement confirmed | integration | the Draft is kept while reading; on confirm the tool closes, the Draft is discarded and the new Work's Adjustments are neutral |
| AC-17 cross-context | the tool keeps its Draft when the new image fails or the replacement is declined | integration | the Draft and the tool state are unchanged |
| AC-17 cross-context | a Draft never counts as Unsaved edits on its own | integration | with an unapplied Draft and no applied change, replacing asks no confirmation |
| AC-17 cross-context | "Open image" stays available while the tool is open | component | the action is enabled — **Narrowed on purpose:** the e2e row opens and drops files with the tool open |
| AC-17 cross-context | dropping a file while the tool is open, then confirming or declining | e2e-through-UI | decline keeps the tool and its Draft; confirm shows the new Work with neutral Adjustments and the tool closed; an unreadable file keeps the tool |
| AC-18 cross-context | the crop-rotate hint for another open tool names it generically | unit | "Apply or cancel the open tool first." is the catalog entry for both actions and keys |
| AC-18 cross-context | only one tool opens at a time, and each tool's open and close keep their own side effects | integration | opening adjust while crop-rotate is open is refused, and the reverse; crop-rotate still sets the whole-image preview and fits the View; adjust does neither |
| AC-18 cross-context | Crop and rotate draws the applied Adjustments, and its Apply keeps them | integration | with adjust closed the Preview's Adjustments are unset, so the Work's Adjustments are drawn; after a Geometry Apply the Work's Adjustments are unchanged |
| AC-18 cross-context | each tool's action and key show "apply or cancel the open tool first" while the other is open | component | "Crop and rotate" and "Adjust" show unavailable with the hint; C and A show the hint toast, and do nothing while a text field has focus |
| AC-18 cross-context | Crop and rotate on an adjusted Work shows the adjusted image, outside the frame too | e2e-through-UI | the pixels inside and outside the crop frame have the adjusted colour, with no seam when the frame is widened (pixel read on Chromium only, as crop-rotate does for screenshots of the WebGL canvas); the refusal toasts show in both directions on all three engines |
| AC-19 error | the tool is unavailable with no image open | integration | the open request is refused with no Work |
| AC-19 error | the action shows "open an image first" and A shows the same hint | component | the button is unavailable with the hint; pressing A shows the hint toast |
| AC-19 error | with no image, the action and A give the hint in a real browser | e2e-through-UI | the hint shows and the tool does not open |
| AC-20 cross-context | opening and closing adjust leave the View alone | integration | zoom, pan and the Preview's Geometry are unchanged by open, Apply and Cancel |
| AC-20 cross-context | zoom and pan inside the tool never change the Draft or count as an edit | integration | the Draft and the revision are unchanged after zoom and pan |
| AC-20 cross-context | zooming and panning around the tool in a real browser | e2e-through-UI | zoom and pan before opening are kept on opening; they work inside the tool; the View is the same after Apply and after Cancel; the Preview shows the Crop only |
| AC-21 happy | the action sits next to "Crop and rotate", opens with Enter, Space or A, and A is guarded | component | it follows "Crop and rotate" in the top bar; Enter and Space open it; A opens it, and does nothing with the export panel open, with the tool open, or with a text field focused |
| AC-21 happy | inside the tool Tab reaches every control, arrows step by 1 or 10, Enter applies outside a field or button, Escape cancels | component | the Tab order is each slider then its field top to bottom, then Compare, Auto, Reset, Cancel, Apply; arrows change by 1, by 10 with Shift, kept in range; Enter on a focused button presses only that button; Enter elsewhere applies; focus goes to brightness on open and back to the action on close |
| AC-21 happy | lightening and an automatic fix each take three actions, by mouse and by keyboard alone | e2e-through-UI | Adjust, drag brightness, Apply gives a lighter Work; A, Auto, Apply gives an auto-adjusted Work; the same by Tab, Enter, arrows and Enter alone; Space on Auto and Apply presses them instead of starting space-pan (spec §7 KPI) |

## Edge cases / error paths

The error and authorization ACs each have their own rows above: AC-05 (error), AC-15
(authorization) and AC-19 (error). The spec and the SAD also imply these boundaries:

- Every slider at both bounds at once (the combined extreme) → every channel stays in 0..255 and no
  channel wraps (AC-07).
- Contrast −100 → every pixel becomes mid-grey 128, alpha untouched (ADR-0003).
- Brightness +100 on pure black → black stays black (ADR-0003 keeps black in place).
- Temperature or tint ±100 on pure black → not tinted (ADR-0003, answers spec §8's first question).
- A pixel with alpha 1 → alpha stays 1; its colour is checked only in the CPU reference (`sad.md`
  §11).
- A 1×1 Work → the tool opens, every setting renders, and Auto reports "nothing to correct".
- A Crop whose non-transparent pixels are all one colour while the rest of the Original is not →
  "nothing to correct" (Auto measures the Crop only).
- Auto when the Draft already holds Auto's values → the same values; the Draft is unchanged.
- The display is lost while the tool is open → open-and-view's display-lost message; Auto is
  disabled; the sliders, Cancel and Apply still work (`screens.md` SCR-03 "display lost").
- The window loses focus while `\` or the Compare button is held → Compare ends; the Preview shows
  the Draft.
- The tool closes (Apply, Cancel, replace) while Compare is held → Compare ends with it.
- Escape while a field holds pending text → the text is discarded with the Draft; nothing is
  committed.
- A trailing "%" in a −100..100 field → not a number; the previous value returns.
- A very long plain decimal in any field → a number, snapped to the range, never an error.
- The new image can't be read while the tool is open → open-and-view's failure notice; the tool and
  its Draft stay (AC-17).
- A held A or C key's repeats → no repeated toasts or toggles.

## Test data

- **Seed strategy.**
  - Unit property tests generate random stored sRGB colours, alphas (0..255), Adjustments (each
    field in its range, whole numbers) and Auto samples (random sizes up to 512×512, random
    alphas). Example tests use ADR-0003's anchor table and small named samples: dark, light, flat,
    blue cast, green cast, one colour, all transparent, empty.
  - Integration and component tests build a Work with a small in-memory Original through the
    existing Work factory (`createWork` in `src/core/document.ts`). No decoding is involved.
- **Fixtures for e2e-through-UI.**
  - An **anchor fixture**: opaque patches of mid-grey 128, black, white, red, green, blue and
    yellow, large enough to read each patch's centre at 100%. It is generated deterministically by
    `e2e/fixtures/generate.sh` and documented in the fixtures README.
  - A **semi-transparent fixture**: patches with alpha 0, 1, 64, 128, 254 and 255 over several
    colours, generated the same way. Used only for the transparency rows (QG-1c) and the AC-14
    transparency hint.
  - The **opaque reference set** for fidelity, the round trip and Auto: the existing `photo.png` and
    `ref.png`, which are sRGB without an embedded profile (checked by the fixtures README before use).
  - A **one-colour image**, built in the page at run time, for "nothing to correct".
  - The 4096×3072 Work for the load scenarios, built in the page at run time as the export perf
    suite already does.
- **Setting Adjustments.** The fidelity, anchor and transparency rows set Adjustments through the
  `setAdjustments` test hook (T9) and read the Preview through `previewAt100()`. The flow rows
  drive the real UI.
- **Independent oracle.** The anchor rows compare the shader with ADR-0003's table as written in
  the test, not with `core`'s CPU reference. The fidelity rows compare the Export with the Preview.
  The round-trip and neutral rows compare two Exports exactly.
- **Integration dependency.** The real editor, export, crop-rotate and adjust stores, created
  fresh. Stores are never mocked. The renderer, the export worker and the GL are replaced by
  recording fakes at this level only; the real ones run in e2e-through-UI.
- **Cleanup boundary.** Per test. Unit and integration tests create fresh stores in each test, and
  e2e-through-UI tests use a fresh browser context in each test. The Adjustments are never
  persisted, so no stored state crosses tests. Downloaded Export files are read from the test's
  temporary output and dropped with it.

## NFR validation (load)

The load/perf tool already in your repo, or e.g. k6 or Locust. Every scenario runs on the reference
machine (Apple M1 MacBook Air, latest stable Chrome) with the 4096×3072 Work, takes p95 over **20
runs after 2 warm-up runs**, and is tagged as a perf test, so it runs by hand rather than on every
PR.

- **Preview while dragging** (§6 row 1) → for each of the seven sliders, drag continuously for 2 s
  with one pointer move per display frame. Assert the p95 frame interval is ≤ 33 ms (at least 30
  updates per second).
- **Action to updated Preview** (§6 row 2) → for each of Apply, Cancel, Reset and releasing Compare,
  20 runs. Assert p95 from the action to the redrawn Preview is ≤ 150 ms.
- **Tool ready** (§6 row 3) → 20 openings of "Adjust". Assert p95 from the action to the tool-ready
  mark is ≤ 150 ms.
- **Auto** (§6 row 4) → 20 runs of Auto on the 4096×3072 Work. Assert p95 from choosing Auto to the
  frame that shows its values is ≤ 300 ms.
- **Export with Adjustments** (§6 row 5) → all seven values away from neutral, then 20 full-size
  exports per format. Assert p95 ≤ 1 s for JPEG at quality 90 and ≤ 2 s for PNG.
- **Memory after 50 Applies** (§6 row 9) → apply 50 Adjustment changes in a row, Chromium only.
  Assert whole-page memory, measured as export §6 does it, is ≤ 110% of the memory after the first
  Apply.

The §6 fidelity, neutral-value and transparency rows carry tolerances, not rates. They are verified
by the e2e-through-UI rows of AC-06 and AC-14.

## CI placement

- **On every PR:** unit (with property tests), integration and component, together with lint and
  typecheck. These are the fast suites.
- **On every PR, three engines:** e2e-through-UI, the same way the repo's CI already runs the export,
  open-and-view and crop-rotate browser suites. This includes the anchor, fidelity, neutral,
  transparency and round-trip rows, since a colour regression must block a merge.
- **By hand before release, on the reference machine:** the load scenarios above (the perf-tagged
  suite).

## Rows by task

So `implement` can find each row's home in `tasks.json`:

- T1, T2, T3, T4 — the unit rows of AC-01 to AC-07 and AC-11 to AC-13.
- T5, T6, T7 — the recording-GL integration rows (uniforms, bypass, sample, two passes).
- T8, T12, T13 — the store integration rows.
- T9 — the `PreviewCanvas` component row and the test hooks the e2e rows use.
- T10 — the hint catalog unit rows and the `ExportAction` and `CropRotateAction` component rows.
- T11, T14, T15, T16 — the remaining component rows.
- T17 — the e2e anchor, fidelity, neutral, transparency, two-path, round-trip and smaller-size rows.
- T18 — the e2e tool-flow rows (AC-01, AC-05, AC-08 to AC-10, AC-12, AC-13, AC-21).
- T19 — the e2e cross-feature rows (AC-11, AC-16 to AC-20).
- T20 — the load scenarios.
