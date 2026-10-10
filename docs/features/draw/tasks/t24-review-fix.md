---
id: T24
title: "Value-equal points paint a dot, so a tap with a zero-length move leaves a mark on every engine; dot and Eraser-click e2e on all three engines"
layer: "app"
deps: ["T21"]
acs: ["AC-01", "AC-04"]
files_hint: ["src/features/draw/stroke-session.ts", "src/features/draw/stroke-session.test.ts", "e2e/draw/tool.spec.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 S4"
---

# T24 — Value-equal points paint a dot, so a tap with a zero-length move leaves a mark on every engine; dot and Eraser-click e2e on all three engines

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding S4. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

Unit row 'two equal points give a dot' passes; the dot and Eraser-click e2e run outside the Chromium-only block.
