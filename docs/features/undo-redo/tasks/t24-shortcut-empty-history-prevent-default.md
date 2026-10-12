---
id: T24
title: "Pin preventDefault on an empty-history shortcut and align the test plan"
layer: "tests"
deps: ["T7"]
acs: ["AC-05"]
files_hint: ["src/features/undo-redo/shortcuts.test.ts", "docs/features/undo-redo/spec.md"]
owner: "Blazheiko"
estimate: "S"
status: "done"
---

# T24 — Pin preventDefault on an empty-history shortcut and align the test plan

Follow-up from the second re-review, finding S2 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The owner chose to keep the code: a handled key calls `preventDefault`, as `screens.md` §Keyboard and `sad.md` say.

## Definition of Done

The AC-05 shortcut unit test asserts that `defaultPrevented` is true for Ctrl/Cmd+Z and Ctrl+Y when there is nothing to undo or redo. The `spec.md` test-plan row says the key is taken and nothing changes, which matches `screens.md` §Keyboard and `sad.md`.
