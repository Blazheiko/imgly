---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-09"
feature_size: "M"
---

# Spec — draw

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root; Drawing layer and Stroke added for this feature) and [draw CONTEXT](./CONTEXT.md) (Brush, Clear, Draft, Eraser)
> **Reference module / docs / channels used:** `docs/idea-brief.md`, `docs/roadmap.md` (step 6, decision D3), `docs/architecture-map.md`, `docs/adr/0003-persist-works-in-indexeddb-as-original-plus-params-plus-layer.md`, `docs/adr/0004-render-adjustments-on-webgl2-and-drawing-on-canvas2d.md`, `docs/features/adjust/spec.md`, `docs/features/open-and-view/screens.md` (§Keyboard), `src/features/*/shortcuts.ts`, `src/features/editor/store.ts`. No other channels.

## 1. Context

The Editor often wants to mark something on a photo before sharing it: circle a detail, underline a word on a screenshot, add an arrow or a quick handwritten note. Today they have to export the image and draw on it in another program, which defeats the point of a quick offline editor. The Portfolio reviewer expects a brush in any image editor and tries it as part of the open, edit and save flow.

Why now: drawing is roadmap step 6 and the third editing tool. Crop and rotate (step 4) and Adjust (step 5) have shipped and set the pattern for a tool that edits the Work. The root glossary already says the drawing layer is painted over the adjusted image and is never adjusted, and repo ADR 0003 plans to store a Work as its Original plus parameters plus a separate drawing layer. Undo and redo (step 7) and the gallery (step 8) both build on the Drawing layer this feature adds to the Work.

Committed approach: **one non-destructive Drawing layer, edited in one tool.** A "Draw" tool opens in the same tool slot as "Crop and rotate" and "Adjust". It has two modes, the Brush and the Eraser, a colour palette with a custom colour, one width for both modes, and a Clear action. Strokes appear under the pointer as the Editor draws, but they reach the Work only on **Apply**, and **Cancel** returns to the Drawing layer the Work had before, the same Draft pattern as the other two tools. The Drawing layer is attached to the image, not to the screen or the crop frame: when the Editor later turns, flips, straightens or crops the image, every mark stays on the part of the photo it was drawn on, and a mark hidden by a narrower Crop comes back when the Crop is widened. The Original is never changed: the Eraser removes only marks, and clearing the layer gives back exactly the image from before. This approach was chosen at easy interview depth (2026-10-09). The owner chose two points explicitly, the Draft with Apply and Cancel and the layer attached to the image, and the rest comes from the accepted assumptions ledger. The ideation analyses did not run at that depth.

Traceability and deliberate compromises:

- Decision: roadmap decision D3 is closed. The Drawing layer is attached to the Original's coordinates, so it follows every later Geometry change (AC-08). This keeps the idea brief's "re-edit yesterday's crop under an existing drawing" promise (idea-brief §6, "Fixed pipeline order") and matches the non-destructive Crop in the root glossary.
- Decision: strokes reach the Work only on Apply, like the other tools. Until undo and redo arrive (step 7), Cancel, the Eraser and Clear are the only ways back. Whether step 7 undoes each Stroke or each Apply is §8's open question.
- Cross-feature change: while the "Draw" tool is open, Export is unavailable and Ctrl/Cmd+S shows a hint to apply or cancel the drawing first (AC-15). This narrows export AC-17 the same way crop-rotate AC-16 and adjust AC-16 do.
- Cross-feature change: "Crop and rotate", "Adjust" and "Draw" share one tool slot. While one is open, the others' buttons are unavailable and their shortcuts show a hint to apply or cancel the open tool first (AC-16). This extends the one-tool rule of adjust AC-18 to a third tool, and the shortcut hints of crop-rotate AC-20 (the C key) and adjust AC-21 (the A key) to the "Draw" tool being open.
- Cross-feature change: the "Crop and rotate" tool shows the whole image with its marks, and the "Adjust" tool, including its Compare "Before" view, shows the Drawing layer over the image unchanged (AC-11). The Drawing layer is never adjusted (root glossary, Adjustments).

## 2. Goals

