---
id: T7
title: "Make Autosave raise editor.storageSuperseded on versionchange and on APP_PART_UNAVAILABLE, instead of infoNewerVersion()"
layer: "app"
deps: ["T5", "T6"]
blocks: ["T8"]
acs: ["AC-12", "AC-14"]
files_hint: ["src/features/editor/autosave.ts", "src/features/editor/autosave.test.ts", "src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/editor/messages.ts", "src/features/editor/messages.test.ts", "src/features/editor/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 33 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Make Autosave raise editor.storageSuperseded on versionchange and on APP_PART_UNAVAILABLE, instead of infoNewerVersion()

## Place in the sequence

- **Blocked by:** T5 — Map a worker script that fails to load to APP_PART_UNAVAILABLE · T6 — Add the Reload gate editor.requestReload() · **Blocks:** T8 — Add the feature store's update lifecycle · **Wave:** 2.
- **Lane:** shares `src/features/editor/store.ts` with T6 and `src/features/editor/messages.ts` with T5 — serialized after both.

## Why (user story)

> **As an** Editor
> **I want** every other window of the app to tell me when another window has switched to a new version
> **So that** I never keep editing in an outdated window without knowing it
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task turns Autosave's "a newer version took the Gallery" stop into a store flag the update notice can reword, instead of a notice of its own.

## Inlined context

> - `src/features/editor/autosave.ts` keeps ADR-0006's steps: let the running save finish, drop the pending one, close the connection and mark the Gallery unavailable. It sets `storageSuperseded` on the `editor` store instead of pushing `infoNewerVersion()`. The feature rewords the one update notice to `reload-to-save`.
> - Autosave treats a codec worker that fails to load (`APP_PART_UNAVAILABLE`, an outdated window) the same way, and raises `storageSuperseded` instead of the could-not-save notice.
> - After that, `isStored()` is false for every edit, so "Reload" asks for confirmation as AC-12 says.
>
> — `adr/0002, How it works bullets 2–4, verbatim` · full text: [adr/0002](../adr/0002-tell-other-windows-of-a-switch-through-controllerchange-and-of-a-storage-change-through-versionchange.md)

> `editor/messages.ts  infoNewerVersion() moves to the new feature's wording (SCR-05, third wording)`
>
> — `sad.md §5, decomposition, verbatim` · full text: [sad.md](../sad.md)

**Code today:** `onVersionChange` in `src/features/editor/autosave.ts:162-171` ends with `deps.notices.pushAll([{ kind: 'info', text: infoNewerVersion() }])`; `infoNewerVersion` lives in `src/features/editor/messages.ts:47`.

**Fallback:** insufficient or contradicted by the code → read [adr/0002](../adr/0002-tell-other-windows-of-a-switch-through-controllerchange-and-of-a-storage-change-through-versionchange.md) and gallery ADR-0006, and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. New readonly store state `storageSuperseded: Readonly<Ref<boolean>>` on the `editor` store, exported through `src/features/editor/index.ts`.

## Acceptance criteria

### AC-12 — cross-context

> **Given** the update notice is shown and the open Work has Unsaved edits that Autosave has not stored in the Gallery, for example because the Gallery is unavailable or the last save failed
> **When** the Editor chooses "Reload"
> **Then** the app asks for confirmation and says that the edits not stored in the Gallery will be lost and that exporting first keeps them. Cancelling keeps the Work, its Edit history and the update notice as they were. Confirming reloads, and the app reopens the Work's last Stored state when there is one, or opens no Work when there is none
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context (the storage-change sentence)

> **Then** … If the newer version changes how the Gallery is stored, a window still on the older version stops saving from that moment and says that it must reload to keep saving, instead of writing in the older shape; edits it makes after that count as not stored in the Gallery, so its "Reload" asks for confirmation as AC-12 says
>
> — `spec.md §5, AC-14, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Autosave gets an `onSuperseded()` dep (or returns a `superseded` ref); `onVersionChange` calls it instead of pushing `infoNewerVersion()` — `src/features/editor/autosave.ts`.
- [ ] A save whose codec job returns `APP_PART_UNAVAILABLE` runs the same stop (drop pending, close, unavailable) and raises superseded, with no could-not-save notice — `autosave.ts`.
- [ ] Expose `storageSuperseded` on the editor store — `src/features/editor/store.ts`, `index.ts`.
- [ ] Delete `infoNewerVersion()` and its test — `src/features/editor/messages.ts`, `messages.test.ts`.
- [ ] Tests — `autosave.test.ts`, `store.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| `versionchange` while a save runs | The save finishes first, then the stop (gallery ADR-0006, unchanged) |
| Edit after the stop | Not stored; `requestReload()` returns `confirm` (AC-12) |
| `APP_PART_UNAVAILABLE` on the second job of the same save | Same stop; no partial record written |
| `versionchange` and `APP_PART_UNAVAILABLE` both occur | Flag is raised once; the stop runs once (`closing` guard) |
| Any other save failure | Unchanged: the existing could-not-save notice |

## Definition of Done

- [ ] `autosave.test.ts` proves: versionchange → no notice, flag true, no further save reaches the DB; codec `APP_PART_UNAVAILABLE` → same.
- [ ] `store.test.ts` proves `requestReload()` returns `confirm` after the flag is raised and an edit is made.
- [ ] No reference to `infoNewerVersion` remains (`grep`).
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
