---
id: T14
title: "Add e2e for install (synthetic offer), the offline-ready notice and offline Installed-app start, and the two-window switch and storage-change flows"
layer: "tests"
deps: ["T12"]
blocks: []
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-14"]
files_hint: ["e2e/pwa-install-update/", "e2e/pwa-install-update/two-builds.ts", "playwright.config.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 61 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — e2e for install, offline, and two windows

## Place in the sequence

- **Blocked by:** T12 — wiring · **Blocks:** — · **Wave:** 7, alongside T13.
- **Lane:** shares `e2e/pwa-install-update/two-builds.ts` and `playwright.config.ts` with T13 — serialized after T13's harness.

## Why (user story)

> **As an** Editor
> **I want** every other window of the app to tell me when another window has switched to a new version
> **So that** I never keep editing in an outdated window without knowing it
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task proves the cross-window, install and offline behaviour that only a real browser shows.

## Inlined context

> **How verify:** a unit test of the check schedule with a fake clock (`src/core/app-update/`). An e2e test publishes a second build and triggers a check. A two-window e2e test asserts the "updated in another window" notice, and after a schema change it asserts the "reload to keep saving" notice and that no further save reaches the Gallery store.
>
> — `sad.md §10, QG-2, verbatim` · full text: [sad.md](../sad.md)

> | Works offline after installation | 100% of starts of the Installed app succeed offline after its first load, on Chromium | e2e in offline mode |
> | Windows left on an outdated version without a notice | 0 in the two-window e2e flow |
>
> — `spec.md §6 NFR row 6 + §7 KPI 4, abridged` · full text: [spec.md](../spec.md)

> "Accepted without `appinstalled`" is detected by a bounded wait (default 10 s) … an e2e test with the synthetic install offer covers both outcomes.
>
> — `sad.md §11, risk row 5, abridged` · full text: [sad.md](../sad.md)

**Testing hooks:** T12 adds a synthetic install offer and the `updateNotice` state to `window.__imgly` (e2e build only). Real `beforeinstallprompt` can't be driven by Playwright, so AC-01–AC-04 run on the synthetic offer; "standalone" is emulated with `page.emulateMedia` or the hook. A schema change for AC-14 needs build B to carry a higher IndexedDB version — a test-only migration in build B, never in `src/infra/db/migrations/`.

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §10, §11 and [spec.md](../spec.md) §6, and follow them. Do not guess.

## Data delta

No DB changes in the product. Build B of the e2e harness may open the Gallery at a higher version to trigger `versionchange` (test-only).

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** the app is open in a browser tab, it is not installed, and the browser offers to install it
> **When** the Portfolio reviewer chooses "Install app" in the top bar
> **Then** the browser's own install confirmation appears. Once it is accepted, the app opens in its own window as the Installed app, and the "Install app" action is gone from both the tab and the new window
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — authorization

> **Given** the browser does not offer to install the app, because it cannot install web apps (Firefox on the desktop), installs them only through its own menu (Safari), has stopped offering for now (for example after the Portfolio reviewer declined several times), or the app is already installed
> **When** the app is open in a tab
> **Then** no "Install app" action is shown and nothing else in the app changes. The action appears later only if the browser starts offering installation while the tab is open
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — error

> **Given** the "Install app" action is shown
> **When** the Portfolio reviewer dismisses the browser's install confirmation, or the browser fails to install the app
> **Then** nothing is installed and the open Work is untouched. A dismissal shows no notice, and "Install app" hides until the browser offers installation again. A failure, meaning the browser could not show its confirmation or did not install the app after it was accepted, shows a notice that says in plain words that the app could not be installed and that the browser's menu can be tried instead
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — domain invariant

> **Given** the app runs as the Installed app in its own window
> **When** the window opens or the browser's install offer changes
> **Then** no "Install app" action is ever shown, because the Installed app never offers to install itself
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — happy path

> **Given** the browser has never stored the app's files for offline use, which also means people who already had the app ready offline before this release never see this notice
> **When** it finishes storing what it needs to start and edit without a connection
> **Then** a short notice says that imgly is ready to work offline. It appears once: it does not come back after an App update, and it comes back only after the browser has cleared the app's stored files and stores them again
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** the app is open in two or more windows and one of them switches to a new version
> **When** that switch happens
> **Then** every other window shows a notice that imgly was updated in another window and offers "Reload", even where the Editor had dismissed the update notice for that version. A window shows at most one update notice at a time, and the newest replaces the one before. Each of those windows keeps its open Work and everything it has already loaded, and its "Reload" follows AC-07 to AC-13. When an action in an older window needs a part of the app that the window can no longer load, the action changes nothing and the window says that imgly was updated in another window and must be reloaded to continue. If the newer version changes how the Gallery is stored, a window still on the older version stops saving from that moment and says that it must reload to keep saving, instead of writing in the older shape; edits it makes after that count as not stored in the Gallery, so its "Reload" asks for confirmation as AC-12 says
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `install.spec.ts`: synthetic offer → "Install app" last in the top bar; accepted + installed → gone; dismissed → gone, no notice; accepted without `appinstalled` (short wait via hook) → failure notice; no offer → no action; standalone → never (AC-01–AC-04).
- [ ] `offline.spec.ts`: first load → one "ready to work offline" notice; reload → none; after update (build B) → none (AC-05). Chromium: offline start of the app after first load succeeds (spec §6).
- [ ] `two-windows.spec.ts`: two pages on build A, dismiss in page 2, page 1 reloads into B → page 2 shows "updated in another window" in the single `app-update` slot; an action needing a missing worker → part-unavailable notice, nothing changed; build B with a higher DB version → "reload to keep saving", no further save reaches IndexedDB, "Reload" asks (AC-14).
- [ ] Reuse T13's `two-builds.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| Firefox / WebKit: no install offer at all | `install.spec.ts` asserts no action (AC-02) and skips the offer cases |
| Engine can't run the two-build flow | `test.skip` with a reason; Chromium is the gate (spec §8 Q1) |
| Page with no controller at load (hard reload) | Known gap (`sad.md §11` row 2): not asserted for `controllerchange`; still asserts "reload to keep saving" on a schema change |

## Definition of Done

- [ ] `install.spec.ts`, `offline.spec.ts`, `two-windows.spec.ts` pass on Chromium; other engines pass or skip with a stated reason.
- [ ] The two-window flow asserts 0 windows left without a notice.
- [ ] No test-only migration lands in `src/infra/db/migrations/`.
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
