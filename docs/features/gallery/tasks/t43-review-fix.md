---
id: T43
title: "A thumbnail that will not decode never turns the open Work's entry Damaged"
layer: "app"
deps: ["T42"]
acs: ["AC-07", "AC-03"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryList.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14-r3 R3-3"
---

# T43 — A thumbnail that will not decode never turns the open Work's entry Damaged

Finding R3-3 of [review-2026-10-14-r3.md](../_review/review-2026-10-14-r3.md).

## Definition of done

gallery.markDamaged leaves the entry for editor.openWorkId Open (Delete still aria-disabled with its hint) and does not add the open id to the page's damaged set; tested in the gallery store and GalleryList.
