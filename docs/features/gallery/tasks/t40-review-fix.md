---
id: T40
title: "The commit-quota test fault aborts every save, not only a first one"
layer: "tests"
deps: ["T39"]
acs: ["AC-10"]
files_hint: ["src/infra/db/testing.ts", "src/infra/db/works-repository.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "done"
source: "review-2026-10-14-r2 R2-7"
---

# T40 — The commit-quota test fault aborts every save, not only a first one

Finding R2-7 of [review-2026-10-14-r2.md](../_review/review-2026-10-14-r2.md).

## Definition of done

The commitFail fault aborts the transaction whatever stores the save writes; a test on a later save shows nothing committed and STORAGE_QUOTA returned.
