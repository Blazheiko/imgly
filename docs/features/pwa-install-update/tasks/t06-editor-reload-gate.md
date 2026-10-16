---
id: T6
title: "Add the Reload gate editor.requestReload(): wait on settled(), then tool-open | exporting | confirm | ready with reopenId"
layer: "app"
deps: []
blocks: ["T7", "T9"]
acs: ["AC-07", "AC-10", "AC-11", "AC-12", "AC-13"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/editor/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 54 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Add the Reload gate editor.requestReload(): wait on settled(), then tool-open | exporting | confirm | ready with reopenId

## Place in the sequence

- **Blocked by:** — · **Blocks:** T7 — Make Autosave raise storageSuperseded · T9 — Add the feature store's Reload action and the reopen after the update · **Wave:** 1.
- **Lane:** shares `src/features/editor/store.ts` and `store.test.ts` with T7 — serialized.

## Why (user story)

> **As an** Editor
> **I want** the update to wait for my open tool, my running save and my running Export, and to bring my Work back afterwards
> **So that** switching versions costs me no Draft, and no applied change unless I confirm it
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task puts the "may this window leave its Work now?" rule next to the Replace gate, in one tested place.

## Inlined context

> - `editor.requestReload()` does nothing while `phase` is `reading` or `confirming`. Otherwise it awaits `settled()`, then returns `tool-open` when `activeTool` is set, `exporting` while `phase === 'exporting'`, and `confirm` when the open Work has Unsaved edits that are not stored. In every other case it returns `ready`. `confirm` and `ready` carry `reopenId`, the Work's id when it has a Stored state, else `null`.
>
> — `adr/0004, How it works bullet 1, verbatim` · full text: [adr/0004](../adr/0004-own-the-reload-gate-in-the-editor-store-and-the-install-and-update-ui-in-a-new-feature.md)

> The `editor` store already holds every condition the Reload checks need: `activeTool` tells whether a tool is open. `phase === 'exporting'` lasts from `beginExport()` to the end of the save dialog. Autosave's `saving` flag, `settled()` and `isStored(work)` cover the save. The Replace gate in `openImage` and `reopenWork(id)` waits on `settled()` and asks only when edits are not stored (gallery ADR-0001).
>
> — `sad.md §2, Technical constraints, abridged` · full text: [sad.md](../sad.md)

> Cross-feature rule: the reload after an update follows the same confirmation rule as the Replace gate. It waits for a running save, and it asks for confirmation only when the open Work has Unsaved edits that Autosave has not stored (AC-11, AC-12; gallery AC-16, AC-17, AC-20).
>
> — `spec.md §1, traceability bullet 2, verbatim` · full text: [spec.md](../spec.md)

**Code today:** `needsConfirmation()` (`src/features/editor/store.ts:435`) is the Replace gate's "unstored edits" check — reuse it, do not copy it. "Has a Stored state" for `reopenId` must come from Autosave (a Work that was stored at least once), not from `isStored(work)` (which means "current revision stored").

**Fallback:** insufficient or contradicted by the code → read [adr/0004](../adr/0004-own-the-reload-gate-in-the-editor-store-and-the-install-and-update-ui-in-a-new-feature.md) and [sad.md](../sad.md) §6 flow 1, and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. New public store function: `requestReload(): Promise<ReloadOutcome>`, `ReloadOutcome = { kind: 'ignored' } | { kind: 'tool-open' } | { kind: 'exporting' } | { kind: 'confirm'; reopenId: string | null } | { kind: 'ready'; reopenId: string | null }`, exported from `src/features/editor/index.ts`.

## Acceptance criteria

### AC-07 — happy path

> **Given** the update notice is shown, no tool is open, no Export is running and the open Work, if any, has no Unsaved edits that are missing from the Gallery
> **When** the Editor chooses "Reload"
> **Then** the app switches to the new version and reloads within this window
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

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

- [ ] Add `ReloadOutcome` and `requestReload()` — `src/features/editor/store.ts`. Order after `await autosave.settled()`: `tool-open` → `exporting` → `confirm` (via `needsConfirmation()`) → `ready`. Evaluate all conditions **after** the await (AC-11).
- [ ] Compute `reopenId`: the open Work's id when Autosave has a Stored state for it, else `null`; `null` when no Work is open.
- [ ] `requestReload()` changes no state (no phase change, no notice) — the feature store owns the effects.
- [ ] Export `ReloadOutcome` from `src/features/editor/index.ts`.
- [ ] Tests — `src/features/editor/store.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| `phase` is `reading` or `confirming` | `{ kind: 'ignored' }` at once (ADR-0004) |
| A save running, then a tool opens during the wait | `tool-open` (AC-11) |
| A save running, then an Export starts during the wait | `exporting` (AC-11) |
| Export dialog open but no export started | Not `exporting` — `phase` is not `'exporting'` until `beginExport()` (AC-13) |
| No Work open | `ready` with `reopenId: null` |
| Unstored edits, never stored (Gallery unavailable) | `confirm` with `reopenId: null` (AC-12) |
| Unstored edits after an earlier successful save | `confirm` with the Work's id (AC-12) |

## Definition of Done

- [ ] `store.test.ts` covers every row above and the AC-07 `ready` case with a stored Work (`reopenId` = its id).
- [ ] Existing Replace-gate tests unchanged and green.
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
