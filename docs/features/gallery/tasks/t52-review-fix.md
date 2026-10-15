---
id: T52
title: "The Gallery couldn't-be-read notice shows once and is withdrawn when a listing succeeds"
layer: "app"
deps: ["T51"]
acs: ["AC-03"]
files_hint: ["src/features/gallery/store.ts", "src/features/gallery/store.test.ts", "docs/features/gallery/screens.md"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-15-r4 R4-3"
---

# T52 — The Gallery couldn't-be-read notice shows once and is withdrawn when a listing succeeds

Finding R4-3 of [review-2026-10-15-r4.md](../_review/review-2026-10-15-r4.md).

## Definition of done

A failing refresh pushes the notice only when none is shown; the next listing that succeeds dismisses it. screens.md marks the catalog row withdrawable. Tested: two failing refreshes show one notice, then a succeeding refresh shows none.
