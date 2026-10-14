---
id: T38
title: "The delete confirmation over the Editor holds the keyboard and drops, and its Esc leaves an open tool alone"
layer: "wiring"
deps: ["T37"]
acs: ["AC-06", "AC-08"]
files_hint: ["src/features/editor/store.ts", "src/features/gallery/store.ts", "src/features/crop-rotate/shortcuts.ts", "src/app/App.test.ts"]
owner: "Blazheiko"
estimate: "M"
status: "todo"
source: "review-2026-10-14-r2 R2-4"
---

# T38 — The delete confirmation over the Editor holds the keyboard and drops, and its Esc leaves an open tool alone

Finding R2-4 of [review-2026-10-14-r2.md](../_review/review-2026-10-14-r2.md).

## Definition of done

With the standby DeleteWorkDialog open, tool keys, undo/redo, Ctrl+O, Ctrl+S, zoom keys and drops do nothing to the Work; Esc cancels only the dialog, the open tool keeps its Draft.
