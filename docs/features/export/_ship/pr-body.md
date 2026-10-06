## Summary

Adds **Export**, which saves the open Work as a PNG, JPEG or WebP file from one panel. The panel
offers a quality setting for JPEG and WebP, a smaller size by preset or long side, and a safe name
taken from the Source name. In Chromium the file is saved through the "Save as…" dialog. In Firefox
and Safari it goes to the browser's downloads. Export is an honest save. Each file is checked by its
content before it is saved, a full-size PNG matches the Preview, and no metadata is written. The
Work counts as saved only when the file has really been written or handed off. This is roadmap
step 3. See the [spec](docs/features/export/spec.md) and the
[changelog](docs/features/export/_ship/changelog.md).

## Acceptance criteria

- AC-01: Save through the "Save as…" dialog in the chosen format, and a notice names the file ✓
- AC-01b: A name with a mismatched extension is refused, nothing is written, and the Unsaved edits stay ✓
- AC-02: With no dialog, the file is handed to the downloads and the notice says so ✓
- AC-03: The file holds the whole Work whatever the zoom or pan, and the View is unchanged ✓
- AC-04: Quality runs 1–100 with a default of 90, and q10 < q50 < q90 in bytes. It's shared by JPEG and WebP and hidden for PNG ✓
- AC-05: Presets and a typed long side give exactly the dimensions the panel shows, with proportions kept ✓
- AC-06: The size snaps to the Work's full size, or to the smallest size that isn't empty ✓
- AC-07: A safe suggested name, such as `IMG_4021.HEIC` becoming `IMG_4021-edited.jpg` ✓
- AC-08: The name follows a replaced Work ✓
- AC-09: A finished export is a save point, so the next open replaces the Work with no prompt ✓
- AC-10: Cancelling or failing keeps the Unsaved edits, a cancel shows no message, and a failure shows its reason ✓
- AC-11: While an export runs, edits, opening and a second export are refused (a drop gets a notice), and zoom and pan still work ✓
- AC-12: Formats this browser can't produce are shown but can't be chosen, and every file's format is checked by its content ✓
- AC-13: A failed export never leaves a blank or partial file reported as saved, and the notice says what's left ✓
- AC-14: When writing is not allowed, nothing is saved and the notice suggests another folder ✓
- AC-15: A JPEG of a transparent Work is flattened onto white, with a one-line hint first ✓
- AC-16: No Exif, XMP, IPTC, text or non-sRGB profile in any format ✓
- AC-17: Export is reachable by keyboard, Ctrl/Cmd+S opens the panel and then confirms it, and the flow takes at most three steps ✓
- AC-18: Export works offline after the first load ✓
- AC-19: The default format follows the Source format, and the panel remembers its choices for the session ✓

## Design

- Spec: `docs/features/export/spec.md`
- Architecture: `docs/features/export/sad.md`
- Decisions: `docs/features/export/adr/`
  - [ADR-0001](docs/features/export/adr/0001-encode-and-verify-before-the-save-dialog.md): encode and verify before the "Save as…" dialog
  - [ADR-0002](docs/features/export/adr/0002-render-and-encode-exports-in-a-dedicated-web-worker.md): render and encode in a dedicated worker with the Preview's shader code
- UX: `docs/features/export/ux-flows.md` and `docs/features/export/screens.md`
- Data model and migration: none, because nothing is persisted
- API: none (client-only)

## Tasks (SDD-Task trailers)

