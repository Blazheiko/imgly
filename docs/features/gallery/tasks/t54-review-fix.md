---
id: T54
title: "A touchedAt outside the date range sorts oldest, as every other unusable time"
layer: "core"
deps: []
acs: ["AC-03", "AC-08"]
files_hint: ["src/core/gallery/rules.ts", "src/core/gallery/rules.test.ts", "src/features/gallery/store.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-15-r4 R4-5"
---

# T54 — A touchedAt outside the date range sorts oldest, as every other unusable time

Finding R4-5 of [review-2026-10-15-r4.md](../_review/review-2026-10-15-r4.md).

## Definition of done

touchedKey uses isUsableTime, so 1e17 sorts before every usable time. 1e17 is in the unusable table of rules.test.ts and the store test asserts it lists after the valid Work.