- The Editor can draw and write freehand on any open Work in the colour and width they choose, see each Stroke as they draw it, and remove mistakes with the Eraser, without leaving the app.
- Drawing never destroys pixels of the image: the Eraser and Clear uncover exactly the image beneath, and the Drawing layer stays on the same part of the photo through every later crop, turn, flip or straighten.
- What the Editor applies is exactly what every Export contains, in every target browser, so later steps (undo and redo, the gallery) can rely on the Drawing layer.

## 3. Non-goals

- Shapes, arrows, straight-line or rectangle tools, text and stickers. idea-brief §5 moves them after deployment, and a freehand arrow is still possible with the Brush.
- Brush opacity, softness, texture, blend modes, pen pressure or tilt. The brief asks for colour and width only, and Strokes are fully opaque with smooth edges.
- Selecting, moving or restyling a Stroke after it is drawn, or more than one Drawing layer. idea-brief §5 rules out per-stroke vector editing, and applied Strokes merge into one layer.
- Undo and redo. That is roadmap step 7, and whether one undo step removes one Stroke or one Apply of the tool is §8's open question. Until then Cancel, the Eraser and Clear are the ways back.
- Keeping the drawing across sessions. Persisting a Work is roadmap step 8 (gallery), and a new Work always starts with an empty Drawing layer.
- Touch-first drawing on phones and tablets. Desktop is the target (idea-brief §5); a pen or a finger works like a mouse, but touch gestures are not designed for.

## 4. User stories

### US-01: Draw freehand on the photo

**As a** Editor
**I want** to draw on the image with a brush by dragging across it and see the line appear under the pointer
**So that** I can circle, underline or write on the photo without another program

### US-02: Pick the colour and width

**As a** Editor
**I want** to choose the brush colour from a palette or any colour I like, and set the line width
**So that** my marks stand out on the photo and are as thick or thin as I need

### US-03: Fix mistakes

**As a** Editor
**I want** to erase parts of what I drew, or clear the whole drawing, without touching the photo
**So that** a slip of the hand never costs me the image underneath

### US-04: Change my mind about a drawing session

**As a** Editor
**I want** to keep what I drew with Apply or throw it all away with Cancel
**So that** trying something out never spoils what I had before

### US-05: Keep marks in place when I crop or turn later

**As a** Editor
**I want** my drawing to stay on the same part of the photo when I crop, turn, flip or straighten it afterwards
**So that** a circle around a face still circles that face after I change the framing

### US-06: Export what I see after drawing

**As a** Editor
**I want** the Export and the other tools to show the drawing I applied, exactly as the Preview shows it
**So that** the saved file looks exactly like what I approved

### US-07: Draw on the first try

