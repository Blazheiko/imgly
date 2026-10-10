---
id: T32
title: "Write the missing test-plan rows for AC-02, 03, 04, 07, 09, 10, 11 and 19, or mark them Narrowed on purpose"
layer: "tests"
deps: ["T22", "T24", "T31"]
acs: ["AC-02", "AC-03", "AC-04", "AC-07", "AC-09", "AC-10", "AC-11", "AC-19"]
files_hint: ["e2e/draw/tool.spec.ts", "e2e/draw/fidelity.spec.ts", "e2e/draw/cross-feature.spec.ts", "src/features/draw/DrawControls.test.ts", "src/features/draw/DrawTool.test.ts", "docs/features/draw/test-plan.md"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 S6"
---

# T32 — Write the missing test-plan rows for AC-02, 03, 04, 07, 09, 10, 11 and 19, or mark them Narrowed on purpose

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding S6. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

Every listed test-plan row has a test or a 'Narrowed on purpose' note naming the lower-level test.
