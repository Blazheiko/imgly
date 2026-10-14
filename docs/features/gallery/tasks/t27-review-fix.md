---
id: T27
title: "The Gallery overlay: close after a confirmed reopen, Esc in SCR-04 or SCR-05 cancels the dialog only, and the overlay covers the status bar"
layer: "ui"
deps: ["T26"]
acs: ["AC-04", "AC-17", "AC-06", "AC-03"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryOverlay.vue", "src/features/gallery/components/GalleryOverlay.test.ts", "src/features/editor/EditorView.vue", "e2e/gallery/gate-and-lifecycle.spec.ts"]
owner: "Blazheiko"
estimate: "M"
status: "todo"
source: "review-2026-10-14 S1-5, S1-6, S2-7"
---

# T27 — The Gallery overlay: close after a confirmed reopen, Esc in SCR-04 or SCR-05 cancels the dialog only, and the overlay covers the status bar

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S1-5, S1-6, S2-7. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

GalleryOverlay/store tests: choosing a Work that asks, then Replace, hides the overlay and focuses Gallery; Cancel keeps it open; Esc in DeleteWorkDialog or ReplaceDialog over the overlay closes only the dialog; the overlay box covers the status bar; an e2e: failed save, choose a Work, Replace, overlay hidden.
