---
id: T4
title: "Add the infra/platform install-prompt client and the INSTALL_FAILED error code"
layer: "infra"
deps: []
blocks: ["T10"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04"]
files_hint: ["src/infra/platform/install-prompt.ts", "src/infra/platform/install-prompt.test.ts", "src/infra/platform/index.ts", "src/core/result.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 50 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Add the infra/platform install-prompt client and the INSTALL_FAILED error code

## Place in the sequence

- **Blocked by:** — · **Blocks:** T10 — Add InstallAction and the install-offer state · **Wave:** 1.
- **Lane:** shares `src/infra/platform/index.ts` with T3 and `src/core/result.ts` with T5 — serialized.

## Why (user story)

> **As a** Portfolio reviewer
> **I want** to see in the app itself that it can be installed, and install it from there
> **So that** I learn it runs like a desktop app without searching the browser's menus
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task wraps the browser's install offer so the feature store can show, use and drop it under Vitest.

## Inlined context

> `install-prompt.ts   NEW  beforeinstallprompt / appinstalled / display-mode standalone; prompt() → accepted | dismissed | INSTALL_FAILED`
>
> **The install offer follows the browser.** The store keeps the deferred `beforeinstallprompt` event, and "Install app" shows only while one is held and the display mode is not `standalone` (AC-02, AC-04). `appinstalled` and a `dismissed` choice drop the event (AC-01, AC-03). A `prompt()` that rejects, or an `accepted` choice with no `appinstalled` within a bounded wait (default 10 s, which `tasks` may tune), raises the could-not-install notice (AC-03).
>
> — `sad.md §5, decomposition + tactical decision 4, verbatim` · full text: [sad.md](../sad.md)

**Tuned here:** the bounded wait stays **10 000 ms**, exported as a constant so tests and e2e can override it (`sad.md §11` asks `tasks` to set it).

> | Error handling | `infra` returns `Result`. New codes `INSTALL_FAILED` and `APP_PART_UNAVAILABLE` are added to `AppErrorCode`, and their text goes in the owning feature's `messages.ts`. |
>
> — `sad.md §8, Error handling row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** Installation always goes through the browser's confirmation, and the app never calls `prompt()` without the Editor's click.
>
> — `sad.md §8, Security and privacy row, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §5, §6 flows 3–4 and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. New `AppErrorCode` member `INSTALL_FAILED` (doc comment: "The browser could not show its install confirmation, or did not install after it was accepted. AC-03").

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

## Checklist

- [ ] Add `INSTALL_FAILED` to `AppErrorCode` with its doc comment — `src/core/result.ts`.
- [ ] `createInstallPrompt({ target = window, matchMedia = window.matchMedia, installWaitMs = INSTALL_WAIT_MS })`: `isStandalone()` from `(display-mode: standalone)`; `onOfferChange(cb)` fired on `beforeinstallprompt` (call `preventDefault()`, keep the event) and on `appinstalled` (drop it); `hasOffer()`; `prompt(): Promise<Result<'accepted' | 'dismissed', AppError>>` — `src/infra/platform/install-prompt.ts`.
- [ ] `prompt()`: no held event or `event.prompt()` rejects → `err(INSTALL_FAILED)`; `dismissed` → drop the event, `ok('dismissed')`; `accepted` → wait up to `installWaitMs` for `appinstalled` → `ok('accepted')`, else `err(INSTALL_FAILED)`. The event is single-use: drop it after any `prompt()`.
- [ ] Export from `src/infra/platform/index.ts`; unit tests with a fake event target and fake timers — `install-prompt.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| Browser without `beforeinstallprompt` (Firefox, Safari) | `hasOffer()` stays false; nothing fires (AC-02) |
| `standalone` display mode | `isStandalone()` true; the store must ignore every later offer (AC-04) — this client still reports offers faithfully |
| `appinstalled` arrives before `userChoice` resolves | Counts as installed; `ok('accepted')` |
| A second `prompt()` while one is in flight | Returns `err(INSTALL_FAILED)` without calling the browser again |
| Offer withdrawn (`appinstalled` from the browser's own UI) | Event dropped, `onOfferChange` fires so the action hides (AC-02) |

## Definition of Done

- [ ] `install-prompt.test.ts` covers: offer kept and `preventDefault` called; dismissed; accepted + `appinstalled`; accepted + timeout → `INSTALL_FAILED`; reject → `INSTALL_FAILED`; no offer; standalone.
- [ ] `src/infra/import-rules.test.ts` and `src/core/result.test.ts` stay green.
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
