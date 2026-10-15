---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-15"
feature_size: "S"
ticket: "roadmap step 9 — pwa-install-update"
---

# 0001 — Hold each new version in a waiting service worker until the Editor chooses Reload

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth)

## Context

Today `vite.config.ts` builds the service worker with vite-plugin-pwa in `autoUpdate` mode, with Workbox `skipWaiting: true` and `clientsClaim: true`, and `src/app/pwa.ts` calls `registerSW({ immediate: true })`. A new build therefore takes over the moment it has downloaded, and the page reloads without a word, even mid-edit. The spec requires that a version switch only when the Editor chooses "Reload", or at the next start after every window has closed (AC-06, AC-07, AC-09). A service worker is the hardest part of a PWA to fix in the field, because it serves the code that would fix it.

## Decision drivers

- spec §6: 0 reloads the Editor did not choose, and 0 Drafts or applied changes lost, across the update e2e flows
- spec AC-06: while an update waits, editing, Autosave and Export work as before
- spec AC-09: an ignored notice leaves the current version running, and the new one takes over at the next start after every window has closed
- spec AC-05: the offline-ready notice appears once, never after an App update
- sad.md §2: the app already uses vite-plugin-pwa 2 (`generateSW`, Workbox 7) and workbox-window 7.4

## Considered options

1. **Waiting worker, prompt mode.** `registerType: 'prompt'`, no `skipWaiting`. `onNeedRefresh` raises the notice, and "Reload" sends `SKIP_WAITING` and reloads on `controllerchange`.
2. **Own service worker (`injectManifest`).** Hand-written install, activate and fetch handlers around Workbox's precache manifest, for example to keep older hashed chunks for older windows.
3. **Keep `autoUpdate`, drop only the reload.** The new worker still takes over at once, and the page shows a notice instead of reloading.

## Decision outcome

**Chosen:** Option 1. It is the plugin's and Workbox's standard path, and the browser's own rule ("a waiting worker takes over once no window uses the active one") is exactly AC-09. Option 2 adds service-worker code that would have to be tested on three engines, and no spec requirement needs it. Option 3 makes the new worker control the old page at once, and that worker has already cleaned up the old build's files, so the old page breaks at its next worker load even though the Editor chose nothing. That contradicts AC-06.

How it works:

- `vite.config.ts`: `registerType: 'prompt'`. Workbox `skipWaiting` is removed and `clientsClaim` kept. Precache, `navigateFallback` and the `/imgly/` scope stay unchanged.
- `src/infra/platform/service-worker.ts` wraps `registerSW` with `onNeedRefresh`, `onOfflineReady` and `onRegisteredSW`. It exposes the registration's `update()`, a `controllerchange` subscription and `activateWaiting()`, which calls `updateSW(true)`.
- The feature store calls `update()` on the schedule from `src/core/app-update/` (spec §6). Offline or failed checks are ignored (AC-15).
- `onOfflineReady` fires only when a worker installs with no earlier one, so AC-05 needs no stored flag.

## Consequences

**Positive**
- No reload happens without "Reload", and the old page keeps its own precached build until it is gone.
- The behaviour is the plugin's documented contract, with no custom service-worker code.

**Negative**
- The first release with this change reaches windows that still run the `autoUpdate` build. Those windows get no notice, and the new version takes over once they all close (§11).
- When one window activates the new version, the other windows are controlled by it while still running old code, so an older window can miss a hashed file. ADR-0002 and AC-14 handle this.

**Neutral**
- Switching to `injectManifest` later is possible without changing the feature's store API, because the wrapper in `infra/platform` hides the mode.

## Links

- Spec: [[../spec.md]] AC-05, AC-06, AC-07, AC-09, AC-15, §6
- SAD: [[../sad.md]] §4, §5, §7
- Related ADR: [[0002-tell-other-windows-of-a-switch-through-controllerchange-and-of-a-storage-change-through-versionchange]], [[0004-own-the-reload-gate-in-the-editor-store-and-the-install-and-update-ui-in-a-new-feature]]
