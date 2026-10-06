---
id: T3
title: "Carry Source name, Source format and the transparency fact on the Work from every open"
layer: "domain"
deps: ["T1"]
blocks: ["T4", "T8"]
acs: ["AC-08", "AC-15"]
files_hint: ["src/core/document.ts", "src/infra/image-decode/", "src/features/editor/store.ts", "src/app/test-hooks.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 54 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Carry Source name, Source format and the transparency fact on the Work from every open

## Place in the sequence

- **Blocked by:** T1 — Add the export error codes and the pure file-name rules (Source name, suggested name, extension match).
- **Blocks:** T4 — Add the editor store's exclusive exporting phase, beginExport/finishExport and the save point, T8 — Create the export store: panel state, defaults, session memory, format availability and the messages catalog.
- **Wave:** 2 — after T1.
- **Lane:** shares `src/app/test-hooks.ts`, `src/features/editor/store.ts` with T4, T15 — serialized.

## Why (user story)

> **US-04: Recognise the exported file**
>
> **As a** Editor  
> **I want** the exported file to be named after the image I opened  
> **So that** I can find it and tell it apart from the original photo
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

> **US-06: Understand why an export did not happen**
>
> **As a** Editor  
> **I want** a plain reason when a format is unavailable or an export fails  
> **So that** I never end up with a wrong or blank file, or with an export that failed inside the app without my knowing it
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It makes the Work remember which file it came from and whether it has transparent pixels, so the suggested name and the JPEG hint always describe the image actually open.

## Inlined context

> - `Work` gains `sourceName: string` and `sourceFormat: ImageFormat`, replacing the placeholder `name: 'Untitled'`. `openImage(file)` sets them from `File.name` (last extension removed only when it is a known image extension, CONTEXT "Source name") and from the decoder's `format`, so a replace by "Open image" or by a drop always brings the new image's name and format (AC-08). A plain `Blob` with no name gives an empty Source name, which AC-07 turns into `image`.
> - The decode worker scans the decoded bitmap's alpha channel once per open and reports `hasTransparency` (at least one pixel not fully opaque) with the other image facts; it becomes a field of the Original. The export panel reads it for the JPEG hint (AC-15). The scan runs off the main thread, a single pass over at most 4096 × 4096 pixels.
>
> — `sad.md §5, Cross-feature changes bullets 1 and 3, verbatim` · full text: [sad.md](../sad.md)

> | Term | Meaning |
> |---|---|
> | Source name | The opened file's name with a known image extension removed; it names Exports |
> | Source format | The format the Work was opened from, judged by content; it picks the default Export format |
>
> — `sad.md §12, Glossary, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** a tool that changes alpha (eraser, crop to a shape) must keep the Original's `hasTransparency` fact true for the edited Work
>
> — `sad.md §11, risk row 4 (abridged), abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** Functional core with feature folders: `core` is pure TypeScript; features never import each other and coordinate through the `editor` store; `infra` may call pure `core` functions
>
> — `sad.md §2, Technical constraints, verbatim` · full text: [sad.md](../sad.md)

> **Fixed by this breakdown:** the contract change to `Work` and `Original` is folded into this task with its only implementer, `replace()` in `src/features/editor/store.ts` (the sole `createWork` call site), so the task commits green. `name` is removed, not kept alongside.
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-08 — cross-context

> **Given** the Editor opened one image and then replaced it with another, by the "Open image" action or by dropping a file
> **When** the Editor exports the new Work
> **Then** the suggested name comes from the new image's Source name, never from the image it replaced
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — error

> **Given** the Work has transparent areas, meaning at least one pixel is not fully opaque, whatever format the Work was opened from
> **When** JPEG is selected in the export panel, whether the Editor chose it or it was preset or remembered (AC-19)
> **Then** the panel says in one line that JPEG has no transparency and transparent areas will become white, and suggests PNG or WebP to keep them. In the exported JPEG every pixel looks as it would on a white background: its colour is opacity × the pixel's colour + (1 − opacity) × white, computed on the stored sRGB values (as the Preview would show it on white), so a fully transparent pixel becomes white. A Work with no transparent pixels shows no such hint
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Replace `Work.name` with `sourceName: string` and `sourceFormat: ImageFormat`; add `hasTransparency: boolean` to `Original`; extend `createWork` to take them — `src/core/document.ts` (+ `document.test.ts`)
- [ ] Scan the decoded bitmap's alpha once in the worker pipeline and add `hasTransparency` to `DecodedImage` — `src/infra/image-decode/pipeline.ts`, `types.ts`, `worker-handler.ts` (+ tests)
- [ ] Thread the opened file's name through `openImage` → `replace()` (also through the `confirming` → `confirmReplace` path) and set `sourceName: sourceNameOf(file.name ?? '')`, `sourceFormat: image.format` — `src/features/editor/store.ts`
- [ ] Expose `sourceName`, `sourceFormat` and `hasTransparency` from the `work()` test hook so e2e can assert them — `src/app/test-hooks.ts`, `e2e/test-hooks.d.ts`
- [ ] Store tests: open A then replace with B by "Open image" and by a drop → B's Source name and format — `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Opened from a `Blob` with no `name` | `sourceName === ''` (AC-07 later gives `image`) |
| Replace pending on the confirmation, then cancelled | the Work keeps its old Source name and format |
| Replace by drop after a replace by "Open image" | the newest image's name and format win (AC-08) |
| Opaque JPEG; PNG with one alpha 254 pixel | `hasTransparency` false; true |
| Fully opaque PNG with an alpha channel | `hasTransparency` false (no hint, AC-15) |

## Definition of Done

- [ ] Vitest proves a replace by "Open image" and by a drop both set the new Source name and Source format (AC-08)
- [ ] Vitest proves the alpha scan reports `hasTransparency` true for one non-opaque pixel and false for a fully opaque image with an alpha channel
- [ ] every Hard Rule inlined above still holds; open-and-view's existing tests stay green
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
