---
id: T25
title: "Damaged records the index can't see: list from the store, sort in core with a NaN-safe order, and treat a record that fails the shape or thumbnail check as damaged when choosing what to evict"
layer: "infra"
deps: ["T24"]
acs: ["AC-08", "AC-03", "AC-06", "AC-09"]
files_hint: ["src/infra/db/works-repository.ts", "src/infra/db/works-repository.test.ts", "src/core/gallery/rules.ts", "src/core/gallery/rules.test.ts"]
owner: "Blazheiko"
estimate: "M"
status: "done"
source: "review-2026-10-14 S1-2, S1-3 (repository half)"
---

# T25 — Damaged records the index can't see: list from the store, sort in core with a NaN-safe order, and treat a record that fails the shape or thumbnail check as damaged when choosing what to evict

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S1-2, S1-3 (repository half). The ACs are in [spec.md](../spec.md) §5.

## Definition of done

A record with touchedAt missing, null or NaN is listed (marked damaged), counted and deletable; storeWork at 20 Works evicts a record that fails validateRecordShape or the PNG-thumbnail check first and names it, with no damaged set from the caller (test-plan row 143); the eviction comparator is total for NaN.
