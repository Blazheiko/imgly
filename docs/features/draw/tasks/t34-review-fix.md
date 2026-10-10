---
id: T34
title: "With Draw open only an unshifted + on either key right of P steps the width; = and Shift+ + still zoom; AC-18 records the exception"
layer: "wiring"
deps: []
acs: ["AC-18", "AC-19"]
files_hint: ["src/features/editor/EditorView.vue", "src/features/editor/EditorView.test.ts", "src/features/draw/DrawTool.test.ts", "docs/features/draw/spec.md"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-10-2 R1"
---

# T34 — With Draw open only an unshifted + on either key right of P steps the width; = and Shift+ + still zoom; AC-18 records the exception

A follow-up task from the re-review. The finding, its citations and the agreed fix are in
[review-2026-10-10-2.md](../_review/review-2026-10-10-2.md), finding R1. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

EditorView tests: '+' on BracketLeft and BracketRight steps the width with Draw open, '=' and Shift+'+' on BracketRight zoom; spec AC-18 names the exception.
