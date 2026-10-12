---
id: T21
title: "e2e-through-UI: Ctrl/Cmd+Z on a freshly opened image leaves it unchanged and shows no notice"
layer: "tests"
deps: ["T19"]
acs: ["AC-05"]
files_hint: ["e2e/undo-redo/flows.spec.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
---

# T21 — e2e-through-UI: Ctrl/Cmd+Z on a freshly opened image leaves it unchanged and shows no notice

Follow-up from the independent re-review, finding R1 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

flows.spec, on all three engines, presses Ctrl/Cmd+Z right after the image opens. It asserts that the revision is unchanged, that Undo is aria-disabled with the hint "Nothing to undo", and that no status notice appears.
