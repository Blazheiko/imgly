---
id: T20
title: "Add the @perf suite: drag frame interval, Apply / Cancel / Reset / Compare-release and tool-ready times, Auto time, memory after 50 Applies, and export time with all seven set"
layer: "tests"
deps: ["T17", "T18", "T19"]
blocks: []
acs: ["AC-01", "AC-12"]
files_hint: ["e2e/adjust/perf.spec.ts", "e2e/export/perf.spec.ts", "src/features/adjust/AdjustControls.vue"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 46 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T20 — Add the @perf suite: drag frame interval, Apply / Cancel / Reset / Compare-release and tool-ready times, Auto time, memory after 50 Applies, and export time with all seven set

## Place in the sequence

- **Blocked by:** T17 — Add the e2e fidelity suite: each slider at its anchors vs Preview, all seven combined, with and without a Geometry, neutral = 0 difference, exact alpha, lossless round trip, smaller sizes · T18 — Add the e2e tool-flow suite: three-action paths, live Preview on drag, Compare by mouse, keys and backslash, Cancel and Reset, Auto values and the nothing hint, keyboard-only use · T19 — Add the e2e cross-feature suite: Unsaved edits, export and crop refusals in both directions, replace while open, no-image hint, View untouched, Crop and rotate shows the adjusted image.
- **Blocks:** — (end of the chain).
- **Wave:** 9 — alone in its wave.
- **Lane:** shares `src/features/adjust/AdjustControls.vue` with T15 — serialized.

## Why (user story)

> **US-01: Make a dull photo lighter or punchier**
>
> **As a** Editor  
> **I want** to change the brightness and contrast of the image with sliders and see the result while I drag  
> **So that** a dark or flat photo looks the way I remember it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It measures the responsiveness promises of spec §6 on the reference machine.

## Inlined context

> | Preview update while dragging any slider | p95 frame interval ≤ 33 ms (at least 30 updates per second) | frame-timing trace in an e2e performance test on the reference machine |
> | From choosing Apply, Cancel or Reset, or releasing Compare, to the updated Preview | p95 ≤ 150 ms | e2e performance test on the reference machine |
> | From choosing "Adjust" to the tool being ready to use | p95 ≤ 150 ms | e2e performance test on the reference machine |
> | From choosing Auto to the sliders and the Preview showing its values | p95 ≤ 300 ms | e2e performance test on the reference machine |
> | Export time with all seven Adjustments away from neutral | within export §6 targets: full-size JPEG at quality 90 p95 ≤ 1 s, full-size PNG p95 ≤ 2 s | export's e2e performance test, repeated with all seven values set |
> | Memory after 50 applied Adjustment changes | ≤ 110% of memory after the first Apply | whole-page memory as export §6 measures it, Chromium e2e |
>
> — `spec.md §6, NFR rows 1–5 + 9, verbatim` · full text: [spec.md](../spec.md)

> Reference machine: Apple M1 MacBook Air with the latest stable Chrome … The Work for the timing rows is 4096×3072 px. Each p95 is taken over 20 runs after 2 warm-up runs.
>
> — `spec.md §6, preamble, abridged` · full text: [spec.md](../spec.md)

> A new `e2e/adjust/perf.spec.ts` tagged `@perf` (run with `PERF=1` on the reference machine). It uses a frame-timing trace while dragging, performance marks from the action to the redrawn Preview, to the tool-ready mark and to Auto's frame (§7), and whole-page memory as export §6 measures it (`e2e/perf-memory.ts`), Chromium only.
>
> — `sad.md §10, QG-3 How verify, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Mirror `e2e/crop-rotate/perf.spec.ts` (Chromium-only skip, `@perf` names, `PERF=1`). Add an `imgly:adjust-auto-shown` mark in `AdjustControls.vue` on the frame after Auto's values land (`requestAnimationFrame` after the store update). Tool-ready mark comes from T16.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Adjust" tool, drags the brightness slider to +30 and chooses Apply
> **Then** while the slider moves, the Preview shows the Work with the slider's latest value at least 30 times per second (§6); values skipped during a fast drag need not be shown, and the value where the slider stops is always shown. On Apply the tool closes and the Preview keeps showing it. The tool shows seven sliders in this order: brightness, contrast, saturation, temperature and tint from −100 to +100, and grayscale and sepia from 0% to 100%, each with its current value in a number field next to it and its neutral value (0, or 0%) marked. All values are whole numbers. The grayscale and sepia fields hold the bare number with a "%" label next to the field. The tool opens with the Work's current Adjustments, which are neutral for a newly opened Work. After Apply the Work has Unsaved edits (AC-11)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — happy path

> **Given** the "Adjust" tool is open on an image that is not all one colour
> **When** the Editor chooses Auto
> **Then** the brightness, contrast, temperature and tint sliders move to values computed from the pixels inside the Work's Crop, and the Preview shows the result; saturation, grayscale and sepia stay as they were. The values are computed from the Work with its Geometry and without any Adjustments, and they replace the four sliders' values instead of adding to them, so choosing Auto again gives the same values. The Editor can change the values afterwards, and they reach the Work only on Apply. Fully transparent pixels are ignored
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Auto-shown mark — `src/features/adjust/AdjustControls.vue`
- [ ] Drag, action-to-Preview, tool-ready, Auto and memory measurements — `e2e/adjust/perf.spec.ts`
- [ ] Export timing repeated with all seven values set — `e2e/export/perf.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Run without `PERF=1` | suite skipped, CI unaffected |
| Firefox / WebKit | skipped (Chrome is the reference) |

## Definition of Done

- [ ] `PERF=1 pnpm test:e2e --grep @perf e2e/adjust` runs and reports every row above on the reference machine; results recorded in the PR
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
