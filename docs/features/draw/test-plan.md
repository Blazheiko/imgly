---
status: Draft
owner: "Blazheiko"
reviewers: ["Blazheiko (implementing engineer)", "Tech Lead"]
updated_at: "2026-10-10"
feature_size: "M"
---

# Test plan — draw

One "Draw" tool paints on the Work's Drawing layer with a Brush and an Eraser. It has 10 preset
colours plus a custom colour, one width from 1 to 200 image pixels, Clear, Apply and Cancel. Strokes
follow the pointer live, through every reported position. The layer lies on the Original's pixel
grid, so it follows every Geometry. It is painted over the adjusted image and never adjusted. It
never changes the image's own pixels. Every Export matches the Preview at 100% on Chromium, Firefox
and WebKit.

Inputs: `spec.md` §5 (AC-01 to AC-19), §6 and §7; `sad.md` §5, §6 (F1 to F7), §8, §10 (QG-1a to
QG-3) and §11; ADR-0001 to ADR-0005; `ux-flows.md` (the e2e-through-UI scripts); `screens.md` SCR-03
(the component states, the keyboard table and the message catalog); `tasks.json` (T1 to T20).
`target_surfaces: [web-frontend]`, so the frontend tiers apply.

## Decisions taken in this plan

- **Levels (chosen by the owner).** Every AC group runs at every level that has something to check:
  - Rules (AC-02, AC-03, AC-19's width steps, and the footprint and coordinate maps behind AC-08,
    AC-09, AC-12 and AC-18): unit (with property tests), integration, component and e2e-through-UI.
  - Tool flows (AC-01, AC-04 to AC-06, AC-18, AC-19): unit, integration, component and
    e2e-through-UI.
  - Invariants and fidelity (AC-07 to AC-10): unit, integration, component (the `PreviewCanvas`
    layer choice) and e2e-through-UI.
  - Cross-feature (AC-11 to AC-17): unit (the message catalog), integration, component and
    e2e-through-UI.
- **The painter has a recording 2D context (chosen by the owner).** The simulated DOM used for
  component and integration tests has no Canvas 2D. A new `src/render/drawing/fake-2d.ts` therefore
  records the calls: composite operation, `setTransform`, `clip`, `arc`, `bezierCurveTo`,
  `lineWidth`, `lineCap` and `save`/`restore`. It returns set pixels for `readRect` and
  `hasAnyMark`, the way `src/render/fake-gl.ts` does for WebGL. It holds the order clip → transform →
  paint, the Eraser's `destination-out` and the dirty rectangle on every PR. Real antialiasing and
  real erasing are held only by e2e-through-UI. The fake is kept in step with the calls the painter
  actually makes: a painter test asserts that it uses no 2D method the fake lacks.
- **No visual-regression (chosen by the owner, as in adjust).** Mark pixels are checked by
  comparisons with a stated tolerance. The palette, the swatches, the selected ring and the width
  circle are checked by component tests. No baseline images are kept.
- **Fidelity tolerance (follows `sad.md` §11, High risk).** Every pixel comparison compares within one
  engine. Export is compared with the Preview, or the same Work before and after, never a layer
  across engines, because Canvas 2D antialiasing differs between Skia, Gecko and Core Graphics.
  - Preview-to-Export rows (QG-1a): **2 of 255 per channel** on all three engines.
  - Empty layer and Geometry round-trip rows (QG-1b, QG-2a): **difference 0**.
  - "Image unchanged outside the marks" (QG-2c): difference 0 outside a mask of the drawn area,
    widened by 1 px at Eraser edges for AC-04's fringe.
  - An engine that misses 2/255 at mark edges is recorded as an engine deviation with its own ADR,
    as adjust ADR-0005 did. The tolerance is never loosened silently.
- **The AC-12 change flag has its own oracle.** The six QG-2d cases are integration rows against the
  real `editor` store. Pixel comparison can't tell "drawn and erased again" from "never drawn", so
  the e2e rows assert only the replace confirmation and the cleared flag after Export.
- **Bitmap ledger.** Every create and release goes through `render/drawing` and is counted
  (ADR-0001, ADR-0004). Integration rows assert the count after each close path. The e2e hooks expose
  it, so each e2e flow ends with an assertion on the retained count. A missed release fails CI before
  the memory scenario would.
- **Contract is N/A.** The only boundary between participants is the main thread ↔ export worker
  message, which gains `layer: ImageData | null`. Both sides import one shared type, so the
  typecheck gate is the contract check, and the e2e fidelity rows exercise the real message.

## Levels

