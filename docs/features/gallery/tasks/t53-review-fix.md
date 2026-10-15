---
id: T53
title: "Cancelling a Delete opened from the damaged notice returns focus to that entry's Delete"
layer: "ui"
deps: ["T52"]
acs: ["AC-06"]
files_hint: ["src/features/gallery/components/DeleteWorkDialog.vue", "src/features/gallery/components/GalleryList.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-15-r4 R4-4"
---

# T53 — Cancelling a Delete opened from the damaged notice returns focus to that entry's Delete

Finding R4-4 of [review-2026-10-15-r4.md](../_review/review-2026-10-15-r4.md).

## Definition of done

Outside standby, DeleteWorkDialog returns focus to the pending entry's Delete button; standby keeps the Gallery button. Tested in GalleryList/GalleryStart: Delete… on the notice, Cancel, focus is on [data-delete-id=<id>], not body.
