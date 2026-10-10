---
id: T31
title: "QG-2b oracle: Export after each Rotation, Flip and Straighten equals the layer mapped through frameToOriginal; one case through the real Crop and rotate Apply; a Geometry Apply keeps the layer"
layer: "tests"
deps: ["T29"]
acs: ["AC-08"]
files_hint: ["e2e/draw/fidelity.spec.ts", "e2e/draw/helpers.ts", "src/features/editor/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 S5"
---

# T31 — QG-2b oracle: Export after each Rotation, Flip and Straighten equals the layer mapped through frameToOriginal; one case through the real Crop and rotate Apply; a Geometry Apply keeps the layer

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding S5. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

A fidelity e2e compares the Export with an expected image built independently of the shader; the editor-store row asserts the layer object/id survives a Geometry Apply.
