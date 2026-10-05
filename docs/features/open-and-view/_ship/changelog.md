# Changelog — open-and-view

## open-and-view — open an image by picking or dropping it, and view it with fit, 100%, zoom and pan

**What:** The editor can now open an image. The Editor picks a file with "Open image" or drops it
anywhere on the window, and the image appears upright at Fit, ready to edit. JPEG, PNG, WebP, AVIF
and GIF open in every target browser, and HEIC/HEIF opens where the browser can decode it. An image
whose long side is over 4096 px is reduced to that Downscale limit, and a one-line notice gives the
old and new dimensions. Animated images keep their first frame. Every file that can't be opened
(damaged, mis-named, an unsupported format such as SVG/BMP/TIFF/PSD, larger than the size ceiling of 100 MP or 500 MB,
or blocked by the OS) gets a plain-language reason, and the open Work is never touched. The Preview
supports Fit, 100% (one image pixel per device pixel), zoom toward the pointer from 10% to 800%, and
panning that stops at the image edge. The dimensions and zoom level stay visible in the status bar.
Opening over a Work with Unsaved edits asks for confirmation first, and zooming or panning never
counts as an edit. A browser without WebGL2 gets an honest blocking message instead of a blank
canvas. A temporary graphics interruption restores the Preview by itself, and if it can't be
restored the app says so. Opening works offline after the first visit.

**Why:** Every later tool (crop, adjustments, drawing, export, gallery) starts from an open Work, so
this is the foundation step (roadmap step 2). The committed approach is an open that needs no
dialogs and holds no surprises: the image is read completely before it replaces anything, downscales
are announced, and failures are explained ([spec](../spec.md) §1–§2). Key decisions:

- Decode, orient and downscale off the main thread, in a dedicated worker
  ([ADR-0001](../adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md)).
- Parse image headers in `core` before decoding, so formats are judged by content and
  decompression bombs are refused before any pixels are decoded
  ([ADR-0002](../adr/0002-parse-image-headers-in-core-before-decoding.md)).
- One WebGL2 canvas renders the Preview through a View transform
  ([ADR-0003](../adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md)).
- Every Original is converted to sRGB on open
  ([ADR-0004](../adr/0004-convert-every-original-to-srgb-on-open.md)).
- Unsaved edits are tracked with a revision counter on the Work
  ([ADR-0005](../adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md)).

**How to use:** Open the app (`/imgly/`). On the empty canvas, click **Open image** or drop an image
file anywhere in the window. Use the status-bar controls (− / + / Fit / 100%), pinch or Ctrl/Cmd +
wheel (or a Safari trackpad pinch) to zoom, and drag, Space + drag or the wheel to pan. Keyboard shortcuts: `+` and `-` zoom,
`Shift+1` fits and `Shift+0` shows 100%. The browser's own Ctrl/Cmd zoom keys are left alone.

**Operational notes:**
- Migration: none. The feature keeps no data, and the Work lives only in the current session.
- Feature flag / config: none. Test hooks (`window.__imglyTest`) are compiled only into the e2e
  build (`dist-e2e/`); the production `dist/` was checked and contains none.
- Service worker: the decode worker is now in the precache, so a new deploy changes the precache
  manifest and clients pick it up on their next service-worker update.
- Rollback: revert the merge and redeploy GitHub Pages. No stored state needs undoing.
- Review: four review rounds (`_review/review-2026-10-04.md`, `-04-2`, `-05`, `-05-2`), each
  returning CHANGES REQUESTED, with every finding fixed in T21–T56. No defect in production
  behaviour was found in the last two rounds. The final fix delta (T47–T56, `4308f39..b6f780f`) has
  not been re-reviewed.
- Limits: the size ceiling is 100 MP, with a separate 500 MB byte ceiling and no limit on side
  length. Every Original is converted to sRGB. These were open in spec §8 and are now resolved.
  The scan for a second GIF frame past the header window stops at 64 MiB, so a still-looking GIF
  whose second frame lies beyond that opens without the animation notice (accepted in `sad.md` §11).
- Known follow-ups: the visual-regression baselines are deferred (owner Blazheiko, due before
  roadmap step 4 `sdd:implement`). AC-15 is verified against a test-prepared Work with Unsaved
  edits, and roadmap step 4 (crop and rotate) must re-verify it with real edits. HEIC and Safari
  pinch still need a manual check in real Safari (`e2e/fixtures/README.md`). Keeping metadata stays
  open in spec §8 for the export feature.

**Acceptance criteria delivered:** AC-01 – AC-19b (AC-01 … AC-11, AC-11b, AC-12, AC-12b, AC-13 …
AC-16, AC-16b, AC-17, AC-18, AC-19, AC-19b): pick or drop to open at Fit and upright; multi-file
and non-image drops; announced downscale; honest refusals that never touch the Work; first-frame
animations; stacked notices; zoom, 100% and pan within bounds; confirmation only for Unsaved edits;
latest-open-wins; the first-visit empty state; and honest graphics-failure screens.
