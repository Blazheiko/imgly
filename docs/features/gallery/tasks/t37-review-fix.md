---
id: T37
title: "While the database connects, the Gallery shows neither a count, the empty state nor a storage line"
layer: "ui"
deps: ["T35"]
acs: ["AC-03", "AC-05"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryList.vue", "src/features/gallery/components/GalleryStart.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14-r2 R2-3"
---

# T37 — While the database connects, the Gallery shows neither a count, the empty state nor a storage line

Finding R2-3 of [review-2026-10-14-r2.md](../_review/review-2026-10-14-r2.md).

## Definition of done

Before the first listing after connect, gallery-count, gallery-empty and the storage line are absent on SCR-01 and SCR-03; they appear once the list is read.
