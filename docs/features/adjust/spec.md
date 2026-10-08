---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-08"
feature_size: "M"
---

# Spec — adjust

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root; Adjustments added for this feature) and [adjust CONTEXT](./CONTEXT.md) (Auto adjust, Compare, Draft)
> **Reference module / docs / channels used:** `docs/idea-brief.md`, `docs/roadmap.md` (step 5), `docs/architecture-map.md`, `docs/design-system.md`, `docs/adr/0004-render-adjustments-on-webgl2-and-drawing-on-canvas2d.md`, `docs/features/crop-rotate/spec.md`, `docs/features/crop-rotate/adr/` (0002, 0003, 0004), `docs/features/export/spec.md`, `src/core/document.ts`, `src/features/editor/store.ts`. No other channels.

## 1. Context

The Editor often opens a photo whose light or colour is off: too dark, flat, washed out, too blue under shade or too yellow under a lamp. Sometimes they want a black-and-white or vintage look instead. Before drawing on the photo or exporting it, they need to fix that by eye, seeing the result at once, and without the fix eating into the photo for good. The Portfolio reviewer expects brightness, contrast and colour sliders in any image editor and judges the app by how smoothly the Preview follows them.

Why now: adjustments are roadmap step 5 and the second editing tool. Crop and rotate (step 4) has shipped and set the pattern for a tool that edits the Work, and repo ADR 0004 already decided that colour adjustments share the rendering path of the Preview and the Export. The drawing layer (step 6), undo and redo (step 7) and the gallery (step 8) all build on the Adjustments this feature adds to the Work.

Committed approach: **non-destructive Adjustments, edited in one tool.** An "Adjust" tool opens in the same tool slot as "Crop and rotate" and shows seven sliders: brightness, contrast, saturation, temperature, tint, grayscale and sepia. The Preview follows every slider move live, but the Work changes only on **Apply**. **Cancel** returns to the Adjustments the Work had before. **Reset** and a per-slider reset return to neutral values. **Compare** shows the photo without any Adjustments while it is held, and **Auto adjust** sets brightness, contrast, temperature and tint from the photo itself, on the visible sliders only. The Original is never changed: the Work stores only the seven values, so any of them can be changed or reset until the Work is replaced, and the Preview and every Export show exactly the values the Editor applied. This approach was chosen at easy interview depth from the deep-dive and the accepted assumptions ledger (2026-10-08). The ideation analyses did not run at that depth. Comparable browser editors use the same "sliders with live preview, apply or cancel" pattern, and storing the Work as its Original plus parameters is what repo ADR 0003 already plans.

Traceability and deliberate compromises:

- Decision override: Auto adjust is in scope although idea-brief §5 warns that extras like it are the "and so on" that sinks the timeline — rationale: the owner chose it explicitly. Its cost is bounded: it only moves four visible sliders, gives the same values every time for the same Work and Geometry, and never goes beyond ±50 (AC-12, AC-13). It is the first thing cut if the budget slips, before Compare.
- Decision override: Compare (US-04) and the per-slider reset (AC-10) were added by the owner beyond roadmap step 5's wording — rationale: both are small, and Compare is the usual way to judge a colour change by eye.
- Decision: the drawing layer (roadmap step 6) is painted over the adjusted image and is never adjusted itself (root glossary, Adjustments). This fixes a rule step 6 must follow; it does not touch roadmap decision D3.
- Cross-feature change: while the "Adjust" tool is open, Export is unavailable and Ctrl/Cmd+S shows a hint to apply or cancel the adjustments first (AC-16), which narrows export AC-17 the same way crop-rotate AC-16 does.
- Cross-feature change: "Crop and rotate" and "Adjust" share one tool slot. While one is open, the other's button is unavailable and its shortcut shows a hint to apply or cancel the open tool first (AC-18). crop-rotate AC-20 does not cover another tool being open; this feature adds that case, where the C key shows that hint while "Adjust" is open.
- Cross-feature change: the "Crop and rotate" tool shows the image with its applied Adjustments, so the Editor crops what they will export (AC-18).
- The export spec's §1 override asked the first editing feature (crop-rotate) to re-verify export AC-01 and AC-09 with real edits; crop-rotate did, and AC-11 and AC-14 repeat the check with applied Adjustments.
- Decision override: size stays M — rationale: one new tool folder, seven new values on the Work and an extension of the shared rendering path, with Auto adjust and Compare at the upper bound of M. If design shows otherwise, `/sdd:classify-size adjust` re-sizes it.

## 2. Goals

