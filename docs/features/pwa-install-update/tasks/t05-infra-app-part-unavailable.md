---
id: T5
title: "Map a worker script that fails to load to APP_PART_UNAVAILABLE in the decode, codec and export clients, and word it"
layer: "infra"
deps: []
blocks: ["T7"]
acs: ["AC-14"]
files_hint: ["src/core/result.ts", "src/infra/image-decode/client.ts", "src/infra/image-decode/client.test.ts", "src/infra/work-codec/client.ts", "src/infra/work-codec/client.test.ts", "src/render/export/client.ts", "src/render/export/client.test.ts", "src/features/editor/messages.ts", "src/features/editor/messages.test.ts", "src/features/export/messages.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "S"   # measured: 28 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Map a worker script that fails to load to APP_PART_UNAVAILABLE in the decode, codec and export clients, and word it

## Place in the sequence

- **Blocked by:** — · **Blocks:** T7 — Make Autosave raise storageSuperseded · **Wave:** 1.
- **Lane:** shares `src/core/result.ts` with T4 and `src/features/editor/messages.ts` with T7 — serialized.

## Why (user story)

> **As an** Editor
> **I want** every other window of the app to tell me when another window has switched to a new version
> **So that** I never keep editing in an outdated window without knowing it
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task makes an outdated window refuse an action cleanly, with a "reload to continue" message, when its old worker script is gone.

## Inlined context

> **An outdated window reports a missing part instead of failing halfway.** The three worker clients map a worker script that fails to load to `APP_PART_UNAVAILABLE`. The decode, reopen and export paths already change nothing until their worker succeeds (open-and-view, gallery ADR-0003, export ADR-0001), so the action changes nothing. Each owner's `messages.ts` words the code as "imgly was updated in another window and must be reloaded to continue", because a hashed script of this build goes missing only after a newer build has replaced it (AC-14).
>
> — `sad.md §5, tactical decision 5, abridged` · full text: [sad.md](../sad.md)

> | failure | `APP_PART_UNAVAILABLE` | AC-14 | imgly was updated in another window. Reload this window to continue. |
>
> — `screens.md §Message catalog, verbatim` · full text: [screens.md](../screens.md)

> GitHub Pages serves only the latest build, so an older window's hashed files are no longer on the network after a deploy.
>
> — `sad.md §2, Browser behaviour, verbatim` · full text: [sad.md](../sad.md)

**Code today:** each client sets `worker.onerror` to its generic failure (`DECODE_FAILED` in `src/infra/image-decode/client.ts:99`, the codec's `failed` in `src/infra/work-codec/client.ts:58`, the export `fallback` in `src/render/export/client.ts:103`). The generic failure for a runtime error inside a running worker must stay as it is.

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §5 and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. New `AppErrorCode` member `APP_PART_UNAVAILABLE` (doc comment: "A worker script of this build could not be loaded, because a newer build replaced it. AC-14").

## Acceptance criteria

### AC-14 — cross-context (the missing-part sentence)

> **Then** … When an action in an older window needs a part of the app that the window can no longer load, the action changes nothing and the window says that imgly was updated in another window and must be reloaded to continue. …
>
> — `spec.md §5, AC-14, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `APP_PART_UNAVAILABLE` to `AppErrorCode` — `src/core/result.ts`.
- [ ] In each client, tell a script that failed to **load** apart from a runtime failure, and return `err(appError('APP_PART_UNAVAILABLE'))` for the load case — `image-decode/client.ts`, `work-codec/client.ts`, `render/export/client.ts`.
- [ ] Word the code in the editor's failure map (decode, reopen) — `src/features/editor/messages.ts` — and in the export failure map — `src/features/export/messages.ts`. Same copy in both.
- [ ] Tests per client with a fake `Worker` that fires the load-failure signal; messages tests for the copy.

## Edge cases

| Case | Behaviour |
|---|---|
| Worker script 404 before any message | `APP_PART_UNAVAILABLE`; the action changes nothing (open, reopen, export already commit only on success) |
| Runtime error inside a worker that did load | Unchanged: `DECODE_FAILED`, the codec failure, or `EXPORT_FAILED` |
| Load failure and runtime error look identical in an engine | **Do not guess.** Record which signal you used per engine in the client's doc comment; if no reliable signal exists, stop and raise it with the owner (it changes `sad.md §5`) |
| Autosave's codec job hits it | Out of scope here: T7 makes Autosave raise `storageSuperseded` for this code |

## Definition of Done

- [ ] Each client's test proves load failure → `APP_PART_UNAVAILABLE` and runtime error → the old code.
- [ ] `messages.test.ts` proves the catalog copy for `APP_PART_UNAVAILABLE`.
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
