---
id: T8
title: "Add the pwa-install-update feature store's update lifecycle: one slotted update notice in three wordings, dismissal per waiting worker, check timer, offline-ready notice"
layer: "app"
deps: ["T1", "T2", "T3", "T7"]
blocks: ["T9", "T10"]
acs: ["AC-05", "AC-06", "AC-09", "AC-14", "AC-15"]
files_hint: ["src/features/pwa-install-update/store.ts", "src/features/pwa-install-update/store.test.ts", "src/features/pwa-install-update/messages.ts", "src/features/pwa-install-update/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 62 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Add the pwa-install-update feature store's update lifecycle

## Place in the sequence

- **Blocked by:** T1 — update-check schedule · T2 — lasting, slotted notices · T3 — service-worker client and reload marker · T7 — `storageSuperseded` · **Blocks:** T9 — Reload action and reopen · T10 — InstallAction and install-offer state · **Wave:** 3.
- **Lane:** creates `src/features/pwa-install-update/{store,messages,index}.ts`, shared with T9, T10 and T11 — serialized; this task goes first.

## Why (user story)

> **As an** Editor
> **I want** to be told when a new version is available and pick the moment to switch to it
> **So that** an update never reloads the page under me
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task decides which update notice a window shows and when it looks for a new version. "Reload" itself is T9.

## Inlined context

> **One update notice, three wordings.** The feature store keeps one `updateNotice` state, either `none`, `available`, `updated-elsewhere` or `reload-to-save`, and renders it into the `app-update` slot. `reload-to-save` wins over `updated-elsewhere`, which wins over `available`, because a later signal never has less to say. A dismissal hides the notice until the page loads again. For `available`, the dismissal is remembered for that waiting worker only, so a still newer version shows the notice again (AC-09). `updated-elsewhere` and `reload-to-save` are shown even after the notice was dismissed (AC-14).
>
> — `sad.md §5, tactical decision 2, verbatim` · full text: [sad.md](../sad.md)

> The feature store subscribes to `controllerchange` through `src/infra/platform/service-worker.ts`. When this window asked for the switch, it reloads. When the page loaded with no controller, it ignores the event, because a first install with `clientsClaim` fires it without any version switch (AC-05). Otherwise it sets the update notice to `updated-elsewhere`, even if the Editor had dismissed the `available` notice.
>
> — `adr/0002, How it works bullet 1, verbatim` · full text: [adr/0002](../adr/0002-tell-other-windows-of-a-switch-through-controllerchange-and-of-a-storage-change-through-versionchange.md)

> loop on start, at most once every 60 minutes while visible, and on becoming visible after 60 minutes … alt offline, or the check fails → drop it silently, no notice and no error, keep the current version … retried only at the next scheduled check, never in a burst … check the key - skip if this waiting version was dismissed in this page.
>
> — `sad.md §6, Critical flow 6, abridged` · full text: [sad.md](../sad.md)

> | info | first offline-ready | AC-05 | imgly is ready to work offline. |
> | lasting + action | update `available` | AC-06 | A new version of imgly is available. Action: **Reload** |
> | lasting + action | update `updated-elsewhere` | AC-14 | imgly was updated in another window. Reload to use the new version. Action: **Reload** |
> | lasting + action | update `reload-to-save` (replaces `infoNewerVersion()`) | AC-14 | imgly was updated in another window. Reload this window to keep saving to the Gallery. Action: **Reload** |
>
> — `screens.md §Message catalog, rows 3–6, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** Features never import each other. They coordinate through the `editor` store … there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, verbatim`

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §5, §6 flows 2, 5, 6 and [screens.md](../screens.md) SCR-04, SCR-05, and follow them. Do not guess.

## Data delta

No DB changes. The dismissal lives in memory for this page only (`sad.md §6`, flow 6).

## API contract

Internal — no API surface. `usePwaInstallUpdate()` (Pinia setup store) gains `connect(client: ServiceWorkerClient)`, readonly `updateNotice`, and an internal `onReload` hook that T9 fills.

## Acceptance criteria

### AC-05 — happy path

> **Given** the browser has never stored the app's files for offline use, which also means people who already had the app ready offline before this release never see this notice
> **When** it finishes storing what it needs to start and edit without a connection
> **Then** a short notice says that imgly is ready to work offline. It appears once: it does not come back after an App update, and it comes back only after the browser has cleared the app's stored files and stores them again
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — happy path

> **Given** the app is open, in a tab or as the Installed app, and a newer version has been published
> **When** the browser has finished downloading the App update
> **Then** a notice says that a new version of imgly is available and offers "Reload". The notice does not disappear by itself, the app keeps running its current version, and editing, Autosave and Export work as before
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — happy path

> **Given** the update notice is shown
> **When** the Editor dismisses it, or leaves it and keeps working
> **Then** this window keeps running its current version and the notice stays away until this window's page loads again. A browser reload of this window, or a newly opened window, shows the notice again while the App update still waits, and a still newer version shows it again at once. Without "Reload", the new version takes over the next time the app starts after every window of it has closed
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context (notice part)

> **Given** the app is open in two or more windows and one of them switches to a new version
> **When** that switch happens
> **Then** every other window shows a notice that imgly was updated in another window and offers "Reload", even where the Editor had dismissed the update notice for that version. A window shows at most one update notice at a time, and the newest replaces the one before. … If the newer version changes how the Gallery is stored, a window still on the older version stops saving from that moment and says that it must reload to keep saving …
>
> — `spec.md §5, AC-14, abridged` · full text: [spec.md](../spec.md)

### AC-15 — error

> **Given** the app is open without a connection, or the check for a new version fails
> **When** the app would look for a new version
> **Then** no notice and no error appear, the app keeps working on its current version, and it looks again at the next check
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Scaffold the feature: `store.ts` (`usePwaInstallUpdate`), `messages.ts` (catalog rows above), `index.ts` — `src/features/pwa-install-update/`.
- [ ] `connect(client)`: wire `onNeedRefresh` → `available` unless that waiting worker's key was dismissed; `onOfflineReady` → push the `info` notice once; `onControllerChange` → ignore if `!hadControllerAtLoad` or this window asked (T9 sets `switchRequested`), else `updated-elsewhere`.
- [ ] `watch(editor.storageSuperseded)` → `reload-to-save`. Precedence: `reload-to-save` > `updated-elsewhere` > `available`; never downgrade.
- [ ] Render `updateNotice` via `useNotices().pushAll([{ kind: 'lasting', slot: 'app-update', text, action: { label: 'Reload', run } }])`; Dismiss records the dismissal (for `available`: the waiting key).
- [ ] Check timer: on `connect`, on a timer from `nextCheckDue`'s delay, and on `visibilitychange`; record `lastCheck` before each `client.check()`; failures stay silent (inject `now()`, `document`, timers for tests).
- [ ] `store.test.ts` with a fake client, fake timers and a fake editor store state.

## Edge cases

| Case | Behaviour |
|---|---|
| Dismissed `available`, same waiting worker reported again (e.g. another check) | Stays hidden (AC-09) |
| Dismissed `available`, a *different* waiting worker | Shown again at once (AC-09) |
| Dismissed, then `controllerchange` from another window | `updated-elsewhere` shown (AC-14) |
| `updated-elsewhere`, then a new `onNeedRefresh` | Stays `updated-elsewhere` (no downgrade) |
| First install: `controllerchange` with no controller at load | Ignored; only the offline-ready notice (AC-05) |
| Offline or failed `check()` | No notice, no error; next check ≥ 60 min later (AC-15) |
| Hidden window | No check until visible and 60 min passed (spec §6) |

## Definition of Done

- [ ] `store.test.ts` covers every edge-case row plus AC-05 (one info notice) and AC-06 (lasting notice in slot `app-update`).
- [ ] The feature imports only `core`, `infra`, `shared` and `@/features/editor` via its `index.ts` (ESLint boundary rule green).
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
