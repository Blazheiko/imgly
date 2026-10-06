---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-06"
feature_size: "M"
---

# Spec — crop-rotate

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root; Geometry, Crop, Rotation, Flip and Straighten angle added for this feature)
> **Reference module / docs / channels used:** `docs/idea-brief.md`, `docs/roadmap.md` (step 4, decision D3), `docs/architecture-map.md`, `docs/features/export/spec.md`, `docs/features/open-and-view/spec.md`, `src/core/document.ts`, `src/features/editor/`. No other channels.

## 1. Context

The Editor usually opens a photo that is not quite the picture they want. It may be sideways because the camera was held upright, mirrored by a front camera, slightly tilted, or it may include clutter at the edges, or need a set shape for an avatar or a post. Before adjusting or drawing on it, the Editor needs to turn, mirror, level and cut it to the right frame. Because every later edit and every Export builds on that frame, getting it wrong, or losing pixels for good, damages all the work that follows. The Portfolio reviewer expects crop and rotate in any image editor and will try them in the first minute.

Why now: crop and rotate is roadmap step 4, the first editing tool. Export (step 3) is already shipped and verified only with a test-prepared Work. This feature gives the open, edit and save story its first real edit, and it fixes the Geometry that the drawing layer (step 6) and the gallery (step 8) will build on.

Committed approach: **a non-destructive Geometry, edited in one tool.** One "Crop and rotate" tool shows the whole image with a crop frame over it. In the tool the Editor can turn the image in quarter turns, mirror it, level it with a Straighten angle, and set the Crop by dragging, by a fixed proportion or by exact pixel sizes. **Apply** keeps all of it, and **Cancel** restores the Geometry the Work had before. Nothing is cut from the Original: reopening the tool shows the whole image again, so the Crop can always be widened back, and **Reset** returns to no Geometry. The Preview and every Export show exactly the Geometry the Editor applied. This approach was chosen at easy interview depth from the deep-dive and the accepted assumptions ledger (2026-10-06). The ideation analyses did not run at that depth. Comparable browser editors use the same "frame over the whole image, apply or cancel" pattern, and a non-destructive Geometry is what ADR 0003 already plans for storing a Work as its Original plus its parameters.

Traceability and deliberate compromises:

- Roadmap decision D3 (whether the drawing layer stays anchored to the Original when the Geometry changes) is not decided here. It blocks step 6 and is tracked in §8 with today's default.
- The export spec's §1 override says the first editing feature re-verifies export AC-01 and AC-09 with real edits, and the open-and-view §1 override says the same for open-and-view AC-15 (confirming before replacing a Work with Unsaved edits). AC-13 and AC-14 do this with an applied Geometry.
- Cross-feature change: while the "Crop and rotate" tool is open, Ctrl/Cmd+S shows a hint to apply or cancel the crop first instead of opening the export panel (AC-16), which narrows export AC-17. Outside the tool export AC-17 is unchanged.
- Cross-feature change: the status bar shows the Work's size after its Geometry next to the Original's dimensions (AC-01, AC-14), so open-and-view AC-05 and AC-06 still hold.
- Decision override: five interface details beyond the accepted assumptions were added while drafting and kept by the owner: the rule-of-thirds grid while dragging (AC-01), the fine grid while straightening (AC-05), remembering the proportion for the same Work (AC-08), fitting the View after Cancel (AC-19) and blocking Export while the tool is open (AC-16) — rationale: each is small, and AC-16 keeps an Export from containing a Geometry that is not applied.
- Decision override: size stays M — rationale: the owner added four extras to the roadmap's "crop and rotate in 90° steps" (proportions, Flip, Straighten angle, pixel sizes), which puts the feature at the upper bound of M. The Straighten angle (US-04) is the first thing cut if the budget slips, as OS integration is for the roadmap. If design shows otherwise, `/sdd:classify-size crop-rotate` re-sizes it.
- Decision override: the Straighten angle is in scope although idea-brief §7 lists only "crop and 90° rotation" — rationale: the owner chose it explicitly, and it is the extra most worth showing in a portfolio. Its cost is contained by the "no empty corner" rule (AC-06), which avoids any fill or transparency handling.

## 2. Goals

- The Editor can turn, mirror, level and crop any open Work in one tool, and see the result in the Preview straight away.
- The Geometry never destroys pixels: until the Work is replaced, any applied Geometry can be changed or reset, and the area outside the Crop comes back exactly as it was.
- What the Editor applies is exactly what every Export contains, in every target browser, so later editing tools and the Export can rely on the Geometry.

## 3. Non-goals

