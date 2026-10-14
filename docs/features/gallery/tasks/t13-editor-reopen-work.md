---
id: T13
title: "Add reopenWork(id) to the editor store: refuse while exporting or confirming, load, decode and validate in full before the gate, replace with the stored Work, an empty Edit history and a fitted View"
layer: "app"
deps: ["T2", "T5", "T7", "T12"]
blocks: ["T15"]
acs: ["AC-02", "AC-04", "AC-08", "AC-15", "AC-17"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/editor/autosave.ts", "src/features/editor/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 80 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Add reopenWork(id) to the editor store

## Place in the sequence

- **Blocked by:** T2 — Add core/gallery stored-Work rules · T5 — Add listWorks, loadWork and deleteWork · T7 — Add infra/work-codec · T12 — Wire Autosave into the editor store.
- **Blocks:** T15 — Add the gallery feature's store and messages.
- **Wave:** 5.
- **Lane:** shares `src/features/editor/store.ts`, `store.test.ts`, `index.ts` with T12 and `src/features/editor/autosave.ts` with T11 — serialized.

## Why (user story)

> **As an** Editor
> **I want** to reopen a recent Work and find its Crop, Adjustments and drawing exactly as I left them
> **So that** I can change any of them separately later instead of starting again from the source file
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It is the store action that turns a stored Work back into the open, editable Work.

## Inlined context

> - `reopenWork(id)` follows `openImage`'s rules:
>   - It is refused while exporting or confirming (AC-15), and latest open wins.
>   - It reads the record and both Blobs, decodes them and validates them with pure `core` checks. A failure returns a damaged-Work refusal and changes nothing (AC-08).
>   - On success, the gate runs, and `replace` swaps in the stored Work with its own id and source. Its revision equals its `cleanRevision`, it starts an empty Edit history (undo-redo AC-09, AC-10), and the View is fitted (AC-02, AC-04).
>
> — `adr/0001 §Decision outcome, How it works bullet 4, verbatim` · full text: [adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md](../adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md)

> ```
> alt export running or a replacement waits for confirmation → refused, hint to wait or answer first
> else allowed
>     Store->>DB: load the record, the Original and the layer
>     Store->>Codec: decode the PNGs at the recorded size
>     alt any part missing, damaged or invalid → damaged, the open Work unchanged
>     else readable in full
>         Store->>Store: wait until no save is running or pending
>         alt Unsaved edits not stored, or the Gallery unavailable → replace confirmation
>         Store->>Store: replace with the stored Work, empty Edit history, View fitted
>         Store->>Store: queue a save, which updates when it was last opened
>         Store-->>UI: replaced, close the overlay
> ```
>
> — `sad.md §6, Critical flow 2, abridged` · full text: [sad.md](../sad.md)

> On reopen, the decoded Original becomes the Work's `ImageBitmap`. The decoded layer is drawn into a new layer from `createLayer`, which gives it a new id, and the bitmap is closed with `closeBitmap`. […] Autosave then records the restored layer's new id as the stored layer id and keeps the two loaded PNG Blobs as the open Work's encoded copies. The first Crop or Adjustment Step after a reopen therefore encodes nothing and stays within its 300 ms target.
>
> — `adr/0003 §Decision outcome, How it works bullet 4, abridged` · full text: [adr/0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker.md](../adr/0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker.md)

> `createdAt` is deliberately **not** stored […]. On reopen, the in-memory Work's `createdAt` and `updatedAt` are set from `touchedAt`.
>
> — `data-model.md §Entities, works, Removed in v2, abridged` · full text: [data-model.md](../data-model.md)

> | Resource lifetime | Decoded bitmaps that are superseded or rejected go through `closeBitmap`, and replaced layers through `releaseLayer`, as in §2. The open Work's encoded Blobs are dropped when it is replaced (ADR-0003). […] |
>
> — `sad.md §8, Resource lifetime row, abridged` · full text: [sad.md](../sad.md)

> | info (hint) | choose while exporting | AC-15 | Wait for the export to finish, then choose a Work. |
> | info (hint) | choose while a replacement waits | AC-15 | Answer the open question first, then choose a Work. |
>
> — `screens.md §Message catalog, AC-15 rows, verbatim` · full text: [screens.md](../screens.md) — texts are raised by the gallery store (T15); this task returns the refusal reason.

**Code facts (breakdown time):** `createWork(original, id, source, now)` gives `revision = cleanRevision = 0`; T2's `validateStoredWork` and T7's `decodePng(blob, expectedSize)` return `WORK_DAMAGED`; T5's `loadWork(id)` returns record + Blobs.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Reads `works`, `originals` and `layers` through T5's `loadWork`; the follow-up save goes through Autosave.

## API contract

Internal — no API surface. `reopenWork(id): Promise<ReopenOutcome>` (name from ADR-0001; outcome kinds a breakdown-time choice mirroring `OpenOutcome`):
`{ kind: 'replaced' } | { kind: 'confirming' } | { kind: 'cancelled' } | { kind: 'damaged'; error: AppError } | { kind: 'refused'; reason: 'exporting' | 'confirming' | 'unavailable' } | { kind: 'superseded' } | { kind: 'already-open' }`.

## Acceptance criteria

### AC-02 (US-01) — domain invariant

> **Given** the Editor has applied a drawing, undone it, zoomed into the Preview and opened "Draw" again with strokes that are not applied
> **When** the page is reloaded and the Editor reopens the Work from the Gallery
> **Then** the Work has no drawing, because the Undo was stored like any Step, and none of the unapplied strokes, because an open tool's Draft is never stored. The Preview is fitted to the screen, not zoomed, because the View is never stored, and Undo and Redo are unavailable, because the Edit history is never stored
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-04 (US-02) — happy path

> **Given** a Work in the Gallery was stored with a Crop, a Straighten angle, all seven Adjustments away from neutral and a drawing
> **When** the Editor chooses it, after a reload or with another Work open and no Unsaved edits left unstored
> **Then** it replaces the open Work and shows exactly the stored Work: a full-size Export of it is identical to the Export of the same Work made before the reload. Its Source name and Source format still name and pick the default format of the next Export. Each part stays editable on its own: "Crop and rotate" shows the whole image with the stored frame, "Adjust" shows the stored slider values, and "Draw" shows the stored Drawing layer, which can be painted on and erased with the Brush and the Eraser as before the reload. The reopened Work starts with an empty Edit history and no Unsaved edits, and the Gallery closes
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-08 (US-02) — error

> **Given** a Work in the Gallery can no longer be read back, because its stored data is damaged or incomplete
> **When** the Editor chooses it, or the Gallery tries to show its thumbnail
> **Then** the open Work stays exactly as it was. Listing the Gallery checks only what the entry shows (its thumbnail and details), and choosing a Work checks all of it. The entry is marked as damaged instead of failing silently, and choosing it shows a notice that names the Work, says it cannot be opened and offers to delete it. Every other Work in the Gallery lists, opens and deletes normally. A damaged Work still counts toward the 20 places and is the first to be evicted when room is needed, with the usual notice naming it
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-15 (US-02) — cross-context

> **Given** an export is running, or a replacement of the Work is waiting for the Editor's confirmation
> **When** the Editor chooses a Work in the Gallery
> **Then** choosing a Work is unavailable, with a hint to wait for the export or to answer the confirmation first, and the open Work does not change
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-17 (US-06) — cross-context

> **Given** the open Work has Unsaved edits that are not stored in the Gallery, because Autosave failed, including a save that was still running when the Editor chose and then failed, or because the Gallery is unavailable
> **When** the Editor opens another image or chooses a Work in the Gallery
> **Then** the app asks for confirmation before replacing it, saying the latest edits are not saved in the Gallery and would be lost. Cancelling keeps the Work exactly as it was. Choosing a Work that cannot be read never replaces the open Work and never asks (open-and-view AC-16)
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `reopenWork(id)`: refuse on `exporting`/`confirming`/unavailable; `id === openWorkId` → `already-open`; bump `latestOpenId`, `phase = 'reading'` — `src/features/editor/store.ts`
- [ ] `loadWork` → `validateStoredWork` → `decodePng` Original and layer at the recorded size; any failure → `damaged`, close any decoded bitmap, phase back to `idle`, nothing else changes
- [ ] Gate: `await autosave.settled()`, re-check supersede, ask under the same rule as `openImage` (T12); hold the restored parts as `pending` for `confirmReplace`/`cancelReplace` (cancel closes bitmaps)
- [ ] Generalise `replace()` to accept a restored Work: `createWork` with the stored id and source, `createdAt`/`updatedAt` = `touchedAt`, Geometry + Adjustments from the record, layer = `createLayer` + draw decoded bitmap + `closeBitmap`; `edits.clear`; View fitted
- [ ] Hand the loaded Blobs and the new layer id to Autosave (`keepEncoded`), then `request(work)` so `touchedAt` updates — `src/features/editor/autosave.ts`
- [ ] Export the `ReopenOutcome` type — `src/features/editor/index.ts`
- [ ] Store tests per the DoD — `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| reopen while a newer open or reopen started | older returns `superseded`; its decoded bitmaps closed |
| the Work chosen is the open one | `already-open`; nothing read or replaced (SCR-03 `open Work chosen`) |
| missing Original, layer without `layerId`, size mismatch, bad Geometry, unknown `formatVersion` | `damaged`; Work, revision, View, history unchanged; no confirmation |
| damaged Work with unstored edits open | `damaged`, never asks (AC-17) |
| record with `layerId: null` | Work has no drawing; no layer decoded |
| the overlay closes while the reopen reads | the reopen still completes or fails cleanly, never half replaces |
| first Adjustment Step after reopen | Autosave writes only the record; nothing encoded |

## Definition of Done

- [ ] `reopenWork` is refused and not queued while exporting or confirming
- [ ] a damaged Work returns a damaged outcome and leaves the Work, revision, View and history unchanged with no confirmation
- [ ] a readable Work replaces the open one keeping its id, Source name, Source format, Geometry and Adjustments, with a new layer id, empty history, `revision === cleanRevision` and a fitted View
- [ ] the next Adjustment save encodes nothing; latest reopen wins; rejected bitmaps are closed (ledger retained count 0)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
