---
id: T20
title: "Add the @perf suite: drag and slider frame interval, action-to-Preview and tool-ready times, memory after 50 Applies, export time with a Geometry"
layer: "tests"
deps: ["T18", "T19"]
blocks: []
acs: ["AC-05", "AC-14"]
files_hint: ["e2e/crop-rotate/perf.spec.ts", "e2e/crop-rotate/helpers.ts", "e2e/export/perf.spec.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 46 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T20 — Add the @perf suite: drag and slider frame interval, action-to-Preview and tool-ready times, memory after 50 Applies, export time with a Geometry

## Place in the sequence

- **Blocked by:** T18 — Add the e2e Geometry fidelity suite: 16 Rotation × Flip, straightened vs Preview, opacity, nothing outside the Crop, lossless round trip · T19 — Add the e2e tool-flow suite: three-action paths, export refusals, replace while open, View fit and frame alignment.
- **Blocks:** — (none; a leaf of the DAG).
- **Wave:** 9.
- **Lane:** shares `e2e/crop-rotate/helpers.ts` with T18; shares `e2e/crop-rotate/helpers.ts` with T19 — serialized.

## Why (user story)

> **US-04: Level a tilted horizon**
>
> **As a** Editor  
> **I want** to turn the image by a small free angle  
> **So that** a slightly tilted photo looks level, without empty corners
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It measures that the Preview follows the slider and the frame smoothly, that the tool responds fast, and that applying many changes doesn't leak.

## Inlined context

> Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view and export. The Work for the timing rows is 4096×3072 px. Each p95 is taken over 20 runs after 2 warm-up runs.
>
> | Aspect | Target | Measurement |
> |---|---|---|
> | Preview update while dragging the crop frame or the straighten slider | p95 frame interval ≤ 33 ms (at least 30 updates per second) | frame-timing trace in an e2e performance test on the reference machine |
> | From choosing rotate, flip, Apply, Cancel or Reset to the updated Preview | p95 ≤ 150 ms | e2e performance test on the reference machine |
> | From choosing "Crop and rotate" to the tool being ready to use | p95 ≤ 150 ms | e2e performance test on the reference machine |
> | Export time with any applied Geometry, including a Straighten angle | within export §6 targets: full-size JPEG at quality 90 p95 ≤ 1 s, full-size PNG p95 ≤ 2 s | export's e2e performance test, repeated with a 90° Rotation, a Flip and a 10° Straighten angle |
> | Memory after 50 applied Geometry changes (Rotations, Flips, Crops, Straighten angles) | ≤ 110% of memory after the first Apply | whole-page memory as export §6 measures it, Chromium e2e |
>
> — `spec.md §6, intro + NFR rows 1–4 and 8, verbatim` · full text: [spec.md](../spec.md)

> **How verify:** a new `e2e/crop-rotate/perf.spec.ts` tagged `@perf` (run with `PERF=1` on the reference machine). It uses a frame-timing trace while dragging, performance marks from the action to the redrawn Preview and to the tool-ready mark (§7), and whole-page memory as export §6 measures it (`e2e/perf-memory.ts`), Chromium only.
>
> — `sad.md §10, QG-3 How verify, verbatim` · full text: [sad.md](../sad.md)

> Performance marks in the e2e build are the measurement points for spec §6: a "tool ready" mark when SCR-03 is first drawn, frame timing through the existing performance trace, and whole-page memory through `e2e/perf-memory.ts`. They are read by the `@perf` suite (`PERF=1`) on the reference machine, not in CI.
>
> — `sad.md §7, Monitoring bullet 2, verbatim` · full text: [sad.md](../sad.md)

Pattern to copy: `e2e/export/perf.spec.ts` (p95 helper, warm-ups, `PERF=1` gate) and `e2e/perf-memory.ts`. The "tool ready" mark is emitted by T17. A miss on the reference machine is reported, not loosened.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-05 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor drags the straighten slider or types an angle
> **Then** the image turns by that angle, from −45° to +45° in steps of 0.1°, around the centre of the crop frame, and the Preview follows while the slider moves. A fine grid shows over the image while the angle changes, so the Editor can line up a horizon. A positive angle turns the image clockwise. The angle is shown next to the slider, and 0° is marked on it
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** a Geometry has been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry, matching the Preview (§6 Fidelity), and no pixel from outside the Crop. The Work's full size in the export panel is the Crop's size in pixels; the size presets and the long-side field of export AC-05 and AC-06 count from it, and a remembered size larger than the new Work snaps to it. Snapping does not replace the remembered size: a remembered long side in pixels comes back, up to the Work's full size, when the Crop is widened again. The transparency hint of export AC-15 is shown only when a pixel inside the Crop is not fully opaque. The size shown for the Work in the status bar is the Crop's size, with the Original's dimensions next to it as in AC-01
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

This task measures the timing side of AC-05 ("the Preview follows while the slider moves") and AC-14 (the Export with a Geometry within export's targets); the other §6 rows are the tool's NFRs.

## Checklist

- [ ] Frame-interval trace while dragging the frame and the slider — `e2e/crop-rotate/perf.spec.ts`
- [ ] Action → redrawn Preview marks for rotate, flip, Apply, Cancel, Reset; tool-ready mark — same file
- [ ] 50 applied changes, memory vs the first Apply via `e2e/perf-memory.ts` — same file
- [ ] Repeat JPEG q90 and PNG export timing with 90° + Flip + 10° — `e2e/export/perf.spec.ts`
- [ ] Shared timing helpers if needed — `e2e/crop-rotate/helpers.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Run without `PERF=1` (CI) | all `@perf` tests skipped |
| Non-Chromium engine | memory row skipped (Chromium only) |
| Target missed on the reference machine | test fails with the measured p95; no silent threshold change |

## Definition of Done

- [ ] `PERF=1 pnpm test:e2e --grep @perf` runs every row above and reports p95 / memory ratio
- [ ] Without `PERF=1` the suite is skipped and CI stays green
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