**As a** Portfolio reviewer
**I want** to find the draw tool and its controls by mouse or keyboard without instructions
**So that** I can judge the drawing tool in the open, edit and save flow

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** an image is open
**When** the Editor opens the "Draw" tool, drags across the image with the Brush and chooses Apply
**Then** while the pointer moves, the Stroke appears under it at least 30 times per second (§6) as one continuous line of the chosen colour and width, with round ends and smooth edges and no visible gaps or corners on a fast curve. The line passes through every pointer position the browser reports, including the coalesced positions between frames, joined smoothly; no stabiliser moves it away from those positions, and it does not change after the pointer is released. A click without moving paints one round dot of that width. On Apply the tool closes and the Preview keeps showing the Stroke over the image. The tool always opens with the Brush selected, with the colour and width last chosen in this session (red #E53935 and 12 px the first time), and with the Work's applied Drawing layer, which is empty for a newly opened Work. After Apply the Work has Unsaved edits (AC-12)

### AC-02 (US-02) — happy path

**Given** the "Draw" tool is open
**When** the Editor picks a colour from the palette or from the custom colour picker, or sets the width with its slider or number field
**Then** every Stroke made afterwards uses that colour and width, and Strokes already made keep theirs. The palette shows 10 preset colours in this order: black #000000, white #FFFFFF, red #E53935 (the first-time colour), orange #FB8C00, yellow #FDD835, green #43A047, cyan #00ACC1, blue #1E88E5, purple #8E24AA and pink #D81B60. The chosen colour is marked when it is one of them, and the custom picker offers any fully opaque colour. The width is a whole number of image pixels from 1 to 200, so a Stroke looks thicker when the Editor zooms in and has exactly that width in a full-size Export. Over the image the pointer shows a circle outline of the current width at the current zoom. The Brush and the Eraser share the width. The colour and the width are remembered as soon as they are chosen, whether the tool is then applied or cancelled, until the app is reloaded, also when another image is opened. They are tool settings, not edits, and never count as Unsaved edits. The mode is not remembered: the tool always opens on the Brush (AC-01)

### AC-03 (US-02) — error

**Given** the "Draw" tool is open
**When** the Editor types a width that is outside 1 to 200, fractional, empty or not a number
**Then** the value is checked when the Editor leaves the field or presses Enter in it: a value outside the range snaps to the nearest bound (1 or 200), a fractional value rounds to the nearest whole number with an exact half rounding up (2.5 becomes 3), and an empty or non-numeric value returns to the previous width. A value is a number under the same rule as crop-rotate AC-07 and adjust AC-05: plain decimal notation with an optional sign and one decimal point or decimal comma, however long; scientific notation such as `1e2` is not a number. A trailing "px" is accepted in any letter case and with or without spaces before it, so "20px", "20 px" and "20PX" all mean 20. Nothing is checked while the Editor is still typing, and pressing Enter in the field only applies the value and does not apply the tool

### AC-04 (US-03) — happy path

**Given** the "Draw" tool is open on a Work whose Drawing layer has marks, applied earlier or drawn in this Draft
**When** the Editor selects the Eraser and drags across some of the marks, or clicks on one
**Then** the marks under the Eraser's path, at the current width, disappear, and inside that path the image shows exactly as it does where nothing was ever drawn. A click without moving erases one round dot of the current width, as a Brush click paints one; it never removes a whole Stroke, because Strokes drawn in this Draft merge into the layer just as applied ones do. The Eraser has smooth edges like the Brush, so at the edge of its path a mark may keep a partly transparent fringe up to 1 px wide. Where nothing is drawn the Eraser changes nothing: it never removes, lightens or makes transparent any pixel of the image itself. The change takes effect on Apply like any other Stroke

### AC-05 (US-03) — happy path

**Given** the "Draw" tool is open on a Work whose Drawing layer has marks
**When** the Editor chooses Clear
**Then** every mark disappears from the Preview at once, without a confirmation. Clear empties the whole Drawing layer: the marks applied earlier and the marks hidden outside a narrower Crop (AC-08) are removed too, so widening the Crop after Clear and Apply shows no mark. Clear changes only the Draft: Apply makes the empty Drawing layer the Work's, and Cancel brings back the marks applied before the tool was opened. Strokes drawn after Clear in the same Draft are kept

### AC-06 (US-04) — happy path

**Given** the Editor has drawn, erased or cleared in the open "Draw" tool
**When** the Editor chooses Cancel or presses Escape
**Then** the tool closes and the Work keeps the Drawing layer it had before the tool was opened, with its Unsaved edits unchanged

### AC-07 (US-03) — domain invariant

**Given** an image is open, with or without transparent pixels
**When** the Editor applies any mix of Brush Strokes, Eraser Strokes and Clear
**Then** the image's own pixels never change: everywhere no mark lies, the Preview and a full-size PNG Export show exactly the pixels the Work has with an empty Drawing layer, and after Clear and Apply a full-size PNG Export is identical to one made before anything was drawn. Brush marks are fully opaque, so inside a mark every pixel has the mark's colour, and only its smooth edge blends with the image beneath. Where a mark lies over a transparent part of the image, the Preview and the Export show the mark's colour there; everywhere else the image keeps exactly its own transparency. These exact guarantees apply to the Preview and to a full-size PNG Export. A JPEG or WebP Export, or one at a smaller size, is that full-size result encoded or reduced as the export spec defines, so pixels next to a mark may change there

### AC-08 (US-05) — domain invariant

**Given** the Work has applied marks on its Drawing layer
**When** the Editor applies any Geometry in "Crop and rotate": a Rotation, a Flip, a Straighten angle or a new Crop
**Then** every mark stays on the same part of the image: it turns, flips and straightens together with the image and keeps its shape and width relative to it. A mark outside a narrower Crop is hidden, not removed, and shows again when the Crop is widened to include it. Turning the image four quarter turns in either direction, or flipping it twice in the same direction, gives a full-size PNG Export identical to the one made before

### AC-09 (US-01) — domain invariant

**Given** the "Draw" tool is open
**When** a Stroke starts, passes or ends outside the Work's Crop, for example in the area around the image
**Then** the Stroke is drawn at its full width along the whole pointer path and then clipped to the Crop: only the painted area that lies inside the Crop is painted or erased, and the rest leaves no mark. So a wide Stroke whose pointer path runs just outside a Crop edge paints the band of it that reaches inside, as the width circle shows, and a press just outside paints the part of its round dot that lies inside. Widening the Crop later shows no mark from the parts that were outside

### AC-10 (US-06) — cross-context

**Given** marks have been applied to the open Work
**When** the Editor exports it
**Then** the Export contains the Work with its Geometry and its Adjustments and the Drawing layer on top, matching the Preview (§6 Fidelity) at full size. The Drawing layer is never adjusted, so a red mark is exported as the same red at any Adjustments, grayscale 100% included. An Export at a smaller size is the full-size Export, marks included, reduced to that size. The transparency hint of export AC-15 is shown exactly when the drawn result still has a transparent pixel inside the Crop. An Export never contains a Draft that has not been applied (AC-15)

### AC-11 (US-06) — cross-context

**Given** the Work has applied marks on its Drawing layer
**When** the Editor opens the "Adjust" tool or the "Crop and rotate" tool, or opens the "Draw" tool on a Work with applied Geometry and Adjustments
**Then** in the "Adjust" tool the Preview shows the marks over the image unchanged by the Draft, and Compare's "Before" view shows them too, because Adjustments never touch the Drawing layer. The "Crop and rotate" tool shows the whole image with all its marks, including the ones outside the crop frame, so widening the frame shows them where they will be. In the "Draw" tool the Editor draws over the image as it stands with its Geometry and its applied Adjustments

### AC-12 (US-04) — cross-context

**Given** an image is open
**When** the Editor applies the "Draw" tool
**Then** the Work has Unsaved edits when the applied Draft contains at least one change: a Brush Stroke with any painted part inside the Crop, or an Eraser Stroke or a Clear that removed any mark. The layer is not compared pixel by pixel, so drawing a mark and erasing it again in the same Draft still counts as a change. An Apply with no Stroke, with Brush Strokes only outside the Crop, with an Eraser Stroke only where nothing was drawn, or with a Clear of an already empty Drawing layer leaves the Unsaved edits as they were, as an Apply with no change does in crop-rotate AC-13 and adjust AC-11. The comparison is only with the Drawing layer from when the tool was opened: after an Export, drawing a mark in one Apply and erasing it in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)

