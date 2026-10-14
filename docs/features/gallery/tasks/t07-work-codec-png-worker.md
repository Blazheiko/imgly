---
id: T7
title: "Add infra/work-codec: encodePng and decodePng in a fresh worker per job, with the decoded-size check"
layer: "infra"
deps: ["T1"]
blocks: ["T11", "T13"]
acs: ["AC-04", "AC-08"]
files_hint: ["src/infra/work-codec/client.ts", "src/infra/work-codec/client.test.ts", "src/infra/work-codec/codec.worker.ts", "src/infra/work-codec/worker-handler.ts", "src/infra/work-codec/worker-handler.test.ts", "src/infra/work-codec/index.ts", "src/infra/import-rules.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 49 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Add infra/work-codec: encodePng and decodePng in a fresh worker per job, with the decoded-size check

## Place in the sequence

- **Blocked by:** T1 — Add core/gallery rules and the error codes (`WORK_DAMAGED`).
- **Blocks:** T11 — Compose autosave.ts · T13 — Add reopenWork(id) to the editor store.
- **Wave:** 2.
- **Lane:** has its own lane, a new module. `src/infra/import-rules.test.ts` is touched only by this task.

## Why (user story)

> **As an** Editor
> **I want** to reopen a recent Work and find its Crop, Adjustments and drawing exactly as I left them
> **So that** I can change any of them separately later instead of starting again from the source file
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task adds the lossless PNG round trip that stores the Original and the Drawing layer and gives them back pixel for pixel.

## Inlined context

> - A new module, `src/infra/work-codec/`, has `client.ts`, `codec.worker.ts` and `worker-handler.ts`, following the worker convention (§2). Each job runs in a fresh worker that is terminated in every branch, with a timeout far above the §6 targets, as `runInWorker` does for the export.
>   - `encodePng(bitmap)` takes a bitmap copy made with `createImageBitmap(...)` and transferred to the worker, draws it into an `OffscreenCanvas` and returns the PNG Blob.
>   - `decodePng(blob, expectedSize)` decodes with no colour conversion, no orientation and no resize. It checks the size against the record and transfers the `ImageBitmap` back. A wrong size or a decode failure is a damaged Work (AC-08).
>
> — `adr/0003 §Decision outcome, How it works bullet 1, verbatim` · full text: [adr/0003](../adr/0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker.md)

> - Workers sit behind a client factory that takes `createWorker`, and their message handling lives in a separately tested `worker-handler.ts`. The export runs each job in a fresh worker that is terminated afterwards (export ADR-0002).
>
> — `sad.md §2, Technical constraint bullet 6, abridged` · full text: [sad.md](../sad.md)

> | A canvas holds colours premultiplied by alpha, so semi-transparent pixels of an Original may come back off by one step after the PNG round trip. Opaque pixels are exact (ADR-0003) | Medium | Add a PNG with partial transparency to the QG-2 reference set on all three engines. … |
>
> — `sad.md §11, premultiplied-alpha row, abridged` · full text: [sad.md](../sad.md)

> | AC-04 happy | PNG encode and decode keep the pixels and check the size | integration | `worker-handler` encodes an opaque RGBA buffer and decodes it to the same bytes; a decoded size that differs from the record's is refused |
>
> — `test-plan.md §AC coverage, AC-04 integration row 1, verbatim` · full text: [test-plan.md](../test-plan.md)

> **Contract is N/A.** The main thread ↔ codec worker message (`encodePng` / `decodePng`) is one shared TypeScript type. The typecheck gate is the contract check …
>
> — `test-plan.md §Decisions, Contract bullet, abridged` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** `infra` may call pure, side-effect-free `core` functions … never Vue, Pinia, a feature or the app shell; `src/infra/import-rules.test.ts` and ESLint enforce it.
>
> — `CLAUDE.md §Module boundaries, infra note, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or the code contradicts it, read the named file in full ([adr/0003](../adr/0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker.md) · `src/render/export/client.ts` and `worker-handler.ts` as the pattern) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. The signatures are a breakdown-time choice that follows `createExportClient`:

- `createWorkCodec(createWorker: () => Worker) → { encodePng(bitmap: ImageBitmap): Promise<Result<Blob, AppError>>; decodePng(blob: Blob, expected: { width; height }): Promise<Result<ImageBitmap, AppError>> }`
- A decode failure or a size mismatch returns `WORK_DAMAGED`. An encode failure or a timeout returns `STORAGE_FAILED`.
- The message types are shared between `client.ts` and `worker-handler.ts`, and that shared type is the contract.

## Acceptance criteria

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

## Checklist

- [ ] Write `worker-handler.ts`, which handles `{ kind: 'encode', bitmap }` and `{ kind: 'decode', blob, expected }`:
  - encode draws into a 2D `OffscreenCanvas` of the bitmap's size, closes the bitmap and returns `convertToBlob({ type: 'image/png' })`;
  - decode calls `createImageBitmap(blob, { colorSpaceConversion: 'none', imageOrientation: 'none', premultiplyAlpha: 'none' })`, compares the size with `expected` and transfers the bitmap back, or closes it and returns `WORK_DAMAGED`.
  Keep the canvas and bitmap factories injectable, as `image-decode` does.
- [ ] Write `codec.worker.ts`, a thin `onmessage` wiring to the handler.
- [ ] Write `client.ts`, following `runInWorker` in `src/render/export/client.ts`: a fresh worker per job, terminated in every branch, with a timeout. Transfer the bitmap copy to the worker and the decoded bitmap back.
- [ ] Write `index.ts`, which exports `createWorkCodec` and the types.
- [ ] Add `src/infra/work-codec` to the module list in `src/infra/import-rules.test.ts`: `core` and `shared` only.
- [ ] Write `worker-handler.test.ts` with the fake canvas or bitmap: an opaque RGBA round trip, a size mismatch, and an undecodable Blob.
- [ ] Write `client.test.ts` with a fake `Worker`: fresh per job, and terminated on success, failure and timeout.

## Edge cases

| Case | Behaviour |
|---|---|
| decoded size ≠ expected | the bitmap is closed and `WORK_DAMAGED` is returned |
| the Blob is not an image | `WORK_DAMAGED` |
| the worker throws or times out on encode | `STORAGE_FAILED`, and the worker is terminated |
| 1 × 1 and 4096 × 4096 bitmaps | encoded and decoded at their size |
| semi-transparent pixels | out of scope at this level. The e2e set in T19 checks them on three engines (sad §11 risk) |

## Definition of Done

- [ ] `worker-handler.test.ts` proves the opaque round trip is byte-exact, and that a size mismatch or an undecodable Blob returns `WORK_DAMAGED`.
- [ ] `client.test.ts` proves a fresh worker per job, terminated on success, failure and timeout.
- [ ] Every Hard Rule inlined above still holds (`import-rules.test.ts` covers `work-codec`).
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean.
