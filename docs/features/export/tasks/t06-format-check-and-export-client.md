---
id: T6
title: "Add the once-per-session format check and the main-thread export client (worker spawn, transfer, terminate)"
layer: "infra"
deps: ["T5"]
blocks: ["T8"]
acs: ["AC-12"]
files_hint: ["src/render/export/", "src/render/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 42 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Add the once-per-session format check and the main-thread export client (worker spawn, transfer, terminate)

## Place in the sequence

- **Blocked by:** T5 — Extract the shared shader module and build the export worker that renders, flattens, encodes and verifies one export.
- **Blocks:** T8 — Create the export store: panel state, defaults, session memory, format availability and the messages catalog.
- **Wave:** 3 — after T5.
- **Lane:** shares `src/render/export/` with T5 — serialized.

## Why (user story)

> **US-06: Understand why an export did not happen**
>
> **As a** Editor  
> **I want** a plain reason when a format is unavailable or an export fails  
> **So that** I never end up with a wrong or blank file, or with an export that failed inside the app without my knowing it
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It answers "can this browser really make JPEG and WebP" from content, and gives the app one call that runs an export in a fresh worker.

## Inlined context

> 3. **Judge formats by content, both before and after** — inline. Once per session, starting with the first open, the export worker trial-encodes a small semi-transparent sample in JPEG and WebP and judges what came out with the core header parser; PNG is always offered. Every real export is judged the same way, by format and dimensions, before it is handed off. A mismatch disables that format for the session (AC-12). This reuses open-and-view ADR-0002's parser instead of trusting `Blob.type`, which the spec rules out ("decided by the content", AC-12).
>
> — `sad.md §4, Top strategic choice 3, verbatim` · full text: [sad.md](../sad.md)

> | Concept | Convention | Where defined |
> |---|---|---|
> | Capability detection | The save path by `'showSaveFilePicker' in window`; the producible formats by the once-per-session trial encode in the export worker, judged by content (AC-12); `FileSystemHandle.remove()` by presence. No user-agent sniffing. A format whose check is still running or has failed is not selectable; PNG always is, and the panel never switches the selected format by itself | here; ADR-0002 |
>
> — `sad.md §8, verbatim` · full text: [sad.md](../sad.md)

> │       └── client.ts             exportImage(request) → Result<Blob>; checkExportFormats() → per-format availability
>
> — `sad.md §5, Internal decomposition (client line), verbatim` · full text: [sad.md](../sad.md)

> at most one export worker rendering an export, plus the session's short-lived format-check worker, which may still be running when a PNG export starts (AC-12 keeps PNG available meanwhile). The check encodes only a 2×2 sample.
>
> — `sad.md §7, Deployment view, abridged` · full text: [sad.md](../sad.md)

> - The same worker runs the session's format check, so "can this browser produce WebP" is answered by the exact code path that later exports it (AC-12)
>
> — `adr/0002 §Consequences, Positive bullet 3, verbatim` · full text: [adr/0002-render-and-encode-exports-in-a-dedicated-web-worker.md](../adr/0002-render-and-encode-exports-in-a-dedicated-web-worker.md)

> **Fixed by this breakdown:** the check runs in its own short-lived instance of the export worker (a `check` message), so it can overlap a PNG export; `checkExportFormats()` never rejects — any error resolves that format to `false`. When to start it (first open of the session) is the export store's job (T8).
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-12 — error

> **Given** the browser cannot produce one of the formats (for example WebP in Safari)
> **When** the Editor opens the export panel
> **Then** that format is shown but cannot be chosen, and a one-line hint next to it says it is not available in this browser. Whether a browser can produce a format, and whether a produced file is in the chosen format, is decided by the content the browser actually produces, never by the browser's name or version. If a produced file ever turns out not to be in the chosen format, it is not saved, the Editor is told why, and the Work keeps its Unsaved edits; that format then becomes not selectable, with the same hint, for the rest of the browser session, and the default falls back to PNG (AC-19). The panel then selects PNG straight away, and PNG becomes the remembered format for this Work. The check of every format starts when the first image of the session is opened and runs once per browser session; a check that fails or errors counts as the browser not being able to produce that format. Until the check of a format has finished, that format cannot be chosen; PNG is always available. If the panel opens before the check of the Work's Source format has finished, the format is preset to PNG and stays PNG: the panel never changes the selected format by itself when a check finishes
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Handle a `check` message in the worker: encode a 2×2 semi-transparent sample as JPEG and WebP through the same encode path, judge each with `sniffImageHeader` — `src/render/export/worker-handler.ts`
- [ ] Write `exportImage(request): Promise<Result<Blob, AppError>>`: new module `Worker`, transfer the bitmap, terminate on reply, `error` or `messageerror` (→ `EXPORT_FAILED`) — `src/render/export/client.ts`
- [ ] Write `checkExportFormats(): Promise<{ png: true; jpeg: boolean; webp: boolean }>`, terminating its worker after the reply — `src/render/export/client.ts`
- [ ] Re-hydrate worker errors with `isAppErrorCode` as the decode client does; export the client from `src/render/index.ts`
- [ ] Vitest with a fake `Worker` (as in `src/infra/image-decode/client.test.ts`) — `src/render/export/client.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Sample encodes as PNG when asked for WebP | `webp: false` |
| Encoder throws or the worker crashes during the check | that format (or both) `false`; PNG stays `true` |
| Worker crashes during an export | `EXPORT_FAILED`, worker terminated |
| Unknown error code from the worker | `EXPORT_FAILED` |
| Two calls of `checkExportFormats` | each spawns and terminates its own worker (the store calls it once) |

## Definition of Done

- [ ] Vitest proves `checkExportFormats` reports a format available only when the sample's content is that format, and `false` on any error, with PNG always true (AC-12)
- [ ] Vitest proves `exportImage` transfers the bitmap, returns the handler's Result, maps a worker crash to `EXPORT_FAILED`, and terminates the worker in every branch
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