- Undo and redo of individual Geometry changes. That is roadmap step 7. Until then, Cancel, Reset and widening the Crop are the ways back.
- Keeping the Geometry across sessions. Persisting a Work is roadmap step 8 (gallery).
- Perspective correction, skew, free transform or a Straighten angle beyond ±45°. A larger turn is a Rotation plus a Straighten angle, and the others need resampling far beyond this feature's size.
- Automatic straightening (detecting the horizon) and filling empty corners with generated content. They need image analysis, and the Crop shrinking (AC-06) means empty corners never occur.
- Non-rectangular crops (a circle or a rounded shape). They would add transparency to the Work, which export's JPEG rules then have to handle.
- Scaling the Work up or down. Exporting at a smaller size is already covered by export AC-05, and the Downscale limit bounds the Work.
- Touch gestures such as pinch-to-rotate. Desktop is the target, and on mobile the tool only has to not break (idea-brief §5).
- Turning the View. The View has only zoom and pan; turning the image is always a change to the Work.

## 4. User stories

### US-01: Cut away what I don't want

**As a** Editor
**I want** to drag a crop frame over the image and apply it
**So that** the Work keeps only the part of the photo I care about

### US-02: Turn the image upright

**As a** Editor
**I want** to rotate the image in 90° steps in either direction
**So that** a sideways or upside-down photo is the right way up

### US-03: Mirror the image

**As a** Editor
**I want** to flip the image horizontally or vertically
**So that** a mirrored selfie or scan reads the right way round

### US-04: Level a tilted horizon

**As a** Editor
**I want** to turn the image by a small free angle
**So that** a slightly tilted photo looks level, without empty corners

### US-05: Crop to a set shape

**As a** Editor
**I want** to lock the crop frame to a common proportion such as 1:1 or 16:9
**So that** the result fits an avatar, a post or a screen without manual measuring

### US-06: Crop to an exact size

**As a** Editor
**I want** to see and type the crop size in pixels
**So that** the result meets an exact size a website or a form asks for

### US-07: Change my mind without losing pixels

**As a** Editor
**I want** to cancel, reset or widen a crop I applied earlier
**So that** trying a frame never costs me part of the photo for good

### US-08: Export what I see after cropping

**As a** Editor
**I want** the Export and the rest of the app to follow the Geometry I applied
**So that** the saved file, its size and the warnings I get match the cropped and rotated image

### US-09: Crop and rotate on the first try

**As a** Portfolio reviewer
**I want** to find the crop and rotate tool and use it by mouse or keyboard without instructions
**So that** I can judge the first real edit in the open, edit and save flow

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** an image is open
**When** the Editor opens the "Crop and rotate" tool, drags an edge or a corner of the crop frame inwards, and chooses Apply
**Then** the tool closes, the Preview shows only the area inside the frame, and the size shown for the Work is the Crop's width and height in pixels, followed by the Original's dimensions whenever the width or the height differs, compared in order, so a 90° Rotation alone also shows them (for example "1920×1080, from 4096×3072"), so the Original's dimensions stay visible as open-and-view AC-05 and AC-06 require. While the tool is open, the area outside the frame is dimmed, a rule-of-thirds grid shows inside the frame while it is being dragged, and the whole frame can be moved by dragging inside it. The Work now has Unsaved edits (AC-13)

### AC-02 (US-01) — domain invariant

**Given** the "Crop and rotate" tool is open
**When** the Editor drags the crop frame, an edge or a corner past the edge of the image, or drags an edge past the opposite edge
**Then** the frame stops at the edge of the image and never extends beyond it, and it never becomes smaller than 1×1 px of the image or turns inside out, because a Crop always lies fully inside the image and is never empty. The Crop's width, height and position are always whole numbers of pixels of the image as it stands after its Flip, Rotation and Straighten angle. When centring or resizing around a centre leaves an odd pixel, the frame's left and top edges round down, so the extra pixel goes to the right or the bottom

### AC-03 (US-02) — happy path

**Given** the "Crop and rotate" tool is open
**When** the Editor chooses rotate clockwise or rotate counter-clockwise
**Then** the image turns by exactly 90° in that direction, and the crop frame turns with it, so the same part of the photo stays inside the frame. The width and height of the image and of the frame swap, and a locked proportion turns with it (4:3 becomes 3:4). Four turns in the same direction, or one turn each way, give back the Geometry from before. A Rotation keeps every pixel: nothing is resampled or lost

### AC-04 (US-03) — happy path