| Level | Scope | Strategy (generic — no tool names) |
|---|---|---|
| Unit | Pure `src/core/draw` rules: `PALETTE`, the defaults, `parseWidth`, `stepWidth`, `catmullRomSegments`, `segmentBounds`, `footprintReachesCrop`. `frameToOriginal` in `src/core/geometry` and `deviceToFrame` in `src/core/view`. The hint catalog in `src/features/draw/messages.ts` and the export refusal text. | In memory, no DOM. Example tests for the named cases, plus **property tests** that generate hundreds of random widths, strings, point sequences, Geometries, Crops and Views, each asserting one invariant. |
| Integration | (a) `src/render/drawing` (layer and painter) against the **recording 2D context**, and the shader and export worker against the **recording GL**: `u_layer`, `u_draw`, the dirty-rectangle upload, one pass or two, the alpha check with the layer. (b) The `draw` store working with the **real** `editor`, export, crop-rotate and adjust stores: Draft, settings, the Stroke session, Clear, Apply, Cancel, the change flag, the tool slot and its refusals, replacing the Work, the bitmap ledger. | (a) The recording fakes record calls and return set pixels. Real Canvas 2D and WebGL are checked only in e2e-through-UI. (b) A fresh set of real stores per test, never a mocked store. Nothing is persisted, so there is no datastore to start. Only the renderer, the painter's 2D context and the export worker are replaced, each by a recording fake. |
| Contract | <!-- N/A: the main thread ↔ export worker message is one shared TypeScript type; the typecheck gate is the contract check, and the e2e fidelity rows exercise the real message. --> | — |
| E2E | Covered by E2E-through-UI: every flow in this feature is driven through the UI. | — |
| Load | The numeric §6 timing and memory NFRs, on the reference machine. | The load/perf tool already in your repo (the existing perf-tagged browser suite, run by hand with the perf switch), or e.g. k6 or Locust. |
| Component | `DrawAction`, `DrawTool`, `DrawControls`, `DrawOverlay`, the `SegmentedControl` swatch option, `PreviewCanvas` (which layer it passes), and the changed `ExportAction`, `CropRotateAction` and `AdjustAction`. Each SCR-03 state in `screens.md` is a case. | Mount the component with real stores and the recording fakes, without booting the app. Assert the rendered output, focus order, keyboard handling, pointer handling and store calls. |
| Visual-regression | <!-- N/A: decided by the owner; mark pixels are checked by comparisons with a stated tolerance, and the panel's layout by component tests. --> | — |
| E2E-through-UI | The `ux-flows.md` flows in a real browser on Chromium, Firefox and WebKit: real pointer drags and clicks over the WebGL Preview, a real Export download decoded back to pixels, file open and drop, keyboard shortcuts on real layouts, Space-drag, the wheel, window blur. | The app's own hooks-enabled build. Fixtures open through the real open path. A test hook paints the reference drawing through the same painter where a test needs many marks (T8). `previewAt100()` renders with the layer, and the hooks expose the bitmap ledger. Each test gets a fresh browser context. |

## AC coverage

Test names are intent-based. Level tokens: `unit`, `integration`, `component`, `e2e-through-UI`.

**Narrowed on purpose** marks a row with no test at its level. The repo limits e2e to what a
simulated DOM can't do (WebGL, Canvas 2D pixels, real downloads, real focus and hit-testing), so
these ACs are held by the rows named in the cell.

