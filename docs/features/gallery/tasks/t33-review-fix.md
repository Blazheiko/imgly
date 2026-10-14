---
id: T33
title: "Regression from T26: only the latest refresh assigns the Gallery list and superseded thumbnail URLs are revoked after the DOM moves on, so a reload never marks a fresh Work Damaged"
layer: "ui"
deps: ["T27"]
acs: ["AC-01", "AC-03", "AC-05", "AC-08"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/components/GalleryList.vue", "src/features/gallery/components/GalleryEntry.vue"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14 S2-6 (pulled forward from T30)"
---

# T33 — Regression from T26: only the latest refresh assigns the Gallery list and superseded thumbnail URLs are revoked after the DOM moves on

T26 marks an entry Damaged when its thumbnail `<img>` fails. At load, App's `connectGallery` refresh and
GalleryStart's `onMounted` refresh overlap; the second revokes the first list's object URLs while its
`<img>` elements still load them, the load fails, and a freshly saved Work lists as "Damaged" after a reload
(e2e `save-and-reopen.spec.ts` AC-01 :115 and AC-05 :444 fail on chromium at `d24ecd5`, pass at `fab1feb`).
This is finding S2-6 of [review-2026-10-14.md](../_review/review-2026-10-14.md), pulled forward from T30.

## Definition of done

Overlapping refresh() calls assign only the newest list and revoke every superseded URL once the new list is rendered; a thumbnail error for a URL the entry no longer shows marks nothing; e2e save-and-reopen AC-01 and AC-05 pass on chromium again.
