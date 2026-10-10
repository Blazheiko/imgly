---
id: T22
title: "With Draw open the key right of P (German +) steps the width instead of zooming"
layer: "wiring"
deps: ["T21"]
acs: ["AC-19"]
files_hint: ["src/features/editor/EditorView.vue", "src/features/editor/EditorView.test.ts", "src/features/draw/shortcuts.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 S2"
---

# T22 — With Draw open the key right of P (German +) steps the width instead of zooming

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding S2. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

A component test with EditorView and DrawTool mounted shows key '+' with code BracketRight steps the width and leaves zoom unchanged; '+' elsewhere still zooms.
