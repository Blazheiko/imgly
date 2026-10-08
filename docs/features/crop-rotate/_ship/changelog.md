# Changelog — crop-rotate

## crop-rotate — turn, mirror, level and crop the Work without losing a pixel

**What:** The editor now has its first editing tool, **Crop and rotate**. A "Crop and rotate"
action sits in the toolbar next to Export, and the C key opens it as well. The tool shows the
whole image with a crop frame over it. In one place the Editor can:

- turn the image in 90° steps either way,
- flip it horizontally or vertically, as it is shown on screen whatever the Rotation,
- level it with a straighten slider or a typed angle from −45° to +45° in 0.1° steps, while the
  frame shrinks automatically so no empty corner can enter the Work,
- drag the frame, its edges and its corners, or type its width and height in pixels,
- lock the frame to Free, Original, 1:1, 4:3, 3:2 or 16:9, in landscape or portrait.

The Preview follows every change straight away. Apply keeps the result, and Cancel or Escape leaves
the Work as it was. The status bar shows the Work's new size, with the Original's dimensions next
to it whenever they differ ("1920×1080, from 4096×3072").

The Geometry never destroys pixels. Rotation, Flip, Straighten angle and Crop are stored as
parameters on the Work, not baked into it. Reopening the tool shows the whole image with the frame
where the Crop is, so the Editor can widen it again, and Reset returns to no Geometry. Widening a
Crop back to the whole image gives exactly the pixels from before. The Export follows the applied
Geometry. A full-size PNG matches the Preview, no pixel from outside the Crop ever reaches the file,
the export panel's sizes count from the Crop, and the transparency hint appears only when a pixel
inside the Crop is transparent. Unsaved edits are raised only when the applied Geometry differs
from the one the tool opened with, so four quarter turns or an Apply with no change raise nothing.

The whole tool works by keyboard. Every control is reachable with Tab, the arrow keys move or
resize the focused frame or handle by 1 px (10 px with Shift), Enter applies and Escape cancels.
Rotating once takes three actions (C, rotate, Apply), and so does cropping to a square (C, 1:1,
Apply).

**Why:** A photo that is sideways, mirrored, tilted or badly framed has to be fixed before any other
edit, and every later edit and Export builds on that frame. Getting it wrong, or losing pixels for
good, damages all the work that follows ([spec](../spec.md) §1–§2). This is roadmap step 4, the
first real edit in the open, edit and save flow. It also fixes the Geometry that the drawing layer
(step 6) and the gallery (step 8) will build on. Key decisions:

- Model the Geometry as integer parameters on the Work, with every rule and a single
  Crop-to-Original transform in `core`, so the Preview, the Export and the overlay can't disagree
  ([ADR-0001](../adr/0001-model-the-geometry-as-integer-parameters-with-one-core-transform.md)).
- Render the Geometry in the shared shader in one pass that samples the Original directly, so the
  Preview and the Export share one resampling path
  ([ADR-0002](../adr/0002-render-the-geometry-in-the-shared-shader-in-one-pass.md)).
- Open tools through an `activeTool` slot on the editor store, with the Draft in the tool's own
  store. The same slot is ready for the adjust and draw tools
  ([ADR-0003](../adr/0003-open-tools-in-an-active-tool-slot-with-the-draft-in-the-feature-store.md)).
- Check for transparency inside the Crop on the GPU with the export shader
  ([ADR-0004](../adr/0004-check-crop-transparency-on-the-gpu-with-the-export-shader.md)).
- Draw the crop frame as a DOM overlay over the Preview canvas, so its handles are focusable and
  accessible ([ADR-0005](../adr/0005-draw-the-crop-frame-as-a-dom-overlay-over-the-preview.md)).

**How to use:** Open an image and click **Crop and rotate** (or press C). Drag the frame or its
handles, or use the controls for turns, flips, the straighten angle, the proportion and the size.
Press Apply or Enter to keep it, or Cancel or Escape to go back. Reopen the tool later to widen
the Crop, or choose Reset to clear the Geometry. Export is unavailable while the tool is open, and
Ctrl/Cmd+S shows a hint to apply or cancel first.

**Operational notes:**

- Migration: none. The Geometry lives on the in-memory Work, and IndexedDB isn't touched.
  Persisting it is roadmap step 8 (gallery).
- Feature flag / config: none. Test hooks (`window.__imglyTest`) stay in the e2e build
  (`dist-e2e/`) only.
- Service worker: the shared shader and the export worker changed, so a deploy changes the precache
  manifest, and clients pick it up on their next service-worker update.
- Rollback: revert the merge and redeploy GitHub Pages. No stored state needs undoing.
- Review: seven review rounds. Rounds 1–6 had 24 findings in total (R1–R11, N1–N7, F1–F3, G1, H1,
  J1–J4), all fixed in T21–T40. Round 7 (`_review/review-2026-10-07-7.md`) returned **PASS** with no
  findings. One `/sdd:fix` came after it (`_fixes/2026-10-07-remembered-lock-unfitted.md`): reopening
  with a remembered proportion the Crop didn't have now fits the frame to it, and AC-12 says so.
- Known follow-ups:
  - Spec §8 D3: whether the drawing layer stays anchored to the Original. Due before step 6 is
    specified. Default: yes, it follows the Geometry.
  - Spec §8: move export's undo save-point question to step 7, since this feature adds no undo.
  - From the fix record: check whether `straightenAnchor`'s "keep the frame's own proportion" branch
    can still be reached, and add the reopen-then-Apply case to `test-plan.md` on the next
    `plan-tests` pass.
  - `docs/architecture-map.md` predates the `activeTool` slot. Run `/sdd:survey` before the next
    feature's design.

**Acceptance criteria delivered:** AC-01 – AC-20:

- Cropping by frame, with dimming, a thirds grid, a Crop that always stays inside the image, and a
  status bar that shows the Crop's size with the Original's dimensions.
- Lossless quarter turns and on-screen flips, which return the Geometry from before after four turns
  or two flips.
- Straightening from −45° to +45°, with the frame fitting itself so no empty corner enters the Work,
  and safe angle input.
- Proportions, typed pixel sizes with the export input rules, and proportion memory for each Work.
- Cancel, Escape, reopening to widen, and Reset, all without losing a pixel.
- Unsaved edits compared field by field with the Geometry at open.
- An Export that follows the Geometry, with nothing from outside the Crop. The tool and Export
  refuse each other while the other one is running, and an image replacement follows open-and-view.
- A View that fits the turned image, and keyboard reach in three actions.
