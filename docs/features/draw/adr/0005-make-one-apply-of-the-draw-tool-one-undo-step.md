---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-09"
feature_size: "M"
ticket: "roadmap step 6 — draw"
---

# 0005 — Make one Apply of the "Draw" tool one undo step, and keep no per-Stroke history

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

Undo and redo are roadmap step 7, outside this feature (spec §3). Spec §8 nonetheless asks, with a due date "before `/sdd:design draw`", whether one undo step will remove one Stroke inside the open "Draw" tool or one whole Apply of the tool. The answer shapes what this feature keeps in memory. The default the spec proposes is one Apply, which is how "Crop and rotate" and "Adjust" already behave: neither keeps a history inside the tool, and their Apply is one change of the Work.

## Decision drivers

- spec §8: the open question, due before this design
- spec §3: undo and redo are not part of this feature; until step 7, Cancel, the Eraser and Clear are the ways back
- spec §6: memory after 50 Applies ≤ 110% of memory after the first Apply
- consistency with crop-rotate and adjust, whose undo unit is one Apply
- ADR-0004: applied layers are immutable, so an earlier layer can be kept by reference

## Considered options

1. **One Apply is one undo step** — inside the tool there is no history. Step 7 undoes an Apply by swapping the Work's layer back to the one from before it.
2. **One Stroke is one undo step** — this feature records, for every Stroke, the dirty rectangle as it was before the Stroke, so that step 7 can undo Strokes one by one while the tool is open.

## Decision outcome

**Chosen:** Option 1. All three tools then have one undo model, an Apply, and this feature needs nothing beyond ADR-0004. Under Option 2, every Stroke would carry a patch of up to the full layer (a 200 px Stroke across the image touches nearly all of it), all to support behaviour that spec §3 puts outside this feature. Option 2 would also mean undo works inside one tool and not inside the other two.

How it works:

- The `draw` store keeps no list of Strokes and no patches. A Draft is one bitmap and a `changed` flag (ADR-0004).
- Each Apply that counts as a change (AC-12) replaces `work.drawing` with a new immutable layer. For step 7, an undo of that Apply is the pair (layer before, layer after), and both are bitmaps that are never painted again.
- Spec §8's open question is answered by this ADR. The spec's checkbox is left for the owner to tick.

## Consequences

**Positive**
- No extra memory or code in this feature; the 50-Apply memory row stays a test of releases only.
- One undo unit across "Crop and rotate", "Adjust" and "Draw".

**Negative**
- Inside a long drawing session the Editor cannot take back only the last Stroke. They can erase it, or cancel the whole session.
- Step 7 inherits a cost: each kept layer is up to 64 MB, so its undo stack has to bound its depth or store differences between layers (§11).

**Neutral**
- Per-Stroke undo can still be added later inside the `draw` store, with patches recorded per Stroke, without changing the Work or the editor API.

## Links

- Spec: [[../spec.md]] §3, §6, §8
- SAD: [[../sad.md]] §4, §11
- Related ADR: [[0004-hold-the-draft-as-a-full-copy-of-the-layer-and-hand-it-to-the-work-on-apply]]
