---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-15"
feature_size: "S"
---

# Spec — pwa-install-update

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root; App update and Installed app added for this feature)
> **Reference module / docs / channels used:** `docs/roadmap.md` (destination, step 9), `docs/idea-brief.md` (§1, §2), `docs/architecture-map.md` (app shell, service worker, app-shell cache), `docs/design-system.md` (Toast, ToastStack), `src/app/pwa.ts` and `vite.config.ts` (today's registration and update behaviour), and `docs/features/gallery/spec.md` (Autosave, Replace gate, AC-04, AC-05, AC-20). No other channels.

## 1. Context

The app can already be installed and already works offline: it describes itself to the browser as an installable app and stores its own files for offline use. Nothing in the app says so. Chrome and Edge show only a small icon at the end of the address bar, Safari offers installation only through its File menu ("Add to Dock"), and Firefox on the desktop cannot install a web app at all. A Portfolio reviewer who opens the deployed app for a few minutes usually never learns that it installs and runs offline, which is half of the roadmap's destination sentence.

Updates have the opposite problem: they are too eager. When a new version is published, the browser downloads it in the background, and today the app switches to it at once and reloads the page without a word, even in the middle of an edit. Autosave keeps the applied Steps, but the open tool's Draft, the Edit history and the View are lost, the Work is closed, and the Editor sees the page flash with no explanation. This is roadmap step 9. Every editing step and the Gallery have shipped, so a silent reload now discards more than it used to, and it is the last step before OS integration.

Committed approach: **an "Install app" action where the browser can install, and an App update that waits for the Editor.** The top bar shows "Install app" only while the browser offers installation, and choosing it opens the browser's own install confirmation. When a new version has downloaded, a notice that stays until the Editor acts on it says a new version is available and offers "Reload". The app changes version only when the Editor chooses Reload, never while a tool is open or an Export runs, and after the reload it reopens the Work that was open. A notice the Editor ignores leaves the current version running, and the new one takes over the next time the app starts after every window of it has closed. The first time the app becomes ready to work offline, a notice says so once. This approach was chosen at easy interview depth (2026-10-15). The owner chose two points explicitly: keep both halves of the step (install and update), and update only with the Editor's consent. The rest comes from the accepted assumptions ledger. The ideation analyses did not run at that depth.

Traceability and deliberate compromises:

- Behaviour change: today the app takes every new version at once and reloads the page. This feature replaces that with a reload the Editor chooses (AC-07 to AC-09).
- Cross-feature rule: the reload after an update follows the same confirmation rule as the Replace gate. It waits for a running save, and it asks for confirmation only when the open Work has Unsaved edits that Autosave has not stored (AC-11, AC-12; gallery AC-16, AC-17, AC-20).
- Cross-feature rule: after the reload, the Work comes back exactly as a reopen from the Gallery gives it back (gallery AC-04), with an empty Edit history whose save point is the state at reopen. This is not the "nothing reopens on start" case of gallery AC-05, because only a reload the Editor chose in this window reopens a Work, never a fresh start (AC-08).
- Cross-feature change: the update notice must stay until the Editor acts on it, and stay after a refused or cancelled "Reload" (AC-06, AC-10, AC-12, AC-13). Today an information notice closes itself after six seconds and its action always closes it (`docs/design-system.md`, Toast and ToastStack), so the shared notice primitive gains a lasting notice whose action can leave it open, and the design system records it.
- Decision: browsers that offer no in-app installation get no install action and no instructions (AC-02, §3).
- Decision override: size stays S although AC-14 adds a cross-window notice and an older window that stops saving — rationale: both reuse the Gallery's existing handling of a storage version change and the existing notice boundary, so no new module, API or migration appears; re-run `sdd:classify-size` if `design` finds otherwise.

## 2. Goals

- A visitor whose browser can install the app learns that it can, from the app itself, and installs it with one action plus the browser's own confirmation.
- A new version never interrupts work. The app changes version only when the Editor chooses or when it next starts, and doing so never loses an open tool's Draft, nor an applied change without the Editor's confirmation.
- No window of the app keeps running an outdated version without being told, and each one gets a safe way to catch up.

## 3. Non-goals

- Install instructions for browsers that offer no in-app installation, such as Firefox and Safari. Their own menus stay the way in, and per-browser instructions go stale with every browser release (AC-02).
- Release notes or a "what's new" panel in the update notice. The app has no list of changes to show, and writing one for each deploy is outside this step.
- Forcing an update or blocking an old version. The app has no server that could declare a version unsafe (ADR 0001).
- Keeping the Edit history or the View across the update reload. Neither is ever stored (CONTEXT: Edit history, View; gallery §3).
- Mobile install banners and touch layouts. Desktop is the target, and mobile only has to not break (roadmap, Out of scope).
- Uninstalling the app from inside it. The browser and the operating system already do that.

## 4. User stories

### US-01: Discover and install the app

**As a** Portfolio reviewer
**I want** to see in the app itself that it can be installed, and install it from there
**So that** I learn it runs like a desktop app without searching the browser's menus

### US-02: Not be offered what I already have

**As an** Editor
**I want** the install action to disappear once the app is installed or can't be installed
**So that** the top bar never offers something that does nothing

### US-03: Know the app works offline

**As an** Editor
**I want** to be told once when the app is ready to work without a connection
**So that** I can rely on it offline without testing it first

### US-04: Update when I choose

**As an** Editor
**I want** to be told when a new version is available and pick the moment to switch to it
**So that** an update never reloads the page under me

### US-05: Never lose work to an update

**As an** Editor
**I want** the update to wait for my open tool, my running save and my running Export, and to bring my Work back afterwards
**So that** switching versions costs me no Draft, and no applied change unless I confirm it

### US-06: Keep every window in step

**As an** Editor
**I want** every other window of the app to tell me when another window has switched to a new version
**So that** I never keep editing in an outdated window without knowing it

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** the app is open in a browser tab, it is not installed, and the browser offers to install it
**When** the Portfolio reviewer chooses "Install app" in the top bar
**Then** the browser's own install confirmation appears. Once it is accepted, the app opens in its own window as the Installed app, and the "Install app" action is gone from both the tab and the new window

### AC-02 (US-02) — authorization

**Given** the browser does not offer to install the app, because it cannot install web apps (Firefox on the desktop), installs them only through its own menu (Safari), has stopped offering for now (for example after the Portfolio reviewer declined several times), or the app is already installed
**When** the app is open in a tab
**Then** no "Install app" action is shown and nothing else in the app changes. The action appears later only if the browser starts offering installation while the tab is open

### AC-03 (US-01) — error

**Given** the "Install app" action is shown
**When** the Portfolio reviewer dismisses the browser's install confirmation, or the browser fails to install the app
**Then** nothing is installed and the open Work is untouched. A dismissal shows no notice, and "Install app" hides until the browser offers installation again. A failure, meaning the browser could not show its confirmation or did not install the app after it was accepted, shows a notice that says in plain words that the app could not be installed and that the browser's menu can be tried instead

### AC-04 (US-02) — domain invariant

**Given** the app runs as the Installed app in its own window
**When** the window opens or the browser's install offer changes
**Then** no "Install app" action is ever shown, because the Installed app never offers to install itself

### AC-05 (US-03) — happy path

**Given** the browser has never stored the app's files for offline use, which also means people who already had the app ready offline before this release never see this notice
**When** it finishes storing what it needs to start and edit without a connection
**Then** a short notice says that imgly is ready to work offline. It appears once: it does not come back after an App update, and it comes back only after the browser has cleared the app's stored files and stores them again

### AC-06 (US-04) — happy path

**Given** the app is open, in a tab or as the Installed app, and a newer version has been published
**When** the browser has finished downloading the App update
**Then** a notice says that a new version of imgly is available and offers "Reload". The notice does not disappear by itself, the app keeps running its current version, and editing, Autosave and Export work as before

### AC-07 (US-04) — happy path

**Given** the update notice is shown, no tool is open, no Export is running and the open Work, if any, has no Unsaved edits that are missing from the Gallery
**When** the Editor chooses "Reload"
**Then** the app switches to the new version and reloads within this window

### AC-08 (US-05) — cross-context

**Given** a Work was open when the Editor chose "Reload" and its Stored state is in the Gallery
**When** the new version has started
**Then** the app reopens that Work as the Gallery reopens it: the same Original, Geometry, Adjustments and Drawing layer, with an empty Edit history and the View fitted to the window. Only a reload chosen through the update notice in this window reopens a Work. Starting the app in any other way opens no Work, as before (gallery AC-05). When that Work can no longer be reopened, because it is a Damaged Work or another window's save evicted it, the app opens no Work and a notice says in plain words why it could not be reopened; a Damaged Work stays in the Gallery as before

### AC-09 (US-04) — happy path

**Given** the update notice is shown
**When** the Editor dismisses it, or leaves it and keeps working
**Then** this window keeps running its current version and the notice stays away until this window's page loads again. A browser reload of this window, or a newly opened window, shows the notice again while the App update still waits, and a still newer version shows it again at once. Without "Reload", the new version takes over the next time the app starts after every window of it has closed

### AC-10 (US-05) — domain invariant

**Given** the update notice is shown and a tool is open with its Draft
**When** the Editor chooses "Reload"
**Then** the app does not reload and says "Apply or cancel the open tool first." The update notice stays, so the Editor can choose "Reload" again after closing the tool

### AC-11 (US-05) — cross-context

**Given** the update notice is shown and Autosave is storing the open Work
**When** the Editor chooses "Reload"
**Then** the app waits for that save to finish, and the Editor can keep working meanwhile. Once the save has finished, the app checks every condition again: it follows AC-10 if a tool is now open, AC-13 if an Export is now running, AC-12 if edits are not stored in the Gallery, and AC-07 otherwise

### AC-12 (US-05) — cross-context

**Given** the update notice is shown and the open Work has Unsaved edits that Autosave has not stored in the Gallery, for example because the Gallery is unavailable or the last save failed
**When** the Editor chooses "Reload"
**Then** the app asks for confirmation and says that the edits not stored in the Gallery will be lost and that exporting first keeps them. Cancelling keeps the Work, its Edit history and the update notice as they were. Confirming reloads, and the app reopens the Work's last Stored state when there is one, or opens no Work when there is none

### AC-13 (US-05) — domain invariant

**Given** the update notice is shown and an Export is running, which for this rule lasts from the Editor choosing to export, including the system's save window, until the file is saved or the export is cancelled; an export dialog that is open without a started export does not count
**When** the Editor chooses "Reload"
**Then** the app does not reload and says to wait for the export to finish. The update notice stays, because an App update never interrupts an Export

### AC-14 (US-06) — cross-context

**Given** the app is open in two or more windows and one of them switches to a new version
**When** that switch happens
**Then** every other window shows a notice that imgly was updated in another window and offers "Reload", even where the Editor had dismissed the update notice for that version. A window shows at most one update notice at a time, and the newest replaces the one before. Each of those windows keeps its open Work and everything it has already loaded, and its "Reload" follows AC-07 to AC-13. When an action in an older window needs a part of the app that the window can no longer load, the action changes nothing and the window says that imgly was updated in another window and must be reloaded to continue. If the newer version changes how the Gallery is stored, a window still on the older version stops saving from that moment and says that it must reload to keep saving, instead of writing in the older shape; edits it makes after that count as not stored in the Gallery, so its "Reload" asks for confirmation as AC-12 says

### AC-15 (US-04) — error

**Given** the app is open without a connection, or the check for a new version fails
**When** the app would look for a new version
**Then** no notice and no error appear, the app keeps working on its current version, and it looks again at the next check

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in the earlier specs. The reference Work is the 4096 × 3072 px Work of gallery §6. Each p95 is taken over 20 runs after 2 warm-up runs.

| Aspect | Target | Measurement |
|---|---|---|
| From a newer version being published to an open, online window showing the update notice | ≤ 60 minutes plus the download time. Each window checks on start and at most once every 60 minutes while it is visible; a hidden window does not check, and checks on becoming visible again when 60 minutes have passed | unit test of the check schedule with a fake clock; e2e that publishes a second build and triggers a check |
| From choosing "Reload" to the reopened reference Work's first Preview in the new version | p95 ≤ 3 s | e2e performance test on the reference machine |
| Reloads the Editor did not choose | 0 across the update e2e flows (notice ignored, tool open, Export running, save running) | e2e on Chromium, Firefox and WebKit |
| Drafts and applied changes lost to an update without the Editor's confirmation | 0 across the same flows | e2e comparing the reopened Work's Export with the Export made before the update |
| Editing stays responsive while the update downloads | longest interface freeze ≤ 200 ms (the open-and-view target) | long-task trace during a background download |
| Works offline after installation | 100% of starts of the Installed app succeed offline after its first load, on Chromium | e2e in offline mode |

## 6.1 Security / privacy

- **Data classification:** confidential. The feature itself handles the app's own files and the browser's install and update signals, but AC-08 reopens a Work, whose photo can be personal (gallery §6.1).
- **Personal data touched:** none new. Across the update reload the app keeps, for this window only, which Work was open, so AC-08 can reopen it; it is forgotten once the Work reopens or the window closes.
- **AuthZ/AuthN impact:** none in the app, which has no accounts. Installation always passes the browser's own confirmation, so the app can never install itself. The browser accepts a new version only from the app's own site and address scope.
- **Abuse cases:**
  - A visitor is nagged to install: the action is a quiet top-bar entry, never a dialog on start, and it disappears whenever the browser stops offering installation (AC-02).
  - A window on an older version damages stored Works after a newer version changed how they are stored: the older window stops saving and asks to reload (AC-14).
  - A shared computer reopens someone's Work after an update: only a reload the Editor chose in this window reopens a Work, and the marker of which Work to reopen lives only in that window (AC-08).
- **Security review:** Required, light. It must confirm that the marker of which Work to reopen holds only the Work's identifier, lives only in that window and is gone once the Work reopens or the window closes, and that no other start reopens a Work (gallery AC-05). The feature adds no other stored data and no new permission.

## 7. Metrics / KPIs

- **Updates that reload the page without the Editor's choice** — baseline: every update that arrives while the app is open, target: 0 in the update e2e flows, by ship.
- **Drafts lost to an update** — baseline: every Draft open when an update arrives, target: 0 in the update e2e flows, by ship.
- **Actions to install the app from inside it, on Chrome or Edge** — baseline: no way from inside the app (only the address-bar icon), target: 2 ("Install app", then the browser's confirmation), by ship.
- **Windows left on an outdated version without a notice** — baseline: not applicable (a silent reload replaces each window), target: 0 in the two-window e2e flow, by ship.

## 8. Open questions

- [ ] Can Firefox and WebKit run the two-build update e2e flow (publish a second build, see the notice, reload) in the CI browsers? Default now: gated on Chromium, measured on Firefox and WebKit where the browser supports it. — owner: Tech Lead, due: before `sdd:plan-tests`
- [ ] Does Safari's "Add to Dock" app share the Gallery with Safari's tabs? Default now: assume it does not, and say nothing about it in the app. — owner: Blazheiko, due: before `sdd:design`
