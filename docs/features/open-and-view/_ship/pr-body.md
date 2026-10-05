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

## Review

[`_review/review-2026-10-04.md`](docs/features/open-and-view/_review/review-2026-10-04.md) ran four
clean-context passes: AC-01–AC-11b, AC-12–AC-19b with ADR fidelity, quality and boundaries, and
security (required by spec §6.1). Its verdict was **CHANGES REQUESTED**, with S1–S8 and Q1–Q10. Each
finding is fixed in T21–T33 above. The only deferral is the visual-regression baselines (S8), owned
by Blazheiko and due before roadmap step 4 `sdd:implement`. **No re-review of the changed surface has
been recorded yet.** The review asks for one, so run it before merging.

## Verification

Re-run on `a9385d5`, 2026-10-04:

- Unit (Vitest, happy-dom + fake-indexeddb): **405 / 405 passed**.
- E2E (Playwright: Chromium, Firefox, WebKit, against `vite preview` of the hooks build): **230 passed, 10 skipped**. The skips are by design: the @perf suite without `PERF=1`, offline reload on Playwright WebKit, and the WebGL pixel and `WEBGL_lose_context` checks that run on Chromium only.
- Lint + typecheck: `pnpm lint` and `pnpm typecheck` are clean.
- Performance: measured at `d6e1bc1` before the review fixes and **not re-run** (it needs `PERF=1 --headed`). Chromium on an Apple M1 Pro; the spec's reference machine is an M1 Air. Time to first Preview p95 was 49 ms for 12 MP (≤ 1500) and 157 ms for 48 MP (≤ 3000). The longest task was 63 / 89 ms (≤ 200). Zoom/pan ran at 119 fps (≥ 50). Memory after 10 opens was 109% of the first (≤ 110%; clean builds read 100–110%, so the margin is thin).
- Ran the feature: I drove the **production** build (`pnpm build` + `vite preview`; `window.__imglyTest` is undefined) in headless Chromium through the real UI:
  - AC-17: the empty app shows "Open image" and "or drop an image anywhere in this window".
  - AC-01: picking `photo.jpg` through the file chooser shows `320 × 240 px` at `100%`, with no notice.
  - AC-01 / S1: dropping `large-lossless.webp` (1,166,480 B, one chunk past the 1 MiB header window) opens at `720 × 540 px`.
  - AC-08 / S7: dropping `text-named.png` (typed `image/png`) shows "This file couldn't be read as an image." The readout stays `720 × 540 px`.
  - AC-09 / AC-16: dropping a PNG whose IHDR (with a valid CRC) declares 20000×20000 shows "This image is too large: 20000×20000 px (400 MP). The largest the editor opens is 100 MP." The open Work is unchanged at `320 × 240 px`.
  - AC-05 / AC-11: dropping `big-animated.gif` (6000×4000) shows `4096 × 2731 px` with "Reduced to the 4096 px limit: 6000×4000 → 4096×2731." and "Animated image: only the first frame was kept."
  - AC-12b / S6: pressing 100% and then resizing the window keeps `100%` (no re-fit), and Fit returns to `18%`.
  - AC-12 / S3: Ctrl+wheel over the status bar is `defaultPrevented`, so the page doesn't zoom.
  - AC-13 / S4: pressing and releasing Space with "Zoom in" focused leaves the zoom at `18%`, so the button isn't pressed.
  - AC-02: the URL stayed `/imgly/` throughout, with zero page errors.
- Still manual (not done here): HEIC and Safari pinch in **real Safari** (`e2e/fixtures/README.md` ship checklist).

## Operational notes

- Migration: none. This feature keeps no data.
- Feature flag / config: none. The decode worker joins the service-worker precache, so offline opens work after the first load.
- Rollback: revert the merge and redeploy Pages.
- Open spec questions shipped at their defaults: the size ceiling (100 MP) and sRGB conversion (spec §8). The new 500 MB byte ceiling (T23) is a constant in the open policy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
