# Changelog — export

## export — save the open Work as a PNG, JPEG or WebP file, honestly

**What:** The editor can now export the open Work as a file. An **Export** action sits in the top
bar next to the canvas. It opens one panel where the Editor picks PNG, JPEG or WebP, sets a quality
from 1 to 100 for JPEG and WebP (90 by default), and can choose a smaller size with a preset (100%,
75%, 50%, 25%) or by typing the long side in pixels. The resulting width and height show before the
export starts. The suggested name comes from the Source name (`IMG_4021.HEIC` becomes
`IMG_4021-edited.jpg`) and is cleaned up so it is safe on Windows, macOS and Linux. Where the
browser has a "Save as…" dialog (Chromium) the Editor picks the folder and name there. Elsewhere
(Firefox, Safari) the file goes to the browser's downloads, and the notice says so.

The export is an honest save. A full-size PNG matches the Preview at 100% to within 2/255 per
channel, whatever the zoom or pan. Each file's format is checked by its content before it is saved.
A format this browser can't really produce (WebP in Safari) is shown but can't be chosen. No
embedded metadata is written (no Exif, XMP, IPTC, text blocks or non-sRGB profile). A JPEG of a
transparent Work is flattened onto white, and the panel warns about it first. The Work counts as
saved, so it no longer has Unsaved edits, only after the file has really been written or handed to
the downloads. A cancelled dialog or a failed write leaves the Unsaved edits in place. A failure
never leaves a blank or partial file reported as saved. While an export runs, editing, opening
another image and a second export are refused, but zoom and pan stay available. Within the session
the panel remembers the quality for every Work, and the format and size for the same Work. Export
works offline after the first visit.

**Why:** Browser storage can be evicted or cleared, so an Export is the only reliable copy of a Work.
The failure this feature is built against is a "false save", where the Work is marked saved
although no file was written and the next open discards the edits ([spec](../spec.md) §1–§2).
Export is roadmap step 3, and it gives every later editing tool a way to save its result. Key
decisions:

- Encode and verify the file before the "Save as…" dialog opens, so a format or encoding failure
  never empties a file the Editor chose to overwrite
  ([ADR-0001](../adr/0001-encode-and-verify-before-the-save-dialog.md)).
- Render and encode every export in a dedicated Web Worker that uses the Preview's own shader code,
  so the file matches the Preview and the UI doesn't freeze
  ([ADR-0002](../adr/0002-render-and-encode-exports-in-a-dedicated-web-worker.md)).

**How to use:** Open an image, then click **Export** (or press Ctrl+S, Cmd+S on a Mac). Choose a
format, and optionally a quality and size. Then click the confirm button or press Ctrl/Cmd+S again.
In Chromium, save in the dialog. In Firefox and Safari, find the file in the browser's downloads.
Escape or a click outside closes the panel when no export is running.

**Operational notes:**

- Migration: none. The feature keeps no data, and IndexedDB isn't touched. Export choices are
  remembered in memory for the session only.
- Feature flag / config: none. Test hooks (`window.__imglyTest`) are compiled only into the e2e
  build (`dist-e2e/`). The production `dist/` was checked and contains none.
- Service worker: the export worker (`export.worker-*.js`) is now in the precache, so a deploy
  changes the precache manifest and clients pick it up on their next service-worker update.
- Work shape: the Work now carries its Source name, Source format and a transparency fact. All three
  live in memory only, so there's nothing to migrate.
- Rollback: revert the merge and redeploy GitHub Pages. No stored state needs undoing.
- Review: three review rounds. `_review/review-2026-10-06.md` had 7 findings and `-r2` had 3
  stage-2 findings, each returning CHANGES REQUESTED. Every finding was fixed, in T17–T25 and,
  for R3, an edit to `tasks.json`. The third round (`-r3`) re-reviewed that fix delta
  (`808be26..34c254c`) and the ship drafts with a clean-context reviewer and returned PASS.
- Known follow-ups:
  - The manual browser passes from `sad.md` §7 are still to do: a Chrome "Save as…" overwrite with
    a wrong extension (Playwright stubs the native dialog), and a real Safari download.
  - Spec §8 leaves two questions open. One is whether undoing back to the exported state clears
    Unsaved edits, due before roadmap step 4 re-verifies AC-09. The other is a fidelity threshold
    for JPEG, WebP and smaller-size exports.
  - Roadmap step 4 must re-verify AC-01 and AC-09 with real edits.
  - `docs/architecture-map.md` is stale. Run `/sdd:survey` before the next feature's design.

**Acceptance criteria delivered:** AC-01 – AC-19 (AC-01, AC-01b, AC-02 … AC-19):

- Save through the "Save as…" dialog or the downloads, and refuse a mismatched extension.
- The whole Work goes into the file, whatever the zoom or pan.
- Quality and size rules, with exact dimensions and an export that is never larger than the Work
  and never empty.
- Safe names taken from the new Work's Source name.
- The save point clears Unsaved edits only on a real save, and the Work is locked while an export
  runs.
- Honest format availability, and failures that never fake a save.
- JPEG flattened onto white, with a warning first.
- No metadata in the file.
- Keyboard reach, with Ctrl/Cmd+S and a flow of at most three steps.
- Export works offline.
- Session memory of the panel's choices.
