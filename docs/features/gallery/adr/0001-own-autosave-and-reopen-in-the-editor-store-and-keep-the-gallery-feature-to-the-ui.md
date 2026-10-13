---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-13"
feature_size: "M"
ticket: "roadmap step 8 — gallery"
---

# 0001 — Own Autosave and reopen in the editor store, and keep the gallery feature to the UI

- **Status:** Accepted
- **Date:** 2026-10-13
- **Deciders:** Blazheiko (owner), design Socratic walk (medium depth)

## Context

Autosave must store the open Work after it replaces the old one and after every Step, Undo and Redo (CONTEXT: Autosave). Each of these starts in the `editor` store: `replace()`, the three `apply*` actions through `edits.commit`, and `undo`/`redo` through the Edit history composable (undo-redo ADR-0004). The replace gate lives there too, in `openImage`, `confirmReplace` and `cancelReplace`. From this feature on, the gate must wait for a running save and ask only when the open Work's Unsaved edits are not stored (spec AC-16, AC-17). Reopening a Work from the Gallery is a new way to replace the Work, with the same rules as opening a file (spec §1 ¶4, AC-15). Features never import each other, they coordinate through the editor store, and there is no event bus (repo ADR 0002). The store is already the hub, at 509 lines, and its tool slot and Edit history were moved into composables (`tool-slot.ts`, `edit-history.ts`).

## Decision drivers

- sad.md §1 quality goal 1: one owner for the order of saves, so "stored" is never claimed for a state that is not (AC-16, AC-17, AC-19)
- sad.md §1 QG-4: the replace confirmation asks exactly when Unsaved edits are not stored, and the leave warning shows exactly while a save runs (AC-20)
- repo ADR 0002: features don't import each other, there is no event bus, and `infra` never imports a feature
- spec AC-08, AC-17: a Work that cannot be read never replaces the open one and never asks, so reopen reads the Work in full before the gate, as `openImage` decodes before it
- architecture map: the editor store is the hub and grows with every feature

## Considered options

1. **The editor store owns Autosave and reopen, through a composed `autosave.ts`, and the `gallery` feature is the UI.**
2. **The `gallery` feature owns Autosave and reopen.** Its store watches `editor.work` and saves when the Work's id or revision changes. The editor gets an injected persistence port (`setPersistence({ settled, isStored })`) for its gate and a generic `replaceWith(restoredWork)`.

## Decision outcome

**Chosen:** Option 1. The triggers, the "saving / stored" state and the gate change together, and keeping them in one composable gives a fixed order of events. Replacing the Work starts the first save of the new Work in the same action, and the gate reads the saving state the store itself holds. Option 2 keeps the editor smaller. But a watcher runs after the fact, on a later tick, so "has the latest state been handed to Autosave?" becomes a timing question. It also adds a new injection pattern, and the gate would only be correct when the gallery feature happens to be installed.

How it works:

- `src/features/editor/autosave.ts` is composed by the store like `createEditHistory`. It holds three things:
  - the save queue (sad.md §5);
  - the Gallery's availability for this page load, decided when the database is opened at start-up (AC-12);
  - the last stored `{ workId, revision }`, a `saving` flag, and the failed-save notice (AC-11).

  It calls the `works` repository in `src/infra/db/` and the PNG codec in `src/infra/work-codec/` (ADR-0002, ADR-0003, ADR-0004), and raises eviction and failure notices through `useNotices` with texts in `src/features/editor/messages.ts`.
- `replace()` hands the new Work to Autosave after the swap, which is how a new image enters the Gallery only once it has replaced the open Work (AC-09). `edits.commit`, `undo` and `redo` hand over the Work after each change. Nothing else does: View changes, open Drafts and Applies that do not count as an edit never reach Autosave (AC-02).
- The replace gate in `openImage` and in the new `reopenWork(id)` waits for Autosave to settle once the new image or Work has been read. It then asks (`phase = 'confirming'`) only when the Work has Unsaved edits and its latest revision is not the stored one, or the Gallery is unavailable (AC-12, AC-16, AC-17).
- `reopenWork(id)` follows `openImage`'s rules:
  - It is refused while exporting or confirming (AC-15), and latest open wins.
  - It reads the record and both Blobs, decodes them and validates them with pure `core` checks. A failure returns a damaged-Work refusal and changes nothing (AC-08).
  - On success, the gate runs, and `replace` swaps in the stored Work with its own id and source. Its revision equals its `cleanRevision`, it starts an empty Edit history (undo-redo AC-09, AC-10), and the View is fitted (AC-02, AC-04).
- The store exposes `saving`, `galleryAvailable`, `openWorkId` (the id that the Gallery must never delete or evict, AC-07) and `reopenWork`.
- `src/features/gallery/` has:
  - the list, start-screen and overlay components;
  - the "Gallery" top-bar action;
  - the delete confirmation;
  - `store.ts`, which holds the listed entries, the overlay's open state and the storage line;
  - `messages.ts` and `index.ts`.

  It reads the repository to list and delete Works, and calls only the editor store's public API, through `@/features/editor`.

## Consequences

**Positive**
- One place decides when a state is stored and whether to ask, and the store's own tests can drive every gate branch with a fake repository.
- Reopen reuses `openImage`'s phase, supersede and notice handling, so AC-15 and AC-17 hold by construction.

**Negative**
- The editor feature grows by `autosave.ts` (roughly the size of `edit-history.ts`) plus `reopenWork` and a few getters.
- Two features talk to the `works` repository: the editor saves and reads, and the gallery lists and deletes. The repository is the one shared contract between them.

**Neutral**
- Moving Autosave into the gallery feature later is a file move plus a port, because the repository API stays the same.

## Links

- Spec: [[../spec.md]] AC-02, AC-08, AC-09, AC-12, AC-15, AC-16, AC-17, AC-20
- SAD: [[../sad.md]] §4, §5
- Related ADR: [[0002-store-each-work-as-a-small-record-plus-separate-original-and-layer-blob-stores]], [[0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker]], [[0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota]]; undo-redo ADR-0004 (composable precedent); repo ADR 0002
