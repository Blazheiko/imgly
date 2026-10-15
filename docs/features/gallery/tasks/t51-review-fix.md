---
id: T51
title: "A delete that commits removes its entry even when the listing after it fails"
layer: "app"
deps: ["T50"]
acs: ["AC-06"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-15-r4 R4-2"
---

# T51 — A delete that commits removes its entry even when the listing after it fails

Finding R4-2 of [review-2026-10-15-r4.md](../_review/review-2026-10-15-r4.md).

## Definition of done

When deleteWork succeeds, the entry leaves entries (its URL revoked after nextTick) before refresh(); a listing that then fails still shows the entry gone and the count one lower. Tested in gallery/store.test.ts.
