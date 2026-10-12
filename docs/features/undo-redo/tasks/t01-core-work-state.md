---
id: T1
title: "Add WorkState, editStateOf and withState to core/document"
layer: "domain"
deps: []
blocks: ["T2", "T4"]
acs: ["AC-03", "AC-13"]
files_hint: ["src/core/document.ts", "src/core/document.test.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 39 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Add WorkState, editStateOf and withState to core/document

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** T2 — Add core/history: EditHistory with createHistory, record, undo, redo, canUndo/canRedo and undo/redo labels; T4 — Add the edit-history composable, record a Step on every counting Apply, make withEdit take the revision, and move layer release to one path.
- **Wave:** 1 — alongside T6, T13.
- **Lane:** shares `src/core/document.test.ts`, `src/core/document.ts` with T4 — serialized.

## Why (user story)

> **US-03: Step back through several changes**
>
> **As an** Editor  
> **I want** to undo several changes in a row, across all three tools  
> **So that** I can return to how the image looked several steps ago
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It gives the Edit history the one value it keeps per state, so an Undo restores a whole earlier state — Geometry, Adjustments, Drawing layer and revision together — instead of recomputing it.

## Inlined context

> `src/core/document.ts` adds `WorkState = { geometry, adjustments, drawing, revision }`. `editStateOf(work)` reads it, and `withState(work, state)` returns the Work with that state and everything else kept: `id`, the Original, the source, `cleanRevision`, plus a new `updatedAt`.
>
> — `adr/0001 §Decision outcome, How it works bullet 1, verbatim` · full text: [adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md](../adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md)

> **Chosen:** Option 1. The restored Geometry, Adjustments and Drawing layer are the same values and the same layer objects that the Preview and the Export used before. Exactness therefore holds by construction, with nothing recomputed and no per-tool code.
>
> — `adr/0001 §Decision outcome, abridged` · full text: [adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md](../adr/0001-record-the-edit-history-as-snapshots-of-the-works-edited-state.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
>
> — `CLAUDE.md §Module boundaries, src/core row, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Scope note: this task is **additive** — `withEdit` keeps its current signature here. Making the revision a required argument of `withEdit` (ADR-0003) breaks every caller in `src/features/editor/store.ts`, so by the contract-task rule it is folded into T4, which rewires those callers. `document.ts` is already re-exported by `src/core/index.ts`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-03 (US-03) — domain invariant

> **Given** the Editor has opened an image, then applied a Crop, Adjustments and a drawing in that order
> **When** the Editor chooses Undo three times, and then Redo three times
> **Then** after the three Undos the Work is exactly the Work as it was opened, and after the three Redos it is exactly the Work as it was after the drawing: a full-size Export at each point is identical, pixel for pixel, to an Export of that same state made before any Undo. Undo and redo never approximate a state; they restore it
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-13 (US-03) — cross-context

> **Given** the Editor has drawn marks and applied them, then applied a Crop and a Rotation, and then applied "Draw" again after Clear
> **When** the Editor undoes the last Step, and then undoes the Rotation
> **Then** after the first Undo every mark is back on the same image content it was drawn on (draw AC-08), and after the second Undo the marks follow the image back to its earlier orientation. The Drawing layer always returns together with the Geometry it was applied under, never shifted or stretched
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `WorkState<TLayer>` = `{ geometry, adjustments, drawing, revision }` (generic over the layer like `Work`) — `src/core/document.ts`
- [ ] Add `editStateOf(work)` returning exactly those four fields, the same object references — `src/core/document.ts`
- [ ] Add `withState(work, state, now?)` returning `{ ...work, ...state, updatedAt: now }`, keeping `id`, `original`, `sourceName`, `sourceFormat`, `createdAt`, `cleanRevision` — `src/core/document.ts`
- [ ] Unit tests: referential identity (`toBe`) of restored geometry/adjustments/drawing, revision restored, cleanRevision kept, `drawing: null` round-trips, type test that the layer type is preserved — `src/core/document.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| state with `drawing: null` | restored as `null`; no layer invented |
| `withState` onto a Work whose `cleanRevision` differs from the state's revision | `cleanRevision` is kept from the Work, never taken from the state (ADR-0003) |
| the same state restored twice | both results hold the same object references — nothing is cloned |

## Definition of Done

- [ ] `document.test.ts` asserts `toBe` identity of geometry, adjustments and drawing after `withState`
- [ ] `document.test.ts` asserts `id`, `original`, source fields and `cleanRevision` are kept and `revision` is the state's
- [ ] `withEdit`'s signature is unchanged (T4 owns that change)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
