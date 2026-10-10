---
id: T27
title: "Released layers read as empty without allocating; a fresh empty layer is uploaded zero-filled with no readback"
layer: "infra"
deps: []
acs: ["AC-01"]
files_hint: ["src/render/drawing/layer.ts", "src/render/drawing/layer.test.ts", "src/render/preview-renderer.ts", "src/render/preview-renderer.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 S3 (part), Q6"
---

# T27 — Released layers read as empty without allocating; a fresh empty layer is uploaded zero-filled with no readback

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding S3 (part), Q6. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

readRect/hasAnyMark on a released layer allocate nothing; setLayer on a fresh empty layer calls texImage2D with null data and no getImageData.
