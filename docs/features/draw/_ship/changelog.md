# Changelog — draw

## draw — mark up a photo freehand, without losing a pixel underneath

**What:** The editor now has its third editing tool, **Draw**. A "Draw" action sits in the toolbar
next to "Adjust", and the D key opens it as well. The tool has:

- **Two modes:** the **Brush** paints fully opaque Strokes with round ends and smooth edges, and the
  **Eraser** removes marks along its path. B and E switch between them.
- **A colour palette:** 10 preset colours (black, white, red, orange, yellow, green, cyan, blue,
  purple and pink) and a custom colour picker for any opaque colour. Red #E53935 is the first-time
  colour.
- **One width for both modes:** 1 to 200 image pixels, set with a slider, a number field (which
  accepts "20px"), or [ and ] (10 with Shift). Over the image the pointer shows a circle of the
  current width at the current zoom. The first-time width is 12 px.
- **Clear**, which empties the whole Drawing layer at once.

The line follows the pointer live through every position the browser reports, coalesced ones
included, joined smoothly with no stabiliser. A click paints one round dot. The Strokes reach the
Work only on **Apply**, and **Cancel** or Escape gives back the Drawing layer the Work had before.
The colour and width are kept for the session, until reload, but they are tool settings, not
edits. The tool always opens on the Brush.

The Drawing layer never destroys a pixel of the image. It is one layer, as large as the Original
and attached to it, so the Original never changes. The Eraser and Clear uncover exactly the image
beneath, and after Clear and Apply the Export is identical to one made before anything was drawn.
Marks follow every later Rotation, Flip, Straighten angle and Crop. A mark outside a narrower Crop
is hidden, not removed, and shows again when the Crop is widened. Four quarter turns or two Flips
give back the identical Export. A Stroke drawn partly outside the Crop is clipped to it and leaves
nothing outside.

The Drawing layer is painted over the adjusted image and is never adjusted itself, so a red mark
stays red in a grayscale photo. Every Export contains the applied marks and matches the Preview at
full size. A smaller Export is the full-size result reduced. The JPEG transparency hint now follows
the drawn result, so opaque marks that cover every transparent pixel inside the Crop remove the
hint. "Crop and rotate" shows the whole image with all its marks, and "Adjust" (including Compare's
"Before") shows the marks unchanged.

Inside the tool a main-button drag draws instead of panning. The wheel, pinch, Space-drag and the
zoom keys and controls still move the View. On layouts where an unshifted `+` sits right of P
(German, Spanish, Italian and Portuguese, for example), that key steps the width and the numpad `+`
zooms in. Circling something and keeping it takes three actions: D, draw, and Enter.

**Why:** The Editor often wants to circle a detail, underline a word or scribble a note before
sharing a photo. Until now that meant exporting the photo and drawing on it in another program
([spec](../spec.md) §1–§2). This is roadmap step 6, and it closes roadmap decision D3: the layer is
attached to the Original, so it follows every later Geometry change. Undo and redo (step 7) and the
gallery (step 8) build on the Drawing layer this adds to the Work. Key decisions:

- Hold the Drawing layer as one Canvas 2D bitmap on the Original's pixel grid. It is created on the
  first mark and is `null` while the layer is empty, so memory does not grow with the number of
  Strokes ([ADR-0001](../adr/0001-hold-the-drawing-layer-as-one-bitmap-in-the-original-pixel-space-created-on-the-first-mark.md)).
- Paint each Stroke segment (a Catmull–Rom curve through the coalesced points) straight into the
  Draft in Original coordinates, clipped to the Crop
  ([ADR-0002](../adr/0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates.md)).
- Composite the layer in the shared fragment shader after the Adjustments. The Preview and every
  Export share that one rendering path, as repo ADR 0004 decided
  ([ADR-0003](../adr/0003-composite-the-drawing-layer-in-the-shared-fragment-shader-after-the-adjustments.md)).
