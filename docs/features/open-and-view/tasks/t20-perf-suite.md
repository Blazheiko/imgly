---
id: T20
title: "Add the @perf suite: time to first Preview, long tasks, zoom/pan frame rate and memory after 10 opens"
layer: "tests"
deps: ["T15", "T18", "T19"]
blocks: []
acs: ["AC-01", "AC-12", "AC-13"]
files_hint: ["e2e/open-and-view/perf.spec.ts", "src/infra/image-decode/", "src/features/editor/store.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 53 inlined lines
status: "done"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T20 — Add the @perf suite: time to first Preview, long tasks, zoom/pan frame rate and memory after 10 opens

## Place in the sequence

- **Blocked by:** T15 — Build the status bar: Original dimensions readout, zoom controls with the live zoom level, and the zoom shortcuts, T18 — Precache the decode worker for offline opens, run e2e on three engines in CI, and record the widened rules, T19 — Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal.
- **Blocks:** nothing — leaf task.
- **Wave:** 10 — after T15, T18, T19 (wave 9).
- **Lane:** shares `src/infra/image-decode/` with T5, T6 — serialized; shares `src/features/editor/store.ts` with T11, T12, T17 — serialized.

## Why (user story)

> **US-05: Inspect the image closely**
>
> **As a** Editor  
> **I want** to fit the image to the window, see it at 100%, zoom and pan  
> **So that** I can check details before and while editing
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It measures the spec §6 targets on the reference machine before release, and adds the development-build bitmap counter that catches leaks.

## Inlined context

> | Time to first Preview p95, 12 MP JPEG (4032×3024), within limit | ≤ 1.5 s | e2e performance test on the reference machine |
> | Time to first Preview p95, 48 MP JPEG (8064×6048), downscale path | ≤ 3 s | e2e performance test on the reference machine |
> | Longest interface freeze while opening any accepted image | ≤ 200 ms (loading indicator keeps animating) | long-task trace in the e2e performance test |
> | Zoom and pan smoothness on a 4096 px Original | ≥ 50 fps | performance trace during a scripted zoom and pan |
> | Memory after 10 consecutive opens of the 48 MP image | ≤ 110% of memory after the first open | memory snapshot in e2e |
>
> — `spec.md §6, NFR table rows 1–5, verbatim` · full text: [spec.md](../spec.md)

> Playwright `@perf` test opens each file 20 times on the reference machine; the start is the file-input change or the dispatched drop, the end is a `performance.mark` the renderer sets on the first frame after a new Original, and p95 is computed over the runs. A `PerformanceObserver` for `longtask` records the longest main-thread task during every open of the reference set and fails above 200 ms
>
> — `sad.md §10, QG-1 How verify, verbatim` · full text: [sad.md](../sad.md)

> the `@perf` suite records a Chrome performance trace during scripted pinch, Ctrl/Cmd+wheel and pan gestures and computes the frame rate from presented frames. For memory, the harness forces garbage collection after the first and the tenth open and sums the memory footprint of the tab's renderer process and the GPU process as reported by the operating system. Because happy-dom has no `ImageBitmap`, the leak guard lives in e2e: a development-build counter of bitmaps created and closed by the decode and replace paths must return to the one retained Original after the ten opens (§8, resource lifetime)
>
> — `sad.md §10, QG-3 How verify, verbatim` · full text: [sad.md](../sad.md)

> The `@perf` suite runs only by hand on the reference machine (§7) […] | Medium | A "run `@perf` on the reference machine" item in the `ship` checklist
>
> — `sad.md §11, risk row 4, abridged` · full text: [sad.md](../sad.md)

> Reference machine: Apple M1 MacBook Air (or equivalent) with the latest Chrome (see §8).
>
> — `spec.md §6, verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** the Editor has no image open
> **When** the Editor chooses a Supported image through the "Open image" action
> **Then** the image is shown at Fit, upright the same way the operating system's photo viewer shows it, and the editor is ready for editing. Fit is the largest zoom at which the whole image fits inside the canvas area (the space left after toolbars and panels), never above 100%, so an image smaller than the canvas area is shown centred at 100% and is never enlarged
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — happy path

> **Given** an image is open
> **When** the Editor pinches on the trackpad, scrolls with Ctrl/Cmd held, or uses the zoom-in and zoom-out controls, "Fit" or "100%"
> **Then** the Preview zooms toward the pointer (or the centre for the controls), the current zoom level is visible, "100%" shows one image pixel per physical screen pixel, and the rest of the app interface never changes size
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — happy path

> **Given** an image is open and zoomed in beyond the canvas area
> **When** the Editor scrolls with two fingers or with a plain mouse wheel (vertical), scrolls with Shift held (horizontal), drags while holding Space, or drags while no editing tool is active
> **Then** the Preview pans in that direction and the Work does not change. Panning stops at the image's edge, so the image can never be pushed out of the canvas area. An image that fits inside the canvas area stays centred and does not pan
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Development/test-build bitmap counter (`created` / `closed`) in the decode and replace paths, exposed via `__imglyTest.bitmaps()` — `src/infra/image-decode/`, `src/features/editor/store.ts`
- [ ] `@perf` spec: 20 opens each of the 12 MP and 48 MP fixtures; p95 of drop/input-change → `imgly:first-frame`; longest `longtask` per open
- [ ] Scripted pinch, Ctrl/Cmd+wheel and pan over a 4096 px Original under a CDP trace; fps from presented frames
- [ ] Memory: CDP `HeapProfiler.collectGarbage` after open 1 and 10; sum renderer + GPU process footprint; ratio ≤ 1.10; bitmap counter back to 1 retained Original
- [ ] Print a results table; document how to run it (`pnpm test:e2e --grep @perf --project chromium`) in `e2e/open-and-view/perf.spec.ts` header

## Edge cases

| Case | Behaviour |
|---|---|
| Run on a CI runner | excluded by `grepInvert` (T18); numbers bind only to the reference machine |
| Longest task > 200 ms on any accepted image | suite fails and names the file |
| Bitmap counter ≠ 1 after ten opens | suite fails (leak) |

## Definition of Done

- [ ] The `@perf` suite runs by hand on the reference machine and reports p95 TTFP, longest task, fps and the memory ratio against the spec §6 targets
- [ ] The bitmap counter returns to one retained Original after ten opens
- [ ] lint + typecheck clean
