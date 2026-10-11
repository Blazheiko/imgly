---
id: T29
title: "Work.drawing is typed by the layer's pixel holder, and a refused applyDrawing leaves the Draft with its caller"
layer: "domain"
deps: ["T27"]
acs: []
files_hint: ["src/core/document.ts", "src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/draw/store.ts", "src/features/export/store.ts", "src/app/test-hooks.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-10 Q5, Q7"
---

# T29 — Work.drawing is typed by the layer's pixel holder, and a refused applyDrawing leaves the Draft with its caller

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding Q5, Q7. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

No 'as Layer' cast on Work.drawing; applyDrawing returns whether it applied and the draw store releases a refused Draft.
