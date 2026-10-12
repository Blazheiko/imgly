---
id: T18
title: "Strengthen the memory e2e: held bytes after every Apply and after the Undos; AC-04 discards 10 Steps and checks Redo"
layer: "tests"
deps: ["T14"]
acs: ["AC-04", "AC-11"]
files_hint: ["e2e/undo-redo/memory.spec.ts", "e2e/undo-redo/helpers.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
---

# T18 — Strengthen the memory e2e: held bytes after every Apply and after the Undos; AC-04 discards 10 Steps and checks Redo

Follow-up from the independent review, finding F3, F4 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

memory.spec asserts heldBytes ≤ 512 000 000 after every Apply and after every Undo; the AC-04 test undoes all 10 drawing Steps, applies through the UI, and asserts Redo is aria-disabled with the hint 'Nothing to redo' alongside the layer ledger.
