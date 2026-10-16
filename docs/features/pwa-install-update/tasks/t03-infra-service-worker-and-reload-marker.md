---
id: T3
title: "Add the infra/platform service-worker client (prompt mode) and the take-once reload marker"
layer: "infra"
deps: []
blocks: ["T8"]
acs: ["AC-05", "AC-08", "AC-15"]
files_hint: ["src/infra/platform/service-worker.ts", "src/infra/platform/service-worker.test.ts", "src/infra/platform/reload-marker.ts", "src/infra/platform/reload-marker.test.ts", "src/infra/platform/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 54 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Add the infra/platform service-worker client (prompt mode) and the take-once reload marker

## Place in the sequence

- **Blocked by:** — · **Blocks:** T8 — Add the pwa-install-update feature store's update lifecycle · **Wave:** 1, thin browser wrappers with no app dependencies.
- **Lane:** shares `src/infra/platform/index.ts` with T4 — serialized.

## Why (user story)

> **As an** Editor
> **I want** the update to wait for my open tool, my running save and my running Export, and to bring my Work back afterwards
> **So that** switching versions costs me no Draft, and no applied change unless I confirm it
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task wraps the service-worker lifecycle and the reopen marker so the feature store can drive both under Vitest.

## Inlined context

> - `src/infra/platform/service-worker.ts` wraps `registerSW` with `onNeedRefresh`, `onOfflineReady` and `onRegisteredSW`. It exposes the registration's `update()`, a `controllerchange` subscription and `activateWaiting()`, which calls `updateSW(true)`.
> - The feature store calls `update()` on the schedule from `src/core/app-update/` (spec §6). Offline or failed checks are ignored (AC-15).
> - `onOfflineReady` fires only when a worker installs with no earlier one, so AC-05 needs no stored flag.
>
> — `adr/0001, How it works, abridged` · full text: [adr/0001](../adr/0001-hold-each-new-version-in-a-waiting-service-worker-until-the-editor-chooses-reload.md)

> When the page loaded with no controller, it ignores the event, because a first install with `clientsClaim` fires it without any version switch (AC-05).
>
> — `adr/0002, How it works bullet 1, abridged` · full text: [adr/0002](../adr/0002-tell-other-windows-of-a-switch-through-controllerchange-and-of-a-storage-change-through-versionchange.md)

> - `src/infra/platform/reload-marker.ts` exposes `markReopen(id)` and `takeReopen()`. It uses one fixed key and stores the Work id as a plain string.
> - At start, after the Gallery connects, the feature store calls `takeReopen()`, which reads and deletes the marker in one step …
> - … No other code path reads the key. A storage failure (`sessionStorage` blocked) makes the reload open no Work, which is the safe default.
>
> — `adr/0003, How it works, abridged` · full text: [adr/0003](../adr/0003-keep-the-work-to-reopen-as-a-take-once-id-in-this-tabs-sessionstorage.md)

> Browser APIs are wrapped in `src/infra/platform/` … Each wrapper returns `Result` where it can fail and takes its browser objects by injection, so Vitest can drive it.
>
> — `sad.md §5 intro, abridged` · full text: [sad.md](../sad.md)

> **Hard rule (security):** the marker holds only the Work's identifier, lives only in that window and is gone once the Work reopens or the window closes, and no other start reopens a Work (gallery AC-05).
>
> — `spec.md §6.1, Security review, abridged` · full text: [spec.md](../spec.md)

> **Hard rule:** `infra` may call pure, side-effect-free `core` functions, never Vue, Pinia, a feature or the app shell; `src/infra/import-rules.test.ts` and ESLint enforce it.
>
> — `CLAUDE.md §Module boundaries, abridged`

**Fallback:** insufficient or contradicted by the code → read the two ADRs above and [sad.md](../sad.md) §5, and follow them. Do not guess.

## Data delta

No DB changes. One `sessionStorage` key (a fixed string, value = Work id), per ADR-0003; the Gallery schema is unchanged.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-05 — happy path

> **Given** the browser has never stored the app's files for offline use, which also means people who already had the app ready offline before this release never see this notice
> **When** it finishes storing what it needs to start and edit without a connection
> **Then** a short notice says that imgly is ready to work offline. It appears once: it does not come back after an App update, and it comes back only after the browser has cleared the app's stored files and stores them again
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — cross-context

> **Given** a Work was open when the Editor chose "Reload" and its Stored state is in the Gallery
> **When** the new version has started
> **Then** the app reopens that Work as the Gallery reopens it: the same Original, Geometry, Adjustments and Drawing layer, with an empty Edit history and the View fitted to the window. Only a reload chosen through the update notice in this window reopens a Work. Starting the app in any other way opens no Work, as before (gallery AC-05). When that Work can no longer be reopened, because it is a Damaged Work or another window's save evicted it, the app opens no Work and a notice says in plain words why it could not be reopened; a Damaged Work stays in the Gallery as before
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — error

> **Given** the app is open without a connection, or the check for a new version fails
> **When** the app would look for a new version
> **Then** no notice and no error appear, the app keeps working on its current version, and it looks again at the next check
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `createServiceWorkerClient({ registerSW, container })` with callbacks `onNeedRefresh`, `onOfflineReady`, `onControllerChange`; methods `check(): Promise<void>` (calls `registration.update()`, swallows rejection), `activateWaiting()` (`updateSW(true)`), `hadControllerAtLoad: boolean`, `waitingKey()` (an identity for the waiting worker, e.g. its `scriptURL` or the worker object, for the dismissal rule) — `src/infra/platform/service-worker.ts`.
- [ ] `markReopen(id, storage = sessionStorage)` and `takeReopen(storage = sessionStorage): string | null` — read and remove in one call; any thrown storage error → `null` / no-op — `src/infra/platform/reload-marker.ts`.
- [ ] Export both from `src/infra/platform/index.ts`.
- [ ] Unit tests with injected fakes — `service-worker.test.ts`, `reload-marker.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| `registration.update()` rejects (offline, 404, network) | Resolves silently; no `Result` error surfaces (AC-15) |
| No `serviceWorker` in `navigator` | Client is inert: callbacks never fire, `check()` resolves |
| `controllerchange` with no controller at page load | Reported with `hadControllerAtLoad === false`, so the store ignores it (ADR-0002) |
| `takeReopen()` twice | Second call returns `null` |
| `sessionStorage` throws (blocked) | `markReopen` does nothing, `takeReopen` returns `null` (ADR-0003 safe default) |
| A non-string value under the key | `takeReopen` removes it and returns `null` |

## Definition of Done

- [ ] `service-worker.test.ts` proves the callbacks fire, `check()` swallows a rejection, `activateWaiting` calls `updateSW(true)`, and `hadControllerAtLoad` is captured at creation.
- [ ] `reload-marker.test.ts` proves take-once, the blocked-storage default, and that only the id string is stored.
- [ ] `src/infra/import-rules.test.ts` stays green.
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