- The Editor can fix the light and colour of any open Work, or give it a black-and-white or sepia look, in one tool, and see every change in the Preview while the slider moves.
- Adjustments never destroy pixels: until the Work is replaced, any applied Adjustment can be changed or reset, and resetting gives back exactly the image from before.
- What the Editor applies is exactly what every Export contains, in every target browser, so later tools (drawing, undo, the gallery) can rely on the Adjustments.

## 3. Non-goals

- Curves, levels, exposure, highlights and shadows, vibrance, hue, blur, sharpen, vignette, noise reduction or any other adjustment beyond the seven. idea-brief §5 moves them after deployment.
- Presets, filters with hidden settings, LUTs or saving one's own looks. Auto adjust is the only automatic action, and it only moves the visible sliders.
- Adjusting part of the image (a brush, a gradient or a selection). Every Adjustment applies to the whole Work, and local edits need masks far beyond this feature's size.
- A histogram or any colour readout. Judging by eye with Compare is the intended way, and a histogram adds a second pixel analysis to keep fast.
- Undo and redo of individual slider changes. That is roadmap step 7; until then Cancel, Reset and the per-slider reset are the ways back.
- Keeping the Adjustments across sessions or copying them to another Work. Persisting a Work is roadmap step 8 (gallery), and a new Work always starts at neutral values.
- Judging whether Auto adjust's result looks good. Only its behaviour is guaranteed (AC-12, AC-13); the look is a matter of taste.

## 4. User stories

### US-01: Make a dull photo lighter or punchier

**As a** Editor
**I want** to change the brightness and contrast of the image with sliders and see the result while I drag
**So that** a dark or flat photo looks the way I remember it

### US-02: Fix the colours

**As a** Editor
**I want** to change the saturation, temperature and tint of the image
**So that** washed-out, too blue or too yellow colours look natural, or as vivid as I want

### US-03: Give the photo a black-and-white or vintage look

**As a** Editor
**I want** to turn the image grayscale or sepia, fully or partly
**So that** I get a classic look without leaving the app

### US-04: See before and after

**As a** Editor
**I want** to hold a control and see the photo without any adjustments, then let go to see my changes again
**So that** I can judge whether my changes actually improve it

### US-05: Change my mind without losing anything

**As a** Editor
**I want** to cancel my changes, reset one slider or all of them, and come back later to change applied values
**So that** trying a look never costs me the original photo

### US-06: Fix a photo in one click

**As a** Editor
**I want** one action that sets brightness, contrast and colour balance for me
**So that** I get a good starting point quickly and can fine-tune it with the sliders

### US-07: Export what I see after adjusting

**As a** Editor
**I want** the Export and the rest of the app to follow the Adjustments I applied
**So that** the saved file looks exactly like the Preview, and other tools show the same image

### US-08: Adjust on the first try

**As a** Portfolio reviewer
**I want** to find the adjust tool and use it by mouse or keyboard without instructions
**So that** I can judge the colour tools in the open, edit and save flow

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** an image is open
**When** the Editor opens the "Adjust" tool, drags the brightness slider to +30 and chooses Apply
**Then** while the slider moves, the Preview shows the Work with the slider's latest value at least 30 times per second (§6); values skipped during a fast drag need not be shown, and the value where the slider stops is always shown. On Apply the tool closes and the Preview keeps showing it. The tool shows seven sliders in this order: brightness, contrast, saturation, temperature and tint from −100 to +100, and grayscale and sepia from 0% to 100%, each with its current value in a number field next to it and its neutral value (0, or 0%) marked. All values are whole numbers. The grayscale and sepia fields hold the bare number with a "%" label next to the field. The tool opens with the Work's current Adjustments, which are neutral for a newly opened Work. After Apply the Work has Unsaved edits (AC-11)

### AC-02 (US-01) — happy path

**Given** the "Adjust" tool is open on any image
**When** the Editor moves the brightness or the contrast slider while the other six values are neutral
**Then** a higher brightness makes the image lighter, so no colour channel of any pixel gets darker, and a lower brightness makes it darker, so no channel gets lighter. A higher contrast makes the parts lighter than mid-grey lighter and the parts darker than mid-grey darker, while mid-grey itself stays the same; a lower contrast moves every tone towards mid-grey. Mid-grey is the stored pixel value 128, 128, 128, which stays 128, 128, 128 at any contrast, and every direction in AC-02 to AC-04 is judged on the stored pixel values

### AC-03 (US-02) — happy path

