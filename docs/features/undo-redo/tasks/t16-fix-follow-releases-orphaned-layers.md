---
id: T16
title: "Release the old history's layers when follow() restarts the Edit history"
layer: "app"
deps: []
acs: ["AC-04", "AC-10"]
files_hint: ["src/features/editor/edit-history.ts", "src/features/editor/edit-history.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
---

# T16 — Release the old history's layers when follow() restarts the Edit history

Follow-up from the independent review, finding F7 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

when follow() starts a new history for a Work it has not followed, every layer the old entries held that neither the new history nor the Work refers to is released through the one release path; a unit test asserts it.
