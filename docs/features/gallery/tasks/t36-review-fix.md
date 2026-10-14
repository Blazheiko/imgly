---
id: T36
title: "Autosave hands the page's damaged set to the save, so a damaged Work is evicted first"
layer: "tests"
deps: ["T35"]
acs: ["AC-08"]
files_hint: ["src/features/editor/autosave.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-14-r2 R2-5"
---

# T36 — Autosave hands the page's damaged set to the save, so a damaged Work is evicted first

Finding R2-5 of [review-2026-10-14-r2.md](../_review/review-2026-10-14-r2.md).

## Definition of done

An autosave.test.ts case with 20 valid records and damagedIds containing a middle one evicts and names that one; the test fails if Autosave passes no damaged set.
