---
id: T18
title: "Precache the decode worker for offline opens, run e2e on three engines in CI, and record the widened rules"
layer: "wiring"
deps: ["T5", "T14"]
blocks: ["T19", "T20"]
acs: ["AC-01"]
files_hint: ["vite.config.ts", "playwright.config.ts", ".github/workflows/ci.yml", "eslint.config.js", "docs/architecture-map.md", "e2e/open-and-view/offline.spec.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 39 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T18 — Precache the decode worker for offline opens, run e2e on three engines in CI, and record the widened rules

## Place in the sequence

- **Blocked by:** T5 — Build the decode worker pipeline and the main-thread decodeImage client with supersede and error mapping, T14 — Build SCR-02's PreviewCanvas with the renderer, Fit on open, and the zoom and pan gestures.
- **Blocks:** T19 — Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal, T20 — Add the @perf suite: time to first Preview, long tasks, zoom/pan frame rate and memory after 10 opens.
- **Wave:** 8 — after T5, T14 (wave 7).
- **Lane:** own lane.

## Why (user story)

> **US-01: Open an image from disk**
>
> **As a** Editor  
> **I want** to choose an image file from my computer with an "Open image" action  
> **So that** I can start editing it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It makes AC-01 hold with no network after the first load, and puts the feature's cross-engine e2e and the widened import rule into the repo's tooling and map.

## Inlined context

> The only deployment change is a new build asset: Vite emits the decode worker as a separate hashed module script (`new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' })`), and the Workbox precache must list it, so an open works with no network after the first load (spec §6, offline row).
>
> — `sad.md §7, Deployment view, verbatim` · full text: [sad.md](../sad.md)

> **When:** the app has been loaded once, the network is switched off, and the Editor opens an image
> **Then:** 100% of runs succeed (spec §6, opening with no network connection); the decode worker script comes from the precache (§7)
> **How verify:** functional e2e in CI on all three engines: load, wait for the service worker, set the context offline, reload, open the 12 MP JPEG, and assert the fitted Preview and the dimensions readout
>
> — `sad.md §10, QG-1b, verbatim` · full text: [sad.md](../sad.md)

> Decision override: this feature's functional e2e suite runs in CI on Chromium, Firefox and WebKit, and the `@perf` suite runs by hand on the reference machine before release (§7) — widening the repo convention of Chromium-only e2e and a CI of install → lint → typecheck → unit → build
>
> — `sad.md §1, Decision override 2, abridged` · full text: [sad.md](../sad.md)

> The widened `infra → core` rule and the three-engine CI (§1 Decision overrides) are not yet reflected in `docs/architecture-map.md` or an import lint rule […] | Low | During `implement`, update `docs/architecture-map.md` §Module inventory and §Conventions, and encode "infra may import only types and pure functions from core" in the ESLint import rules
>
> — `sad.md §11, risk row 9, abridged` · full text: [sad.md](../sad.md)

> Decision override: the decode worker in `src/infra/image-decode/` calls pure `core` functions (`sniffImageHeader`, `checkOpenPolicy`, the target-size maths), not only `core` types. This widens the repo rule "`infra → core` (types only)" (repo ADR 0002, `docs/architecture-map.md` §Module inventory) to "types and pure, side-effect-free functions" — rationale: the worker must run exactly the checks the unit tests cover, so the security review reads one parser in one place (ADR-0001, ADR-0002).
>
> — `sad.md §1, Decision override 1, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** the Editor has no image open
> **When** the Editor chooses a Supported image through the "Open image" action
> **Then** the image is shown at Fit, upright the same way the operating system's photo viewer shows it, and the editor is ready for editing. Fit is the largest zoom at which the whole image fits inside the canvas area (the space left after toolbars and panels), never above 100%, so an image smaller than the canvas area is shown centred at 100% and is never enlarged
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Make sure the Workbox `globPatterns` cover the emitted worker chunk; assert it in the built `sw.js` precache manifest — `vite.config.ts`
- [ ] Playwright projects `chromium`, `firefox`, `webkit`; `grepInvert: /@perf/` for CI; web server built with `VITE_E2E_HOOKS=true` — `playwright.config.ts`
- [ ] CI installs the three browsers and runs `pnpm test:e2e` — `.github/workflows/ci.yml`
- [ ] ESLint `no-restricted-imports` for `src/infra/**`: no `vue`, `pinia`, `@/features/**`; `@/core/**` allowed (core is pure by its own rule) — `eslint.config.js`
- [ ] Update `docs/architecture-map.md` §Module inventory (infra → core: types and pure functions) and §Conventions (three-engine e2e, manual `@perf`)
- [ ] E2E `e2e/open-and-view/offline.spec.ts` exactly as QG-1b

## Edge cases

| Case | Behaviour |
|---|---|
| Offline reload before the service worker activated | test waits for `navigator.serviceWorker.ready` first |
| Worker chunk renamed by a new build | the precache manifest is regenerated by the build — no hand-listed hash |
| `@perf` tests in CI | excluded by `grepInvert` |

## Definition of Done

- [ ] `e2e/open-and-view/offline.spec.ts` passes in CI on Chromium, Firefox and WebKit
- [ ] CI runs the e2e matrix; ESLint rejects a `vue` import inside `src/infra/`
- [ ] `docs/architecture-map.md` reflects both §1 Decision overrides
- [ ] lint + typecheck clean
