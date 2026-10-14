---
id: T30
title: "Notices: the damaged notice's Delete always opens its dialog, and a successful save keeps the storage-full notice"
layer: "ui"
deps: ["T29"]
acs: ["AC-08", "AC-10", "AC-11", "AC-03"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryList.vue", "src/features/gallery/components/GalleryOverlay.vue", "src/features/gallery/components/GalleryStart.vue", "src/features/gallery/index.ts", "src/app/App.vue", "src/features/editor/autosave.ts", "src/features/editor/autosave.test.ts"]
owner: "Blazheiko"
estimate: "M"
status: "done"
source: "review-2026-10-14 S2-4, S2-5"
---

# T30 — Notices: the damaged notice's Delete always opens its dialog, and a successful save keeps the storage-full notice

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S2-4, S2-5. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

DeleteWorkDialog is mounted once outside GalleryList and opens from the notice with no list mounted; pendingDelete never surfaces later unasked; autosave withdraws only the save-failed notice; tests for each. (S2-6 moved to T33.)