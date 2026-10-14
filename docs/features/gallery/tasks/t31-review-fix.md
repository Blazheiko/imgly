---
id: T31
title: "Missing AC-14 and AC-18 tests: persistence is asked once more after the stored data is cleared, and a Work survives a version bump with all its parts"
layer: "tests"
deps: ["T30"]
acs: ["AC-14", "AC-18"]
files_hint: ["src/features/editor/autosave.test.ts", "src/infra/db/works-repository.test.ts", "e2e/gallery/gate-and-lifecycle.spec.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-14 S1-9"
---

# T31 — Missing AC-14 and AC-18 tests: persistence is asked once more after the stored data is cleared, and a Work survives a version bump with all its parts

A follow-up task from the review. The findings, their citations and the agreed fix are in
[review-2026-10-14.md](../_review/review-2026-10-14.md), findings S1-9. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

An integration test: save, clear the database, save again gives exactly one more persist() call; the AC-18 e2e asserts the stored record, Original, layer and thumbnail all still exist after galleryOpenNextVersion() instead of not.toEqual.
