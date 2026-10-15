---
id: T11
title: "Add ReloadDialog (SCR-06): Dialog + Cancel / Reload, two bodies for a Stored state or none"
layer: "ui"
deps: ["T9"]
blocks: ["T12"]
acs: ["AC-12"]
files_hint: ["src/features/pwa-install-update/ReloadDialog.vue", "src/features/pwa-install-update/ReloadDialog.test.ts", "src/features/pwa-install-update/messages.ts", "src/features/pwa-install-update/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 33 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Add ReloadDialog (SCR-06)

## Place in the sequence

- **Blocked by:** T9 — feature store Reload action · **Blocks:** T12 — wiring · **Wave:** 5.
- **Lane:** shares `src/features/pwa-install-update/messages.ts`, `index.ts` with T8–T10 — serialized.

## Why (user story)

> **As an** Editor
> **I want** the update to wait for my open tool, my running save and my running Export, and to bring my Work back afterwards
> **So that** switching versions costs me no Draft, and no applied change unless I confirm it
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task builds the one question the Editor is asked before unstored edits are lost.

## Inlined context

> `ReloadDialog`, composed from `Dialog` and two `BaseButton`s, like `ReplaceDialog`. … rendered while the editor store's Reload gate is in its `confirm` state. It is modal through `Dialog` …
> | default (a Stored state exists) | … `Dialog` · `BaseButton` secondary "Cancel" · `BaseButton` primary "Reload" |
> | default (no Stored state) | The same, but the Work was never stored … The body says the image won't come back |
> | cancelled | "Cancel", `Esc` or a backdrop click … The Work, its Edit history and the update notice stay as they were. Focus returns to "Reload" |
> | confirmed | "Reload" … The marker is written only when a Stored state exists, then the page reloads |
>
> When SCR-06 opens, focus moves to "Cancel".
>
> — `screens.md §SCR-06 + §Shell changes + §Keyboard, abridged` · full text: [screens.md](../screens.md)

> | dialog | SCR-06, a Stored state exists | AC-12 | Title "Reload and lose your latest edits?" · body "Your latest edits aren't saved in the Gallery and will be lost. The last saved version will reopen. Export the image first to keep them." · Cancel · Reload |
> | dialog | SCR-06, never stored | AC-12 | Title "Reload and lose this image?" · body "This image isn't saved in the Gallery, so it won't come back after the reload. Export it first to keep it." · Cancel · Reload |
>
> — `screens.md §Message catalog, dialog rows, verbatim` · full text: [screens.md](../screens.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-06 and the existing `ReplaceDialog` in `src/features/editor/components/`, and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. Reads the store's `confirming`; calls `confirmReload()` / `cancelReload()` (T9). `index.ts` exports `ReloadDialog`.

## Acceptance criteria

### AC-12 — cross-context

> **Given** the update notice is shown and the open Work has Unsaved edits that Autosave has not stored in the Gallery, for example because the Gallery is unavailable or the last save failed
> **When** the Editor chooses "Reload"
> **Then** the app asks for confirmation and says that the edits not stored in the Gallery will be lost and that exporting first keeps them. Cancelling keeps the Work, its Edit history and the update notice as they were. Confirming reloads, and the app reopens the Work's last Stored state when there is one, or opens no Work when there is none
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `ReloadDialog.vue`: `Dialog` open while `confirming !== null`; body chosen by `confirming.reopenId !== null`; `BaseButton` secondary "Cancel" (initial focus) → `cancelReload()`; primary "Reload" → `confirmReload()`; `Esc` / backdrop → `cancelReload()`.
- [ ] Copy in `messages.ts`; export from `index.ts`.
- [ ] Component tests on happy-dom — `ReloadDialog.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| `Esc` or backdrop | Same as Cancel; focus returns to the update notice's "Reload" |
| `reopenId === null` | "Reload and lose this image?" body |
| Double click on "Reload" | `confirmReload()` called once |

## Definition of Done

- [ ] `ReloadDialog.test.ts` covers both bodies, Cancel / Esc / backdrop → `cancelReload`, Reload → `confirmReload`, initial focus on Cancel.
- [ ] Only `Dialog`, `BaseButton` and tokens used.
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