**Given** the "Adjust" tool is open on any image
**When** the Editor moves the saturation, temperature or tint slider while the other six values are neutral
**Then** a higher saturation makes colours more vivid and a lower one moves them towards grey: at −100 every pixel is a shade of grey, with equal red, green and blue. A pixel that is already grey stays the same at any saturation. A higher temperature makes the image warmer, so on a mid-grey image red rises and blue falls, and a lower temperature does the opposite. A higher tint makes the image more magenta, so on a mid-grey image green falls compared with red and blue, and a lower tint makes it greener. Whether pure black and pure white are tinted is left to design (§8)

### AC-04 (US-03) — happy path

**Given** the "Adjust" tool is open on any image
**When** the Editor sets grayscale or sepia to an amount between 0% and 100%
**Then** the image moves from its colours towards the effect in proportion to the amount. At grayscale 100% and sepia 0%, every pixel has equal red, green and blue, whatever the other values, and each colour keeps its perceived lightness, so a pure yellow becomes a light grey and a pure blue a dark grey. At sepia 100%, every pixel is a brown tone, with red at least as high as green and green at least as high as blue, whatever the other values, grayscale included. Grayscale and sepia act last and override what the other sliders do to colour, so these two rules hold for any combination of values; how the other sliders combine with one another follows the fixed order of AC-07

### AC-05 (US-01) — error

**Given** the "Adjust" tool is open
**When** the Editor types a value in a slider's number field that is outside its range, fractional, empty or not a number
**Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound (−100 or +100, or 0% or 100%), a fractional value rounds to the nearest whole number with an exact half rounding up (2.5 becomes 3, −2.5 becomes −2), and an empty or non-numeric value returns to the previous value. A value is a number under the same rule as crop-rotate AC-07: plain decimal notation with an optional sign and one decimal point or decimal comma, however long; scientific notation such as `1e2` is not a number. In the grayscale and sepia fields a trailing "%" is accepted, so "60%" means 60. Nothing is checked while the Editor is still typing, and pressing Enter in a field only applies the value and does not apply the tool

### AC-06 (US-03) — domain invariant

**Given** an image is open, with or without transparent pixels
**When** the Editor applies any Adjustments
**Then** only colours change: every pixel keeps exactly the transparency it has without Adjustments, the Work keeps its size and its Geometry, and an image with no transparent pixels stays fully opaque, in the Preview and in every Export. With all seven values at their neutral values the Work's pixels are exactly the pixels it would have without any Adjustments, because a neutral value changes no pixel. Every colour rule in AC-02 to AC-04 applies to a pixel's colour independent of its transparency: a partly transparent pixel changes colour exactly as the same fully opaque pixel would, so soft edges get no dark or light fringe

### AC-07 (US-02) — domain invariant

**Given** the "Adjust" tool is open
**When** the Editor reaches the same seven values by different paths, for example setting contrast before brightness or after it, or dragging a slider far out and back
**Then** the Preview, and the Work after Apply, are exactly the same, because the Adjustments are always applied in one fixed order that does not depend on the order in which the Editor changed them. A colour channel pushed past white or black stays at white or black and never wraps round to the opposite end

### AC-08 (US-04) — happy path

**Given** the "Adjust" tool is open with any Draft
**When** the Editor holds the Compare button (with the mouse, or with Space or Enter while it has focus), or holds the \ key while no text field has focus. The \ key is the key in that position on a US keyboard, whatever the keyboard layout
**Then** while it is held, the Preview shows the Work with its Geometry and no Adjustments at all, and a "Before" label is shown over it; when it is released, the Preview shows the Draft again. Compare also ends when the window loses focus or the tool closes. Any change to the Draft while Compare is held (moving a slider, typing a value, Auto, Reset or a per-slider reset) changes the Draft, but the Preview keeps showing "Before" until Compare is released. Compare never changes the Work, the Draft or the Unsaved edits

### AC-09 (US-05) — happy path

**Given** the Editor has changed one or more sliders in the open "Adjust" tool
**When** the Editor chooses Cancel or presses Escape
**Then** the tool closes and the Work keeps the Adjustments it had before the tool was opened, with its Unsaved edits unchanged

### AC-10 (US-05) — happy path

**Given** Adjustments were applied earlier to the open Work
**When** the Editor opens the "Adjust" tool again and resets one slider or all of them
**Then** the tool shows the applied values. Double-clicking a slider, or typing 0 in its field, sets that slider to its neutral value. Reset sets all seven sliders to their neutral values. Both change only the Draft and take effect on Apply; after Reset and Apply, the Work's pixels are exactly the pixels it had before any Adjustment was applied (AC-06), because the Adjustments never change the Original

### AC-11 (US-05) — cross-context

