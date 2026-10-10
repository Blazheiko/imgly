---
id: T21
title: "A Stroke takes focus from the tool panel: blur a focused panel control on a main-button pointerdown, committing pending width text; e2e drives real drags instead of leaveField"
layer: "ui"
deps: ["T16"]
acs: ["AC-03", "AC-18", "AC-19"]
files_hint: ["src/features/draw/DrawOverlay.vue", "src/features/draw/DrawOverlay.test.ts", "e2e/draw/helpers.ts", "e2e/draw/tool.spec.ts", "e2e/draw/cross-feature.spec.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 S1"
---

# T21 — A Stroke takes focus from the tool panel: blur a focused panel control on a main-button pointerdown, committing pending width text; e2e drives real drags instead of leaveField

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding S1. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

After a drag on the overlay, Enter applies, B/E/[ ] act, Space-drag pans and a typed width is used by the Stroke; no e2e uses a scripted blur.
