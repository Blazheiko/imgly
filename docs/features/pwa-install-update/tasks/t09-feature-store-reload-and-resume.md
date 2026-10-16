---
id: T9
title: "Add the feature store's Reload action (refusals, busy wait, confirm, mark, activate or reload) and resumeAfterUpdate() that takes the marker and reopens the Work"
layer: "app"
deps: ["T6", "T8"]
blocks: ["T11", "T12"]
acs: ["AC-07", "AC-08", "AC-10", "AC-11", "AC-12", "AC-13"]
files_hint: ["src/features/pwa-install-update/store.ts", "src/features/pwa-install-update/store.test.ts", "src/features/pwa-install-update/messages.ts", "src/features/pwa-install-update/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 71 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Add the feature store's Reload action and resumeAfterUpdate()

## Place in the sequence

- **Blocked by:** T6 — Reload gate `editor.requestReload()` · T8 — feature store update lifecycle · **Blocks:** T11 — ReloadDialog · T12 — wiring · **Wave:** 4, alongside T10.
- **Lane:** shares `src/features/pwa-install-update/store.ts`, `store.test.ts`, `messages.ts`, `index.ts` with T8, T10, T11 — serialized.

## Why (user story)

> **As an** Editor
> **I want** the update to wait for my open tool, my running save and my running Export, and to bring my Work back afterwards
> **So that** switching versions costs me no Draft, and no applied change unless I confirm it
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task maps the Reload gate's outcome to its effects and brings the Work back after the reload.

## Inlined context

> The feature store maps the outcome to its effects. `tool-open` and `exporting` raise their refusal notice and keep the update notice (AC-10, AC-13). `confirm` opens `ReloadDialog`, where Cancel changes nothing (AC-12). On `ready` or a confirmation, it calls `markReopen(reopenId)` when the id is not `null`, then activates the waiting worker or reloads the page (ADR-0001, ADR-0003).
>
> — `adr/0004, How it works bullet 2, verbatim` · full text: [adr/0004](../adr/0004-own-the-reload-gate-in-the-editor-store-and-the-install-and-update-ui-in-a-new-feature.md)

> **"Reload" acts according to the wording.** When a worker is waiting, "Reload" sends it `SKIP_WAITING` and reloads on `controllerchange`. When the version has already switched under this window (`updated-elsewhere`, `reload-to-save`), it reloads the page. Both go through the same `requestReload()` and write the marker first.
>
> — `sad.md §5, tactical decision 3, verbatim` · full text: [sad.md](../sad.md)

> At start, after the Gallery connects, the feature store calls `takeReopen()`, which reads and deletes the marker in one step, then `editor.reopenWork(id)`. A failed reopen, for a Damaged or evicted Work, shows a notice saying why and opens no Work (AC-08).
>
> — `adr/0003, How it works bullet 3, verbatim` · full text: [adr/0003](../adr/0003-keep-the-work-to-reopen-as-a-take-once-id-in-this-tabs-sessionstorage.md)

> | waiting for a save | "Reload" chosen while Autosave stores the Work … The action reads "Reloading…" with a `Spinner` and is `aria-disabled`. The Editor keeps working. When the save ends, the checks run again …
> | refused | A tool is open or an Export runs … The notice stays as it was, "Reload" is enabled again, and a refusal notice is pushed (→ SCR-07)
> | repeated | The same refusal again … The earlier notice of the same text is dismissed first, so they don't pile up
>
> — `screens.md §SCR-05 + §SCR-07, rows abridged` · full text: [screens.md](../screens.md)

> | failure | Reload with a tool open | AC-10 | Apply or cancel the open tool first. |
> | failure | Reload during an Export | AC-13 | Wait for the export to finish, then reload. |
> | failure | reopen after the update: evicted | AC-08 | The image you had open couldn't be reopened: it was removed from the Gallery to make room. |
> | failure | reopen after the update: can't be read or Gallery unavailable | AC-08 | The image you had open couldn't be reopened. Open it from the Gallery if it's there. |
> | failure + action | reopen after the update: `WORK_DAMAGED` | AC-08 | (gallery, unchanged) “{name}” can't be opened: its stored data is damaged. Action: **Delete…** |
>
> — `screens.md §Message catalog, verbatim` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §6 flow 1 and the ADRs above, and follow them. Do not guess.

## Data delta

No DB changes. Writes the reopen marker (`markReopen`) and takes it (`takeReopen`) — ADR-0003.

## API contract

Internal — no API surface. Store gains `reload()`, `confirmReload()`, `cancelReload()`, readonly `confirming: { reopenId: string | null } | null`, and `resumeAfterUpdate(): Promise<void>`.

## Acceptance criteria

### AC-07 — happy path

> **Given** the update notice is shown, no tool is open, no Export is running and the open Work, if any, has no Unsaved edits that are missing from the Gallery
> **When** the Editor chooses "Reload"
> **Then** the app switches to the new version and reloads within this window
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — cross-context

> **Given** a Work was open when the Editor chose "Reload" and its Stored state is in the Gallery
> **When** the new version has started
> **Then** the app reopens that Work as the Gallery reopens it: the same Original, Geometry, Adjustments and Drawing layer, with an empty Edit history and the View fitted to the window. Only a reload chosen through the update notice in this window reopens a Work. Starting the app in any other way opens no Work, as before (gallery AC-05). When that Work can no longer be reopened, because it is a Damaged Work or another window's save evicted it, the app opens no Work and a notice says in plain words why it could not be reopened; a Damaged Work stays in the Gallery as before
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — domain invariant

> **Given** the update notice is shown and a tool is open with its Draft
> **When** the Editor chooses "Reload"
> **Then** the app does not reload and says "Apply or cancel the open tool first." The update notice stays, so the Editor can choose "Reload" again after closing the tool
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — cross-context

> **Given** the update notice is shown and Autosave is storing the open Work
> **When** the Editor chooses "Reload"
> **Then** the app waits for that save to finish, and the Editor can keep working meanwhile. Once the save has finished, the app checks every condition again: it follows AC-10 if a tool is now open, AC-13 if an Export is now running, AC-12 if edits are not stored in the Gallery, and AC-07 otherwise
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — cross-context

> **Given** the update notice is shown and the open Work has Unsaved edits that Autosave has not stored in the Gallery, for example because the Gallery is unavailable or the last save failed
> **When** the Editor chooses "Reload"
> **Then** the app asks for confirmation and says that the edits not stored in the Gallery will be lost and that exporting first keeps them. Cancelling keeps the Work, its Edit history and the update notice as they were. Confirming reloads, and the app reopens the Work's last Stored state when there is one, or opens no Work when there is none
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — domain invariant

> **Given** the update notice is shown and an Export is running, which for this rule lasts from the Editor choosing to export, including the system's save window, until the file is saved or the export is cancelled; an export dialog that is open without a started export does not count
> **When** the Editor chooses "Reload"
> **Then** the app does not reload and says to wait for the export to finish. The update notice stays, because an App update never interrupts an Export
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `reload()`: set the notice action `busy` ("Reloading…"), `await editor.requestReload()`; `ignored` → un-busy; `tool-open` / `exporting` → un-busy, dismiss an earlier identical refusal, push the `failure`, return `'keep-open'`; `confirm` → set `confirming`; `ready` → `leave(reopenId)` — `store.ts`.
- [ ] `confirmReload()` → `leave(confirming.reopenId)`; `cancelReload()` → clear `confirming`, un-busy, nothing else changes.
- [ ] `leave(id)`: `markReopen(id)` when `id !== null`; if `updateNotice === 'available'` → `switchRequested = true`, `client.activateWaiting()` and reload on this window's `controllerchange`; otherwise `location.reload()` (inject `reloadPage`).
- [ ] `resumeAfterUpdate()`: `const id = takeReopen()`; `null` → nothing; else `editor.reopenWork(id)` and map a failed outcome to the catalog notice (evicted / can't be read).
- [ ] Add the refusal and reopen-failure copy — `messages.ts`; export the new API — `index.ts`; tests — `store.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| "Reload" pressed while busy | Ignored (action is `aria-disabled`) |
| "Reload" twice with a tool open | One refusal notice, not two (SCR-07 `repeated`) |
| `confirm` with `reopenId: null`, confirmed | No marker; reload opens no Work (AC-12) |
| Marker present but `reopenWork` refuses (`unavailable`, no Gallery) | "can't be read" notice; no Work (AC-08) |
| Record missing (evicted) | "removed from the Gallery to make room" notice |
| `WORK_DAMAGED` | The gallery's existing damaged notice with "Delete…" must appear. **Check first** how `src/features/gallery/store.ts:187` raises it: this feature may not import `gallery`. If no editor-store path raises it, stop and raise it with the owner — do not copy the gallery's notice here |
| No marker at start | No reopen, as gallery AC-05 |

## Definition of Done

- [ ] `store.test.ts` covers AC-07, AC-10, AC-11 (busy then re-check), AC-12 (cancel and confirm, with and without id), AC-13, and every edge-case row, with fake editor store, client, marker and `reloadPage`.
- [ ] No reload or `activateWaiting` call happens on any refused or cancelled path (asserted).
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
