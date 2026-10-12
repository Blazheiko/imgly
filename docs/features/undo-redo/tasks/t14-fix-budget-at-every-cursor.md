---
id: T14
title: "Bound the Edit history at every cursor position, so Undo can never take it over 512 000 000 B"
layer: "domain"
deps: []
acs: ["AC-11"]
files_hint: ["src/core/history/budget.ts", "src/core/history/budget.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
---

# T14 — Bound the Edit history at every cursor position, so Undo can never take it over 512 000 000 B

Follow-up from the independent review, finding F1 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

trim drops the oldest entries while the held bytes at the worst cursor position exceed the budget; a unit test that undoes 11 whole-image drawing Steps back to the opened state (no layer) asserts held bytes ≤ 512 000 000 at every position; the reference Work still keeps 10 drawing Steps and a 4096 × 4096 Work 7.