### AC-13 (US-04) — cross-context

**Given** the "Draw" tool is open with a Draft that is not applied
**When** the Editor opens another image, by the "Open image" action or by dropping a file
**Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with an empty Drawing layer. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own

### AC-14 (US-06) — authorization

**Given** an export is in progress (export AC-11)
**When** the Editor tries to open the "Draw" tool, by its button or by its keyboard shortcut
**Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export

### AC-15 (US-06) — cross-context

**Given** the "Draw" tool is open
**When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
**Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the drawing first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page"

### AC-16 (US-06) — cross-context

**Given** an image is open
**When** the Editor tries to open one of the "Crop and rotate", "Adjust" and "Draw" tools while another of them is open
**Then** only one of the three tools can be open at a time: while one is open, the other two buttons are unavailable with a hint to apply or cancel the open tool first, and their keyboard shortcuts show the same hint, except while a text field has focus, when the shortcuts do nothing. This extends the one-tool rule of adjust AC-18 and the shortcut behaviour of crop-rotate AC-20 (the C key) and adjust AC-21 (the A key) to the "Draw" tool

### AC-17 (US-01) — error

**Given** no image is open
**When** the Editor looks for the "Draw" tool or presses its keyboard shortcut
**Then** the tool is unavailable, its hint says to open an image first, and the shortcut shows the same hint

