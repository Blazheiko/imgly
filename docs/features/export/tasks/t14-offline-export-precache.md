---
id: T14
title: "Precache the export worker and prove export works offline after the first load"
layer: "wiring"
deps: ["T15"]
blocks: []
acs: ["AC-18"]
files_hint: ["vite.config.ts", "e2e/export/offline.spec.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 36 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — Precache the export worker and prove export works offline after the first load

## Place in the sequence

- **Blocked by:** T15 — Write the functional e2e suite: format honesty, fidelity, quality and size, naming, metadata, downloads and Save as….
- **Blocks:** nothing — a leaf of the DAG.
- **Wave:** 9 — after T15.
- **Lane:** shares `e2e/export/offline.spec.ts` with T15 — serialized.

## Why (user story)

> **US-01: Save the Work as an image file**
>
> **As a** Editor  
> **I want** to export the open Work as a PNG, JPEG or WebP file  
> **So that** I keep a copy of my edited image outside the app
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It makes the export as available as the rest of the app: with no network after the first load.

## Inlined context

> The one deployment change is a new build asset: Vite emits `export.worker.ts` as a separate hashed module script, and the Workbox precache must list it, as it does the decode worker, so export works with no network after the first load (spec §6 offline row, AC-18).
>
> — `sad.md §7, Deployment view (last sentence), verbatim` · full text: [sad.md](../sad.md)

> | Aspect | Target | Measurement |
> |---|---|---|
> | Exporting with no network connection | 100% of runs succeed | e2e run in offline mode after first load |
>
> — `spec.md §6, NFR, verbatim` · full text: [spec.md](../spec.md)

> Offline: functional e2e on all three engines loads, waits for the service worker, goes offline, reloads, opens and exports
>
> — `sad.md §10, QG-3 How verify (last sentence), verbatim` · full text: [sad.md](../sad.md)

> **Fixed by this breakdown:** follow `e2e/open-and-view/offline.spec.ts`: assert `sw.js` lists `assets/export.worker-<hash>.js`, wait for the controller, go offline, reload, open, export. That spec skips WebKit because Playwright WebKit cannot reload while offline; do the same and say so in the test. Reuse `e2e/export/helpers.ts` from T15 (download capture, Save as… stub).
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-18 — cross-context

> **Given** the app was loaded once and the device is now offline
> **When** the Editor exports an image
> **Then** the export completes exactly as it does online
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Build and check that the precache manifest lists the export worker; adjust the Workbox config only if it does not — `vite.config.ts`
- [ ] Write the offline spec: precache assertion, SW ready, offline, reload, open a fixture, export, assert the file by content — `e2e/export/offline.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Playwright WebKit offline reload | skipped with the same reason as open-and-view; Chromium and Firefox run |
| Chromium (Save as… path) | runs through the stubbed `showSaveFilePicker` from T15's helpers |

## Definition of Done

- [ ] `e2e/export/offline.spec.ts` passes on Chromium and Firefox and asserts the export worker is in `sw.js`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` clean