**Given** the "Crop and rotate" tool is open, with any Rotation
**When** the Editor chooses flip horizontal or flip vertical
**Then** the image is mirrored as it is currently shown on screen, so flip horizontal always swaps left and right as the Editor sees them, whatever the Rotation, and the crop frame is mirrored with it, keeping the same part of the photo inside. A Flip also changes the sign of the Straighten angle, so a level horizon stays level: an image straightened by +5° shows −5° on the slider after a Flip. Flipping twice the same way gives back the Geometry from before, and a Flip keeps every pixel

### AC-05 (US-04) — happy path

**Given** the "Crop and rotate" tool is open
**When** the Editor drags the straighten slider or types an angle
**Then** the image turns by that angle, from −45° to +45° in steps of 0.1°, around the centre of the crop frame, and the Preview follows while the slider moves. A fine grid shows over the image while the angle changes, so the Editor can line up a horizon. A positive angle turns the image clockwise. The angle is shown next to the slider, and 0° is marked on it

### AC-06 (US-04) — domain invariant

**Given** the "Crop and rotate" tool is open on any image
**When** the Editor sets any Straighten angle
**Then** the crop frame shrinks automatically around its own centre, keeping its proportions, to the largest size that lies fully inside the turned image, so no empty corner can enter the Work. Its width and height round down to whole pixels. The centre stays where it was; it moves only when the centre itself would fall outside the turned image, and then to the nearest point inside it. When the angle moves back towards 0°, the frame does not grow back by itself; the Editor can widen it again. When the Original has no transparent pixels, every pixel of the Work stays fully opaque, in the Preview and in every Export

### AC-07 (US-04) — error

**Given** the "Crop and rotate" tool is open
**When** the Editor types a Straighten angle outside −45° to +45°, with more than one decimal place, or a value that is empty or not a number
**Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound, extra decimals round to the nearest 0.1°, and an empty or non-numeric value returns to the previous angle. A value is a number when it is written in plain decimal notation: digits with an optional sign and one decimal point or decimal comma, however long. Anything else, including scientific notation such as `1e2`, is not a number. Pressing Enter in the field only applies the value and does not apply the tool

### AC-08 (US-05) — happy path

**Given** the "Crop and rotate" tool is open
**When** the Editor chooses a proportion: Free, Original, 1:1, 4:3, 3:2 or 16:9, optionally switched between landscape and portrait
**Then** the crop frame becomes the largest frame of that proportion that fits inside the current frame, centred on it, and keeps that proportion while it is dragged or resized until the Editor chooses Free. Free is the default when the tool opens for a Work for the first time. Original always means the proportions of the image as it stands after its current Rotation, so it follows a later Rotation or Reset. The frame's long side is the input: the short side is the long side divided by the proportion, rounded to the nearest whole pixel, and an exact half pixel rounds up, the same rule as export AC-05. A proportion is kept when the short side is within 0.5 px of the exact value. The tool remembers the chosen proportion and its landscape or portrait orientation for the same Work until the Work is replaced. It is remembered as soon as it is chosen, even if the tool is then cancelled

### AC-09 (US-06) — happy path

**Given** the "Crop and rotate" tool is open
**When** the Editor looks at the size fields, or types a width or a height in pixels
**Then** the fields always show the crop frame's current width and height in whole pixels, and they update while the frame is dragged. A typed value resizes the frame around its centre, moving it only as far as needed to stay inside the image. With a proportion locked, the side the Editor typed is the input, whether it is the long or the short side, and the other side is the typed side multiplied or divided by the proportion, rounded to the nearest whole pixel with an exact half pixel rounding up, as in AC-08. The width and height shown are exactly the size the Work has after Apply, and exactly the size of a full-size Export

### AC-10 (US-06) — error

**Given** the "Crop and rotate" tool is open
**When** the Editor types a width or height that is larger than fits, zero or negative, fractional, empty or not a number
**Then** the value is checked when the Editor leaves the field or presses Enter in it, following the input rules of export AC-04: a fractional value rounds to the nearest whole number, an empty or non-numeric value returns to the previous value, zero or a negative value becomes 1, and a value larger than fits becomes the largest size that fits inside the image at the current Straighten angle, with the locked proportion if there is one. With no proportion locked, the other side stays as it is and only the typed side is limited. A value is a number under the same rule as AC-07. Nothing is checked while the Editor is still typing. Pressing Enter in a field only applies the value and does not apply the tool

### AC-11 (US-07) — happy path

**Given** the Editor has changed the Rotation, Flip, Straighten angle or crop frame in the open tool
**When** the Editor chooses Cancel or presses Escape
**Then** the tool closes and the Work keeps the Geometry it had before the tool was opened, with its Unsaved edits unchanged

### AC-12 (US-07) — domain invariant