- Hold the Draft as a full copy of the layer, and hand it to the Work on Apply
  ([ADR-0004](../adr/0004-hold-the-draft-as-a-full-copy-of-the-layer-and-hand-it-to-the-work-on-apply.md)).
- Make one Apply of the tool one future undo step, as "Crop and rotate" and "Adjust" do. This
  answers spec §8's open question by default
  ([ADR-0005](../adr/0005-make-one-apply-of-the-draw-tool-one-undo-step.md)).
- The editor's tool slot moved out of the editor store into `src/features/editor/tool-slot.ts`
  before the third tool landed, which closes adjust sad §11's risk.

**How to use:** Open an image and click **Draw** (or press D). Drag across the image to draw, and
click to place a dot. Pick a colour from the palette or "Custom colour", and set the width with the
slider, the field, or [ and ]. Switch to the Eraser (E) to remove marks, or choose **Clear** to
remove all of them. Press Apply or Enter to keep the drawing, or Cancel or Escape to discard it.
While Draw is open, Export, Ctrl/Cmd+S, "Crop and rotate" and "Adjust" show a hint to apply or
cancel first.

**Operational notes:**

- Migration: none. The Drawing layer lives on the in-memory Work, and IndexedDB isn't touched.
  Persisting it is roadmap step 8 (gallery), whose migration must store the layer as a `Blob`
  (repo ADR 0003).
- Feature flag / config: none. The test hooks (`window.__imglyTest`) stay in the e2e build
  (`dist-e2e/`) only. The production `dist/` was checked and has none.
- Service worker: the shared shader, the Preview renderer and the export worker changed, so a
  deploy changes the precache manifest. Clients pick it up on their next service-worker update.
- Rollback: revert the merge and redeploy GitHub Pages. No stored state needs undoing.
- Review: four review rounds. Rounds 1–3 had 29 findings in total (S1–S8, Q1–Q13, R1–R6, and a
  second S1–S2 in round 3), all resolved as tasks T21–T40, with none deferred. Round 4
  (`_review/review-2026-10-10-4.md`) returned **PASS**, and its four non-blocking findings N1–N4
  were fixed as T41–T42.
- Known follow-ups:
  - Undo (step 7) inherits up to 64 MB per kept layer, because one undo step swaps immutable
    layers. Step 7 must bound its stack by memory or store differences between layers (sad §11, due
    before `/sdd:design` of step 7).
  - Spec §8's undo-granularity question is answered by ADR-0005, but the spec's checkbox is left
    for the owner to tick.
  - A layer that the Eraser has emptied by hand keeps its memory until Clear or the next Work
    (accepted debt, ADR-0001).
  - `docs/architecture-map.md` reflects `29eaf3a`, which is before the draw implementation. Run
    `/sdd:survey` before the next feature's design.
  - The perf rows were measured on an M1 Pro at 60 Hz in stable Chrome, not on the M1 Air that the
    spec names as the reference machine.

**Acceptance criteria delivered:** AC-01 – AC-19:

- A live, smooth line through every reported pointer position, a dot on a click, the colour and
  width as chosen, and an Apply that keeps the Strokes (AC-01, AC-02).
- Safe typed widths under the same number rule as the other tools (AC-03).
- An Eraser and a Clear that remove only marks and never touch the image, and a Cancel that gives
  back the layer from before (AC-04 – AC-07).
- Marks that follow every Geometry, with hidden-not-removed marks under a narrower Crop, and Strokes
  clipped to the Crop (AC-08, AC-09).
- An Export that contains the applied, unadjusted marks at any size, follows the transparency hint,
  and never contains a Draft (AC-10, AC-15).
- Marks shown in "Crop and rotate" and "Adjust" (AC-11).
- Unsaved edits raised only by a real change, and a replace that keeps the tool until it succeeds
  (AC-12, AC-13).
- One tool at a time, no Draw during an export, and no Draw without an image (AC-14, AC-16,
  AC-17).
- An untouched View, with zoom and pan still working inside the tool, and full keyboard reach in
  three actions (AC-18, AC-19).
