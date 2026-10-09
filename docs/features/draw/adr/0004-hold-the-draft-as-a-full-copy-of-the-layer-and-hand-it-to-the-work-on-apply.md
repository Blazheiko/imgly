---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-09"
feature_size: "M"
ticket: "roadmap step 6 — draw"
---

# 0004 — Hold the Draft as a full copy of the layer, hand it to the Work on Apply, and never paint an applied layer again

- **Status:** Accepted
- **Date:** 2026-10-09
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

Like "Crop and rotate" and "Adjust", the "Draw" tool changes a Draft, which reaches the Work only on Apply. Cancel and Escape restore the Drawing layer the Work had before the tool opened (AC-06), and replacing the Work discards the Draft (AC-13). The other two tools hold their Draft as a few numbers in their own store (crop-rotate ADR-0003). Here the Draft is a bitmap of up to 64 MB (ADR-0001), painted in place (ADR-0002). The Work itself is an immutable value that the `editor` store swaps on every edit (`withEdit`, open-and-view ADR-0005), and the export snapshot holds a reference to it. Undo and redo (step 7) will keep earlier states of the Work.

## Decision drivers

- spec AC-05, AC-06 and AC-13: Clear, Cancel and replacing the Work change only the Draft; Cancel brings back the marks applied before the tool was opened
- spec AC-12: Unsaved edits follow a per-Draft change, not a pixel comparison; an Apply with no change leaves them as they were
- spec §6: from choosing "Draw" to the tool being ready, and from Apply, Cancel or Clear to the updated Preview, p95 ≤ 150 ms with a full layer; memory after 50 Applies ≤ 110% of memory after the first
- spec AC-14 and AC-15: an Export never contains a Draft that has not been applied
- sad.md §1 quality goals 2 and 3; crop-rotate ADR-0003; open-and-view ADR-0005

## Considered options

1. **A full copy as the Draft, handed to the Work on Apply** — opening the tool copies the Work's layer; Apply makes that bitmap the Work's layer; an applied layer is never painted again.
2. **Paint the Work's layer in place, backing up touched tiles** — copy-on-write: before a Stroke first touches a 256×256 tile, a copy of that tile is kept, and Cancel writes the copies back.

## Decision outcome

**Chosen:** Option 1. It keeps the Work an immutable value, as every other edit does. Each applied layer is a fixed bitmap, so the export snapshot, the renderer and a future undo stack can all hold a reference to it safely. Option 2 saves memory while the tool is open, but it mutates the Work in place between Applies and breaks that rule. Clear would still have to back up every tile. The tile bookkeeping is a second, harder-to-test path whose saving the spec does not need: two layers fit the reference machine's memory, and the memory row measures growth, not size.

How it works:

- **Open.** `editor.openTool('draw')` keeps the Crop and the View, as for "Adjust". The `draw` store makes its Draft a copy of `work.drawing` (one `drawImage` into a new W₀×H₀ canvas), or `null` when the Work has no layer. It then calls `editor.setPreviewLayer(draft)`, so the Preview shows the Draft in place of the Work's layer.
- **Paint and Clear.** Strokes paint the Draft (ADR-0002), and Clear releases it and sets it to `null` (ADR-0001). The store keeps a `changed` flag for AC-12, set the first time a Stroke or a Clear changes something (§4).
- **Apply.** `editor.applyDrawing(draft, changed)` stores the Draft as the Work's layer with a new id, raises the revision through `withEdit()` only when `changed` is true, and releases the previous applied layer. The renderer keys its texture on the bitmap, which Apply hands over unchanged, so Apply uploads nothing (ADR-0003). Enter applies only after the pointer is released (AC-18).
- **Cancel, Escape, replacing the Work.** The Draft is released and the tool slot closes, so the Preview shows `work.drawing` again. While the tool is open, the Preview shows only the Draft, and a `null` Draft (after Clear) shows no marks (AC-05). The renderer re-uploads that layer once, which stays inside the 150 ms budget for a full layer. `editor.replace()` closes the tool and releases the Draft with the old Work (AC-13), as it already drops the other tools' Drafts.
- **Immutability.** A layer handed to the Work is never painted again: a new tool session always paints a fresh copy. The export snapshot can therefore read the applied layer while the editor stays responsive, and step 7 can keep earlier layers by reference.
- **Release.** Every Draft and every replaced applied layer is released explicitly (ADR-0001: canvas set to 0×0, counted by the ledger). e2e asserts that after Apply or Cancel exactly one layer is retained, as it already does for the Original.
- **Tool settings.** The colour and the width live in the `draw` store outside the Draft. They are kept on Apply, Cancel and a new image until reload, and they are never edits (AC-02). The mode is reset to the Brush on every open (AC-01).

## Consequences

**Positive**
- The Work stays immutable, so the editor's edit rule, the export snapshot and the future undo stack need no special case for the layer.
- Apply is a reference handover with no copy and no upload, and Cancel is one release and one upload.
- The Draft's whole lifetime is one store with three exits (Apply, Cancel, replace), each tested at store level.

**Negative**
- While the tool is open, two full layers exist in memory (up to 128 MB for a 4096×4096 Original), plus one layer texture on the GPU.
- Opening the tool on a Work with a layer copies the whole layer, a few milliseconds of the 150 ms budget.
- Canvas memory is freed only when the code releases it explicitly. A missed release shows up in the memory row of §6, not as an error.

**Neutral**
- Switching to tile backups later would stay inside the `draw` store and `render/drawing`. The editor API (`setPreviewLayer`, `applyDrawing`) would not change.

## Links

- Spec: [[../spec.md]] AC-01, AC-02, AC-05, AC-06, AC-12, AC-13, §6
- SAD: [[../sad.md]] §4
- Related ADR: [[0001-hold-the-drawing-layer-as-one-bitmap-in-the-original-pixel-space-created-on-the-first-mark]], [[0005-make-one-apply-of-the-draw-tool-one-undo-step]]; crop-rotate ADR-0003; open-and-view ADR-0005