**Given** an image is open
**When** the Editor applies the "Adjust" tool
**Then** the Work has Unsaved edits only when the applied Adjustments differ from the ones the Work had when the tool was opened. The seven values are compared one by one, not by the pixels they produce, and an Apply with no change, or with values changed and then changed back by hand in the same tool, leaves the Unsaved edits as they were. The comparison is only with the values from when the tool was opened: after an Export, changing a value in one Apply and changing it back in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)

### AC-12 (US-06) — happy path

**Given** the "Adjust" tool is open on an image that is not all one colour
**When** the Editor chooses Auto
**Then** the brightness, contrast, temperature and tint sliders move to values computed from the pixels inside the Work's Crop, and the Preview shows the result; saturation, grayscale and sepia stay as they were. The values are computed from the Work with its Geometry and without any Adjustments, and they replace the four sliders' values instead of adding to them, so choosing Auto again gives the same values. The Editor can change the values afterwards, and they reach the Work only on Apply. Fully transparent pixels are ignored

### AC-13 (US-06) — domain invariant

**Given** the "Adjust" tool is open
**When** the Editor chooses Auto
**Then** the values it sets are whole numbers between −50 and +50, so Auto never pushes a slider to an extreme, and the same Work with the same Geometry always gets the same values in the same browser; between the target browsers each value differs by at most 1. When the pixels inside the Crop that are not fully transparent all have the same colour, or there are none, there is nothing to measure: the sliders stay as they were and a hint says there is nothing to correct automatically

### AC-14 (US-07) — cross-context

**Given** Adjustments have been applied to the open Work
**When** the Editor exports it
**Then** the Export contains the Work with its Geometry and its Adjustments, matching the Preview (§6 Fidelity) at full size. An Export at a smaller size is the full-size adjusted Export reduced to that size, so the Adjustments are applied before the size is reduced; its numeric tolerance follows the export spec's open §8 question on smaller sizes. The transparency hint of export AC-15 is shown exactly when it would be without the Adjustments, because they never change transparency (AC-06). An Export never contains a Draft that has not been applied (AC-16)

### AC-15 (US-07) — authorization

**Given** an export is in progress (export AC-11)
**When** the Editor tries to open the "Adjust" tool, by its button or by its keyboard shortcut
**Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export

### AC-16 (US-07) — cross-context

**Given** the "Adjust" tool is open
**When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
**Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the adjustments first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page"

### AC-17 (US-05) — cross-context

**Given** the "Adjust" tool is open with a Draft that is not applied
**When** the Editor opens another image, by the "Open image" action or by dropping a file
**Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with neutral Adjustments. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own

### AC-18 (US-07) — cross-context

**Given** an image is open with applied Adjustments
**When** the Editor opens the "Crop and rotate" tool, or tries to open one tool while the other is open
**Then** the "Crop and rotate" tool shows the whole image with its applied Adjustments, including the area outside the crop frame, so widening the frame never shows a seam, and any Geometry the Editor applies keeps the Adjustments as they are. Only one of the two tools can be open at a time: while one is open, the other's button is unavailable with a hint to apply or cancel the open tool first, and its keyboard shortcut shows the same hint, except while a text field has focus, when the shortcut does nothing (AC-21, crop-rotate AC-20)

### AC-19 (US-01) — error

**Given** no image is open
**When** the Editor looks for the "Adjust" tool or presses its keyboard shortcut
**Then** the tool is unavailable, its hint says to open an image first, and the shortcut shows the same hint

### AC-20 (US-01) — cross-context

**Given** an image is open and the Editor has zoomed and panned the Preview
**When** the Editor opens the "Adjust" tool, zooms or pans while it is open, and then applies or cancels it
**Then** opening the tool does not change the View, zoom and pan keep working inside the tool, and none of them changes the Draft or counts as an edit. After Apply or Cancel the View stays as it was

### AC-21 (US-08) — happy path

**Given** a Portfolio reviewer has opened an image for the first time
**When** they look for a way to change its light or colour
**Then** an "Adjust" action is visible in the toolbar next to "Crop and rotate". It can be reached with Tab and activated with Enter or Space, and the A key opens it as well. The A key does nothing while the export panel is open, while the "Adjust" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With a slider focused, the arrow keys change it by 1 (10 with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-05). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Lightening a photo and keeping it takes three actions (open the tool, drag brightness, Apply), and an automatic fix takes three actions (open the tool, Auto, Apply)

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view, export and crop-rotate. The Work for the timing rows is 4096×3072 px. Each p95 is taken over 20 runs after 2 warm-up runs.

