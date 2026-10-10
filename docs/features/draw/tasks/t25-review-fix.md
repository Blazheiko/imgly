---
id: T25
title: "The custom swatch keeps the last custom colour after a preset is picked; the Custom colour accessible-name test can fail"
layer: "ui"
deps: ["T23"]
acs: ["AC-02"]
files_hint: ["src/features/draw/DrawControls.vue", "src/features/draw/DrawControls.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 Q2, Q4"
---

# T25 — The custom swatch keeps the last custom colour after a preset is picked; the Custom colour accessible-name test can fail

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding Q2, Q4. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

Pick #123456 then Red: the custom swatch shows #123456 and the picker opens on it; the aria-label assertion reads the input.
