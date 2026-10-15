---
id: T10
title: "Add InstallAction (BaseButton ghost 'Install app') and the store's install-offer state, install() and could-not-install notice"
layer: "ui"
deps: ["T4", "T8"]
blocks: ["T12"]
acs: ["AC-01", "AC-02", "AC-03", "AC-04"]
files_hint: ["src/features/pwa-install-update/InstallAction.vue", "src/features/pwa-install-update/InstallAction.test.ts", "src/features/pwa-install-update/store.ts", "src/features/pwa-install-update/store.test.ts", "src/features/pwa-install-update/messages.ts", "src/features/pwa-install-update/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 59 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Add InstallAction and the store's install-offer state

## Place in the sequence

- **Blocked by:** T4 — install-prompt client · T8 — feature store update lifecycle · **Blocks:** T12 — wiring · **Wave:** 4, alongside T9.
- **Lane:** shares `src/features/pwa-install-update/store.ts`, `messages.ts`, `index.ts` with T8, T9, T11 — serialized.

## Why (user story)

> **As a** Portfolio reviewer
> **I want** to see in the app itself that it can be installed, and install it from there
> **So that** I learn it runs like a desktop app without searching the browser's menus
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task builds the quiet top-bar action and its show/hide rule. US-02 ("not be offered what I already have") is the same rule seen from the Editor.

## Inlined context

> **Install action** (`InstallAction`): a `BaseButton` ghost "Install app" with the tooltip (`title`) "Install imgly as an app on this computer". It renders nothing unless the feature store holds an install offer and the window is not the Installed app (AC-02, AC-04). It is never disabled: installing doesn't touch the open Work, so a tool, an Export or a waiting replacement doesn't block it. It has no keyboard shortcut.
>
> — `screens.md §Shell changes, Install action, verbatim` · full text: [screens.md](../screens.md)

> | default (install offered) | A tab whose browser holds an install offer, and the window is not the Installed app … | `EditorTopBar` · `InstallAction` (`BaseButton` ghost) |
> | install dismissed | … "Install app" hides until the browser offers again, and no notice is shown |
> | install failed | … The Work is untouched, and a failure notice is shown (→ SCR-07). "Install app" stays only while the browser still offers |
> | installed | … "Install app" disappears from this tab, and the Installed app opens in its own window (→ SCR-03) |
>
> SCR-03 default: Display mode `standalone` … The top bar never shows "Install app", whatever the browser's offer does.
>
> — `screens.md §SCR-01 + §SCR-03, rows abridged` · full text: [screens.md](../screens.md)

> | button | top bar | AC-01 | Install app (tooltip "Install imgly as an app on this computer") |
> | failure | `INSTALL_FAILED` | AC-03 | imgly couldn't be installed. Try installing it from the browser's menu instead. |
>
> — `screens.md §Message catalog, rows 1–2, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** the app never calls `prompt()` without the Editor's click. A visitor is nagged to install: the action is a quiet top-bar entry, never a dialog on start.
>
> — `sad.md §8 Security row + spec.md §6.1 abuse case 1, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** plain CSS with `<style scoped>`, only `var(--…)` tokens; reuse `src/shared/ui/` primitives (`BaseButton` ghost here).
>
> — `CLAUDE.md §Conventions, abridged`

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-01–SCR-03 and [sad.md](../sad.md) §6 flows 3–4, and follow them. Do not guess.

## Data delta

No DB changes. The offer lives in memory only (`sad.md §6`, flow 4).

## API contract

Internal — no API surface. Store gains `connectInstall(client: InstallPrompt)`, readonly `canInstall`, `install()`; `index.ts` exports `InstallAction`.

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

- [ ] Store: `connectInstall(client)`; `canInstall = !client.isStandalone() && hasOffer` (reactive via `onOfferChange`); `install()` → `client.prompt()`; `INSTALL_FAILED` → push the `failure` notice; `dismissed` / `accepted` → no notice — `store.ts`, `messages.ts`.
- [ ] `InstallAction.vue`: `v-if="canInstall"`, `BaseButton` variant ghost, label and `title` from `messages.ts`, `@click="install"`; never disabled.
- [ ] Export `InstallAction` — `index.ts`.
- [ ] Tests: store cases + component renders / hides / clicks — `store.test.ts`, `InstallAction.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| Standalone window gets an offer | Still hidden (AC-04) |
| Offer arrives while the tab is open | Action appears at once, no notice (AC-02) |
| Dismissed | Hidden (offer dropped), no notice (AC-03) |
| Failed while the browser still offers | Failure notice; the action stays only while `hasOffer()` (SCR-01 `install failed`) |
| Tool open / Export running | Action still shown and enabled |

## Definition of Done

- [ ] `InstallAction.test.ts` and `store.test.ts` cover AC-01 to AC-04 with a fake `InstallPrompt`.
- [ ] Component uses only `BaseButton` and tokens (no new primitive).
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