| Aspect | Target | Measurement |
|---|---|---|
| Preview update while dragging any slider | p95 frame interval ≤ 33 ms (at least 30 updates per second) | frame-timing trace in an e2e performance test on the reference machine |
| From choosing Apply, Cancel or Reset, or releasing Compare, to the updated Preview | p95 ≤ 150 ms | e2e performance test on the reference machine |
| From choosing "Adjust" to the tool being ready to use | p95 ≤ 150 ms | e2e performance test on the reference machine |
| From choosing Auto to the sliders and the Preview showing its values | p95 ≤ 300 ms | e2e performance test on the reference machine |
| Export time with all seven Adjustments away from neutral | within export §6 targets: full-size JPEG at quality 90 p95 ≤ 1 s, full-size PNG p95 ≤ 2 s | export's e2e performance test, repeated with all seven values set |
| Fidelity of an adjusted Export | each pixel of a full-size PNG Export within 2 of 255 per channel of the Preview's own rendering of the Work at 100%, compared as in export §6 | e2e pixel comparison on Chromium, Firefox and WebKit for each slider at −100, −50, +50 and +100 (0%, 50% and 100% for grayscale and sepia) and for one setting with all seven values away from neutral, with and without a Geometry |
| Neutral values change nothing | difference 0 per channel between a full-size PNG Export with all values neutral and one of the same Work before any Adjustment was applied | e2e pixel comparison on Chromium, Firefox and WebKit |
| Transparency is kept | 100% of pixels keep their exact transparency at every setting of the fidelity row; an Original with no transparent pixels stays 100% opaque | e2e check on Chromium, Firefox and WebKit |
| Memory after 50 applied Adjustment changes | ≤ 110% of memory after the first Apply | whole-page memory as export §6 measures it, Chromium e2e |

## 6.1 Security / privacy

- **Data classification:** confidential. Users' photos can be personal, and the Adjustments change what leaves the device in an Export.
- **Personal data touched:** none new. The seven Adjustment values are new state on the Work, held in session memory only, and Auto adjust reads only the Work's own pixels on the device. The image pixels of the Original are unchanged.
- **AuthZ/AuthN impact:** none. There are no accounts. The only refusals are the app's own rules: no Adjustment change during an export (AC-15), no Export while the tool is open (AC-16) and one tool at a time (AC-18).
- **Abuse cases:**
  - An Export that does not match what the Editor approved (an unapplied Draft or a Compare view leaking into the file): Export is unavailable while the tool is open (AC-16), and Compare never changes the Work (AC-08).
  - Resource exhaustion through typed values: every value is bounded to its range and to whole numbers (AC-05), and Auto adjust is bounded to ±50 (AC-13), so no setting makes the Work larger or the rendering heavier.
  - Malformed input in the number fields: a very long number in plain decimal notation is a number and snaps to the range, while scientific notation and other non-numeric text are not a number and revert to the previous value (AC-05).
- **Security review:** N/A — no new input from outside the app, no new trust boundary and no new personal data.

## 7. Metrics / KPIs

- **Adjustment fidelity on the reference set** (each slider at −100, −50, +50 and +100, or 0%, 50% and 100%, plus one combined setting, with and without a Geometry, on Chromium, Firefox and WebKit) — baseline: 0 (no feature yet), target: 100% of Exports within the §6 fidelity tolerance, by ship.
- **Actions for a common edit** — baseline: none (no tool yet), target: ≤ 3 actions to lighten a photo and keep it, and ≤ 3 actions for an automatic fix, by ship.
- **Lossless round trip** — baseline: 0, target: for 100% of reference images, applying any Adjustments, then Reset and Apply, gives a full-size PNG Export with a difference of 0 per channel from the Export made before adjusting, by ship.

## 8. Open questions

- [ ] How strong is each slider at its bounds, for example how light does brightness +100 make mid-grey, how far does temperature ±100 shift a grey image, whether pure black and white are tinted, and which greys grayscale 100% gives pure red, green, blue and yellow (the weighting behind "keeps its perceived lightness" in AC-04)? Default now: design chooses the curves so that ±100 is a strong but still usable change, comparable to common browser editors at the same slider position; this spec fixes only the directions (AC-02 to AC-04) and the neutral values. Added by `sdd:clarify` 2026-10-08: the grayscale weighting and black/white tinting. — owner: Blazheiko (owner), due: before `/sdd:design adjust`
- [ ] Should a KPI judge Auto adjust's result on the reference images (for example that the mean lightness of the adjusted image lands within a band around mid-grey), or is its behaviour (AC-12, AC-13) enough? Default now: behaviour only, the look is judged by eye. — owner: Blazheiko (owner), due: before `sdd:plan-tests`
