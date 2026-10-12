---
id: T17
title: "Add the test plan's missing component and integration cases"
layer: "tests"
deps: ["T14"]
acs: ["AC-04", "AC-08", "AC-09", "AC-10", "AC-11", "AC-14"]
files_hint: ["src/features/undo-redo/UndoRedoActions.test.ts", "src/features/editor/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
---

# T17 — Add the test plan's missing component and integration cases

Follow-up from the independent review, finding F5 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

component tests: Redo shows 'Nothing to redo' after a new Apply that follows an Undo; both buttons show nothing after a replace; Undo unavailable at the oldest kept Step after a trim; Space activates a button. Integration: AC-08 Apply after the refusal makes the tool's Step the last one; Undo after a cancelled or failed export takes back the last real change.
