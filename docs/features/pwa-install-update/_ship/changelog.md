# Changelog — pwa-install-update

## pwa-install-update — the app says it can be installed, and a new version waits for the Editor

**What:** The app now tells people that it can be installed and that it works offline. A new
version no longer reloads the page by itself, even in the middle of an edit.

- **Install app.** When the browser offers to install the app (Chrome and Edge in a tab), the top
  bar shows a quiet **Install app** action. Choosing it opens the browser's own install
  confirmation. The action disappears once the app is installed, while the browser is asking, and
  whenever the browser stops offering. The Installed app never shows it. If the confirmation is
  dismissed, nothing is said. If the install fails, a notice suggests the browser's menu instead.
  Firefox and Safari, which offer no in-app installation, show nothing extra.
- **Ready offline.** The first time the browser has stored the app for offline use, a short notice
  says "imgly is ready to work offline." It shows once, and an App update doesn't bring it back.
- **Updates wait for the Editor.** When a new version has downloaded, a lasting notice says "A new
  version of imgly is available." and offers **Reload**. Until the Editor chooses Reload, the
  window keeps running its current version, and editing, Autosave and Export work as before.
  Reload follows the same rules as replacing the Work:
  - It waits for a running save, and the Editor can keep working meanwhile.
  - It refuses while a tool is open ("Apply or cancel the open tool first.") or while an Export
    runs, and the notice stays.
  - It asks for confirmation only when the open Work has edits that the Gallery doesn't hold.
  - Otherwise it switches to the new version and reopens the Work that was open, from its Stored
    state. Only this reload reopens a Work. Any other start opens no Work, as before.
- **Ignored or dismissed.** A dismissed notice stays away until this window's page loads again.
  Without Reload, the new version takes over the next time the app starts after every window of it
  has closed. Being offline or a failed check shows nothing, and the app looks again later.
- **Several windows.** When one window switches version, every other window says "imgly was
  updated in another window." and offers Reload. Each window keeps its Work. If the new version
  changes how the Gallery is stored, an older window stops saving and asks to reload before it saves
  again. Its later edits count as not stored, so its Reload asks for confirmation. An action that
  needs a part of the app the older window can no longer load changes nothing and asks to reload.

**Why:** The app could already be installed and run offline, but nothing in it said so. Firefox
can't install web apps, and Chrome and Safari hide the option in the address bar or a menu.
Updates had the opposite problem. A new version reloaded the page at once and without a word, so the
open tool's Draft, the Edit history and the View were lost ([spec](../spec.md) §1–§2). This is
roadmap step 9. Key decisions:

- A new version waits as a waiting service worker until the Editor chooses Reload. There is no
  `skipWaiting`, so the browser activates it once every window has closed
  ([ADR-0001](../adr/0001-hold-each-new-version-in-a-waiting-service-worker-until-the-editor-chooses-reload.md)).
- Other windows learn of a switch through `controllerchange`, and of a change to the Gallery's
  storage shape through IndexedDB `versionchange`
  ([ADR-0002](../adr/0002-tell-other-windows-of-a-switch-through-controllerchange-and-of-a-storage-change-through-versionchange.md)).
- The Work to reopen is a take-once id in this tab's `sessionStorage`. It is written only at the
  switch, and every start reads and deletes it first, so no other start can reopen a Work
  ([ADR-0003](../adr/0003-keep-the-work-to-reopen-as-a-take-once-id-in-this-tabs-sessionstorage.md)).
- The editor store owns the Reload gate. The install and update UI lives in a new
  `pwa-install-update` feature, so no feature imports another
  ([ADR-0004](../adr/0004-own-the-reload-gate-in-the-editor-store-and-the-install-and-update-ui-in-a-new-feature.md)).

**How to use:** On Chrome or Edge, open the app in a tab and choose **Install app** in the top bar,
then confirm. To try an update, keep the app open across a deploy. Within 60 minutes of being
visible (or at the next start), the notice offers **Reload**. Close any open tool, choose Reload,
and the Work comes back in the new version.

**Operational notes:**

- Migration: none. No IndexedDB step, and the schema stays at v2.
- Transition release: windows already open on the current build (`autoUpdate`, `skipWaiting`)
  don't know about the update notice. For this first deploy they show no notice and keep their
  version, and the new worker waits until all of them close. Every later release follows the new
  rules (sad §7, §11).
- Rollback: revert the merge and redeploy GitHub Pages. The reverted build's worker uses
  `skipWaiting` again, so it takes over at once, and the silent reload comes back for later
  updates. No stored data changes either way.
- Feature flag / config: none. `vite.config.ts` switches vite-plugin-pwa to `registerType:
  'prompt'` and drops `skipWaiting`. The `assets-b` directory exists only in the e2e build B. The
  production `dist/` uses `assets` and has no `__imglyTest`.
- Cross-feature changes: the shared Toast and `useNotices` gain lasting, slotted, keep-open and busy
  notices, and the `Dialog` gains `preferReturnFocus` (`docs/design-system.md`). Autosave raises
  `storageSuperseded` instead of its own notice. The new `AppError` codes are `INSTALL_FAILED` and
  `APP_PART_UNAVAILABLE`. The root `CONTEXT.md` adds App update, Installed app, Reload gate and
  Update notice.
- Review: four rounds on 2026-10-15 and 2026-10-16. The findings became tasks T15–T31, and round 4
  (`_review/review-2026-10-16-3.md`) returned **PASS**.
- Known follow-ups:
  - The light security review that spec §6.1 requires (Security Lead) isn't recorded yet. The
    review rounds checked the reopen marker's lifetime (R3), and the hand check saw a fresh window
    open no Work. The "Duplicate tab" case in sad §11 still needs the Security Lead's sign-off.
  - Spec §8 still lists two open questions: Firefox and WebKit in the two-build CI flow, and
    whether Safari's "Add to Dock" app shares the Gallery. Both have defaults in place.

**Acceptance criteria delivered:** AC-01 – AC-15:

- An "Install app" action that appears only while the browser offers installation. It opens the
  browser's confirmation, says nothing when dismissed and gives a plain notice on failure. The
  Installed app never shows it (AC-01 – AC-04).
- A one-time "ready to work offline" notice (AC-05).
- A lasting update notice. The window keeps its version until Reload, and a dismissal holds for
  this page load (AC-06, AC-09).
- A Reload that switches and reopens the open Work, and is the only start that reopens one
  (AC-07, AC-08).
- A Reload gate that refuses while a tool is open or an Export runs, waits for a running save and
  asks only when edits aren't stored (AC-10 – AC-13).
- Other windows are told of a switch, and an outdated window stops saving instead of writing in
  the older shape (AC-14).
- An offline or failed check is silent (AC-15).
