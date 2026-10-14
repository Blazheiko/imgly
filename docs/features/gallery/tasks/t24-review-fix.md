---
id: T24
title: "Repository write side: rewrite the layer when the stored layerId differs, refuse a layerId with no layer, a string-safe evicted name, and a quota failure at commit"
layer: "infra"
deps: []
acs: ["AC-21", "AC-19", "AC-08", "AC-09", "AC-10"]
files_hint: ["src/infra/db/works-repository.ts", "src/infra/db/works-repository.test.ts", "src/infra/db/testing.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-14 S1-1, S2-1, S2-2, S2-3"
---

# T24 — Repository write side: rewrite the layer when the stored layerId differs, refuse a layerId with no layer, a string-safe evicted name, and a quota failure at commit

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S1-1, S2-1, S2-2, S2-3. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

Works-repository tests: two connections with different layer ids never leave a mixed record and layer; storeWork with a layerId, no layer Blob and no stored entry returns STORAGE_FAILED and stores nothing; an evicted damaged record with a non-string sourceName is named ''; a fault mode where every request succeeds and the commit fails with QuotaExceededError is retried and ends in STORAGE_QUOTA.
