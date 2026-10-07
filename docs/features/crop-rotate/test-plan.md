---
status: Draft
owner: "Blazheiko"
reviewers: ["Blazheiko (implementing engineer)", "Tech Lead"]
updated_at: "2026-10-07"
feature_size: "M"
---

# Test plan — crop-rotate

One "Crop and rotate" tool turns, mirrors, straightens and crops the open Work as a non-destructive
Geometry. Apply keeps it, Cancel restores it and Reset clears it. The Preview and every Export show
exactly the applied Geometry, with no pixel from outside the Crop, on Chromium, Firefox and WebKit.

Inputs: `spec.md` §5 (AC-01 to AC-20), §6 and §7; `sad.md` §6 (F1 to F8) and §10 (QG-1 to QG-3);
`ux-flows.md` (the e2e-through-UI scripts); `screens.md` SCR-03 (the component states); `tasks.json`
(T1 to T20). `target_surfaces: [web-frontend]`, so the frontend tiers apply.

## Decisions taken in this plan

- **Fidelity tolerance (closes spec §8 open question 2 and the `sad.md` §11 High risk).** The
  pixel-exact tests (QG-1a, QG-1b, QG-2 and the opacity check) use **opaque fixtures only**, and
  the limit is **2 of 255 per channel on every engine**, including Linux WebKit, with the Crop's
  edge pixels included. Export's 3/255 Linux WebKit limit (export ADR-0003) applies only to
  semi-transparent Originals, so these tests don't use it. A semi-transparent Original with a
  Geometry is covered only by the transparency-hint test (AC-14), which compares no pixels. If an
  engine misses 2/255 on an opaque fixture, record it as an engine deviation with its own ADR, as
  export ADR-0003 does. Never loosen the limit silently.
