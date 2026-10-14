---
id: T34
title: "A stored record with a non-numeric touchedAt never stops the Gallery listing: its label falls back and the entry lists Damaged"
layer: "core"
deps: []
acs: ["AC-08", "AC-03"]
files_hint: ["src/core/gallery/rules.ts", "src/core/gallery/rules.test.ts", "src/features/gallery/store.ts", "src/features/gallery/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-14-r2 R2-1"
---

# T34 — A stored record with a non-numeric touchedAt never stops the Gallery listing: its label falls back and the entry lists Damaged

Finding R2-1 of [review-2026-10-14-r2.md](../_review/review-2026-10-14-r2.md).

## Definition of done

touchedLabel returns a fallback for a non-finite touchedAt; refresh() and open() list every entry when a record has a NaN, null or missing touchedAt, and that entry is Damaged.
