---
id: T37
title: "Quality: layerChanged's comment back in place, a forced-colors selected ring, and the swatch CSS test asserting the invariant only"
layer: "ui"
deps: []
acs: ["AC-02"]
files_hint: ["src/features/editor/store.ts", "src/shared/ui/SegmentedControl.vue", "src/shared/ui/primitives.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-10-2 Q9, Q10, Q11"
---

# T37 — Quality: layerChanged's comment back in place, a forced-colors selected ring, and the swatch CSS test asserting the invariant only

A follow-up task from the re-review. The finding, its citations and the agreed fix are in
[review-2026-10-10-2.md](../_review/review-2026-10-10-2.md), finding Q9, Q10, Q11. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

The comment sits on layerChanged; under forced-colors the selected swatch has an outline; the CSS test checks no outline in the selected rule and a --color-text ring.
