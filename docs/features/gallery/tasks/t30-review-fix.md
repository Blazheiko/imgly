---
id: T30
title: "Notices and refresh: the damaged notice's Delete always opens its dialog, a successful save keeps the storage-full notice, and only the latest refresh assigns the list without leaking thumbnail URLs"
layer: "ui"
deps: ["T29"]
acs: ["AC-08", "AC-10", "AC-11", "AC-03"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryList.vue", "src/features/gallery/components/GalleryOverlay.vue", "src/features/gallery/components/GalleryStart.vue", "src/features/gallery/index.ts", "src/app/App.vue", "src/features/editor/autosave.ts", "src/features/editor/autosave.test.ts"]
owner: "Blazheiko"
estimate: "M"
status: "todo"
source: "review-2026-10-14 S2-4, S2-5, S2-6"
---

# T30 — Notices and refresh: the damaged notice's Delete always opens its dialog, a successful save keeps the storage-full notice, and only the latest refresh assigns the list without leaking thumbnail URLs

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S2-4, S2-5, S2-6. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

DeleteWorkDialog is mounted once outside GalleryList and opens from the notice with no list mounted; pendingDelete never surfaces later unasked; autosave withdraws only the save-failed notice; overlapping refresh() calls assign only the newest list and revoke every superseded URL; tests for each.
