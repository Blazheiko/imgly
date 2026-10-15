---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-13"
feature_size: "M"
ticket: "roadmap step 8 — gallery"
---

# 0006 — Close an older tab's database connection when a newer version upgrades it

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Blazheiko (owner), design Socratic walk (medium depth)

## Context

The app is a PWA, so after a release an old tab can stay open while a new tab loads the new version. Schema changes are forward-only IndexedDB upgrade steps (repo ADR 0003). An upgrade can't start while any other connection to the database is open. The browser sends each open connection a `versionchange` event, and the upgrading tab waits in a `blocked` state for as long as one of them stays open. Gallery data must survive every update (AC-18), and the Gallery must be usable on a first try (spec US-07).

## Decision drivers

- spec AC-18: an update never empties the Gallery or loses a Work, and old records open with exactly their stored data
- spec AC-12: when storage can't be used, editing still works, and replacing the Work asks whenever it has Unsaved edits
- sad.md §1 quality goal 1: no half-stored Work, so an old tab must never write into a schema it doesn't know

## Considered options

1. **The older tab gives way.** On `versionchange` it lets its running save finish, closes its connection, marks the Gallery unavailable until it is reloaded, and shows one notice to reload.
2. **The newer tab waits.** The older tab keeps its connection. The newer tab, while `blocked`, shows the Gallery as unavailable with a hint to close other tabs of the app.

## Decision outcome

**Chosen:** Option 1. The version the person just loaded always works, and an old tab can never write in an old shape after the schema moved on. Option 2 lets a forgotten background tab break the current version, and the person often can't tell which tab is at fault.

How it works:

- `openDb()` in `src/infra/db/open-db.ts` installs a `versionchange` handler on the connection it returns. Autosave (ADR-0001) handles it:
  - it waits for the save that is running, whose transaction completes, then drops the pending save;
  - it closes the connection, sets `galleryAvailable` to false for the rest of the page's life, and raises one info notice that a newer version is open in another tab and to reload to keep saving.
- From then on the tab behaves as AC-12 describes. Opening, editing and exporting work. Replacing the Work asks for confirmation whenever it has Unsaved edits. The Gallery list shows its unavailable state.
- The upgrading tab treats `blocked` as a short wait. If the database is still not open after a bounded wait, for example because an older version without this handler holds it, the Gallery is unavailable for that page load with a reason, as AC-12 says.

## Consequences

**Positive**
- Every migration, from `0002` on, reaches the person's newest tab without manual steps.
- An old tab can't corrupt a newer schema.

**Negative**
- Edits applied in the old tab after the upgrade are not stored until it is reloaded. The replace confirmation and the notice say so.

**Neutral**
- The current release opens no connection at runtime, so the first upgrade to v2 is never blocked. The rule matters from v3 on.

## Links

- Spec: [[../spec.md]] AC-12, AC-17, AC-18
- SAD: [[../sad.md]] §7, §8, §11
- Related ADR: [[0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui]], [[0002-store-each-work-as-a-small-record-plus-separate-original-and-layer-blob-stores]]; repo ADR 0003