**Given** a Crop was applied earlier to the open Work
**When** the Editor opens the "Crop and rotate" tool again
**Then** the tool shows the whole image with the current Rotation, Flip and Straighten angle, and the crop frame where the Crop is, so the Editor can widen it. Widening the frame back to the whole image and applying gives exactly the pixels the Work had before the Crop, because the Geometry never removes pixels from the Original. Reset in the tool returns to no Geometry (no Rotation, no Flip, a Straighten angle of 0° and the Crop covering the whole image), sets the proportion to Free, and takes effect only on Apply

### AC-13 (US-07) — cross-context

**Given** an image is open
**When** the Editor applies the "Crop and rotate" tool
**Then** the Work has Unsaved edits only when the applied Geometry differs from the Geometry the Work had when the tool was opened. Two Geometries are compared field by field (horizontal Flip, vertical Flip, Rotation, Straighten angle and Crop), not by the pixels they produce, so a horizontal and a vertical Flip applied to a Work that had a 180° Rotation count as a change. Four quarter turns, flipping twice, or an Apply with no change leave the Unsaved edits as they were. The comparison is only with the Geometry from when the tool was opened: after an Export, changing the Geometry and then changing it back by hand in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)

### AC-14 (US-08) — cross-context

**Given** a Geometry has been applied to the open Work
**When** the Editor exports it
**Then** the Export contains the Work with its Geometry, matching the Preview (§6 Fidelity), and no pixel from outside the Crop. The Work's full size in the export panel is the Crop's size in pixels; the size presets and the long-side field of export AC-05 and AC-06 count from it, and a remembered size larger than the new Work snaps to it. Snapping does not replace the remembered size: a remembered long side in pixels comes back, up to the Work's full size, when the Crop is widened again. The transparency hint of export AC-15 is shown only when a pixel inside the Crop is not fully opaque. The size shown for the Work in the status bar is the Crop's size, with the Original's dimensions next to it as in AC-01

### AC-15 (US-08) — authorization

**Given** an export is in progress (export AC-11)
**When** the Editor tries to open the "Crop and rotate" tool, by its button or by its keyboard shortcut
**Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export

### AC-16 (US-08) — cross-context

**Given** the "Crop and rotate" tool is open
**When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
**Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the crop first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page", so an Export never contains a Geometry the Editor has not applied

### AC-17 (US-08) — cross-context

**Given** the "Crop and rotate" tool is open with changes that are not applied
**When** the Editor opens another image, by the "Open image" action or by dropping a file
**Then** the tool stays open with its changes until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its changes that were not applied are discarded with the old Work. If the new image cannot be opened or the replacement is declined, the tool stays open with its changes. Changes in the open tool that are not applied never count as Unsaved edits on their own

### AC-18 (US-01) — error

**Given** no image is open
**When** the Editor looks for the "Crop and rotate" tool or presses its keyboard shortcut
**Then** the tool is unavailable, its hint says to open an image first, and the shortcut shows the same hint

### AC-19 (US-01) — cross-context

**Given** an image is open
**When** the Editor opens the "Crop and rotate" tool, zooms or pans while it is open, and then applies or cancels it
**Then** on opening, the View fits the whole image with its current Rotation, Flip and Straighten angle, so every edge of the frame can be reached. Zoom and pan keep working inside the tool, and they never change the Geometry or count as an edit. After Apply or Cancel, the View fits the Work

### AC-20 (US-09) — happy path

**Given** a Portfolio reviewer has opened an image for the first time
**When** they look for a way to crop or turn it
**Then** a "Crop and rotate" action is visible in the toolbar next to Export. It can be reached with Tab and activated with Enter or Space, and the C key opens it as well. The C key does nothing while the export panel is open, while the tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With the frame focused, the arrow keys move it by 1 px of the image (10 px with Shift). With a frame edge or corner focused, they resize it by the same step, and with a proportion locked the other side follows as in AC-08. With the straighten slider focused, they change the angle by 0.1° (1° with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-07, AC-10). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Rotating once and keeping it takes three actions (open the tool, rotate, Apply), and cropping to a square takes three actions (open the tool, choose 1:1, Apply)

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view and export. The Work for the timing rows is 4096×3072 px. Each p95 is taken over 20 runs after 2 warm-up runs.

