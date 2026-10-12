---
id: T22
title: "e2e-through-UI: assert the buttons the user sees after an Undo (AC-01) and after a replace (AC-10)"
layer: "tests"
deps: ["T19"]
acs: ["AC-01", "AC-10"]
files_hint: ["e2e/undo-redo/flows.spec.ts", "e2e/undo-redo/memory.spec.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
---

# T22 — e2e-through-UI: assert the buttons the user sees after an Undo (AC-01) and after a replace (AC-10)

Follow-up from the independent re-review, finding R2 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

After the Undo, the AC-01 shortcut e2e asserts that Redo is available with the hint "Redo Adjust (Shift+Ctrl/Cmd+Z)". After a replace, the AC-10 e2e asserts that both buttons are aria-disabled, with the hints "Nothing to undo" and "Nothing to redo".
