---
id: T45
title: "A listing that fails keeps what the Gallery showed and never shows a false empty Gallery"
layer: "app"
deps: ["T44"]
acs: ["AC-03", "AC-05"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryStart.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14-r3 R3-4"
---

# T45 — A listing that fails keeps what the Gallery showed and never shows a false empty Gallery

Finding R3-4 of [review-2026-10-14-r3.md](../_review/review-2026-10-14-r3.md).

## Definition of done

When listWorks fails, refresh() keeps the previous entries and listRead (a first listing leaves listRead false, so no count, empty-state text or storage line) and shows a failure notice; tested for a first and a later failing listing.
