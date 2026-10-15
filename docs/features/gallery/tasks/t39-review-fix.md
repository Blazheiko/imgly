---
id: T39
title: "e2e: a thumbnail whose bytes will not decode lists Damaged in a real browser"
layer: "tests"
deps: ["T38"]
acs: ["AC-08"]
files_hint: ["src/infra/db/testing.ts", "e2e/gallery/manage-and-limits.spec.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14-r2 R2-6"
---

# T39 — e2e: a thumbnail whose bytes will not decode lists Damaged in a real browser

Finding R2-6 of [review-2026-10-14-r2.md](../_review/review-2026-10-14-r2.md).

## Definition of done

A 'thumbnail-bytes' damage kind stores garbage bytes typed image/png; e2e asserts that entry becomes Damaged and the others stay normal.
