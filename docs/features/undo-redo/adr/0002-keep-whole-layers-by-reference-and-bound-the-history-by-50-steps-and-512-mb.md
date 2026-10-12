---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-11"
feature_size: "S"
ticket: "roadmap step 7 — undo-redo"
---

# 0002 — Keep whole applied layers by reference, and bound the history by 50 Steps and 512 MB

- **Status:** Accepted
- **Date:** 2026-10-11
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth)

## Context

ADR-0001 keeps a snapshot of the Work's edited state for every Step. Geometry and Adjustments are a few numbers, but a Drawing layer is a bitmap of the Original's size: 50 331 648 B on the 4096 × 3072 reference Work, and up to 64 MB on a 4096 × 4096 one (draw ADR-0001). draw `sad.md` §11 asks step 7 to bound its stack by memory, not only by count. The spec fixes the bound: up to 50 Steps and at most 512 MB of image data held by the Edit history, counted as width × height × 4 bytes, with at least the last 10 Steps always kept on the reference Work even when each one draws over the whole image (AC-11, §6).

## Decision drivers

- spec AC-11 and §6 Steps kept: at most 50; at least the last 10 when each is a drawing over the whole image on the reference Work; all 50 when they are Crops or Adjustments
- spec §6 memory: ≤ 512 MB of image data held by the Edit history, counted as width × height × 4 bytes
- spec §6 release: 0 retained layers that no kept Step, the Work or an open Draft refers to, after replacing the Work, after discarding redoable Steps (AC-04) and after dropping the oldest Steps (AC-11)
- spec §6 latency: from Undo or Redo to the updated Preview, p95 ≤ 150 ms with a drawing over the whole image
- draw ADR-0004: applied layers are immutable and can be shared by reference

## Considered options

1. **Whole layers by reference, with a byte budget.** Each applied layer is kept whole, as the immutable object it already is. The budget counts the distinct layers the kept states hold, except the one the Work currently shows.
2. **Differences between layers.** The history keeps only the rectangle that changed between consecutive layers, and Undo patches a layer back together.

## Decision outcome

**Chosen:** Option 1. Undo is a reference swap plus one texture upload of the restored layer, the same cost as the draw tool's Cancel, which already meets 150 ms (draw ADR-0004). It needs no new pixel code, and exactness is untouched. Option 2 saves memory only for small marks. For the spec's worst case, a drawing over the whole image, the difference is the whole layer anyway. Undo would also have to allocate a new 50 MB layer and copy patches into it, which puts the 150 ms target at risk. And the draw store would have to accumulate a dirty rectangle across a whole tool session.

How it works:

- `src/core/history/budget.ts`: `HISTORY_MAX_STEPS = 50` and `HISTORY_BUDGET_BYTES = 512_000_000` (decimal, the stricter reading of "512 MB", ledger L2). A Step count is `entries.length - 1`.
- `heldLayerBytes(history)` is the sum of `width × height × 4` over the distinct layers (by layer `id`) among the kept entries' states, leaving out the layer of `entries[cursor]`, which the Work shows. Geometry and Adjustments count as 0 bytes, because the spec counts image data only.
- Why the Work's own layer is left out: k Steps keep k + 1 states, so they hold at most k layers besides the Work's own. Ten drawing Steps on the reference Work then count at most 10 × 50 331 648 = 503 316 480 B ≤ 512 000 000 B, and AC-11's minimum of 10 always fits. Counting the Work's layer too would make it 11 layers, 553 648 128 B, and only 9 Steps would fit.
- Order on `record`: discard the entries after `cursor` (AC-04), append the new state, then drop `entries[0]` while there are more than 50 Steps or the held bytes exceed the budget. The current entry is never dropped, because its layer is not counted.
- The held bytes are checked at the worst cursor position, not only the newest (amended by `_review/review-2026-10-12.md` F1). An Undo back to a state with no drawing, such as the opened image or a Draw Apply after Clear, leaves every kept layer to the history alone. So `trim` bounds the maximum of the held bytes over every cursor position, and no Undo or Redo can take the history over the budget. The reference Work still keeps 10 drawing Steps: with `[no layer, L1…L10]` at most 10 layers are counted, and when an 11th drawing is applied the opened state is dropped. A 4096 × 4096 Work still keeps 7.
- Release: the `edit-history` composable in the editor store takes the evicted entries and calls `releaseLayer()` on each of their layers that no kept entry refers to. This is the only place a layer from the history is released. `applyDrawing` no longer releases the previous layer, and an unchanged "Draw" Apply keeps the Work's layer and releases the Draft (sad.md §4). Replacing the Work releases every layer of the old history, and `releaseLayer` is a no-op on a second call.
- An open Draft is a separate copy owned by the `draw` store (draw ADR-0004), so the history never refers to it. Undo, Redo and Apply are refused during an export (AC-07, export AC-11), so no layer leaves the history while the export snapshot reads it.

## Consequences

**Positive**
- Undo and Redo cost one reference swap and one layer upload, and exactness is untouched.
- The budget is a pure function of the kept states, tested in `core`. The release rule is one function with three callers: discard, drop and replace.

**Negative**
- A small mark costs a whole layer, so only about 10 drawing Steps fit on the reference Work. A 4096 × 4096 Work fits 7, because 8 layers of 67 108 864 B exceed the budget. AC-11 guarantees 10 only on the reference Work.
- In the steady state of a long drawing session the page holds one more layer than right after the 10th Apply, the Work's own. This is the margin the whole-page §6 row (≤ +10%) has to absorb (sad.md §11).

**Neutral**
- Storing differences later would stay inside `core/history` and `render/drawing`, and the editor store's API would not change.

## Links

- Spec: [[../spec.md]] AC-04, AC-10, AC-11, §6
- SAD: [[../sad.md]] §4, §8, §11
- Related ADR: [[0001-record-the-edit-history-as-snapshots-of-the-works-edited-state]], [[0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature]]; draw ADR-0001, ADR-0004; draw `sad.md` §11
