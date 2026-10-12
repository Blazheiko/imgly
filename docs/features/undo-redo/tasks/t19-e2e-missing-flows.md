---
id: T19
title: "e2e-through-UI: Undo after non-counting actions, Ctrl/Cmd+Z during an export, Ctrl/Cmd+Z with Draw open, and the save point skipping the replace dialog"
layer: "tests"
deps: ["T15"]
acs: ["AC-06", "AC-07", "AC-08", "AC-09"]
files_hint: ["e2e/undo-redo/flows.spec.ts", "e2e/undo-redo/helpers.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
---

# T19 — e2e-through-UI: Undo after non-counting actions, Ctrl/Cmd+Z during an export, Ctrl/Cmd+Z with Draw open, and the save point skipping the replace dialog

Follow-up from the independent review, finding F2 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

flows.spec covers the four test-plan e2e rows of AC-06, AC-07 (the downloaded file matches the Work at confirm, Undo works after), AC-08 (strokes kept + notice, one Undo after Apply takes them back) and AC-09 (open another image at the save point → no replace dialog).
