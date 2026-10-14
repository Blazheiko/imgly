---
id: T26
title: "The page remembers damaged Works: wire damagedIds into Autosave, keep the Damaged mark across refresh, and mark an entry damaged when its thumbnail fails to decode"
layer: "app"
deps: ["T25"]
acs: ["AC-08"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryEntry.vue", "src/features/gallery/components/GalleryList.test.ts", "src/infra/db/testing.ts"]
owner: "Blazheiko"
estimate: "M"
status: "todo"
source: "review-2026-10-14 S1-3 (page half), S1-4"
---

# T26 — The page remembers damaged Works: wire damagedIds into Autosave, keep the Damaged mark across refresh, and mark an entry damaged when its thumbnail fails to decode

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S1-3 (page half), S1-4. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

Editor store keeps a page-level damaged-id set fed by a damaged reopen and a thumbnail decode error and passes it as createAutosave damagedIds; gallery refresh keeps the mark; GalleryEntry's img @error marks the entry Damaged; tests cover each, including an image/png Blob of garbage bytes.
