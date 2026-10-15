---
id: T42
title: "A touchedAt outside the date range lists Damaged and never stops the listing"
layer: "core"
deps: []
acs: ["AC-08", "AC-03"]
files_hint: ["src/core/gallery/rules.ts", "src/core/gallery/stored-work.ts", "src/core/gallery/rules.test.ts", "src/features/gallery/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14-r3 R3-1"
---

# T42 — A touchedAt outside the date range lists Damaged and never stops the listing

Finding R3-1 of [review-2026-10-14-r3.md](../_review/review-2026-10-14-r3.md).

## Definition of done

A record whose touchedAt is finite but beyond ±8.64e15 fails the shape check and lists Damaged; touchedLabel returns '' for it instead of throwing; refresh() and open() list every other entry. Tested with -1e17 in rules.test.ts and gallery/store.test.ts.
