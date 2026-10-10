---
id: T35
title: "Test the clip at a straightened Crop: a painter unit row with a Straighten Geometry and an e2e drag across a straightened Crop edge"
layer: "tests"
deps: []
acs: ["AC-09"]
files_hint: ["src/render/drawing/painter.test.ts", "e2e/draw/tool.spec.ts", "docs/features/draw/test-plan.md"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10-2 R3"
---

# T35 — Test the clip at a straightened Crop: a painter unit row with a Straighten Geometry and an e2e drag across a straightened Crop edge

A follow-up task from the re-review. The finding, its citations and the agreed fix are in
[review-2026-10-10-2.md](../_review/review-2026-10-10-2.md), finding R3. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

painter.test asserts setTransform = frameToOriginal(g) and the clip rect = the Crop under a Straighten angle; an e2e shows layer alpha outside the turned Crop at most 1 px deep; the test-plan note points to them.
