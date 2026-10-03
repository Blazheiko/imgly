---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-03"
feature_size: "M"
ticket: "roadmap step 2 — open-and-view"
---

# 0005 — Track Unsaved edits with a revision counter on the Work

- **Status:** Accepted
- **Date:** 2026-10-03
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

The replace rule fixed in this feature asks for confirmation only when the open Work has Unsaved edits (AC-15) and never for View changes (AC-14). No editing tool exists yet, but the rule is inherited by crop and rotate (roadmap step 4), adjustments (5), drawing (6), undo and redo (7) and the gallery's save (8), so the way a Work knows it has Unsaved edits is a contract between the `editor` store and every later feature (sad.md §5). In this feature AC-15 is verified against a test-prepared Work (spec §1 Decision override).

## Decision drivers

- spec AC-14: View changes never count as Unsaved edits
- spec AC-15: confirm before replacing a Work with Unsaved edits; verified now with a test-prepared Work, re-verified by roadmap step 4
- CONTEXT Invariants: the open Work is never discarded without confirmation when it has Unsaved edits
- sad.md §2: `src/core/` is pure TypeScript; features never import each other and coordinate through the `editor` store (repo ADR 0002)
- sad.md §1 quality goal 2 (Work integrity)

## Considered options

1. **Revision counter** — the Work carries `revision`, increased by every edit and by every undo and redo, and `cleanRevision`, the revision at open (later also at save); `hasUnsavedEdits(work)` is `revision !== cleanRevision`.
2. **Position in the command history** — Unsaved edits exist when the current undo/redo position differs from the position recorded at open or save, so undoing back to the opened state makes the Work clean again.

## Decision outcome

**Chosen:** Option 1. It works today without a command stack, gives AC-15's test-prepared Work a one-line setup (raise `revision`), and leaves every editing feature with one rule to follow: an edit raises the revision. Option 2 is more precise after a full undo, but it would force a command history into this feature ahead of roadmap step 7 and fix its shape before any real command exists.

How it works:

- `src/core/document.ts`: `Work = { id, original, revision, cleanRevision, … }`; a new Work starts with `revision = cleanRevision = 0`. `hasUnsavedEdits(work)` is a pure function next to it.
- Every operation that changes the Work (an edit command, undo, redo) returns a Work with `revision + 1`. View changes live outside the Work in the `editor` store and never touch it (AC-14).
- The gallery's save (roadmap step 8) sets `cleanRevision = revision` after a successful write.
- The `editor` store reads only `hasUnsavedEdits(work)` when deciding between replace and confirm; it never inspects which edits exist.

## Consequences

**Positive**
- One pure, unit-tested rule in `core`; no feature needs to know how another feature edits the Work.
- AC-15 is testable now, and roadmap step 4 re-verifies it by doing nothing more than making a real edit.
- Undo and redo (step 7) and save (step 8) plug in without changing the replace rule.

**Negative**
- After the Editor undoes every edit, the Work still counts as having Unsaved edits, so replacing it asks for a confirmation that is strictly unnecessary. This errs on the side of the Work, and is accepted.
- Every editing feature must remember to raise the revision; a forgotten raise silently drops the protection. The `editor` store's edit entry point raises it, so features should go through it, and step 4's re-verification of AC-15 catches the first miss.

**Neutral**
- Switching to option 2 later is local to `hasUnsavedEdits` and the undo/redo code in step 7; callers keep the same function.

## Links

- Spec: [[../spec.md]] AC-14, AC-15, §1 (Decision override on AC-15)
- SAD: [[../sad.md]] §5
- Related ADR: [[0001-decode-and-downscale-in-a-dedicated-web-worker]] (the open that this rule gates)
