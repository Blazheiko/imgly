---
id: T20
title: "Complete the @perf suite: drawing frame interval and latency through the real overlay, tool-ready, Apply / Cancel / Clear and Crop-and-rotate Apply over a full layer, export time with a full layer, and memory after 50 Applies"
layer: "tests"
deps: ["T9", "T17", "T18", "T19"]
blocks: []
acs: ["AC-01"]
files_hint: ["e2e/draw/perf.spec.ts", "e2e/export/perf.spec.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "S"   # measured: 33 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T20 — Complete the @perf suite: drawing frame interval and latency through the real overlay, tool-ready, Apply / Cancel / Clear and Crop-and-rotate Apply over a full layer, export time with a full layer, and memory after 50 Applies

## Place in the sequence

- **Blocked by:** T9 — Spike the hot path: a @perf e2e that paints scripted Strokes through the hooks at 1 px and 200 px, at Fit and at 100%, and records the frame interval and the pointer-to-frame latency · T17 — Add the e2e fidelity suite: reference drawing vs Preview at 100% for each Geometry case and with Adjustments, empty layer = 0, Geometry round trips = 0, image pixels unchanged outside marks, smaller sizes and the transparency hint · T18 — Add the e2e tool-flow suite: the live line through every position, a dot, the Eraser, Clear, Apply and Cancel, the clip at the Crop, drag vs pan and zoom in the tool, the keyboard path and the layer ledger · T19 — Add the e2e cross-feature suite: Unsaved edits rules, export and Ctrl/Cmd+S refused while drawing, one tool at a time in both directions, Draw refused during an export and with no image, replace while open, and marks in Crop and rotate and Adjust.
- **Blocks:** — (last in its chain).
- **Wave:** 9 — alone.
- **Lane:** shares `e2e/draw/perf.spec.ts` with T9 — serialized.

## Why (user story)

> **US-01: Draw freehand on the photo**
>
> **As a** Editor  
> **I want** to draw on the image with a brush by dragging across it and see the line appear under the pointer  
> **So that** I can circle, underline or write on the photo without another program
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It confirms the live-drawing and no-leak goals on the reference machine with the finished tool.

## Inlined context

> | From choosing "Draw" to the tool being ready to draw | p95 ≤ 150 ms | e2e performance test on the reference machine |
> | From choosing Apply, Cancel or Clear to the updated Preview | p95 ≤ 150 ms, with the Drawing layer covered by marks over the whole image | e2e performance test on the reference machine |
> | From choosing Apply in "Crop and rotate" to the updated Preview, with marks over the whole image | p95 ≤ 150 ms | e2e performance test on the reference machine |
> | Export time with marks over the whole image | within export §6 targets: full-size JPEG at quality 90 p95 ≤ 1 s, full-size PNG p95 ≤ 2 s | export's e2e performance test, repeated with a full Drawing layer |
> | Memory after 50 Applies, each with a new Stroke across the whole image | ≤ 110% of memory after the first Apply | whole-page memory as export §6 measures it, Chromium e2e |
>
> — `spec.md §6, NFR rows 3–6 and 10, verbatim` · full text: [spec.md](../spec.md)

> "Covered by marks over the whole image" means 200 px Brush Strokes 100 px apart that together cover every pixel of the image. "A Stroke across the whole image" means one 200 px Brush Stroke from one edge of the image to the opposite edge.
>
> — `spec.md §6, preamble definitions, verbatim` · full text: [spec.md](../spec.md)

Extend the T9 spike file (same lane) to drive the real overlay with scripted pointer moves at 120/s, and read the §7 marks (tool ready, per-frame Stroke, Apply/Cancel/Clear/Crop-Apply). Memory uses `e2e/perf-memory.ts`. For export time, parametrise `e2e/export/perf.spec.ts` with a full layer via `setReferenceDrawing`-style hook.

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

- [ ] Frame interval + latency via overlay, tool-ready, Apply/Cancel/Clear, Crop-Apply, memory 50 Applies — `e2e/draw/perf.spec.ts`
- [ ] Export time with full layer — `e2e/export/perf.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| PERF unset | skipped |
| a row misses | reported with its p95; recorded as a risk, not loosened |

## Definition of Done

- [ ] all spec §6 timing and memory rows measured on the reference machine and within target
- [ ] results noted in the PR description
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
