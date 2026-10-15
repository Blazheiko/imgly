---
id: T44
title: "A reopen that fails to read storage says so, without marking the Work Damaged or offering Delete"
layer: "app"
deps: ["T43"]
acs: ["AC-08", "AC-06"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "src/features/gallery/messages.ts", "docs/features/gallery/screens.md"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14-r3 R3-2"
---

# T44 — A reopen that fails to read storage says so, without marking the Work Damaged or offering Delete

Finding R3-2 of [review-2026-10-14-r3.md](../_review/review-2026-10-14-r3.md).

## Definition of done

choose() marks the entry and shows the damaged notice with Delete only for WORK_DAMAGED; STORAGE_FAILED shows a plain failure notice with no action and leaves the entry's status alone; screens.md gains the row; gallery-store test covers both codes.
