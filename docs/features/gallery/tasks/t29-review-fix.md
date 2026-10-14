---
id: T29
title: "Before the database connects: SCR-01 shows the listing state, not a false unavailable reason, and a Work opened in that window is stored once the connection opens"
layer: "app"
deps: ["T28"]
acs: ["AC-12", "AC-01"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryStart.test.ts", "src/features/editor/store.ts", "src/features/editor/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14 S1-8"
---

# T29 — Before the database connects: SCR-01 shows the listing state, not a false unavailable reason, and a Work opened in that window is stored once the connection opens

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S1-8. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

Gallery store: a null connection gives unavailableReason null (newer-version only when connected and the editor reports unavailable); editor store: connectGallery with a Work open requests one save; tests for both, and GalleryStart renders no unavailable copy while connecting.
