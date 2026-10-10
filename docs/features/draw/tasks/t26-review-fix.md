---
id: T26
title: "A focused, selected swatch shows both the selected ring and the focus ring"
layer: "ui"
deps: ["T25"]
acs: ["AC-02"]
files_hint: ["src/shared/ui/SegmentedControl.vue", "src/shared/ui/primitives.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-10 Q3"
---

# T26 — A focused, selected swatch shows both the selected ring and the focus ring

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding Q3. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

The selected ring is drawn so :focus-visible no longer replaces it; primitives test covers it.
