---
id: T12
title: "Switch vite-plugin-pwa to prompt mode, connect the feature store in pwa.ts, mount InstallAction and ReloadDialog, resume after the update, add PWA e2e hooks and glossary terms"
layer: "wiring"
deps: ["T9", "T10", "T11"]
blocks: ["T13", "T14"]
acs: ["AC-01", "AC-06", "AC-08", "AC-09"]
files_hint: ["vite.config.ts", "src/app/pwa.ts", "src/main.ts", "src/app/App.vue", "src/app/App.test.ts", "src/app/test-hooks.ts", "src/app/test-hooks.test.ts", "e2e/test-hooks.d.ts", "CONTEXT.md"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 53 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Switch to prompt mode and wire the feature into the app shell

## Place in the sequence

- **Blocked by:** T9 — Reload action and reopen · T10 — InstallAction · T11 — ReloadDialog · **Blocks:** T13 — single-window update e2e · T14 — install, two-window and offline e2e · **Wave:** 6.
- **Lane:** own lane (the only task touching `vite.config.ts`, `src/app/`, `CONTEXT.md`).

## Why (user story)

> **As an** Editor
> **I want** to be told when a new version is available and pick the moment to switch to it
> **So that** an update never reloads the page under me
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task is the switch: after it, the built app stops reloading silently and the feature is live.

## Inlined context

> - `vite.config.ts`: `registerType: 'prompt'`. Workbox `skipWaiting` is removed and `clientsClaim` kept. Precache, `navigateFallback` and the `/imgly/` scope stay unchanged.
>
> — `adr/0001, How it works bullet 1, verbatim` · full text: [adr/0001](../adr/0001-hold-each-new-version-in-a-waiting-service-worker-until-the-editor-chooses-reload.md)

> - `src/features/pwa-install-update/` exports `InstallAction`, `ReloadDialog` and `usePwaInstallUpdate` from `index.ts`. `App.vue` mounts the components, and `src/app/pwa.ts` connects the service-worker client to the store.
>
> — `adr/0004, How it works bullet 3, verbatim` · full text: [adr/0004](../adr/0004-own-the-reload-gate-in-the-editor-store-and-the-install-and-update-ui-in-a-new-feature.md)

> `app/pwa.ts` registers the service worker in prompt mode and connects the feature store · `App.vue` mounts InstallAction and ReloadDialog; after connectGallery, calls resumeAfterUpdate() · `test-hooks.ts` + PWA hooks for e2e (synthetic install offer, update state, marker)
>
> — `sad.md §5, decomposition (app/), abridged` · full text: [sad.md](../sad.md)

> **Top bar** (`EditorTopBar`): `InstallAction` is mounted **last** in `EditorView`'s `top-bar-actions` slot, after `ExportAction`, so `App.vue` fills it as `…<DrawAction /><ExportAction /><InstallAction />`. … **Reload confirmation** (`ReloadDialog`, SCR-06) is mounted by `App.vue` at the root, beside `DeleteWorkDialog` …
>
> — `screens.md §Shell changes, abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** Vite `base`, the manifest `scope` and `start_url`, and the SW scope are all `/imgly/`. `src/app/` imports `features` through `index.ts` only.
>
> — `CLAUDE.md §Conventions + §Module boundaries, abridged`

> Reload checks / Reload gate … *Not yet in CONTEXT, so a `glossary` follow-up is due* · Update notice … *Not yet in CONTEXT, so a `glossary` follow-up is due* · Reopen marker — The take-once id of the Work to reopen after an update reload, kept in this tab's `sessionStorage` (ADR-0003)
>
> — `sad.md §12, Glossary rows 4–7, abridged` · full text: [sad.md](../sad.md)

**Code today:** `src/app/pwa.ts` calls `registerSW({ immediate: true })` with no callbacks; `src/main.ts:20` registers only when `import.meta.env.PROD`; `App.vue`'s `connectGallery()` opens the DB, then `editor.connectGallery` and `gallery.refresh()`.

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §5, §7 and the ADRs above, and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. `window.__imgly` test hooks (e2e build only) gain PWA hooks: a synthetic install offer (fire `beforeinstallprompt` with a scripted `userChoice`), the feature's `updateNotice` state, and peek at the reopen marker. Mirror them in `e2e/test-hooks.d.ts`.

## Acceptance criteria

### AC-01 — happy path

> **Given** the app is open in a browser tab, it is not installed, and the browser offers to install it
> **When** the Portfolio reviewer chooses "Install app" in the top bar
> **Then** the browser's own install confirmation appears. Once it is accepted, the app opens in its own window as the Installed app, and the "Install app" action is gone from both the tab and the new window
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — happy path

> **Given** the app is open, in a tab or as the Installed app, and a newer version has been published
> **When** the browser has finished downloading the App update
> **Then** a notice says that a new version of imgly is available and offers "Reload". The notice does not disappear by itself, the app keeps running its current version, and editing, Autosave and Export work as before
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-08 — cross-context (start-up part)

> **Then** … Only a reload chosen through the update notice in this window reopens a Work. Starting the app in any other way opens no Work, as before (gallery AC-05). …
>
> — `spec.md §5, AC-08, abridged` · full text: [spec.md](../spec.md)

### AC-09 — happy path (takeover part)

> **Then** … Without "Reload", the new version takes over the next time the app starts after every window of it has closed
>
> — `spec.md §5, AC-09, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `vite.config.ts`: `registerType: 'prompt'`; remove `workbox.skipWaiting`; keep `clientsClaim`, precache, `navigateFallback`, `/imgly/`.
- [ ] `src/app/pwa.ts`: build the service-worker client (T3) and install-prompt client (T4), then `usePwaInstallUpdate().connect(...)` / `connectInstall(...)`. Keep the `PROD` guard for the SW; connect the install client in every build.
- [ ] `App.vue`: add `<InstallAction />` after `<ExportAction />`; mount `<ReloadDialog />` beside `<DeleteWorkDialog standby />`; `await` `resumeAfterUpdate()` after `gallery.refresh()` in `connectGallery()`.
- [ ] `test-hooks.ts` + `e2e/test-hooks.d.ts`: the PWA hooks above.
- [ ] `CONTEXT.md` `## Glossary`: add "Reload gate", "Update notice", "Reopen marker" (one line each, with a NOT-reference), from `sad.md §12`.
- [ ] Tests — `App.test.ts` (InstallAction order, ReloadDialog mounted, `resumeAfterUpdate` after `connectGallery`), `test-hooks.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| Dev server (`pnpm dev`, not PROD) | No SW registration; install client still connects; no errors |
| Gallery fails to open | `resumeAfterUpdate()` still runs; a marked Work gets the "can't be read" notice (T9) |
| Unsupported display (no WebGL2) | Top-bar slot not rendered, so no "Install app" (screens §Shell changes) |
| A window still on the old `autoUpdate` build | Gets no notice; the new worker waits until all such windows close (`sad.md §7`, transition release) |

## Definition of Done

- [ ] `App.test.ts` and `test-hooks.test.ts` pass with the new cases.
- [ ] `pnpm build` succeeds and the built `sw.js` contains no `skipWaiting()` call on install (grep `dist/sw.js`).
- [ ] `CONTEXT.md` has the three new terms.
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
