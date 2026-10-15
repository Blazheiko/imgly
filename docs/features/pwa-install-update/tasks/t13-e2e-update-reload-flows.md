---
id: T13
title: "Add the two-build e2e harness and the single-window update flows: notice, ignore, tool open, Export running, save running, confirm, reopen, failed check, @perf reload"
layer: "tests"
deps: ["T12"]
blocks: []
acs: ["AC-06", "AC-07", "AC-08", "AC-09", "AC-10", "AC-11", "AC-12", "AC-13", "AC-15"]
files_hint: ["e2e/pwa-install-update/", "e2e/pwa-install-update/two-builds.ts", "playwright.config.ts"]
owner: "Blazheiko"
estimate: "L"
context_budget: "M"   # measured: 81 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Two-build e2e harness and single-window update flows

## Place in the sequence

- **Blocked by:** T12 — wiring · **Blocks:** — · **Wave:** 7, alongside T14.
- **Lane:** shares `e2e/pwa-install-update/two-builds.ts` and `playwright.config.ts` with T14 — serialized; this task builds the harness first.

## Why (user story)

> **As an** Editor
> **I want** the update to wait for my open tool, my running save and my running Export, and to bring my Work back afterwards
> **So that** switching versions costs me no Draft, and no applied change unless I confirm it
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

This task proves, against a real service-worker update, that no reload happens without "Reload" and nothing is lost.

## Inlined context

> **How verify:** e2e on Chromium, Firefox and WebKit. The harness serves a second build, triggers a check and drives each flow, then asserts that no navigation happened before "Reload". It compares the reopened Work's Export with the Export made before the update. Where Firefox or WebKit cannot run the two-build flow, it is measured there and gated on Chromium (spec §8 Q1).
>
> — `sad.md §10, QG-1, verbatim` · full text: [sad.md](../sad.md)

> | From choosing "Reload" to the reopened reference Work's first Preview in the new version | p95 ≤ 3 s | e2e performance test on the reference machine |
> | Reloads the Editor did not choose | 0 across the update e2e flows (notice ignored, tool open, Export running, save running) | e2e on Chromium, Firefox and WebKit |
> | Drafts and applied changes lost to an update without the Editor's confirmation | 0 across the same flows | e2e comparing the reopened Work's Export with the Export made before the update |
> | Editing stays responsive while the update downloads | longest interface freeze ≤ 200 ms (the open-and-view target) | long-task trace during a background download |
>
> — `spec.md §6, NFR rows 2–5, verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts`, only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads). `@perf` tests run only with `PERF=1`. Import `test` from `e2e/harness.ts`, never from `@playwright/test`.
>
> — `CLAUDE.md §Conventions + e2e/harness.ts header, abridged`

**Code today:** `playwright.config.ts` `webServer` builds once (`VITE_E2E_HOOKS=true … --outDir dist-e2e`) and serves it with `vite preview` on port 4173 under `/imgly/`. The harness needs a second, distinguishable build served at the **same origin and path** after a switch (e.g. a small static server fixture that swaps its root from build A to build B). Reuse `e2e/gallery/helpers.ts` for opening and editing a Work.

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §10 and [spec.md](../spec.md) §6, §8 Q1, and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 — happy path

> **Given** the app is open, in a tab or as the Installed app, and a newer version has been published
> **When** the browser has finished downloading the App update
> **Then** a notice says that a new version of imgly is available and offers "Reload". The notice does not disappear by itself, the app keeps running its current version, and editing, Autosave and Export work as before
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

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

### AC-09 — happy path

> **Given** the update notice is shown
> **When** the Editor dismisses it, or leaves it and keeps working
> **Then** this window keeps running its current version and the notice stays away until this window's page loads again. A browser reload of this window, or a newly opened window, shows the notice again while the App update still waits, and a still newer version shows it again at once. Without "Reload", the new version takes over the next time the app starts after every window of it has closed
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

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

### AC-15 — error

> **Given** the app is open without a connection, or the check for a new version fails
> **When** the app would look for a new version
> **Then** no notice and no error appear, the app keeps working on its current version, and it looks again at the next check
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Two-build fixture: build A and build B (B differs by a build marker), one static server on the test origin under `/imgly/` that can switch A → B; trigger a check through a test hook or `registration.update()` — `e2e/pwa-install-update/two-builds.ts`, `playwright.config.ts` (a separate project or webServer for this folder).
- [ ] Flows — `e2e/pwa-install-update/update.spec.ts`: notice appears and stays (AC-06); ignore + dismiss + reload page shows it again (AC-09); tool open refusal (AC-10); Export running refusal (AC-13); save running → wait → reload (AC-11); unstored edits cancel / confirm (AC-12); reopen equals pre-update Export (AC-07, AC-08); offline check → nothing (AC-15). Each asserts **no navigation before "Reload"**.
- [ ] `@perf` — `e2e/pwa-install-update/perf.spec.ts`: "Reload" → first Preview p95 ≤ 3 s on the reference Work; long-task ≤ 200 ms during a background download.
- [ ] Gate on Chromium; on Firefox / WebKit run where the engine supports the two-build flow, else `test.skip` with the reason (spec §8 Q1).

## Edge cases

| Case | Behaviour |
|---|---|
| Engine can't drive a real SW update in CI | `test.skip` with a reason; Chromium stays the gate (spec §8 Q1, `sad.md §11`) |
| Damaged or evicted Work on reopen | Notice, no Work (AC-08) — seed via the gallery helpers |
| Takeover after all windows close (AC-09 last sentence) | Close the context's pages, open a new one, assert build B runs with no notice and no Work |

## Definition of Done

- [ ] `pnpm test:e2e e2e/pwa-install-update/update.spec.ts` passes on Chromium; Firefox / WebKit pass or skip with a stated reason.
- [ ] Every flow asserts zero unchosen navigations and an identical Export after reopen.
- [ ] `PERF=1` run records the p95 and long-task numbers (on the reference machine before release).
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
