---
id: T28
title: "Nothing reaches the Work under the open Gallery: opens, drops, zoom, Undo/Redo and the save shortcut do nothing while activePanel is gallery"
layer: "wiring"
deps: ["T27"]
acs: ["AC-03"]
files_hint: ["src/features/editor/EditorView.vue", "src/features/editor/EditorView.test.ts", "src/features/undo-redo/UndoRedoActions.vue", "src/features/undo-redo/UndoRedoActions.test.ts", "src/features/export/ExportAction.vue", "src/features/export/ExportAction.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-14 S1-7"
---

# T28 — Nothing reaches the Work under the open Gallery: opens, drops, zoom, Undo/Redo and the save shortcut do nothing while activePanel is gallery

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S1-7. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

EditorView, UndoRedoActions and ExportAction tests: with activePanel 'gallery', Ctrl/Cmd+O, a drop, +/-/0 zoom keys, Ctrl/Cmd+Z/Y and Ctrl/Cmd+S change nothing (no replace, no View change, no Step, Export panel stays closed); the drop guard still prevents navigation.