- **Levels per group (chosen by the owner).**
  - Geometry rules (AC-02 to AC-10): unit (including property tests) + integration + component +
    e2e-through-UI.
  - Tool flows (AC-01, AC-11 to AC-13, AC-15 to AC-20): integration + component + e2e-through-UI.
  - The level question didn't name AC-05 and AC-14. Both are in the geometry group because each
    has a pure mapping rule (turn around the frame's centre; `cropToOriginalUv`).
- **No visual-regression.** The DOM frame's alignment with the WebGL Preview (`sad.md` §11, ADR-0005)
  is checked geometrically in e2e-through-UI: the frame's on-screen box against the image's known
  on-screen edges. No baseline images are used.

## Levels

| Level | Scope | Strategy (generic — no tool names) |
|---|---|---|
| Unit | Pure `src/core` Geometry rules: clamp, quarter turn, on-screen flip, straighten and fit-inside, proportions, typed-size and angle parsing, field-by-field equality, the one transform and overlay maths. | In memory, no DOM. Example tests for the named cases, plus **property tests** that generate hundreds of random Geometries and Original sizes and assert each invariant. |
| Integration | The crop-rotate store working with the **real** editor and export stores: Draft, Geometry at open, Apply, Cancel, Reset, Unsaved edits, the remembered proportion, the active-tool slot, refusals and replacing the Work. | A fresh set of real stores per test, with no mocked stores. Nothing is persisted, so there is no datastore. The renderer and the export worker are the only boundaries replaced, by a recording fake, because WebGL is checked only in e2e-through-UI. |
| Contract | <!-- N/A: the only cross-participant boundary is the main thread ↔ export worker message carrying the Geometry; both sides import one shared TypeScript type, so the typecheck gate is the contract check, and the e2e fidelity rows exercise the real message. --> | — |
| E2E | Covered by E2E-through-UI: every flow in this feature is driven through the UI. | — |
| Load | Spec §6 timing and memory NFRs, on the reference machine. | The load/perf tool already in your repo (the existing `@perf`-tagged browser suite, run by hand with the perf switch), or e.g. k6 or Locust. |
| Component | `CropOverlay`, `CropRotateControls`, `CropRotateTool`, the toolbar action, and the extended `SliderField`, `NumberField` and `BaseButton`. Each SCR-03 state in `screens.md` is a case. | Mount the component with a real store, without booting the app or using WebGL. Assert the rendered output, focus order, keyboard handling and store calls. |
| Visual-regression | <!-- N/A: decided by the owner; frame-to-Preview alignment is a geometric e2e-through-UI assertion instead. --> | — |
| E2E-through-UI | The `ux-flows.md` flows in a real browser on Chromium, Firefox and WebKit: the WebGL Preview, a real Export download decoded back to pixels, file open and drop, keyboard shortcuts, View fit. | The app's own hooks-enabled build. Fixtures are opened through the real open path, and a test hook sets a Geometry directly where a test needs many Geometries. Each test gets a fresh browser context. |

## AC coverage

Test names are intent-based. Level tokens: `unit`, `integration`, `component`, `e2e-through-UI`.

**Narrowed on purpose** marks a row that has no test at its level. T19 limited the e2e suite to what
happy-dom can't do (WebGL, real downloads, real focus and hit-testing), as the repo's test convention
asks, so these ACs are held by the rows at the other levels named in the cell. The marking was added
after review 2026-10-07 (R11).

| AC (spec.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 happy | applying a dragged-in frame leaves only the frame's area as the Work | integration | Work's Geometry holds the new Crop; the Work's size is the Crop's width and height; Unsaved edits raised |
| AC-01 happy | status bar shows the Crop's size and "from" the Original's size whenever width or height differs | component | "1920×1080, from 4096×3072" after a Crop; a 90° Rotation alone also shows "from"; an identity Geometry shows the Original's size alone |
| AC-01 happy | outside is dimmed, thirds grid only while dragging, dragging inside moves the frame | component | four dimming panels around the frame; thirds grid visible during a drag and gone after it; an inside drag moves the frame without resizing it |
| AC-01 happy | open, drag an edge inwards, Apply | e2e-through-UI | tool closes; the Work's size is the Crop's; status bar shows the Crop's size "from" the Original's — **Narrowed on purpose:** only an edge is dragged and the Preview's pixels are not read; QG-1a and QG-1b check that the cropped Preview and Export match |
| AC-02 invariant | the Crop always lies whole-pixel inside the turned image and is at least 1×1 (property) | unit | for any random Geometry and any drag of the frame, an edge or a corner, the Crop stays inside, is whole pixels and is never empty or inverted |
| AC-02 invariant | dragging past the image edge or past the opposite edge stops at the edge or at 1 px | unit | frame stops at the image edge; the dragged edge stops 1 px before the opposite one |
| AC-02 invariant | centring with an odd pixel puts the extra pixel right and bottom | unit | left and top round down; the extra pixel goes to the right or the bottom |
| AC-02 invariant | the Draft's Crop stays valid through a sequence of store actions | integration | after any mix of turn, flip, straighten, proportion and typed size, the Draft's Crop is inside, whole pixels and at least 1×1 |
| AC-02 invariant | pointer drag beyond the image and past the opposite edge clamps the frame | component | frame and size fields stop at the bound; the frame never turns inside out |
| AC-02 invariant | dragging the frame off the image in a real browser stops at the edge | e2e-through-UI | frame's on-screen box stays within the image's on-screen box — **Narrowed on purpose:** the unit property tests and the component pointer-drag rows hold the clamp, and the ADR-0005 alignment test checks where the frame sits on screen |
| AC-03 happy | a quarter turn swaps width and height and keeps the same photo area in the frame | unit | image and Crop sizes swap; the Crop maps to the same source area of the Original |
| AC-03 happy | four turns one way, or one turn each way, give an equal Geometry (property) | unit | equal field by field to the Geometry before |
| AC-03 happy | a locked proportion turns with the image | unit | 4:3 becomes 3:4 |
| AC-03 happy | rotating in the store turns the Draft and the remembered orientation | integration | Draft rotated; locked proportion's orientation flipped; Work untouched until Apply |
| AC-03 happy | rotate buttons turn the Draft and swap the size fields | component | "Rotate left" and "Rotate right" call the store; width and height fields swap |
| AC-03 happy | each of 16 Rotation × Flip combinations exports every pixel losslessly, with and without a Crop | e2e-through-UI | each pixel of a full-size PNG Export within 2/255 per channel of the Original pixel the test's own inverse mapping names, on all three engines |
| AC-04 happy | flip horizontal swaps left and right as shown on screen, whatever the Rotation | unit | for each Rotation, the on-screen left-right order is mirrored and the Crop keeps its photo area |
| AC-04 happy | a Flip changes the sign of the Straighten angle | unit | +5° becomes −5° |
| AC-04 happy | flipping twice the same way gives an equal Geometry (property) | unit | equal field by field to the Geometry before |
| AC-04 happy | flipping in the store mirrors the Draft and the slider's angle | integration | Draft mirrored; the Draft's Straighten angle has the opposite sign |
| AC-04 happy | flip buttons mirror the Draft and the slider shows the angle with the opposite sign | component | after a Flip, the slider and field read −5.0 where they read 5.0 |
| AC-04 happy | a flipped Export is mirrored as shown on screen | e2e-through-UI | covered by the 16-combination fidelity row (AC-03) — **Narrowed on purpose:** no test reads the on-screen left-right order of coloured quadrants. QG-1a (`e2e/crop-rotate/fidelity.spec.ts`) checks every pixel of the Export against the inverse mapping, and the unit rows in `src/core/geometry/geometry.test.ts` ("toggles the stored horizontal Flip…", "mirrors the Crop in the turned image") hold the on-screen mapping |
| AC-05 happy | the straighten angle turns the image around the frame's centre, positive is clockwise | unit | the frame's centre maps to the same Original point before and after; a positive angle turns clockwise |
| AC-05 happy | angles are kept to −45..+45 in steps of 0.1 | unit | the stored angle is always a multiple of 0.1 within the range |
| AC-05 happy | the slider updates the Draft live while it moves | integration | each slider change updates the Draft and requests a Preview update |
| AC-05 happy | slider shows the signed angle with one decimal, 0 marked, fine grid while it changes | component | value text such as "3.4", a tick at 0, the fine grid shown during the change and hidden after |
| AC-05 happy | dragging the slider in a real browser turns the Preview | e2e-through-UI | Preview pixels change as the slider moves; the angle shown matches the Draft — **Narrowed on purpose:** the slider is driven only by the `@perf` suite (`PERF=1`); the component and integration rows hold the live update, and QG-1b checks the straightened Preview |
| AC-06 invariant | straightening shrinks the frame around its centre to the largest that fits, keeping proportions (property) | unit | for any angle in range and any Crop, the result lies inside the turned image, is whole pixels and keeps its proportion within 0.5 px |
| AC-06 invariant | the centre moves only when it would fall outside, and then to the nearest point inside | unit | centre unchanged when inside; otherwise the nearest inside point |
| AC-06 invariant | moving the angle back towards 0 never grows the frame | unit | frame size never increases as the angle returns |
| AC-06 invariant | the Draft never has an empty corner after straightening | integration | after any slider or typed angle, the Draft's Crop lies inside the turned image |
| AC-06 invariant | the frame visibly shrinks while straightening and stays smaller when the slider returns | component | the frame's size fields go down and do not go back up — **Narrowed on purpose:** the unit rows (including the anchored 0°→45°→0° sweep) and the integration row hold it |
| AC-06 invariant | an opaque Original stays 100% opaque after any Straighten angle | e2e-through-UI | at −45°, −0.1°, +1° and +45°, every pixel of the Preview and of a full-size PNG Export is fully opaque, on all three engines |
| AC-07 error | typed angle out of range snaps to the nearest bound | unit | "60" gives 45; "−90" gives −45 |
| AC-07 error | typed angle with extra decimals rounds to 0.1 | unit | "3.47" gives 3.5 |
| AC-07 error | empty, non-numeric or scientific-notation angle returns to the previous angle | unit | "", "abc" and "1e2" keep the previous value; a very long plain decimal snaps to the range; a decimal comma is accepted |
| AC-07 error | a corrected angle reaches the Draft only on commit | integration | the Draft changes only when the field is left or Enter is pressed, with the corrected value |
| AC-07 error | the angle field checks only on leaving or Enter, and Enter does not apply the tool | component | nothing changes while typing; the corrected value shows after leaving or Enter; Enter in the field never applies the tool |
| AC-07 error | typing an invalid angle in a real browser reverts it | e2e-through-UI | the field shows the previous angle and the tool stays open — **Narrowed on purpose:** parsing is pure (unit), and the component row covers leaving the field and Enter in it |
| AC-08 happy | choosing a proportion gives the largest frame of it inside the current frame, centred | unit | for each of Original, 1:1, 4:3, 3:2 and 16:9, in landscape and portrait, the frame is centred on the old frame and as large as fits |
| AC-08 happy | the short side is the long side divided by the proportion, a half pixel rounding up (property) | unit | the short side is within 0.5 px of exact; an exact half rounds up |
| AC-08 happy | Original follows the image after its current Rotation | unit | after a 90° turn, Original is the turned image's proportions |
| AC-08 happy | the proportion is remembered per Work as soon as it is chosen, even after Cancel | integration | reopening the tool for the same Work restores the proportion and orientation; a new Work starts at Free |
| AC-08 happy | a locked proportion holds while the frame is dragged or resized, until Free | component | dragging a corner keeps the proportion; Free releases it; orientation is disabled for Free and 1:1 |
| AC-08 happy | cropping to a square in a real browser | e2e-through-UI | open, choose 1:1, Apply; the Work's width equals its height |
| AC-09 happy | a typed size resizes the frame around its centre, moving it only as far as needed | unit | centre kept unless that would leave the image; then moved the minimum to stay inside |
| AC-09 happy | with a proportion locked, the typed side is the input and the other side follows | unit | typed long side or short side alike; the other side rounded with a half pixel up |
| AC-09 happy | the size fields always equal the Draft's Crop, and the applied Work's size | integration | field values equal the Draft's Crop at every step; after Apply they equal the Work's size |
| AC-09 happy | size fields follow a frame drag live | component | width and height fields update during the drag |
| AC-09 happy | the size shown in the tool is exactly the full-size Export's size | e2e-through-UI | the decoded Export's width and height equal the fields shown before Apply — **Narrowed on purpose:** QG-1c checks that the Export's size equals the Crop's, but not through the fields; the integration row ties the fields to the Draft's Crop |
| AC-10 error | a too-large typed size becomes the largest that fits at the current angle and proportion | unit | width or height clamped to the largest that fits; with no proportion locked, the other side is unchanged |
| AC-10 error | zero or a negative size becomes 1 | unit | "0" and "−5" give 1 |
| AC-10 error | a fractional size rounds to the nearest whole number | unit | "100.5" gives 101; "100.4" gives 100 |
| AC-10 error | empty, non-numeric or scientific-notation size returns to the previous value | unit | "", "abc" and "1e2" keep the previous value |
| AC-10 error | a corrected size reaches the Draft only on commit | integration | the Draft's Crop changes only when the field is left or Enter is pressed |
| AC-10 error | the size fields check only on leaving or Enter, and Enter does not apply the tool | component | no check while typing; the corrected value shows after leaving or Enter; Enter in the field never applies the tool |
| AC-10 error | typing an oversized width in a real browser clamps it | e2e-through-UI | the field shows the largest width that fits and the frame reaches the image edge — **Narrowed on purpose:** held by the unit, integration and component rows |
| AC-11 happy | Cancel restores the Geometry at open and leaves Unsaved edits unchanged | integration | after changing Rotation, Flip, angle and Crop and then cancelling, the Work's Geometry and Unsaved edits are as before |
| AC-11 happy | Cancel and Escape close the tool from anywhere, including a field mid-typing | component | Escape in a field discards the pending text and cancels; the Cancel button cancels |
| AC-11 happy | cancelling in a real browser shows the Work as before | e2e-through-UI | Preview pixels and status bar equal those from before the tool opened — **Narrowed on purpose:** the AC-19 e2e test cancels with Escape and checks the View and revision but not the pixels; Escape on a focused handle is covered by the keyboard-only e2e test |
| AC-12 invariant | reopening shows the whole turned image with the frame where the Crop is | integration | the Draft at open equals the Work's Geometry; the tool is in whole-image mode |
| AC-12 invariant | Reset gives no Geometry and proportion Free, taking effect only on Apply | integration | the Draft is the identity Geometry; the Work is unchanged until Apply; Cancel after Reset keeps the old Geometry |
| AC-12 invariant | Reset button sets the controls to no Geometry | component | angle 0.0, proportion Free, size fields equal to the Original's size — **Narrowed on purpose:** the integration rows and QG-2 (Reset then Apply in a real browser) hold it |
| AC-12 invariant | Crop, then widen back to the whole image (or Reset) and Apply, gives back the pixels from before | e2e-through-UI | a full-size PNG Export within 2/255 per channel of the Export made before the Crop, for every reference fixture, on all three engines (spec §7 lossless round trip, QG-2) |
| AC-13 cross-context | Apply with an equal Geometry leaves Unsaved edits unchanged | integration | four quarter turns, two equal Flips, or no change keep Unsaved edits as they were |
| AC-13 cross-context | Geometries are compared field by field, not by pixels | integration | a horizontal plus a vertical Flip on a 180° Rotation raises Unsaved edits |
| AC-13 cross-context | the comparison is with the Geometry at open, not the one at the last Export | integration | after an Export, changing and changing back by hand in a later Apply still raises Unsaved edits |
| AC-13 cross-context | pressing Apply with an unchanged Draft closes the tool without an edit | component | tool closes; the Work's Unsaved edits are as they were; pressing Apply after a turn raises them — **Narrowed on purpose:** the integration rows hold it, and the CropRotateTool test checks that Enter after a turn raises Unsaved edits |
| AC-13 cross-context | after an applied change, opening another image asks to confirm, and an Export clears Unsaved edits | e2e-through-UI | replace confirmation shown; after a successful Export, Unsaved edits are cleared — **Narrowed on purpose:** the AC-17 e2e suite covers the confirmation; clearing on Export is export's own AC-09 e2e test |
| AC-14 cross-context | every Crop pixel centre maps inside the Crop's source area of the Original (property) | unit | for any Geometry, the transform never names a source point outside the Crop's area |
| AC-14 cross-context | export sizes count from the Work's size after its Geometry | integration | full size, presets and the long-side field use the Crop's size; a remembered larger size snaps down and comes back when the Crop is widened |
| AC-14 cross-context | the transparency hint shows only when a pixel inside the Crop is not fully opaque | integration | hint hidden when the transparent area is outside the Crop; shown when it is inside; hidden while the check runs |
| AC-14 cross-context | export panel shows the Crop's size as the full size | component | the full-size label and presets read the Crop's size — **Narrowed on purpose:** `ExportPanel.test.ts` is unchanged; the export store integration row holds the sizes the panel reads |
| AC-14 cross-context | the Export contains nothing from outside the Crop | e2e-through-UI | for a fixture with a distinctly coloured band outside the Crop, with and without a Straighten angle, no exported pixel has the band's colour and the Export's size equals the Crop's |
| AC-14 cross-context | a straightened Export matches the Preview at 100% | e2e-through-UI | at −45°, −0.1°, +1° and +45°, a full-size PNG Export within 2/255 per channel of the Preview's rendering at 100%, edge pixels included, on all three engines (QG-1b) |
| AC-15 authorization | the tool refuses to open while an export is in progress | integration | the request is refused and not queued; the tool doesn't open when the export ends |
| AC-15 authorization | the toolbar action is disabled and the C key does nothing during an export | component | button visibly disabled; pressing C changes nothing |
| AC-15 authorization | during a real export, the tool can't be opened by button or shortcut | e2e-through-UI | the tool stays closed and the Export contains the Work as it was at confirmation — **Narrowed on purpose:** held by the integration and component rows; an export's length in a real browser is too short to aim a key press at reliably |
| AC-16 cross-context | Export is refused while the tool is open | integration | the export does not start; the "apply or cancel the crop first" hint is raised |
| AC-16 cross-context | Export is unavailable and Ctrl/Cmd+S shows the hint while the tool is open | component | Export shown unavailable; the shortcut's default is prevented and the hint toast shows |
| AC-16 cross-context | Ctrl/Cmd+S with the tool open never opens "Save page" or downloads | e2e-through-UI | no download and no browser save dialog; the hint toast is visible |
| AC-17 cross-context | the tool stays open until the new image is read and the replacement confirmed | integration | Draft kept while reading; on confirm the tool closes and the Draft is discarded with the old Work |
| AC-17 cross-context | the tool stays open with its Draft when the new image fails or the replacement is declined | integration | Draft and tool state unchanged |
| AC-17 cross-context | changes in the open tool never count as Unsaved edits on their own | integration | with an unapplied Draft and no applied change, replacing asks no confirmation |
| AC-17 cross-context | "Open image" stays available while the tool is open | component | the action is enabled; the loading and failure overlays show over the tool — **Narrowed on purpose:** the AC-17 e2e suite opens and drops files with the tool open |
| AC-17 cross-context | dropping a file while the tool is open, then confirming or declining | e2e-through-UI | decline keeps the tool and its Draft; confirm shows the new Work with the tool closed; an unreadable file keeps the tool |
| AC-18 error | the tool is unavailable with no image open | integration | the open-tool request is refused with no Work |
| AC-18 error | toolbar action is unavailable with the "open an image first" hint, and C shows the same hint | component | button disabled with the hint; pressing C shows the hint |
| AC-18 error | with no image, the action and the C key give the hint in a real browser | e2e-through-UI | hint shown; the tool does not open — **Narrowed on purpose:** held by the integration and component rows (including C on a non-Latin layout and a held key's repeats) |
| AC-19 cross-context | the View fits the whole turned image on opening, and the Work after Apply or Cancel | integration | the fit target is the whole turned image while the tool is open and the Work after it closes |
| AC-19 cross-context | zoom and pan inside the tool never change the Draft or count as an edit | integration | the Draft and Unsaved edits are unchanged after zoom and pan |
| AC-19 cross-context | opening the tool, zooming, panning, then applying or cancelling in a real browser | e2e-through-UI | every frame edge is reachable on opening; zoom and pan work; the View fits the Work afterwards |
| AC-19 cross-context | the DOM frame lines up with the Preview's image edges at 100% and 800% | e2e-through-UI | the frame's on-screen box is within 0.5 CSS px of the image's on-screen edges (ADR-0005 risk) |
| AC-20 happy | the action sits next to Export, is reachable with Tab, opens with Enter, Space or C, and C is guarded | component | Tab reaches it; Enter and Space open it; C does nothing with the export panel open, with the tool open, or with a text field focused — **Narrowed on purpose:** no test presses Tab to reach the action or opens it with Enter or Space; the action is a native `<button>`. `CropRotateAction.test.ts` covers click, C and the guards, `shortcuts.test.ts` covers C (layout, repeats, modifiers, text fields), and `src/app/keyboard.test.ts` shows that Space on the focused action reaches the button instead of starting space-pan |
| AC-20 happy | inside the tool every control is reachable with Tab, Enter applies outside a field, Escape cancels from anywhere | component | Tab order covers every control; Enter on a focused button presses only that button; Enter elsewhere applies; Escape cancels — **Narrowed on purpose:** no test walks the whole Tab order. The keyboard-only e2e tests (`e2e/crop-rotate/tool.spec.ts`, "by keyboard alone") reach Rotate right, Apply, the proportion radios, the Straighten slider, the first handle and, with Shift+Tab, the frame. `CropRotateTool.test.ts` and `shortcuts.test.ts` hold Enter and Escape |
| AC-20 happy | arrow keys move or resize the frame by 1 px (10 with Shift) and change the angle by 0.1° (1° with Shift) | integration | the Draft moves or resizes by 1 or 10 image pixels, following a locked proportion; the angle changes by 0.1 or 1 |
| AC-20 happy | arrow keys on the focused frame, a handle and the slider | component | key events on each focusable element produce the matching store call |
| AC-20 happy | rotating once and keeping it takes three actions, and so does cropping to a square | e2e-through-UI | C, Rotate right, Apply gives a turned Work; C, 1:1, Apply gives a square Work, by mouse and by keyboard alone (Tab, Space, arrows, Enter) |
| AC-20 happy | a focused handle and the Straighten slider keep Escape and Enter for the tool, and Space presses the tool's buttons | e2e-through-UI | Escape on a focused handle cancels; Enter on the focused slider applies; Space on Rotate right and Apply presses them instead of starting space-pan |
| AC-19 cross-context | the wheel zooms over the crop frame and a space-drag over it pans | e2e-through-UI | the View zooms and pans; the Draft is unchanged |

## Edge cases / error paths

The error ACs each have their own rows above: AC-07, AC-10, AC-15 (authorization) and AC-18. The
spec also implies these boundaries:

- Straighten angle at exactly ±45° → the frame still fits with no empty corner and is at least 1×1.
- A very thin Original (for example 4096×1) at ±45° → the Crop stays at least 1×1 and inside the
  turned image.
- A 1×1 Original → every Rotation, Flip, angle and proportion keeps a 1×1 Crop.
- A Crop centre that would fall outside the turned image after straightening → it moves to the
  nearest point inside (AC-06).
- An odd-sized Original with a centred proportion → the extra pixel goes right or bottom (AC-02).
- A typed size with a decimal comma ("100,5") → accepted as a number and rounded.
- A very long plain decimal in the angle or size field → treated as a number and snapped to the
  range, never an error.
- Scientific notation ("1e2") in the angle or size field → not a number; the previous value comes
  back.
- Escape while a field holds pending text → the text is discarded with the Draft; nothing is
  committed.
- The new image can't be read while the tool is open → open-and-view's failure notice; the tool
  and its Draft stay (AC-17).
- The display is lost while the tool is open → the overlay hides with the canvas area; Cancel still
  works (`screens.md` SCR-03 "display lost").
- A semi-transparent Original whose transparent pixels are all outside the Crop → no transparency
  hint (AC-14).
- A remembered export long side larger than the new Work → it snaps to the Work's size, then comes
  back when the Crop is widened (AC-14).

## Test data

- **Seed strategy.**
  - Unit property tests generate random Original sizes (1×1 up to the Downscale limit, including
    very thin ones) and random Geometries (any Rotation, any Flip, an angle in 0.1 steps, any
    valid Crop).
  - Example tests use small named cases.
  - Integration and component tests build a Work with a small in-memory Original through the
    existing Work factory (`createWork` in `src/core/document.ts`). No decoding is involved.
- **Fixtures for e2e-through-UI.** All of them are **opaque** (see the tolerance decision).
  - An asymmetric, non-square fixture with odd dimensions and a distinct colour per pixel, so every
    Rotation × Flip and every off-by-one shows. It is generated deterministically by
    `e2e/fixtures/generate.sh` and documented in the fixtures README.
  - The existing `ref.png` (four coloured quadrants) for the on-screen left-right checks.
  - A band fixture for "nothing outside the Crop", with a single colour outside the planned Crop
    that appears nowhere inside it, built in the page at run time.
  - The 4096×3072 Work for the load scenarios, built in the page at run time as the export perf
    suite already does.
  - One semi-transparent Original, only for the transparency-hint rows of AC-14.
- **Setting a Geometry.** The 16-combination, straighten and round-trip rows set each Geometry
  through the `setGeometry` test hook (T9). The flow rows drive the real UI.
- **Independent oracle.** The lossless rows compare each exported pixel with the Original pixel
  named by an inverse mapping written in the test itself, not by the shader or by `core`'s
  transform.
- **Integration dependency.** The real editor, export and crop-rotate stores, created fresh. Stores
  are never mocked. The renderer and the export worker are replaced by a recording fake at this
  level only; the real ones run in e2e-through-UI.
- **Cleanup boundary.** Per test. Unit and integration tests create fresh stores in each test, and
  e2e-through-UI tests use a fresh browser context in each test. The Geometry is never persisted,
  so no stored state crosses tests. Downloaded Export files are read from the test's temporary
  output and dropped with it.

## NFR validation (load)

The load/perf tool already in your repo, or e.g. k6 or Locust. Every scenario runs on the reference
machine (Apple M1 MacBook Air, latest stable Chrome) with the 4096×3072 Work, takes p95 over **20
runs after 2 warm-up runs**, and is tagged as a perf test, so it runs by hand rather than on every
PR.

- **Preview while dragging** (§6 row 1) → for each run, drag the crop frame continuously for 2 s
  with one pointer move per display frame, then drag the straighten slider the same way. Assert
  the p95 frame interval is ≤ 33 ms (at least 30 updates per second).
- **Action to updated Preview** (§6 row 2) → for each of rotate, flip, Apply, Cancel and Reset,
  20 runs. Assert p95 from the action to the redrawn Preview is ≤ 150 ms.
- **Tool ready** (§6 row 3) → 20 openings of "Crop and rotate". Assert p95 from the action to the
  tool-ready mark is ≤ 150 ms.
- **Export with a Geometry** (§6 row 4) → a 90° Rotation, a Flip and a 10° Straighten angle, then
  20 full-size exports per format. Assert p95 ≤ 1 s for JPEG at quality 90 and ≤ 2 s for PNG.
- **Memory after 50 Applies** (§6 row 8) → apply 50 Geometry changes in a row (Rotations, Flips,
  Crops and Straighten angles), Chromium only. Assert whole-page memory, measured as export §6
  does it, is ≤ 110% of the memory after the first Apply.

The §6 fidelity and opacity rows carry tolerances, not rates. They are verified by the
e2e-through-UI rows of AC-03, AC-06, AC-12 and AC-14.

## CI placement

- **On every PR:** unit (with property tests), integration and component, together with lint and
  typecheck. These are the fast suites.
- **On every PR, three engines:** e2e-through-UI, the same way the repo's CI already runs the export
  and open-and-view browser suites. This includes the fidelity rows, since a fidelity regression
  must block a merge.
- **By hand before release, on the reference machine:** the load scenarios above (the perf-tagged
  suite).
