---
id: T2
title: "Add core/gallery stored-Work rules: STORED_WORK_FORMAT, toStoredFields and validateStoredWork, refusing every damage kind as WORK_DAMAGED"
layer: "domain"
deps: ["T1"]
blocks: ["T5", "T13"]
acs: ["AC-04", "AC-08", "AC-18"]
files_hint: ["src/core/gallery/stored-work.ts", "src/core/gallery/stored-work.test.ts", "src/core/gallery/index.ts", "src/core/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 65 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Add core/gallery stored-Work rules: STORED_WORK_FORMAT, toStoredFields and validateStoredWork, refusing every damage kind as WORK_DAMAGED

## Place in the sequence

- **Blocked by:** T1 — Add core/gallery rules and the `STORAGE_UNAVAILABLE`, `STORAGE_FAILED` and `WORK_DAMAGED` error codes.
- **Blocks:** T5 — Add listWorks, loadWork and deleteWork to the works repository · T13 — Add reopenWork(id) to the editor store.
- **Wave:** 2. It needs `WORK_DAMAGED` from T1.
- **Lane:** shares `src/core/gallery/index.ts` and `src/core/index.ts` with T1, so the two run one after the other.

## Why (user story)

> **As an** Editor
> **I want** to reopen a recent Work and find its Crop, Adjustments and drawing exactly as I left them
> **So that** I can change any of them separately later instead of starting again from the source file
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task adds the pure check that turns an untrusted stored record into a Work's editable fields, or refuses it as damaged.

## Inlined context

> | Data read from storage | Untrusted (§3 trust boundary). Listing checks a record's shape and its thumbnail only. Choosing a Work runs `validateStoredWork` (sizes, Geometry with the Crop inside the image, Adjustment ranges, Source format, `formatVersion`) and checks each PNG's decoded size against the record (AC-08). The Source name is only ever rendered as text, and stored data is only ever shown as an image (spec §6.1) |
>
> — `sad.md §8, row Data read from storage, verbatim` · full text: [sad.md](../sad.md)

> | `sourceName` | `string` | required, may be `''` |
> | `sourceFormat` | `ImageFormat` | one of `'jpeg' \| 'png' \| 'gif' \| 'webp' \| 'avif' \| 'heic'` |
> | `touchedAt` | `number` | required, epoch ms, indexed |
> | `width` / `height` | `number` | integer ≥ 1, ≤ 4096 |
> | `hasTransparency` | `boolean` | required |
> | `geometry` | `Geometry` | Crop inside the turned image, Straighten −450…450, Rotation ∈ {0, 90, 180, 270} |
> | `adjustments` | `Adjustments` | each field within `ADJUSTMENT_RANGES` |
> | `layerId` | `string \| null` | `null` ⇔ no `layers` entry |
> | `thumbnail` | `Blob` (`image/png`) | required |
> | `formatVersion` | `number` | `1` for this layout. … `validateStoredWork` rejects unknown values (AC-18). The constant lives in `src/core/gallery/` (`STORED_WORK_FORMAT = 1`) |
>
> — `data-model.md §Entities, works, abridged (Notes column dropped)` · full text: [data-model.md](../data-model.md)

> **Invariant:** a `layers` entry exists ⇔ `works.layerId !== null`. A violation at reopen is a damaged Work (AC-08).
> … On reopen, the in-memory Work's `createdAt` and `updatedAt` are set from `touchedAt`.
>
> — `data-model.md §Entities, layers invariant + works "Removed in v2", abridged` · full text: [data-model.md](../data-model.md)

> - `damagedWorkFixture(kind)` returns a stored Work broken in one way: `'missing-original'`, `'layer-without-record-id'`, `'size-mismatch'`, `'bad-geometry'` or `'unknown-format-version'` (AC-08 and `validateStoredWork` cases).
>
> — `data-model.md §Test fixtures, bullet 3, verbatim` · full text: [data-model.md](../data-model.md)

> | AC-04 happy | a stored record and its parts serialise and read back to the same Work (property) | unit | for random valid Geometries, Adjustments, sizes, Source names and formats, `toRecord` then `validateStoredWork` gives the same values |
> | AC-08 error | each kind of damage makes `validateStoredWork` refuse the Work | unit | `missing-original`, `layer-without-record-id`, `size-mismatch`, `bad-geometry` and `unknown-format-version` from `damagedWorkFixture` each make it refuse the Work as damaged; a valid stored Work passes |
>
> — `test-plan.md §AC coverage, AC-04 unit + AC-08 unit rows, verbatim` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** `src/core/` — Pure TS domain … May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
>
> — `CLAUDE.md §Module boundaries, src/core row, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** if a slice is insufficient or the code contradicts it, read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [test-plan.md](../test-plan.md)) and follow it. Do not guess.

## Data delta

No DB changes. This task validates the `works` record shape that T3 defines, and it does not change it.

## API contract

Internal — no API surface. This task exposes the following to T5 and T13 (the shapes are a breakdown-time choice, and `toRecord` in the test plan is this `toStoredFields`):

- `STORED_WORK_FORMAT = 1`
- `toStoredFields(work, touchedAt): StoredWorkFields` returns every `works` field except `thumbnail`, with `layerId` taken from the Work's drawing layer id or null.
- `validateStoredWork(input: unknown, parts: { hasOriginal: boolean; hasLayer: boolean }): Result<StoredWorkFields, AppError>`. Every failure is `WORK_DAMAGED`.
- `validateRecordShape(input: unknown): boolean` is the listing-only shape check that T5 uses (AC-08: listing checks only what an entry shows).

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

### AC-18 (US-02) — cross-context

> **Given** the Gallery holds Works stored by an earlier version of the app
> **When** the app updates to a new version and the Editor reopens one of them
> **Then** the Work opens with exactly the stored data: the same Original pixels, Source name, Source format, Geometry, Adjustments and Drawing layer. When the update did not change how a Work is drawn, a full-size Export of it is identical to the Export the earlier version made. An update never empties the Gallery or loses a Work
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `STORED_WORK_FORMAT`, the `StoredWorkFields` type and `toStoredFields(work, touchedAt)` (`src/core/gallery/stored-work.ts`). Copy Geometry and Adjustments as plain values.
- [ ] Add `validateRecordShape(input)`. It checks that every field has the right primitive type, that `thumbnail` exists, and that `sourceName` is a string. It does not check ranges.
- [ ] Add `validateStoredWork(input, parts)`, which runs the shape check and then:
  - checks that `width` and `height` are integers in 1–4096;
  - reuses the `core/geometry` validators for the Crop inside the turned image, Straighten in −450…450 and Rotation in {0, 90, 180, 270};
  - checks every Adjustment against `ADJUSTMENT_RANGES`;
  - checks that `sourceFormat` is a known `ImageFormat` and that `formatVersion === STORED_WORK_FORMAT`;
  - checks that `parts.hasOriginal` is true and that `(layerId !== null) === parts.hasLayer`.
  Any failure returns `err(appError('WORK_DAMAGED', …))`.
- [ ] Export from `src/core/gallery/index.ts` and `src/core/index.ts`.
- [ ] Write `stored-work.test.ts`: a round-trip property test over random valid values, and one refusal test per Edge case row. Build the inputs inline. The `damagedWorkFixture` in `src/infra/db/testing.ts` is T3's, and core can't import it.

## Edge cases

| Case | Behaviour |
|---|---|
| `input` is `null`, a number or is missing fields | `WORK_DAMAGED` |
| `width` is 0, 4097 or 3.5 | `WORK_DAMAGED` |
| Crop outside the image after the stored Rotation | `WORK_DAMAGED` (`bad-geometry`) |
| an Adjustment one step outside its range | `WORK_DAMAGED` |
| `sourceFormat: 'bmp'` | `WORK_DAMAGED` |
| `formatVersion: 2` (an unknown future layout) | `WORK_DAMAGED`, never guessed at |
| `layerId` set but no layer, or a layer but `layerId: null` | `WORK_DAMAGED` (`layer-without-record-id`) |
| no Original | `WORK_DAMAGED` (`missing-original`) |
| `sourceName` containing markup such as `<img onerror>` | valid, because the string is kept as is (it is only ever rendered as text, spec §6.1) |
| `sourceName: ''` | valid |

## Definition of Done

- [ ] A round-trip property test passes for random valid Geometries, Adjustments, sizes, Source names and formats.
- [ ] Each damage kind and Edge case row returns `WORK_DAMAGED`.
- [ ] A valid stored Work passes.
- [ ] Every Hard Rule inlined above still holds: no import outside `core`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean.