| AC (spec.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 happy | the curve passes through every given point and a single point is a dot | unit | `catmullRomSegments` gives Bézier segments whose ends are exactly the input points, in order; one point gives a dot; two equal points give a dot; no point is moved (no stabiliser) |
| AC-01 happy | a segment's bounds hold its whole painted footprint (property) | unit | for random points and widths, every point of the curve widened by half the width lies inside `segmentBounds` |
| AC-01 happy | the defaults are red #E53935 and 12 px | unit | `DEFAULT_COLOUR` and `DEFAULT_WIDTH` have those values |
| AC-01 happy | the painter paints a segment as one round-capped line of the colour and width | integration | the recording 2D context shows `source-over`, round caps and joins, the colour, `lineWidth` equal to the width, one `bezierCurveTo` per segment, and a filled `arc` for a dot |
| AC-01 happy | opening copies the applied layer into a Draft, a Stroke paints into it, and Apply hands it to the Work | integration | the Draft is a new bitmap equal to the applied layer, or `null` for a new Work; the mode is Brush; after Apply the Work holds the Draft with a new layer id, the old layer is released, the tool is closed and Unsaved edits are raised |
| AC-01 happy | coalesced positions all reach the painter, and the Preview gets one dirty rectangle per frame | integration | each coalesced position becomes a curve point; several pointer moves in one frame cause one `layerChanged` with their union; nothing is painted after release |
| AC-01 happy | the overlay feeds the Stroke session with coalesced positions and falls back without them | component | the session receives every position of `getCoalescedEvents()`; without that method it receives the event's own position; the pointer is captured on press and released on release |
| AC-01 happy | the tool opens on the Brush with the last colour and width | component | "Brush" is selected; the Red swatch and 12 px the first time; the last chosen colour and width after that |
| AC-01 happy | a drag draws a continuous line under the pointer that does not change after release | e2e-through-UI | the Preview read during the Stroke shows the line through each scripted position; after release the Preview is identical to the read just before release; no gap along a fast curve (Chromium, where coalesced events are reliable) |
| AC-01 happy | a click without moving paints one round dot, and Apply keeps the Stroke | e2e-through-UI | a filled disc of the width centred on the click; after Apply the tool is closed, the Preview shows the Stroke and Unsaved edits are raised; all three engines |
| AC-02 happy | the palette has 10 colours in the specified order | unit | `PALETTE` equals black, white, red, orange, yellow, green, cyan, blue, purple and pink with the AC-02 hex values, in that order |
| AC-02 happy | colour and width apply to later Strokes only, and are remembered until reload, not the mode | integration | a Stroke after a change uses the new colour and width, and earlier Strokes keep theirs; after Apply, after Cancel and after another image opens, reopening shows the last colour and width and the Brush; a colour or width change never raises Unsaved edits |
| AC-02 happy | the palette shows 10 swatches with names, and marks the chosen one or none for a custom colour | component | 10 swatches in AC-02's order, each with its colour, name and tooltip; the chosen swatch has the selected ring; a custom colour equal to a preset selects that preset; any other custom colour selects no preset and rings the custom swatch |
| AC-02 happy | the custom colour input offers only opaque colours and sets the colour | component | the native colour input's value becomes the Draft colour; it has no alpha |
| AC-02 happy | the width circle has the width times the zoom, for the Brush and the Eraser | component | the circle's diameter equals width × zoom in device pixels; it follows a width change and a zoom change; the system cursor is hidden over the image |
| AC-02 happy | the swatch option of the shared segmented control | component | a `swatch` option draws a filled square inside the border token, keeps arrow-key navigation, and accepts `modelValue: null` |
| AC-02 happy | a Stroke at 20 px in a full-size Export is 20 px wide, and thicker on screen when zoomed in | e2e-through-UI | the Export's horizontal Stroke measures 20 px across its opaque core (±1 px antialiased edge); the on-screen width at 200% is twice that at 100% (not on WebKit on Linux, which now and then leaves the WebGL canvas out of page screenshots; the Export width is checked there too) |
| AC-03 error | a typed value out of range snaps to the nearest bound | unit | "0" gives 1; "250" gives 200; "−5" gives 1; a very long plain decimal snaps to the range |
| AC-03 error | a fractional value rounds half up | unit | "2.5" gives 3; "2.4" gives 2; "2,5" (decimal comma) gives 3; a fraction longer than a double holds rounds from its digits ("2.49999999999999999999" gives 2) |
| AC-03 error | an empty, non-numeric or scientific-notation value returns to the previous width | unit | "", "abc", "1e2" and "px" keep the previous width |
| AC-03 error | a trailing "px" is accepted in any case and with spaces before it | unit | "20px", "20 px", "20PX" and "20  Px" give 20; "px20" is not a number |
| AC-03 error | the result is always a whole number in 1..200 or the previous width (property) | unit | for random strings, `parseWidth` returns an integer in 1..200 or "keep previous" |
| AC-03 error | a corrected width reaches the store only on commit | integration | the width changes only when the field is left or Enter is pressed, and holds the corrected value |
| AC-03 error | the field checks only on leaving or Enter, and Enter in it never applies the tool | component | while typing the width and the circle stay as before; the corrected value shows after Tab or Enter; Enter in the field leaves the tool open |
| AC-03 error | typing an invalid width in a real browser corrects it | e2e-through-UI | "250" then Enter shows 200; "2.5" then Tab shows 3; "1e2" then Tab shows the previous width; "20 PX" then Enter shows 20; the tool stays open |
| AC-04 happy | the Eraser paints with `destination-out` and never touches the image | integration | the recording 2D context shows `destination-out` on the Drawing layer's context only; the Original's texture is never written |
| AC-04 happy | an Eraser click removes one round dot, not a whole Stroke | integration | the recorded calls for a click are one filled `arc` of the width under `destination-out` |
| AC-04 happy | E and the "Eraser" button select the Eraser, and the shared width carries over | component | the mode shows "Eraser"; the width and the circle are unchanged; the colour controls stay enabled |
| AC-04 happy | erasing across a mark uncovers the image exactly | e2e-through-UI | inside the Eraser path, with its 1 px edge excluded, the Preview at 100% equals the Work with no layer (difference 0); a click erases a disc; erasing where nothing is drawn changes no pixel; all three engines — **Narrowed on purpose (review 2026-10-10):** inside an Eraser path the check is Export-equals-no-layer on the hook-painted reference drawing's erased paths (QG-2c in `fidelity.spec.ts`, full-size Exports, not the Preview), with the Preview tied to the Export by the Export-vs-`previewAt100` fidelity rows (QG-1); the disc and the no-change rows run through the UI (`tool.spec.ts`) |
| AC-05 happy | Clear makes the Draft empty and keeps later Strokes | integration | after Clear the Draft is `null` and its bitmap released; `setPreviewLayer(null)` is sent; a Stroke after Clear creates a new bitmap; Apply gives the Work `null`; Cancel brings back the applied layer |
| AC-05 happy | Clear removes marks hidden outside a narrower Crop too | integration | a layer with a mark outside the Crop is `null` after Clear and Apply |
| AC-05 happy | the Preview shows no marks at once after Clear | component | `PreviewCanvas` passes `null` to `setLayer` while the Draft is empty, not the Work's layer |
| AC-05 happy | the "Clear" button asks no confirmation | component | one click empties the Draft; no dialog opens |
| AC-05 happy | Clear and Apply, then widening the Crop, shows no mark | e2e-through-UI | after widening, the Preview at 100% equals the Work with no layer; all three engines |
| AC-06 happy | Cancel and Escape keep the layer from before and leave Unsaved edits unchanged | integration | after drawing, erasing or Clear and then Cancel, the Work's layer is the same object as before, the Draft is released, and the revision is unchanged |
| AC-06 happy | Escape cancels from anywhere in the tool, including a field and a Stroke in progress | component | Escape in the width field discards the pending text and cancels; Escape with the pointer still pressed cancels at once with the partial Stroke; focus returns to the "Draw" action |
| AC-06 happy | cancelling in a real browser shows the Work as before | e2e-through-UI | after Escape, the Preview's pixels and Unsaved edits equal those from before the tool opened; the ledger shows no retained Draft |
| AC-07 invariant | an applied empty Draft is no layer | unit | the Draft after Clear, and a Draft with no Stroke on a Work without a layer, apply as `null` |
| AC-07 invariant | `u_draw` is off with no layer, so the shader skips the layer block | integration | the recording GL shows `u_draw` false for a `null` layer and true for a layer; the layer is composited after the Adjustments (ADR-0003) |
| AC-07 invariant | the painter writes only the Drawing layer's own context | integration | every recorded 2D call goes to the layer's context; Brush calls use an opaque colour (alpha 1) |
| AC-07 invariant | Clear and Apply give an Export identical to one before anything was drawn | e2e-through-UI | difference 0 per channel on a full-size PNG Export; on an opaque and on a transparent fixture; all three engines (QG-1b) |
| AC-07 invariant | outside the marks the image keeps exactly its own pixels and transparency | e2e-through-UI | outside the mask of the drawn area, difference 0 from the Export with no layer; inside a Brush mark's core every pixel has the mark's colour, opaque, also over transparent parts of the image; all three engines (QG-2c) |
| AC-08 invariant | four quarter turns and two Flips map the frame back to the Original exactly (property) | unit | for random Originals, Crops and Straighten angles, `frameToOriginal` after four quarter turns or two Flips in the same direction equals the original mapping |
| AC-08 invariant | `frameToOriginal` agrees with the existing UV transform | unit | for random Geometries and frame points, `frameToOriginal` equals `cropToOriginalUv` scaled to pixels, within floating-point tolerance |
| AC-08 invariant | a Geometry Apply keeps the Work's layer object and only changes how it is drawn | integration | after a Crop and rotate Apply the Work's `drawing` is the same layer with the same id; no bitmap is created or released |
| AC-08 invariant | marks follow each Rotation, Flip, Straighten angle and Crop | e2e-through-UI | the Export after the Geometry equals the expected Export computed in that engine from the same layer through `frameToOriginal` (spec §7 KPI, QG-2b); all three engines |
| AC-08 invariant | four quarter turns or two Flips give an identical Export | e2e-through-UI | difference 0 per channel on a full-size PNG Export, in both directions; all three engines (QG-2a) |
| AC-08 invariant | a mark outside a narrower Crop is hidden and shows again when widened | e2e-through-UI | the narrowed Export has no mark pixels; after widening, the Export equals the one from before narrowing; all three engines |
| AC-09 invariant | the footprint test counts any painted part inside the Crop (property) | unit | `footprintReachesCrop` is true exactly when the segment widened by half the width overlaps the Crop; a pointer path just outside an edge with a wide width is true; a 1 px path 2 px outside is false; also with a Straighten angle |
| AC-09 invariant | `deviceToFrame` inverts the View for one point | unit | for random zooms, pans and points, mapping a frame point to the device and back gives the same point |
| AC-09 invariant | every segment is painted at full width under a clip to the Crop | integration | the recording 2D context shows `clip` to the Crop's path before the transform and the stroke, for the Brush and the Eraser; the width is not reduced near the edge |
| AC-09 invariant | the overlay takes presses that start outside the image | component | a press in the area around the image starts a Stroke; the width circle shows there |
| AC-09 invariant | a Stroke across the Crop edge paints only inside it | e2e-through-UI | the band of a wide Stroke whose pointer path runs just outside an edge is painted inside; a press just outside paints the inside part of its dot; widening the Crop later shows nothing from outside, without a Straighten angle exactly, with one within a 1 px fringe (`sad.md` §11); all three engines — covered through the UI in `tool.spec.ts` (review 2026-10-10): the band and the press at a plain Crop edge, and a Stroke dragged across a straightened Crop whose marks reach at most 1 px beyond it; the painter's Straighten clip row (`painter.test.ts`) pins the transform and the clip rectangle |
| AC-10 cross-context | the export snapshot carries the applied layer, never the Draft | integration | the snapshot's `drawing` is the Work's layer; with the tool open no snapshot is made |
| AC-10 cross-context | the worker composites the layer in one pass at full size and two passes when smaller | integration | the recording GL shows the layer texture bound and `u_draw` true; full size gives one pass; a smaller size with a layer gives a full-size pass into a texture then a mipmapped reduction |
| AC-10 cross-context | the transparency check renders with the layer and keys its cache on the layer id | integration | with a layer, the identity short-cut is skipped; a new layer id misses the cache; the opaque-Original short-cut still answers "no" |
| AC-10 cross-context | an Export with marks matches the Preview at 100% | e2e-through-UI | for the reference drawing (1, 12 and 200 px, the 10 preset colours, erased parts) with no Geometry, each Rotation, a Flip, a Straighten angle with a Crop, and all seven Adjustments away from neutral, each pixel of a full-size PNG Export is within 2/255 per channel of `previewAt100()`; all three engines (QG-1a, spec §7 KPI) |
| AC-10 cross-context | marks are never adjusted | e2e-through-UI | at grayscale 100% a red #E53935 mark's core is exported as #E53935 (±2/255); all three engines |
| AC-10 cross-context | a smaller Export is the full-size Export with marks, reduced | e2e-through-UI | a smaller Export matches the full-size Export reduced to that size, within the tolerance export already uses for smaller sizes |
| AC-10 cross-context | the transparency hint follows the drawn result | e2e-through-UI | on the transparent fixture, the hint shows with marks covering some transparent pixels and is gone when they cover all inside the Crop; alpha outside the marks equals the Export with no layer; all three engines (QG-1d) |
| AC-11 cross-context | Adjust and Crop and rotate draw the Work's layer, Draw draws over the Geometry and the Adjustments | integration | with "Adjust" open the renderer gets the Work's layer and the Draft Adjustments; Compare's neutral values leave the layer set; with "Crop and rotate" open the renderer gets the whole image and the whole layer; with "Draw" open it gets the Work's Geometry, the applied Adjustments and the Draft |
| AC-11 cross-context | `PreviewCanvas` passes the Draft only while the "Draw" tool is open | component | `setLayer` gets `previewLayer` with "Draw" open and `work.drawing` otherwise, including with "Adjust" and "Crop and rotate" open |
| AC-11 cross-context | marks show in Adjust, its "Before" view and Crop and rotate | e2e-through-UI | in "Adjust" a red mark stays red while grayscale is 100% and while Compare is held; in "Crop and rotate" a mark outside the frame is visible with no seam when the frame is widened (pixel read on Chromium, as crop-rotate does for the WebGL canvas); all three engines for visibility |
| AC-12 cross-context | Apply raises Unsaved edits only with a real change | integration | no Stroke, Brush Strokes only outside the Crop, an Eraser Stroke only where nothing was drawn, and Clear of an empty layer leave the revision as it was; a mark drawn and erased in one Draft raises it (QG-2d) |
| AC-12 cross-context | the comparison is with the layer at open, not with the last Export | integration | after an Export, a mark drawn in one Apply and erased in a later Apply leaves Unsaved edits raised |
| AC-12 cross-context | the Eraser's change flag is set only when it lowered alpha | integration | the recording 2D context reports alpha lowered in the dirty rectangle only where a mark lay; the flag stays false otherwise |
| AC-12 cross-context | pressing Apply with no change closes the tool without an edit | component | the tool closes; Unsaved edits are unchanged; after a Stroke inside the Crop, Apply raises them |
| AC-12 cross-context | after an applied mark, opening another image asks to confirm, and an Export clears Unsaved edits | e2e-through-UI | the replace confirmation shows; after a successful Export it no longer does |
| AC-13 cross-context | the tool keeps its Draft until the new image is read and the replacement confirmed | integration | the Draft is kept while reading; on confirm the tool closes, the Draft is released, and the new Work's layer is `null` |
| AC-13 cross-context | the tool keeps its Draft when the new image fails or the replacement is declined | integration | the Draft, its bitmap and the tool state are unchanged; the ledger count is unchanged |
| AC-13 cross-context | a Draft never counts as Unsaved edits on its own | integration | with an unapplied Draft and no applied change, replacing asks no confirmation |
| AC-13 cross-context | "Open image" stays available while the tool is open, and a declined replace keeps focus in the tool | component | the action is enabled; after declining with Esc the tool stays open with its Draft and focus inside it |
| AC-13 cross-context | dropping a file while drawing, then confirming or declining | e2e-through-UI | decline keeps the tool and its Draft; confirm shows the new Work with no marks and the tool closed; an unreadable file keeps the tool; the ledger has no retained Draft after confirm |
| AC-14 authorization | the tool refuses to open while an export is in progress | integration | `openTool('draw')` is refused and not queued; the tool doesn't open when the export ends |
| AC-14 authorization | the action is disabled and D does nothing during an export | component | the button is truly disabled; pressing D changes nothing |
| AC-14 authorization | during a real export the tool can't be opened | e2e-through-UI | **Narrowed on purpose:** held by the integration and component rows; an export in a real browser is too short to aim a key press at reliably (as in adjust AC-15) |
| AC-15 cross-context | the export refusal names the drawing | unit | the catalog text for draw is "Apply or cancel the drawing first, then export."; the crop-rotate and adjust texts are kept |
| AC-15 cross-context | Export is refused while the tool is open | integration | the export does not start; no snapshot is taken; the draw hint is raised |
| AC-15 cross-context | Export is unavailable and Ctrl/Cmd+S shows the hint while the tool is open | component | Export shows unavailable; the shortcut's default is prevented and the hint toast shows |
| AC-15 cross-context | Ctrl/Cmd+S with the tool open never opens "Save page" or downloads | e2e-through-UI | no download and no browser save dialog; the hint toast is visible; all three engines |
| AC-16 cross-context | the hint for another open tool is generic | unit | "Apply or cancel the open tool first." is the catalog entry for the "Draw" action and the D key |
| AC-16 cross-context | only one of the three tools opens at a time | integration | opening "Draw" while "Crop and rotate" or "Adjust" is open is refused, and the reverse; each tool's open and close keep their side effects (crop-rotate still fits the View, draw keeps it) |
| AC-16 cross-context | the tool slot keeps the editor store's API and tests unchanged | integration | the editor store's existing tests pass unchanged after the extraction to `tool-slot.ts` (T1) |
| AC-16 cross-context | each action and key show "apply or cancel the open tool first" while another tool is open | component | "Crop and rotate" and "Adjust" show unavailable with the hint while "Draw" is open, and "Draw" while either is open; C, A and D show the hint toast, and do nothing while a text field has focus |
| AC-16 cross-context | the refusals in a real browser, in each direction | e2e-through-UI | with "Draw" open, C and A and their buttons show the hint; with "Adjust" or "Crop and rotate" open, D and the "Draw" button show it; all three engines |
| AC-17 error | the tool refuses to open with no image | integration | `openTool('draw')` is refused with no Work |
| AC-17 error | the action shows "open an image first" and D shows the same hint | unit + component | the catalog has the text; the button is unavailable with the hint; pressing D shows the hint toast |
| AC-17 error | with no image, the action and D give the hint in a real browser | e2e-through-UI | the hint shows and the tool does not open |
| AC-18 cross-context | opening, applying and cancelling leave the View alone | integration | zoom and pan are unchanged by open, Apply and Cancel; `openTool('draw')` keeps the Crop |
| AC-18 cross-context | input during a Stroke applies from the next Stroke, and Enter waits for release | integration | a colour, mode or width change while pressed leaves the current Stroke's colour, mode and width; Apply requested while pressed runs after release; Escape while pressed cancels at once |
| AC-18 cross-context | a pointer cancel, a blur or a second touch ends the Stroke and keeps it | integration | the Stroke ends with what was painted; no further segment is painted; the Draft keeps it |
| AC-18 cross-context | a zoom during a Stroke does not break it, and View changes never touch the Draft | integration | positions after the zoom map through the new View into the same Stroke; the Draft and the revision are unchanged by zoom and pan alone |
| AC-18 cross-context | a main-button drag draws, Space-drag pans, and Space on a button presses it | component | the overlay takes a main-button drag; with `spacePan` set it lets the drag through to the pan gesture; Space with a button focused presses it; Space in the width field types; Space while pressed does not start a pan |
| AC-18 cross-context | zoom and pan around drawing in a real browser | e2e-through-UI | zoom and pan before opening are kept; a drag draws; Space-drag pans; Ctrl/Cmd+wheel zooms and the plain wheel pans; a zoom during a Stroke keeps one Stroke; window blur mid-Stroke keeps what was drawn; the View is the same after Apply and after Cancel; all three engines |
| AC-18 cross-context | with the tool open the zoom keys still zoom, except an unshifted `+` on a key right of P, which steps the width (AC-19) | component | `EditorView.test.ts`: `+` on BracketLeft and BracketRight is left to the tool, `=` and a shifted `+` zoom (Dvorak, US), and the numpad `+` zooms; `DrawTool.test.ts` with `EditorView` mounted: the German and Portuguese `+` step the width and keep the zoom, Dvorak `=` zooms (review 2026-10-10, R1) |
| AC-19 happy | the width steps by 1, or 10 with Shift, and stays in range (property) | unit | `stepWidth` gives ±1 and ±10; 195 + 10 gives 200; 5 − 10 gives 1; for random widths the result is in 1..200 |
| AC-19 happy | D, B, E, [ and ] are recognised by character first, then by key position | unit | "d" and the D key code open; on a layout with no Latin letter there the code works; Shift+[ (typing "{") steps by −10; the German ü and + keys step by ∓1 by position |
| AC-19 happy | the action sits after "Adjust", opens with D, and D is guarded | component | it follows "Adjust" in the top bar; D opens it, and does nothing with the export panel open, with the tool open, or with a text field focused — **Narrowed on purpose:** Enter and Space open it only through native button activation, which the simulated DOM doesn't emulate, so they are asserted in a real browser |
| AC-19 happy | inside the tool Tab reaches every control and the keys work | component | the Tab order is mode, swatches, custom colour, width slider, width field, Clear, Cancel, Apply; B and E select the mode; [ and ] step the width and repeat while held; they are silent in a text field; Enter on a focused button presses only that button; Enter elsewhere applies; Escape cancels; focus goes into the tool on open and back to the action on close |
| AC-19 happy | circling something and keeping it takes three actions, by mouse and by keyboard to the tool | e2e-through-UI | Draw, a drag, Apply gives a Work with the mark; D, a drag, Enter does too; Tab to "Draw" and Enter or Space open it; [ and ] work on a German layout; Space on Apply presses it instead of starting a pan (spec §7 KPI); all three engines — **Narrowed on purpose (review 2026-10-10):** a browser test cannot switch the keyboard layout, so the German keys are held by the component test with `EditorView` and `DrawTool` mounted together (`DrawTool.test.ts`) and the key-position unit rows (`shortcuts.test.ts`) |

## Edge cases / error paths

The error and authorization ACs each have their own rows above: AC-03 (error), AC-14
(authorization) and AC-17 (error). The spec and the SAD also imply these boundaries:

- Width 1 px and 200 px at the image's corner → painted within the Crop only, no exception from the
  painter or the dirty rectangle (clamped to the layer).
- A 1×1 Work → the tool opens; a click paints the one pixel; Clear and Apply give back the image.
- A Brush Stroke on a Work with no layer yet → the first painted segment creates the bitmap, which
  the ledger counts once; an Apply with no Stroke creates none.
- Drawing only outside the Crop on a Work with no layer → Apply leaves the Work's layer `null` and
  Unsaved edits as they were (AC-12).
- An Eraser Stroke on a Work with no layer → nothing is created, nothing changes.
- A layer the Eraser has emptied by hand → kept as a layer, not `null` (accepted debt, `sad.md`
  §11), and its Export equals the Work with no layer (difference 0).
- `getCoalescedEvents` missing → the event's own position is used and the line stays continuous
  (`sad.md` §11).
- A second pointer pressed during a Stroke (pinch start) → the first Stroke ends and is kept; the
  pinch zooms.
- The pointer leaves the window while pressed → pointer capture keeps the Stroke until release or
  cancel.
- Escape while a Stroke is in progress → the partial Stroke goes with the Draft; the Draft bitmap is
  released.
- A held [ or ] at the bound → the width stays at 1 or 200; no extra Draft change.
- A held D key's repeats → no repeated toasts or toggles.
- A custom colour equal to a preset → that preset shows as selected.
- The display is lost while the tool is open → open-and-view's display-lost message; the panel's
  controls, Clear, Cancel and Apply still work; after restore the Preview shows the Draft
  (`screens.md` SCR-03 "display lost", T6 context-loss restore).
- The new image can't be read while the tool is open → open-and-view's failure notice; the tool and
  its Draft stay (AC-13).
- 50 Applies in a row → the ledger's retained count stays at one applied layer.

## Test data

- **Seed strategy.**
  - Unit property tests generate random width strings (digits, signs, decimal points and commas,
    "px" in any case, spaces, exponents, long fractions), point sequences, widths 1..200,
    Originals up to 4096×4096, Crops, Rotations, Flips, Straighten angles, zooms and pans.
  - Integration and component tests build a Work with a small in-memory Original through the
    existing Work factory (`createWork` in `src/core/document.ts`). The recording 2D context
    returns set pixels where the change flag or `hasAnyMark` needs them. No decoding is involved.
- **Fixtures for e2e-through-UI.**
  - The **opaque reference set**: the existing `photo.png` and `ref.png` (sRGB without an embedded
    profile, as the fixtures README records).
  - A **transparent fixture**: the existing `alpha-patches.png`, for AC-07's transparency and the
    AC-10 hint (marks covering some, then all, transparent pixels inside the Crop).
  - The **reference drawing**: Strokes at 1, 12 and 200 px in the 10 preset colours plus erased parts,
    painted on the Work by a test hook through the real painter (T8). It is defined once as data in
    the e2e helpers, so every engine paints the same Strokes.
  - The **expected Export after a Geometry** is computed in the same engine from the same layer
    through `frameToOriginal`, never stored as a file.
  - The 4096×3072 Work for the load scenarios, built in the page at run time as the export perf
    suite already does.
- **Independent oracle.** The fidelity rows compare the Export with the Preview. The empty-layer and
  round-trip rows compare two Exports exactly. The "image unchanged" rows compare with the Export of
  the same Work with no layer. The palette rows compare with AC-02's hex values as written in the
  test, not with `PALETTE`.
- **Integration dependency.** The real editor, export, crop-rotate, adjust and draw stores, created
  fresh. Stores are never mocked. The renderer, the painter's 2D context, the GL and the export
  worker are replaced by recording fakes at this level only; the real ones run in e2e-through-UI.
- **Cleanup boundary.** Per test. Unit and integration tests create fresh stores and fakes in each
  test and assert the ledger's retained count at the end. e2e-through-UI tests use a fresh browser
  context in each test. The Drawing layer and the tool settings are never persisted, so no stored
  state crosses tests. Downloaded Export files are read from the test's temporary output and dropped
  with it.

## NFR validation (load)

The load/perf tool already in your repo, or e.g. k6 or Locust. Every scenario runs on the reference
machine (Apple M1 MacBook Air, latest stable Chrome) with the 4096×3072 Work, takes p95 over **20
runs after 2 warm-up runs**, and is tagged as a perf test, so it runs by hand rather than on every
PR. The drawing scenarios run twice, with the View at Fit and at 100%, and both must pass. Scripted
pointer moves arrive at 120 per second through the real overlay.

- **Preview while drawing** (§6 row 1) → for the Brush and the Eraser, at 200 px and at 1 px, draw a
  2 s Stroke at 120 moves per second. Assert the p95 frame interval is ≤ 33 ms (at least 30
  updates per second).
- **Pointer to frame** (§6 row 2) → the same Strokes. Assert p95 from a pointer move to the frame
  that shows the Stroke reaching that point is ≤ 50 ms.
- **Tool ready** (§6 row 3) → 20 openings of "Draw" on a Work covered by marks over the whole
  image. Assert p95 from the action to the tool-ready mark is ≤ 150 ms.
- **Apply, Cancel, Clear** (§6 row 4) → with the Drawing layer covered by marks over the whole
  image, 20 runs of each. Assert p95 from the action to the updated Preview is ≤ 150 ms.
- **Crop and rotate Apply over marks** (§6 row 5) → with marks over the whole image, 20 Geometry
  Applies. Assert p95 from Apply to the updated Preview is ≤ 150 ms.
- **Export with a full layer** (§6 row 6) → with marks over the whole image, 20 full-size exports
  per format. Assert p95 ≤ 1 s for JPEG at quality 90 and ≤ 2 s for PNG.
- **Memory after 50 Applies** (§6 row 10) → 50 Applies, each with a new Stroke across the whole
  image, Chromium only. Assert whole-page memory, measured as export §6 does it, is ≤ 110% of the
  memory after the first Apply.

The T9 spike runs the first two scenarios through the test hooks before the tool UI exists. T20
runs them again through the real overlay.

The §6 fidelity, empty-layer and round-trip rows carry tolerances, not rates. They are verified by
the e2e-through-UI rows of AC-07, AC-08 and AC-10.

## CI placement

- **On every PR:** unit (with property tests), integration and component, together with lint and
  typecheck. These are the fast suites.
- **On every PR, three engines:** e2e-through-UI, the same way the repo's CI already runs the export,
  open-and-view, crop-rotate and adjust browser suites. This includes the fidelity, empty-layer,
  round-trip and "image unchanged" rows, since a pixel regression must block a merge.
- **By hand before release, on the reference machine:** the load scenarios above (the perf-tagged
  suite).

## Rows by task

So `implement` can find each row's home in `tasks.json`:

- T1 — the AC-16 row "the tool slot keeps the editor store's API and tests unchanged".
- T2 — the unit rows for the palette, defaults, `parseWidth`, `stepWidth`, the curve, the bounds and
  the footprint (AC-01 to AC-03, AC-09, AC-19).
- T3 — the unit rows for `frameToOriginal` and `deviceToFrame` (AC-08, AC-09).
- T4 — the layer lifecycle and ledger integration rows (AC-05, AC-13), and the empty-Draft unit row
  (AC-07).
- T5 — the recording 2D context and the painter integration rows (AC-01, AC-04, AC-07, AC-09,
  AC-12's alpha check).
- T6 — the recording-GL shader rows (`u_layer`, `u_draw`, context-loss restore; AC-07, AC-11).
- T7 — the tool-slot integration rows (AC-12, AC-13, AC-15, AC-16, AC-17, AC-18's View).
- T8 — the `PreviewCanvas` component rows (AC-05, AC-11) and the test hooks the e2e rows use.
- T9 — the spike's first two load scenarios.
- T10 — the export integration rows (AC-10: snapshot, passes, transparency check).
- T11 — the draw store integration rows (AC-01 to AC-03, AC-05, AC-06, AC-12, AC-13).
- T12 — the Stroke session integration rows (AC-01, AC-04, AC-09, AC-12, AC-18).
- T13 — the hint catalog unit rows and the `DrawAction`, `ExportAction`, `CropRotateAction` and
  `AdjustAction` component rows (AC-14 to AC-17, AC-19's D key).
- T14 — the swatch and `DrawControls` component rows (AC-02, AC-03, AC-05, AC-19's Tab order).
- T15 — the `DrawOverlay` component rows (AC-01, AC-02's circle, AC-09, AC-18).
- T16 — the `DrawTool` component rows and the in-tool keys (AC-06, AC-16, AC-18, AC-19).
- T17 — the e2e fidelity, empty-layer, round-trip, "image unchanged", Geometry, smaller-size and
  transparency-hint rows (AC-07, AC-08, AC-10, AC-11's pixels).
- T18 — the e2e tool-flow rows (AC-01 to AC-06, AC-09, AC-18, AC-19).
- T19 — the e2e cross-feature rows (AC-11 to AC-17).
- T20 — the remaining load scenarios.
