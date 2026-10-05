## Summary

Adds the editor's first real capability (roadmap step 2): open an image by picking or dropping it,
see it upright at Fit, and inspect it with 100%, zoom and pan. Images over the 4096 px Downscale
limit are reduced with a one-line notice, and every file that can't be opened gets a plain reason
without touching the open Work. Spec: [`docs/features/open-and-view/spec.md`](docs/features/open-and-view/spec.md).
Changelog: [`docs/features/open-and-view/_ship/changelog.md`](docs/features/open-and-view/_ship/changelog.md).

## Acceptance criteria

- AC-01 — "Open image" shows the image upright at Fit, never above 100% ✓
- AC-02 — a drop anywhere opens it, and the app never navigates away ✓
- AC-03 — a multi-file drop opens the first readable file and says the rest were ignored ✓
- AC-04 — a drop with no image file opens nothing and says only images can be opened ✓
- AC-05 — over the limit: long side = 4096, notice "6000×4000 → 4096×2731", dimensions shown ✓
- AC-06 — within the limit: own dimensions, no notice ✓
- AC-07 — SVG/BMP/ICO/TIFF/RAW/PSD (and HEIC where it's undecodable) refused with the format named ✓
- AC-08 — damaged or mis-named files are judged by content and reported as unreadable ✓
- AC-09 — over the size ceiling: refused from the declared size, before decoding ✓
- AC-10 — a read the OS doesn't permit is reported, with a hint ✓
- AC-11 / AC-11b — animations keep frame 1, with a notice; notices stack, and errors stay until dismissed ✓
- AC-12 / AC-12b — zoom toward the pointer between min(Fit, 10%) and 800%, true 100%, re-fit on resize until a manual zoom ✓
- AC-13 — pan stops at the image edge, and a fitted image stays centred ✓
- AC-14 — View changes never trigger the replace confirmation ✓
- AC-15 — Unsaved edits → confirm, and Cancel keeps the Work and View exactly as they were (verified on a test-prepared Work; step 4 re-verifies it with real edits) ✓
- AC-16 / AC-16b — a failed open never replaces the Work; latest open wins ✓
- AC-17 — the first visit shows one "Open image" action and a drop hint ✓
- AC-18 — no WebGL2 → a blocking message, and drops are inert ✓
- AC-19 / AC-19b — the Preview restores after context loss, else an honest "display lost" message ✓

## Design

- Spec: `docs/features/open-and-view/spec.md`
- Architecture: `docs/features/open-and-view/sad.md`
- UX flows / screens: `docs/features/open-and-view/ux-flows.md`, `docs/features/open-and-view/screens.md`
- Decisions: `docs/features/open-and-view/adr/` (0001 decode worker · 0002 header parse in core · 0003 one WebGL2 canvas + View transform · 0004 sRGB on open · 0005 revision counter)
- Test plan: `docs/features/open-and-view/test-plan.md`
- Data model + migration: none (no persistence in this feature)
- API: none (client-only)

## Tasks (SDD-Task trailers)

| Commit | Task | Subject |
|---|---|---|
| fef8827 | T1 | add open error codes and the JPEG/PNG/GIF header parser |
| c5c0448 | T4 | add the pure View model and the Work revision rule |
| 1b87f5c | T7 | add the window drop guard, DataTransfer files and the image picker |
| 183b7b7 | T10 | add the notice queue and the Spinner/Toast/ToastStack/Dialog/CanvasMessage primitives |
| 5840beb | T2 | extend the header parser to WebP, AVIF and HEIC/HEIF with a fuzz suite |
| 4f4e185 | T3 | add the open policy: size ceiling, target size, reduction steps, drop order |
| 182939e | T8 | add the WebGL2 preview renderer and the View transform |
| 6ef7e46 | T5 | add the decode worker pipeline and the decodeImage client |
| 581b410 | T9 | restore the preview after WebGL context loss, else report lost |
| 10c7f6c | T6 | probe orientation and HEIC support in the worker, orient when needed |
| 11a0c26 | T11 | implement the editor store's open and replace rule |
| 24955b9 | T12 | add the message catalog, drop sequencing and post-replace notices |
| 4c205e5 | T13 | build the editor shell and SCR-01 with intake wired to the store |
| c20cc44 | T14 | add SCR-02's PreviewCanvas with Fit on open, zoom and pan gestures |
| a10037d | T15 | add the status bar with the dimensions readout and zoom controls |
| 9b151cd | T16 | add SCR-03, the replace confirmation dialog |
| 548174b | T17 | add the start-up capability gate and the SCR-04/SCR-05/restoring screens |
| 456a4b3 | T18 | precache-verified offline opens, three-engine e2e, infra import rule |
| ba7fdf7 | T19 | add the cross-engine reference set, and CRC-check PNG chunks |
| 7b8301c | T20 | add the @perf suite and the bitmap leak ledger |
| d6e1bc1 | T20 | measure @perf memory with graphics included, after it settles |
| dcc3a08 | — | add the review-2026-10-04 follow-ups T21–T33 |
| 1a94de3 | T21 | parse a simple-format WebP whose chunk runs past the header window |
| e74961c | T22 | size a GIF by its first frame too, and re-check the ceiling after decoding |
| 1731c8b | T23 | refuse files above a 500 MB byte ceiling before reading them |
| 9802d32 | T24 | land 100% and zoom steps on exact targets and always leave auto-fit |
| 59f8e24 | T25 | block page zoom anywhere in the editor and zoom the View on Safari pinch |
| 9d7c2c6 | T26 | add a Space pan mode that never presses the focused button |
| 42c966a | T27 | show SCR-05 when the renderer fails at mount, never under the replace dialog |
| 77e217e | T28 | give a dropped image-named file that isn't an image the unreadable reason |
| 5638ac2 | T29 | settle every decode as DECODE_FAILED when the worker rejects or can't start |
| 0f2a2a6 | T30 | round refused sizes up and start the RAW message with Camera RAW |
| 567879c | T31 | tokenise the primitive widths and document image-decode and the infra rule |
| df334ed | T32 | make never-navigates falsifiable, harden the fuzz suite, cover the renderer seam |
| 20253cb | T33 | report Firefox's AbortError on a refused file read as not permitted |
| a9385d5 | T33 | add the missing UI-level AC tests and defer the visual baselines |
| 4f80429 | — | add the review-2026-10-04-2 follow-ups T34–T39 |
| 309ccca | T34 | refuse a GIF with no image descriptor inside the header window as unreadable |
| b1387d2 | T35 | count an early refusal as an image reason only for a file that looks like one |
| cec08e5 | T36 | align the spec with the resolved ceilings and colour decision |
| 8423ef2 | T37 | recognise an SVG that starts with a comment or an svg DOCTYPE |
| 70fcf8c | T38 | cover Reload, the zoom limits and a fitted drag, and mark engine-limited rows |
| 4caac10 | T39 | show the Space pan grab cursor only when the image can pan |
| 776a8ce | — | add the open-and-view ship drafts and the next-steps note |
| 14a5e30 | — | add the review-2026-10-05 follow-ups T40–T46 |
| bdf62a4 | T40 | detect an animated GIF whose second frame lies past the header window |
| 3415fb0 | T41 | check the upright orientation pixels on all three engines |
| 15fd058 | T42 | carry the AC-09 byte ceiling into the flows and the test plan |
| 7ed7b0d | T43 | treat Canon CRW and Sigma X3F names as image files when judging a drop |
| 9d5e83e | T44 | point the stage-record, worker-count and ledger rows at the tests that prove them |
| 99217d3 | T45 | mark the reference machine, ceiling and restore deadline notes as resolved |
| 1f96a7b | T46 | cite SCR-02 on the UI tasks T15, T25, T26 and T39, and close T40–T46 |
| 4308f39 | — | add the review-2026-10-05-2 follow-ups T47–T56 |
| 2dba905 | T47 | test the CRW and X3F drop extensions each on their own |
| f29d952 | T48 | check the first-frame Original pixels of an animated GIF on all three engines |
| aa3e3e3 | T49 | cap the GIF late-frame walk at 64 MiB past the header window |
| a8347f4 | T50 | show the 500 MB byte-ceiling refusal in the rendered toast |
| e676cb2 | T51 | assert one retained Original at the end of the replace and over-Work e2e tests |
| c2bcd71 | T52 | compare the Preview before a context loss with the Preview after restore |
| b6f780f | T53 | drop a link over an open Work end to end |
| b0dfffb | T54 | cite the screen states on T10 and SCR-02 success, error and drag-over on T13 |
| ae9801a | T55 | show the GIF late-frame walk in the pipeline comment and sad.md flow 4 |
| e6e37b8 | T56 | remove the unstyled Space pan class and its prop |

Commits from T34 on carry no `SDD-Task` trailer. They are mapped to their tasks by title in `tasks.json`.

## Review

Four clean-context review rounds ran, and each returned **CHANGES REQUESTED**:

| Record | Scope | Findings | Fixed in |
|---|---|---|---|
| [`review-2026-10-04.md`](docs/features/open-and-view/_review/review-2026-10-04.md) | whole feature: AC-01–AC-11b, AC-12–AC-19b with ADR fidelity, quality and boundaries, and security (spec §6.1) | S1–S8, Q1–Q10 | T21–T33 (S8 visual baselines deferred) |
| [`review-2026-10-04-2.md`](docs/features/open-and-view/_review/review-2026-10-04-2.md) | changed surface | N1, F1–F5 | T34–T39 |
| [`review-2026-10-05.md`](docs/features/open-and-view/_review/review-2026-10-05.md) | changed surface | R1–R8 | T40–T46; R8 (stale ship drafts) fixed by this PR body |
| [`review-2026-10-05-2.md`](docs/features/open-and-view/_review/review-2026-10-05-2.md) | fix delta plus a whole-feature stage-1 trace | V1–V10 | T47–T56 |

The last two rounds found no defect in production behaviour. Their findings were about test
strength, traceability and docs, plus the GIF walk cap. **The final fix delta, `4308f39..b6f780f`
(T47–T56), has not been re-reviewed.** Run `/sdd:review open-and-view` on that surface before
merging if you want a recorded PASS.

## Verification

Re-run on `b6f780f`, 2026-10-05:

- Unit (Vitest, happy-dom + fake-indexeddb): **428 / 428 passed**.
- E2E (Playwright: Chromium, Firefox, WebKit, against `vite preview` of the hooks build): **251 passed, 10 skipped**, exit 0. The skips are by design: the @perf suite without `PERF=1`, offline reload on Playwright WebKit, and the `WEBGL_lose_context` / WebGL pixel checks that are Chromium-only.
- Lint + typecheck: `pnpm lint` and `pnpm typecheck` are clean.
- Performance: last measured at `d6e1bc1` and **not re-run** (it needs `PERF=1 --headed`). Time to first Preview p95 was 49 ms for 12 MP and 157 ms for 48 MP. The longest task was 89 ms or less, zoom/pan ran at 119 fps, and memory after 10 opens was 109% of the first (the limit is 110%). That ran on Chromium on an M1 Pro; the reference machine is an M1 Air.
- Ran the feature: I drove the **production** build (`pnpm build` + `vite preview`; `window.__imglyTest` is undefined) in headless Chromium through the real UI:
  - AC-17: the empty app shows "Open image" and "or drop an image anywhere in this window".
  - AC-01: picking `photo.jpg` through the real file chooser shows `320 × 240 px` at `100%` (never above 100%), with no notice.
  - AC-07: dropping `drawing.svg` shows "SVG files can't be opened here. Convert it to JPEG or PNG." The Work stays at `320 × 240 px`.
  - AC-08: dropping `text-named.png` (typed `image/png`) shows "This file couldn't be read as an image." The Work is unchanged.
  - AC-09 / AC-16: dropping a well-formed PNG whose IHDR declares 20000×20000 shows "This image is too large: 20000×20000 px (400 MP). The largest the editor opens is 100 MP." The Work is unchanged.
  - AC-05 / AC-11 / AC-11b: dropping `big-animated.gif` (6000×4000) shows `4096 × 2731 px` with two stacked notices: "Reduced to the 4096 px limit: 6000×4000 → 4096×2731." and "Animated image: only the first frame was kept."
  - AC-03: dropping `notes.txt` + `photo.png` + `photo.webp` opens `photo.png` and says "The editor works with one image at a time. 2 other files were ignored."
  - AC-04 (V7): dropping a link (`text/uri-list` only) over the open Work shows "Only image files can be opened." The Work is unchanged and the drop is `defaultPrevented`.
  - AC-12: Zoom in goes from 100% to 150%, then 100% and Fit work. Ctrl+wheel over the Preview is `defaultPrevented` and zooms the View (128%), not the page.
  - AC-02: the URL stayed `/imgly/` throughout, with zero page errors.
  - Offline (QG-1b): after the service worker took control, I went offline, reloaded and dropped `photo.avif`. It opened at `320 × 240 px`.
- Still manual (not done here): HEIC and Safari pinch in **real Safari** (`e2e/fixtures/README.md` ship checklist). AC-15 can't be exercised in production yet, since there are no edits until roadmap step 4. It is covered by e2e on a test-prepared Work.

## Operational notes

- Migration: none. This feature keeps no data.
- Feature flag / config: none. Test hooks are compiled only into `dist-e2e/`, and the production `dist/` was checked and contains none.
- Service worker: the decode worker joins the precache, so offline opens work after the first load, and a deploy changes the precache manifest.
- Rollback: revert the merge and redeploy Pages. No stored state needs undoing.
- Limits: 100 MP pixel ceiling, 500 MB byte ceiling, 4096 px Downscale limit, sRGB on open (spec §8, now resolved). The GIF late-frame scan stops 64 MiB past the header window (`sad.md` §11).
- Deferred: the visual-regression baselines (review S8), owner Blazheiko, due before roadmap step 4 `sdd:implement`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
