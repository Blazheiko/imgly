---
id: T28
title: "Context-loss tests cover setLayer and updateLayer while the context is restoring"
layer: "tests"
deps: ["T27"]
acs: []
files_hint: ["src/render/context-loss.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 Q8"
---

# T28 — Context-loss tests cover setLayer and updateLayer while the context is restoring

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding Q8. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

Two context-loss cases assert one full upload of the held layer on restore and no texSubImage2D.
