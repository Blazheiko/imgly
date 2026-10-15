---
id: T50
title: "Closing the overlay and then failing a listing leaves no entry Damaged"
layer: "app"
deps: []
acs: ["AC-08", "AC-09", "AC-03"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/components/GalleryList.vue", "src/features/gallery/components/GalleryList.test.ts", "src/features/gallery/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-15-r4 R4-1"
---

# T50 — Closing the overlay and then failing a listing leaves no entry Damaged

Finding R4-1 of [review-2026-10-15-r4.md](../_review/review-2026-10-15-r4.md).

## Definition of done

The gallery store owns thumbnail URL lifetime: GalleryList no longer revokes URLs the store still holds. After the overlay closes and the next listing fails, the shown entries carry live URLs, and an image error on a stale URL marks nothing. Tested: close the overlay, fail the listing, reopen it, fire an image error, and check the entry is not Damaged and editor.damagedIds is empty.