| Aspect | Target | Measurement |
|---|---|---|
| Preview update while dragging the crop frame or the straighten slider | p95 frame interval ≤ 33 ms (at least 30 updates per second) | frame-timing trace in an e2e performance test on the reference machine |
| From choosing rotate, flip, Apply, Cancel or Reset to the updated Preview | p95 ≤ 150 ms | e2e performance test on the reference machine |
| From choosing "Crop and rotate" to the tool being ready to use | p95 ≤ 150 ms | e2e performance test on the reference machine |
| Export time with any applied Geometry, including a Straighten angle | within export §6 targets: full-size JPEG at quality 90 p95 ≤ 1 s, full-size PNG p95 ≤ 2 s | export's e2e performance test, repeated with a 90° Rotation, a Flip and a 10° Straighten angle |
| Fidelity of Rotation, Flip and Crop without a Straighten angle | each pixel of a full-size PNG Export is within 2 of 255 per channel of the Original pixel it comes from | e2e pixel comparison on Chromium, Firefox and WebKit for all 16 Rotation × Flip combinations (4 Rotations × no Flip, horizontal, vertical, both), with and without a Crop |
| Fidelity with a Straighten angle | full-size PNG Export within 2 of 255 per channel of the Preview's own rendering of the Work at 100%, compared as in export §6 | e2e pixel comparison on Chromium, Firefox and WebKit at −45°, −0.1°, +1° and +45° |
| Opaque images stay opaque | 100% of pixels fully opaque after any Straighten angle, for an Original with no transparent pixels | e2e check on Chromium, Firefox and WebKit at the same angles |
| Memory after 50 applied Geometry changes (Rotations, Flips, Crops, Straighten angles) | ≤ 110% of memory after the first Apply | whole-page memory as export §6 measures it, Chromium e2e |

## 6.1 Security / privacy

- **Data classification:** confidential. Users' photos can be personal, and the Geometry decides which part of them leaves the device in an Export.
- **Personal data touched:** none new. The Geometry (Rotation, Flip, Straighten angle and Crop) is new state on the Work, held in session memory only, and the image pixels are unchanged.
- **AuthZ/AuthN impact:** none. There are no accounts. The only refusals are the app's own rules: no Geometry change during an export (AC-15) and no Export while the tool is open (AC-16).
- **Abuse cases:**
  - Leaking a cropped-out area (someone crops out a face or an address and shares the Export): the Export never contains pixels from outside the Crop (AC-14), and the file is plain pixels with no hidden layers or metadata (export AC-16).
  - Resource exhaustion through typed sizes or angles: sizes are bounded by the image and angles by ±45° (AC-07, AC-10), so the Work can never grow beyond the Downscale limit.
  - Malformed input in the size and angle fields: a very long number in plain decimal notation is a number and snaps to the allowed range, while scientific notation and other non-numeric text are not a number and revert to the previous value (AC-07, AC-10).
- **Security review:** N/A — no new input from outside the app, no new trust boundary and no new personal data. The one privacy rule (AC-14, nothing outside the Crop) is verified by tests.

## 7. Metrics / KPIs

- **Geometry fidelity on the reference set** (16 Rotation × Flip combinations, each with and without a Crop, plus Straighten angles of −45°, −0.1°, +1° and +45°, on Chromium, Firefox and WebKit) — baseline: 0 (no feature yet), target: 100% of Exports within the §6 fidelity tolerances, by ship.
- **Actions for a common edit** — baseline: none (no tool yet), target: ≤ 3 actions to rotate an image once and keep it, and ≤ 3 actions to crop it to a square, by ship.
- **Lossless round trip** — baseline: 0, target: for 100% of reference images, applying a Crop, then Reset and Apply, gives a full-size PNG Export within 2 of 255 per channel of the Export made before the Crop, by ship.

## 8. Open questions

- [ ] When the drawing layer exists (roadmap step 6), does it stay anchored to the Original, so it moves, turns and is cropped together with the image when the Geometry changes later? This is roadmap decision D3. Default now: yes, the drawing is anchored to the Original's pixels and follows the Geometry. — owner: Blazheiko (owner), due: before `/sdd:specify` of roadmap step 6
- [ ] Is the §6 tolerance of 2 of 255 per channel between a straightened full-size PNG Export and the Preview's rendering at 100% achievable and enough in all three browser engines, especially for the pixels along the edges of the Crop? Default now: yes, the same tolerance as export §6. — owner: Blazheiko (owner), due: before `sdd:plan-tests`
- [ ] The export spec's §8 question on the save point (whether undoing back to the exported state clears Unsaved edits) was due before this feature re-verifies export AC-09. AC-13 settles the case without undo (changing the Geometry back by hand still counts as an edit), so only the undo case is left, and this feature adds no undo. Should its due move to roadmap step 7? Default now: yes, it moves to step 7 (undo and redo). — owner: Blazheiko (owner), due: before `/sdd:specify` of roadmap step 7