### AC-18 (US-01) — cross-context

**Given** an image is open and the Editor has zoomed and panned the Preview
**When** the Editor opens the "Draw" tool, zooms or pans while it is open, and then applies or cancels it
**Then** opening the tool does not change the View, apart from what the narrower canvas area needs while the tool panel is open: a View at Fit re-fits, and a pan is clamped to stay valid, as when the "Adjust" panel opens. Inside the tool a drag with the main mouse button draws instead of panning, while the other View controls keep working: Ctrl/Cmd+wheel and pinch zoom, the plain wheel and Shift+wheel pan, a drag with Space held pans, and the zoom keys and controls work as in open-and-view. One exception keeps AC-19's width keys: on a layout where a key right of P types an unshifted `+` (for example German, Spanish, Italian and Portuguese), that key steps the width while the tool is open, and the numpad `+` and the zoom controls zoom in (on these layouts `=` is Shift+0, which is 100%). On every other layout `=` and a shifted `+` still zoom in as well. While a button in the tool has focus, Space presses that button and does not pan, as Space-drag does outside the Compare button in the "Adjust" tool; while a text field has focus, Space types. None of them makes a Stroke, changes the Draft or counts as an edit, and a Stroke in progress is not broken by a zoom. While a Stroke is in progress (the pointer is still pressed), input waits for it to finish: a colour, mode or width change (by control or by B, E, [ or ]) applies from the next Stroke, Space does not start a pan, and Enter applies the tool only after the pointer is released. Escape cancels the tool at once, the partial Stroke included (AC-06). A pointer cancel, the window losing focus or a second touch (for example the start of a pinch) ends the Stroke where it is and keeps what was drawn so far. After Apply or Cancel the View stays as it was

### AC-19 (US-07) — happy path

**Given** a Portfolio reviewer has opened an image for the first time
**When** they look for a way to draw on it
**Then** a "Draw" action is visible in the toolbar next to "Adjust". It can be reached with Tab and activated with Enter or Space, and the D key opens it as well, under the same rule as the A key for "Adjust": the letter d, or the D key itself on a layout that types no Latin letter there. The D key does nothing while the export panel is open, while the "Draw" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab; B selects the Brush and E selects the Eraser under the same letter-first rule, silent in a text field. [ and ] make the width 1 smaller or larger, and 10 with Shift held. Each is recognised by the character it types ([ or ]) or, on a layout that does not type that character there, by its key position (the two keys right of P), so Shift+[ works although it types "{" and the German ü and + keys work too. Holding the key repeats the change, the result stays within 1 to 200 (195 plus 10 gives 200), and both are silent in a text field. Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-03). Escape cancels the tool from anywhere in it, including a field. Drawing a mark itself needs a mouse, a pen or a finger. Circling something and keeping it takes three actions: open the tool, draw, Apply

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view, export, crop-rotate and adjust. The Work for the timing rows is 4096×3072 px. Each p95 is taken over 20 runs after 2 warm-up runs. The drawing rows are measured twice, with the View at Fit and at 100%, and both must pass. Scripted pointer moves arrive at 120 per second. "Covered by marks over the whole image" means 200 px Brush Strokes 100 px apart that together cover every pixel of the image. "A Stroke across the whole image" means one 200 px Brush Stroke from one edge of the image to the opposite edge.

