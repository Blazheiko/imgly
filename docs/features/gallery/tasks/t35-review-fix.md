---
id: T35
title: "The page's damaged mark clears when the Work reopens or stores whole, only WORK_DAMAGED marks it, and the open Work lists Open"
layer: "app"
deps: ["T34"]
acs: ["AC-07", "AC-09", "AC-08", "AC-03"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/store.damaged.test.ts", "src/features/editor/autosave.ts", "src/features/gallery/store.ts", "src/features/gallery/store.test.ts"]
owner: "Blazheiko"
estimate: "M"
status: "done"
source: "review-2026-10-14-r2 R2-2"
---

# T35 — The page's damaged mark clears when the Work reopens or stores whole, only WORK_DAMAGED marks it, and the open Work lists Open

Finding R2-2 of [review-2026-10-14-r2.md](../_review/review-2026-10-14-r2.md).

## Definition of done

A transient STORAGE_FAILED on reopen does not mark the Work; a successful reopen or a committed save of that id removes the mark; refresh lists the open Work as Open; a Work marked then reopened is not evicted first.
