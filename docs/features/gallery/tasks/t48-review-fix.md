---
id: T48
title: "The overlapping-refresh test waits for its reads, not for a fixed delay"
layer: "tests"
deps: ["T45"]
acs: []
files_hint: ["src/features/gallery/store.refresh-race.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14-r3 R3-8"
---

# T48 — The overlapping-refresh test waits for its reads, not for a fixed delay

Finding R3-8 of [review-2026-10-14-r3.md](../_review/review-2026-10-14-r3.md).

## Definition of done

store.refresh-race.test.ts waits until the expected number of listWorks gates is reached instead of sleeping 10 ms, and no read from an earlier test can push into the shared gates; passes under a loaded parallel run.