| Aspect | Target | Measurement |
|---|---|---|
| Preview update while drawing a Stroke with the Brush or the Eraser | p95 frame interval ≤ 33 ms (at least 30 updates per second), at the widest width of 200 px and at 1 px | frame-timing trace in an e2e performance test on the reference machine |
| From a pointer move to the frame that shows the Stroke reaching that point | p95 ≤ 50 ms | e2e performance test on the reference machine, scripted pointer moves |
| From choosing "Draw" to the tool being ready to draw | p95 ≤ 150 ms | e2e performance test on the reference machine |
| From choosing Apply, Cancel or Clear to the updated Preview | p95 ≤ 150 ms, with the Drawing layer covered by marks over the whole image | e2e performance test on the reference machine |
| From choosing Apply in "Crop and rotate" to the updated Preview, with marks over the whole image | p95 ≤ 150 ms | e2e performance test on the reference machine |
| Export time with marks over the whole image | within export §6 targets: full-size JPEG at quality 90 p95 ≤ 1 s, full-size PNG p95 ≤ 2 s | export's e2e performance test, repeated with a full Drawing layer |
| Fidelity of an Export with marks | each pixel of a full-size PNG Export within 2 of 255 per channel of the Preview's own rendering of the Work at 100%, compared as in export §6 | e2e pixel comparison on Chromium, Firefox and WebKit, for a reference drawing with Strokes at 1, 12 and 200 px in the 10 preset colours plus erased parts, with no Geometry, with each Rotation, with a Flip, a Straighten angle and a Crop, and with all seven Adjustments away from neutral |
| An empty Drawing layer changes nothing | difference 0 per channel between a full-size PNG Export after Clear and Apply and one of the same Work before anything was drawn | e2e pixel comparison on Chromium, Firefox and WebKit |
| Marks stay on the image through Geometry round trips | difference 0 per channel between a full-size PNG Export before and after four quarter turns, and before and after two Flips in the same direction | e2e pixel comparison on Chromium, Firefox and WebKit |
| Memory after 50 Applies, each with a new Stroke across the whole image | ≤ 110% of memory after the first Apply | whole-page memory as export §6 measures it, Chromium e2e |

## 6.1 Security / privacy

- **Data classification:** confidential. Users' photos can be personal, and a drawing can add handwriting, names or redactions that leave the device in an Export.
- **Personal data touched:** none new. The Drawing layer is new state on the Work, held in session memory only, and it never leaves the device except in an Export the Editor asks for. The image pixels of the Original are unchanged.
- **AuthZ/AuthN impact:** none. There are no accounts. The only refusals are the app's own rules: no drawing tool during an export (AC-14), no Export while the tool is open (AC-15) and one tool at a time (AC-16).
- **Abuse cases:**
  - An Export that does not match what the Editor approved (an unapplied Draft leaking into the file): Export is unavailable while the tool is open (AC-15), and an export in progress refuses the tool (AC-14).
  - A mark used to hide something, such as a black bar over a name: Brush marks are fully opaque (AC-07), so an Export never lets the covered pixels show through. The Original still holds them until the Work is replaced, which is the non-destructive promise, and the Export is the only copy that leaves the device.
  - Resource exhaustion by drawing for a long time: the Drawing layer is one layer the size of the Original, so memory does not grow with the number of Strokes (§6 memory row).
  - Malformed input in the width field: very long numbers in plain decimal notation snap to the range, while scientific notation and other text revert to the previous width (AC-03).
- **Security review:** N/A — no new input from outside the app, no new trust boundary and no new personal data.

## 7. Metrics / KPIs

- **Drawing fidelity on the reference set** (the §6 reference drawing on each Geometry case and with Adjustments, on Chromium, Firefox and WebKit) — baseline: 0 (no feature yet), target: 100% of Exports within the §6 fidelity tolerance, by ship.
- **Actions for a common annotation** — baseline: none (no tool yet; today the image must be exported and drawn on elsewhere), target: ≤ 3 actions to circle something and keep it (open the tool, draw, Apply), by ship.
- **Marks stay aligned through re-editing** — baseline: 0, target: for 100% of reference cases (each Rotation, each Flip, a Straighten angle, narrowing and then widening the Crop) every mark lands on the same image content as before, checked by pixel comparison against the expected Export, by ship.

## 8. Open questions

- [x] Does opening the tool keep the View exactly, even when its panel narrows the canvas area? Resolved by review 2026-10-10 (S7): no, the layout re-fit and pan clamp stay, as in "Adjust"; AC-18 now says so. — owner: Blazheiko
- [ ] When undo and redo arrive (roadmap step 7), does one undo step remove one Stroke inside the open "Draw" tool, or one whole Apply of the tool? Default now: one Apply, like "Crop and rotate" and "Adjust"; this feature keeps no per-Stroke history. — owner: Blazheiko (owner), due: before `/sdd:design draw`
