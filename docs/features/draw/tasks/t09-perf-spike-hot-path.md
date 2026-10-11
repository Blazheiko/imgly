---
id: T9
title: "Spike the hot path: a @perf e2e that paints scripted Strokes through the hooks at 1 px and 200 px, at Fit and at 100%, and records the frame interval and the pointer-to-frame latency"
layer: "tests"
deps: ["T8"]
blocks: ["T12", "T20"]
acs: ["AC-01"]
files_hint: ["e2e/draw/perf.spec.ts", "docs/features/draw/tasks/_epic.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 33 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Spike the hot path: a @perf e2e that paints scripted Strokes through the hooks at 1 px and 200 px, at Fit and at 100%, and records the frame interval and the pointer-to-frame latency

## Place in the sequence

- **Blocked by:** T8 — Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger.
- **Blocks:** T12 — Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released · T20 — Complete the @perf suite: drawing frame interval and latency through the real overlay, tool-ready, Apply / Cancel / Clear and Crop-and-rotate Apply over a full layer, export time with a full layer, and memory after 50 Applies.
- **Wave:** 4 — alongside T13, T14, T17.
- **Lane:** shares `e2e/draw/perf.spec.ts` with T20 — serialized.

## Why (user story)

> **US-01: Draw freehand on the photo**
>
> **As a** Editor  
> **I want** to draw on the image with a brush by dragging across it and see the line appear under the pointer  
> **So that** I can circle, underline or write on the photo without another program
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It proves, before any tool UI exists, that a Stroke can reach the Preview at least 30 times a second on the largest Work.

## Inlined context

> | The hot path may miss 33 ms per frame or 50 ms from pointer to frame at Fit on 4096×3072. Each frame reads back a dirty rectangle and uploads it, below 100% it also regenerates the whole layer's mipmaps (ADR-0003), and a 200 px Brush rasterises on the CPU (`willReadFrequently`) | Medium | The first draw task is a spike that measures the per-frame cost at 1 px and 200 px, at Fit and at 100%, with `@perf` on the reference machine, before the tool UI is built. If it misses, the fallbacks in order are: during a Stroke below 100%, regenerate the mipmaps at most every other frame and once more on release; paint at most one coalesced batch per frame; move the painter into a worker behind the same `render/drawing` interface (ADR-0002 Neutral) |
>
> — `sad.md §11, hot-path risk, verbatim` · full text: [sad.md](../sad.md)

> | Preview update while drawing a Stroke with the Brush or the Eraser | p95 frame interval ≤ 33 ms (at least 30 updates per second), at the widest width of 200 px and at 1 px | frame-timing trace in an e2e performance test on the reference machine |
> | From a pointer move to the frame that shows the Stroke reaching that point | p95 ≤ 50 ms | e2e performance test on the reference machine, scripted pointer moves |
>
> — `spec.md §6, NFR rows 1–2, verbatim` · full text: [spec.md](../spec.md)

> Reference machine: Apple M1 MacBook Air with the latest stable Chrome … The Work for the timing rows is 4096×3072 px. Each p95 is taken over 20 runs after 2 warm-up runs. The drawing rows are measured twice, with the View at Fit and at 100%, and both must pass. Scripted pointer moves arrive at 120 per second.
>
> — `spec.md §6, preamble, abridged` · full text: [spec.md](../spec.md)

Reuse `e2e/adjust/perf.spec.ts` for the `@perf` tag, `PERF=1` skip and p95 helper. Drive `__imglyTest.paintStroke` at 120 Hz with `requestAnimationFrame`-timed frame marks. A miss is not a failed task: record the numbers, pick the fallback, and make T12 (which depends on this task) carry it. T20 later extends this same file.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Draw" tool, drags across the image with the Brush and chooses Apply
> **Then** while the pointer moves, the Stroke appears under it at least 30 times per second (§6) as one continuous line of the chosen colour and width, with round ends and smooth edges and no visible gaps or corners on a fast curve. The line passes through every pointer position the browser reports, including the coalesced positions between frames, joined smoothly; no stabiliser moves it away from those positions, and it does not change after the pointer is released. A click without moving paints one round dot of that width. On Apply the tool closes and the Preview keeps showing the Stroke over the image. The tool always opens with the Brush selected, with the colour and width last chosen in this session (red #E53935 and 12 px the first time), and with the Work's applied Drawing layer, which is empty for a newly opened Work. After Apply the Work has Unsaved edits (AC-12)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Spike spec at 1/200 px × Fit/100% on a 4096×3072 fixture — `e2e/draw/perf.spec.ts`
- [ ] Run with `PERF=1 pnpm test:e2e --project=chromium e2e/draw/perf.spec.ts` on the reference machine
- [ ] Record p95s and the decision in `_epic.md` §Risks — `docs/features/draw/tasks/_epic.md`

## Edge cases

| Case | Behaviour |
|---|---|
| PERF unset | suite skipped in CI |
| Fit below 100% with mipmaps | measured separately from 100% |
| a miss on any case | fallback recorded in order; T12 implements it |

## Definition of Done

- [ ] four measured cases recorded with their p95s
- [ ] decision (no change, or the named fallback) written in `_epic.md`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
