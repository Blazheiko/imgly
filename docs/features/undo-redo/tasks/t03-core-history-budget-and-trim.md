---
id: T3
title: "Bound the history: budget.ts with 50 Steps and 512 000 000 B, heldLayerBytes, and the oldest-first trim inside record"
layer: "domain"
deps: ["T2"]
blocks: ["T4"]
acs: ["AC-11"]
files_hint: ["src/core/history/budget.ts", "src/core/history/budget.test.ts", "src/core/history/history.ts", "src/core/history/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 39 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Bound the history: budget.ts with 50 Steps and 512 000 000 B, heldLayerBytes, and the oldest-first trim inside record

## Place in the sequence

- **Blocked by:** T2 — Add core/history: EditHistory with createHistory, record, undo, redo, canUndo/canRedo and undo/redo labels.
- **Blocks:** T4 — Add the edit-history composable, record a Step on every counting Apply, make withEdit take the revision, and move layer release to one path.
- **Wave:** 3.
- **Lane:** shares `src/core/history/history.ts`, `src/core/history/index.ts` with T2 — serialized.

## Why (user story)

> **US-05: Keep a long session safe**
>
> **As an** Editor  
> **I want** undo to stay reliable while a tool is open, while an export runs, and through a long session  
> **So that** undoing never mixes with an unapplied tool, never changes a file being saved and never makes the app run out of memory
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It keeps a long session inside a fixed memory budget while always keeping at least the last 10 Steps on the reference Work.

## Inlined context

> `src/core/history/budget.ts`: `HISTORY_MAX_STEPS = 50` and `HISTORY_BUDGET_BYTES = 512_000_000` (decimal, the stricter reading of "512 MB", ledger L2). A Step count is `entries.length - 1`.
> `heldLayerBytes(history)` is the sum of `width × height × 4` over the distinct layers (by layer `id`) among the kept entries' states, leaving out the layer of `entries[cursor]`, which the Work shows. Geometry and Adjustments count as 0 bytes, because the spec counts image data only.
> Why the Work's own layer is left out: k Steps keep k + 1 states, so they hold at most k layers besides the Work's own. Ten drawing Steps on the reference Work then count at most 10 × 50 331 648 = 503 316 480 B ≤ 512 000 000 B, and AC-11's minimum of 10 always fits. Counting the Work's layer too would make it 11 layers, 553 648 128 B, and only 9 Steps would fit.
> Order on `record`: discard the entries after `cursor` (AC-04), append the new state, then drop `entries[0]` while there are more than 50 Steps or the held bytes exceed the budget. The current entry is never dropped, because its layer is not counted.
>
> — `adr/0002 §Decision outcome, How it works bullets 1–4, verbatim` · full text: [adr/0002-keep-whole-layers-by-reference-and-bound-the-history-by-50-steps-and-512-mb.md](../adr/0002-keep-whole-layers-by-reference-and-bound-the-history-by-50-steps-and-512-mb.md)

> A 4096 × 4096 Work keeps only 7 drawing Steps, because 8 layers of 67 108 864 B exceed 512 000 000 B (ADR-0002). AC-11's minimum of 10 is stated for the 4096 × 3072 reference Work only
>
> — `sad.md §11, 4096 × 4096 row, verbatim` · full text: [sad.md](../sad.md)

> | Memory the Edit history takes | ≤ 512 MB of image data held by the Edit history (kept layers or their differences, counted as width × height × 4 bytes), whatever the number and kind of Steps | the DEV resource ledger, asserted in a unit test and in e2e after 100 Applies of a new drawing over the whole image |
> | Steps kept | at most 50; at least the last 10 when each is a drawing over the whole image on the reference Work; all 50 when they are Crops or Adjustments | unit test of the history bound, and the memory e2e above counting the Undos available |
>
> — `spec.md §6, rows Memory + Steps kept, verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
>
> — `CLAUDE.md §Module boundaries, src/core row, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-11 (US-05) — domain invariant

> **Given** the Editor keeps applying Steps on the 4096 × 3072 px reference Work, each one a drawing over the whole image or a Crop or Adjustment
> **When** the Edit history reaches its limit of 50 Steps, or its memory budget
> **Then** the oldest Steps are dropped first, without a message, and the newest are kept: the Editor can always undo at least the last 10 Steps, and up to the last 50 when they take less memory. Undoing past the oldest kept Step is not possible; Undo becomes unavailable there as in AC-05. The memory the Edit history takes never exceeds its budget (§6)
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `HISTORY_MAX_STEPS`, `HISTORY_BUDGET_BYTES`, `heldLayerBytes(history)` (distinct by layer `id`, excluding `entries[cursor]`'s layer) — `src/core/history/budget.ts`
- [ ] Add `trim(history) → { history, evicted }` dropping `entries[0]` (shifting `cursor`) while over either bound — `src/core/history/budget.ts`
- [ ] Call `trim` at the end of `record` and append its dropped entries to `evicted` after the discarded ones — `src/core/history/history.ts`
- [ ] Export from `src/core/history/index.ts`
- [ ] Unit tests per Edge case below, using fake layers `{ id, width, height, pixels: {} }` — `src/core/history/budget.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| 11th full-size drawing Step on 4096×3072 | the oldest entry is dropped; 10 Steps remain; held bytes ≤ 512 000 000 |
| 51st Crop/Adjust Step | the oldest is dropped; 50 Steps remain; held bytes 0 |
| two kept entries share one layer `id` (a non-drawing Step after a drawing) | that layer counts once |
| a 4096×4096 Work with 8 drawing Steps | 7 Steps kept (8 × 67 108 864 B > budget) |
| a single layer above the budget can never occur on a permitted image | the current entry is never dropped, even if the loop would otherwise empty the history |

## Definition of Done

- [ ] `budget.test.ts` covers every Edge case row, with the exact byte numbers above
- [ ] `record` returns discarded + dropped entries in `evicted`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
