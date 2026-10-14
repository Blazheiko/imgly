---
id: T10
title: "Add the Autosave save queue: single flight, latest wins, with saving, settled() and the last stored { workId, revision }"
layer: "app"
deps: []
blocks: ["T11"]
acs: ["AC-16", "AC-20"]
files_hint: ["src/features/editor/autosave-queue.ts", "src/features/editor/autosave-queue.test.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 45 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Add the Autosave save queue: single flight, latest wins, with saving, settled() and the last stored { workId, revision }

## Place in the sequence

- **Blocked by:** — (none; the queue takes the save function as an argument).
- **Blocks:** T11 — Compose autosave.ts: prepare the Original, layer and thumbnail PNGs, call storeWork, keep the encoded Blobs, ask for persistence once, react to versionchange, and raise the notices.
- **Wave:** 1 — pure ordering logic with an injected save function, so it starts with the core tasks.
- **Lane:** own lane.

## Why (user story)

> **As an** Editor
> **I want** opening another image to ask for confirmation only when I would really lose something
> **So that** autosave saves me clicks instead of adding them
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It provides the "is a save running, and is the latest state stored?" answers that the replace gate (AC-16) and the leave warning (AC-20) read.

## Inlined context

> **Save queue: single flight, latest wins (inline).** `autosave.ts` runs at most one save at a time and holds at most one pending request, which is always the newest Work value handed to it. A newer request replaces the pending one, so states in between are skipped, and the latest applied state is stored by the shortest path without an older state overwriting a newer one. `saving` is true while a save runs or one is pending. `settled()` resolves when neither remains, and the replace gate waits on it (AC-16), and `EditorView` installs the `beforeunload` warning only while `saving` is true (AC-20). The alternatives were a strict FIFO of every state, which makes the latest state wait behind all the earlier ones, and a debounce, which adds its delay to every save and contradicts "after every Step" (CONTEXT: Autosave).
>
> — `sad.md §5, Tactical decisions, Save queue, abridged` · full text: [sad.md](../sad.md)

> `src/features/editor/autosave.ts` is composed by the store like `createEditHistory`. It holds three things:
> - the save queue (sad.md §5);
> - the Gallery's availability for this page load, decided when the database is opened at start-up (AC-12);
> - the last stored `{ workId, revision }`, a `saving` flag, and the failed-save notice (AC-11).
>
> — `adr/0001 §Decision outcome, How it works bullet 1, abridged` · full text: [adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md](../adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md)

> **AC-16 cross-context** — the save queue runs one save at a time and keeps only the newest pending state (property) — unit — for random interleavings of requests and completions, at most one save runs, the pending state is always the newest request, and the last stored state is the newest one
>
> — `test-plan.md §AC coverage, AC-16 property row, verbatim` · full text: [test-plan.md](../test-plan.md)

**Breakdown-time choice:** the ordering logic lives in its own `autosave-queue.ts` with an injected `save(work) → Promise<boolean>` (true = committed), so T11's `autosave.ts` only prepares and stores. It holds no Vue/Pinia import beyond `ref`/`computed` if needed for `saving`.

> **Hard rule:** Features never import each other. […] there is no event bus.
>
> — `CLAUDE.md §Module boundaries, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [test-plan.md](../test-plan.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. The TS surface for T11 (breakdown-time choice, names from `sad.md` §5 / ADR-0001):

- `createSaveQueue<W extends { id: string; revision: number }>(save: (w: W) => Promise<boolean>)` →
  `{ request(w): void, saving: Readonly<Ref<boolean>>, settled(): Promise<void>, stored(): { workId: string; revision: number } | null, isStored(w): boolean, dropPending(): void }`.
- `isStored(w)` is true only when `stored()` equals `{ w.id, w.revision }`; `dropPending()` serves ADR-0006's "drop the pending one".

## Acceptance criteria

### AC-16 (US-06) — cross-context

> **Given** the open Work has Unsaved edits and Autosave has stored its latest applied state, or is storing it and then succeeds
> **When** the Editor opens another image by "Open image", by dropping a file or by choosing a Work in the Gallery, and it is read successfully
> **Then** if a save was still running, the replacement waits for it to finish. It then replaces the open Work without asking for confirmation, and the previous Work stays in the Gallery with all its applied edits. An open tool's unapplied changes are discarded with the old Work, as crop-rotate AC-17 already requires
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-20 (US-01) — domain invariant

> **Given** Autosave is storing the open Work after an Apply, Undo or Redo
> **When** the Editor reloads the page or closes the tab before that save finishes
> **Then** the browser shows its own warning that leaving may lose changes. Staying lets the save finish. Once no save is running, reloading or closing the tab shows no warning, even when the Work has Unsaved edits, because they are stored in the Gallery
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write `createSaveQueue` with one running slot and one pending slot (newest replaces pending) — `src/features/editor/autosave-queue.ts`
- [ ] `saving` true while running or pending; `settled()` resolves once both are empty (immediately when idle)
- [ ] On a committed save record `{ workId, revision }`; on a failed one keep the previous stored value
- [ ] `dropPending()` clears the pending slot without touching the running save
- [ ] Example tests + property tests over random request/completion orders, using deferred promises — `src/features/editor/autosave-queue.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| ten quick requests (Undo/Redo pressed fast) | one save runs, one waits with the newest Work; the stored state ends as the last one |
| a request for the Work already stored at the same revision | still queued (the caller decides); `isStored` stays true |
| the running save fails and a newer one is pending | the pending one runs next; `isStored` reflects only committed saves |
| `settled()` called while idle | resolves at once |
| a request for another Work id while one runs | latest wins regardless of id; `isStored` compares id and revision |

## Definition of Done

- [ ] property tests prove at most one save runs, the pending request is always the newest, `saving` is true exactly while one runs or waits, and `settled()` resolves only when none remains
- [ ] the last stored revision is the newest successful one; a failed save leaves `isStored(work)` false
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