| Task | Commit | Subject |
|---|---|---|
| T1 | 3a58e54 | feat(export): add the export error codes and the pure file-name rules |
| T2 | 8fd83cf | feat(export): add the pure size, quality and default-format rules |
| T3 | f0eccf7 | feat(export): carry Source name, Source format and transparency on the Work |
| T4 | 19ea852 | feat(export): add the editor's exclusive exporting phase and the save point |
| T5 | 3d02259, 63da1ea | feat(export): extract the shared shaders and build the export worker (+ WebKit fix) |
| T6 | 0131de6 | feat(export): add the session format check and the main-thread export client |
| T7 | 357e4b6 | feat(export): add the platform save path and the download hand-off |
| T8 | c49ceb8 | feat(export): create the export store with panel state and session memory |
| T9 | a571e71 | feat(export): orchestrate the export in the export store |
| T10 | 264d4a7 | feat(export): add the Popover and SegmentedControl shared primitives |
| T11 | 4a3c140 | feat(export): add the NumberField and SliderField shared primitives |
| T12 | c56d988 | feat(export): build the export panel (SCR-03) in every state |
| T13 | 0afcf78 | feat(export): mount the Export action with Ctrl/Cmd+S and the exporting lock |
| T14 | 08fb7f0 | test(export): prove export works offline after the first load |
| T15 | 58df66f | test(export): add the functional e2e suite on Chromium, Firefox and WebKit |
| T16 | a9afd0f | test(export): add the @perf export suite |
| T17 | 1e07aeb | fix(export): let Space press the export controls instead of starting space-pan |
| T18 | 52da5ad | fix(export): close the export panel when another Work replaces the open one |
| T19 | 3084617 | test(export): make the AC-09 e2e check observe Unsaved edits |
| T20 | d07eafe | test(export): assert the AC-15 blend on partly transparent pixels |
| T21 | ed6f29b | fix(export): make Export unavailable while the editor reads an image or asks to replace |
| T22 | 1c959bb | fix(export): time out an export or format-check worker that never answers |
| T23 | 587ecd5 | fix(ui): re-place the Popover on window resize while it is open |
| T24 | 080401f | fix(export): keep the no-image Export focusable while the first image is read |
| T25 | 34c254c | test(app): import the editor's fake renderer through a testing barrel |

## Verification

Verified at `34c254c` on 2026-10-06 (Apple M1 Pro).

- Unit: `pnpm test` passes 738 of 738.
- Lint and vet: `pnpm lint` and `pnpm typecheck` are clean.
- Build: `pnpm build` is clean. The production `dist/` has no `__imglyTest` hooks, and
  `export.worker-*.js` is in the service-worker precache.
- e2e: `pnpm test:e2e` on Chromium, Firefox and WebKit has 299 passing and 13 skipped. The skips
  are `@perf` outside Chromium, WebP on WebKit (that browser can't produce it, by design), offline
  reload on WebKit (a Playwright limit) and the skips open-and-view already documents.
- Perf: `PERF=1` on Chromium. Export p95 is 283 ms for JPEG at q90 (target ≤ 1000) and 278 ms for
  PNG (target ≤ 2000). No long task over 50 ms was seen (target ≤ 200 ms). Memory after 10 exports
  is 102% of the first (target ≤ 110%), with 1 bitmap retained.
- The feature was exercised in real browsers through Playwright, which drives the real UI. What was
  observed:
  - AC-12: in all three browsers, every PNG and JPEG file's header matches its extension and is
    320×240. On WebKit, WebP can't be chosen, and the panel says "WebP isn't available in this
    browser."
  - AC-01 and AC-03: a full-size PNG matches the Preview's rendering at 100% to within 2/255 after
    zooming and panning, in all three browsers. The AC-09 check in the same test shows the Work has
    no Unsaved edits afterwards.
  - AC-16: the source fixture really carries Exif, and the PNG, JPEG and WebP outputs carry no
    Exif, XMP, IPTC, text or non-sRGB profile.
  - AC-15: a JPEG of a partly transparent Work blends onto white within ±6.
  - AC-04, AC-05 and AC-06: the byte sizes go q10 < q50 < q90, and presets and a typed long side
    give exactly the dimensions the panel shows.
  - AC-18: export works after going offline and reloading, on Chromium and Firefox.
- AC-01b, AC-10, AC-11, AC-13, AC-14, AC-17 and AC-19 are covered by unit and component tests with a
  fake save target and a fake worker. Those are `save-file.test.ts`, the export `store.test.ts`,
  `ExportAction.test.ts`, `ExportPanel.test.ts` and `app/keyboard.test.ts`.
- Not verified yet, and to do by hand before or after merge (`sad.md` §7):
  - A real Chrome "Save as…" overwrite with a wrong extension. Playwright stubs
    `showSaveFilePicker` and can't drive the native dialog.
  - A real Safari download.
- Review: `_review/review-2026-10-06.md` had 7 findings and `-r2` had 3 stage-2 findings. All are
  fixed in T17–T25. The R1–R3 fixes (T24, T25 and T17's `files_hint`) were checked at ship but not
  re-reviewed by a clean-context reviewer.

## Operational notes

- Migration: none, because IndexedDB isn't touched. Rollback is to revert the merge and redeploy
  GitHub Pages.
- Feature flag or config: none. The new export worker is precached, so clients pick it up on their
  next service-worker update.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
