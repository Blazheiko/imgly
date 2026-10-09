# Changelog — adjust

## adjust — fix the light and colour of a photo by eye, without losing a pixel

**What:** The editor now has its second editing tool, **Adjust**. An "Adjust" action sits in the
toolbar next to "Crop and rotate", and the A key opens it as well. The tool shows seven sliders in
three groups:

- **Light:** brightness and contrast, from −100 to +100.
- **Colour:** saturation, temperature (cooler or warmer) and tint (greener or more magenta), from
  −100 to +100.
- **Effects:** grayscale and sepia, from 0% to 100%.

Each slider has a number field next to it and a mark at its neutral value. The Preview follows
every move live, but the Work changes only on **Apply**. **Cancel** or Escape keeps the Adjustments
the Work had before. A double-click on a slider, or typing 0, returns it to neutral, and **Reset**
returns all seven. **Compare** shows the photo with no Adjustments, labelled "Before", while the
button or the \ key is held. **Auto** sets brightness, contrast, temperature and tint from the
photo's own pixels inside the Crop. It stays within ±50, gives the same values every time for the
same Work and Geometry, and says "Nothing to correct automatically." when the photo is one colour.

The Adjustments never destroy pixels. The Work stores only the seven whole numbers, never adjusted
pixels, so any value can be changed or reset until the Work is replaced. With all seven at neutral,
the Work is pixel for pixel what it was before any Adjustment. The Adjustments change only colour:
transparency, size and Geometry stay exactly as they were, and soft edges get no fringe. The steps
always apply in one fixed order, so the same values give the same picture whatever order the Editor
set them in. The Export follows the applied Adjustments. A full-size PNG matches the Preview, and a
smaller Export is the full-size adjusted image reduced. The "Crop and rotate" tool shows the image
with its Adjustments, so the Editor crops what they will export. Unsaved edits are raised only when
the applied values differ from the values the tool opened with.

The whole tool works by keyboard. Every control is reachable with Tab, the arrow keys move a focused
slider by 1 (10 with Shift), Enter applies and Escape cancels. Lightening a photo takes three actions
(A, brightness, Apply), and so does an automatic fix (A, Auto, Apply).

**Why:** Photos often open too dark, flat, washed out, or with a blue or yellow cast. The Editor
needs to fix that by eye, with the result shown at once, before drawing on the photo or exporting
it, and the fix must not eat into the photo for good ([spec](../spec.md) §1–§2). This is roadmap
step 5. It also adds the Adjustments to the Work, which undo (step 7) and the gallery (step 8)
build on, and it fixes the rule that the drawing layer (step 6) is painted over the adjusted image.
Key decisions:

- Model the Adjustments as seven integer fields on the Work, with their ranges, parsing and the CPU
  reference of the formulas in `core`
  ([ADR-0001](../adr/0001-model-the-adjustments-as-seven-integer-fields-on-the-work.md)).
- Apply them in the shared fragment shader in the same pass as the Geometry, on unpremultiplied
  stored sRGB values. The Preview and the Export share one rendering path, as repo ADR 0004 decided
  ([ADR-0002](../adr/0002-apply-the-adjustments-in-the-shared-fragment-shader-on-stored-srgb-values.md)).
- Define each Adjustment by a fixed formula that keeps black in place, applied in one fixed order
  with a clamp after each step. Its anchor table fixes how strong each slider is at its bounds
  ([ADR-0003](../adr/0003-define-each-adjustment-by-a-fixed-formula-that-keeps-black-in-place.md)).
- Measure Auto on a sample of the Crop at most 512 px on the long side, read from the Preview's
  WebGL2 context, and compute the values in `core`
  ([ADR-0004](../adr/0004-measure-auto-adjust-on-a-bounded-sample-in-the-preview-context.md)).
- Record the colour deviation of semi-transparent pixels on Firefox and WebKit instead of loosening
  the fidelity check. Alpha stays exact on every engine
  ([ADR-0005](../adr/0005-record-the-semi-transparent-colour-deviation-on-firefox-and-webkit.md)).

**How to use:** Open an image and click **Adjust** (or press A). Drag a slider, use the arrow keys,
or type a value. Hold **Compare** (or \) to see the photo before the change, or choose **Auto**.
Press Apply or Enter to keep the change, or Cancel or Escape to go back. Reopen the tool to change
the values again, and choose Reset to return all of them to neutral. Only one tool can be open at a
time. While Adjust is open, Export, "Crop and rotate" and their shortcuts show a hint to apply or
cancel first.

**Operational notes:**

- Migration: none. The Adjustments live on the in-memory Work, and IndexedDB isn't touched.
  Persisting them is roadmap step 8 (gallery).
- Feature flag / config: none. Test hooks (`window.__imglyTest`) stay in the e2e build
  (`dist-e2e/`) only.
- Service worker: the shared shader, the Preview renderer and the export worker changed, so a deploy
  changes the precache manifest, and clients pick it up on their next service-worker update.
- Rollback: revert the merge and redeploy GitHub Pages. No stored state needs undoing.
- Review: seven review rounds. Rounds 1–6 had 41 findings in total (R1–R13, N1–N7, F1–F8, G1–G5,
  H1–H3, I1–I4, J1), all done. Round 7 (`_review/review-2026-10-09-7.md`) returned **PASS** with no
  findings.
- Known follow-ups:
  - ADR-0003's formulas become a stored-data contract once the gallery saves Works. Step 8 must store
    a formula version with the Adjustments (sad §11, due before `/sdd:design` of step 8).
  - `src/features/editor/store.ts` is now 515 lines. Extract the tool slot into
    `src/features/editor/tool-slot.ts` before the drawing layer adds a third tool, or once the store
    passes 600 lines (sad §11, due before `/sdd:tasks` of step 6).
  - `docs/architecture-map.md` reflects 71f9628, which is before this feature's second tool and the
    shader's colour block. Run `/sdd:survey` before the next feature's design.

**Acceptance criteria delivered:** AC-01 – AC-21:

- Seven sliders with a live Preview, whole-number values, neutral marks and safe typed input.
- Brightness, contrast, saturation, temperature, tint, grayscale and sepia, each moving the image in
  the direction the spec fixes, applied in one fixed order that never wraps a channel.
- Only colour changes: exact transparency, no fringe on soft edges, and neutral values that change
  no pixel.
- Compare, Cancel, Reset and a per-slider reset, none of which loses a pixel.
- Auto within ±50, deterministic for the same Work and Geometry, with a hint when there is nothing
  to correct.
- Unsaved edits compared value by value with the values at open.
- An Export that follows the applied Adjustments at any size and never contains a Draft. The tool,
  Export and "Crop and rotate" refuse each other while one of them is open or running, and an image
  replacement follows open-and-view.
- An untouched View, and keyboard reach in three actions.
