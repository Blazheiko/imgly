---
id: T30
title: "Fix the @perf drawing measurement: latency to the frame after the renderer draws, move i matched to the draw after i+1, Eraser runs, the 1 px timeouts explained; re-measure"
layer: "tests"
deps: ["T27", "T29"]
acs: ["AC-01"]
files_hint: ["src/app/test-hooks.ts", "e2e/draw/perf.spec.ts", "e2e/test-hooks.d.ts", "docs/features/draw/tasks/_epic.md"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-10 S3"
---

# T30 — Fix the @perf drawing measurement: latency to the frame after the renderer draws, move i matched to the draw after i+1, Eraser runs, the 1 px timeouts explained; re-measure

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding S3. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

The perf rows time the right frame, cover Brush and Eraser at 1 px and 200 px at Fit and 100%, and run to completion; results recorded in _epic.md.
