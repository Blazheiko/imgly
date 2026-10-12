---
id: T23
title: "Make the AC-08 Draw-open e2e cheap: reduce the alpha readbacks in the page"
layer: "tests"
deps: ["T19"]
acs: ["AC-08"]
files_hint: ["e2e/undo-redo/flows.spec.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
---

# T23 — Make the AC-08 Draw-open e2e cheap: reduce the alpha readbacks in the page

Follow-up from the second re-review, finding S1 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

The AC-08 Draw-open e2e compares the Draft and the Drawing layer through a mark count and a checksum that the page computes. It never sends a full alpha array to Node. Its timeout is 120 s, like its sibling tests. It still fails if Ctrl/Cmd+Z changes the Draft, or if one Undo leaves strokes.
