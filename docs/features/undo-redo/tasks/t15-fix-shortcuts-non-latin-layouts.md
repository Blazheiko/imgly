---
id: T15
title: "Match Ctrl/Cmd+Z and Ctrl+Y by key position on non-Latin layouts (letter-first rule)"
layer: "ui"
deps: []
acs: ["AC-14"]
files_hint: ["src/shared/keyboard.ts", "src/shared/keyboard.test.ts", "src/shared/index.ts", "src/features/undo-redo/shortcuts.ts", "src/features/undo-redo/shortcuts.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
---

# T15 — Match Ctrl/Cmd+Z and Ctrl+Y by key position on non-Latin layouts (letter-first rule)

Follow-up from the independent review, finding F6 in [`_review/review-2026-10-12.md`](../_review/review-2026-10-12.md). The finding there gives the cited problem.

## Definition of Done

isLetter lives in src/shared/keyboard.ts; the undo-redo shortcuts accept event.code KeyZ/KeyY when the key types no Latin letter, while a Latin layout typing another letter there keeps it; unit tests cover a Cyrillic layout.
