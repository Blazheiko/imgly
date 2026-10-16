## Summary

The top bar now shows **Install app** while the browser offers installation, and a one-time notice
says when the app is ready to work offline. A new version no longer reloads the page by itself. It
waits behind a lasting "A new version of imgly is available." notice. Its **Reload** waits for a
running save, refuses while a tool is open or an Export runs, and asks only when edits aren't stored
in the Gallery. After the switch, the Work that was open comes back. Other windows are told when
one window switches. This is roadmap step 9. See the [spec](docs/features/pwa-install-update/spec.md)
and the [changelog](docs/features/pwa-install-update/_ship/changelog.md).

## Acceptance criteria

- AC-01: "Install app" opens the browser's own confirmation, and once installed the action is gone ✓
- AC-02: no browser offer means no "Install app" and no other change. It appears if an offer comes later ✓
- AC-03: a dismissal says nothing and hides the action. A failure shows a plain notice pointing to the browser's menu ✓
- AC-04: the Installed app never offers to install itself ✓
- AC-05: "imgly is ready to work offline." shows once, at the first offline store ✓
- AC-06: a downloaded version shows a lasting notice with Reload. The window keeps its version, and editing, Autosave and Export go on ✓
- AC-07: Reload with nothing pending switches and reloads this window ✓
- AC-08: after the switch the open Work reopens from its Stored state. No other start reopens a Work, and an evicted or damaged Work is explained ✓
- AC-09: a dismissal holds for this page load. Without Reload, the version takes over once every window has closed ✓
- AC-10: Reload with a tool open says "Apply or cancel the open tool first." and the notice stays ✓
- AC-11: Reload waits for a running save, then checks every condition again ✓
- AC-12: edits the Gallery doesn't hold ask for confirmation, and Cancel keeps everything ✓
- AC-13: Reload during an Export says to wait, and the notice stays ✓
- AC-14: other windows are told of a switch. An outdated window stops saving after a storage change and asks to reload ✓
- AC-15: offline or a failed check shows nothing, and the app looks again later ✓

## Design

- Spec: `docs/features/pwa-install-update/spec.md`
- Architecture: `docs/features/pwa-install-update/sad.md`
- Decisions: `docs/features/pwa-install-update/adr/`
  - [ADR-0001](docs/features/pwa-install-update/adr/0001-hold-each-new-version-in-a-waiting-service-worker-until-the-editor-chooses-reload.md): a new version waits as a waiting service worker until Reload (prompt mode, no `skipWaiting`)
  - [ADR-0002](docs/features/pwa-install-update/adr/0002-tell-other-windows-of-a-switch-through-controllerchange-and-of-a-storage-change-through-versionchange.md): other windows learn through `controllerchange` and IndexedDB `versionchange`
  - [ADR-0003](docs/features/pwa-install-update/adr/0003-keep-the-work-to-reopen-as-a-take-once-id-in-this-tabs-sessionstorage.md): the Work to reopen is a take-once id in this tab's `sessionStorage`
  - [ADR-0004](docs/features/pwa-install-update/adr/0004-own-the-reload-gate-in-the-editor-store-and-the-install-and-update-ui-in-a-new-feature.md): the editor store owns the Reload gate, and a new feature owns the UI
- UX: `docs/features/pwa-install-update/ux-flows.md` and `docs/features/pwa-install-update/screens.md`
- Data model and migration: none (no IndexedDB step)
- API: none (client-only)

## Tasks

These commits carry `SDD-Task` and `SDD-AC` trailers. Their task ids come from `docs/features/pwa-install-update/tasks/tracker.md`.

| Task | Commit | Subject |
|---|---|---|
| T1 | d8b57f8 | feat(pwa-install-update): add the pure update-check schedule nextCheckDue |
| T2 | 5f8c726 | feat(pwa-install-update): widen useNotices and Toast with lasting, slotted, keep-open and busy notices |
| T3 | 25f6c7a | feat(pwa-install-update): add the prompt-mode service-worker client and the take-once reload marker |
| T4 | 4925164 | feat(pwa-install-update): add the install-prompt client and the INSTALL_FAILED code |
| T5 | 490821e | feat(pwa-install-update): map a worker script that fails to load to APP_PART_UNAVAILABLE |
| T6 | 0168f4f | feat(pwa-install-update): add the Reload gate editor.requestReload() |
| T7 | 59b7eae | feat(pwa-install-update): make Autosave raise storageSuperseded instead of its own notice |
| T8 | f35a153 | feat(pwa-install-update): add the feature store's update lifecycle |
| T9 | 92f81f7 | feat(pwa-install-update): add Reload and the reopen after the update |
| T10 | b186833 | feat(pwa-install-update): add InstallAction and the install-offer state |
| T11 | d870422 | feat(pwa-install-update): add ReloadDialog (SCR-06) |
| T12 | b630020 | feat(pwa-install-update): switch to prompt mode and wire install and update into the app shell |
| T13 | 969f962 | test(pwa-install-update): add the two-build e2e harness and the single-window update flows |
| T12 | 27e8789 | fix(pwa-install-update): list the Gallery afresh before deciding a marked Work was evicted |
| T14 | 522ef9e | test(pwa-install-update): add e2e for install, the offline-ready notice and two windows |
| T15 | c0b0394 | fix(pwa-install-update): reopen in an outdated window asks to reload and marks nothing Damaged |
| T16 | 4e8f241 | fix(pwa-install-update): hold the editor while the Reload confirmation is open and while leaving |
| T17 | cf8f6f2 | fix(pwa-install-update): take the reopen marker first at start and write it only at the switch |
| T18 | 6af0a12 | fix(pwa-install-update): edits stored before versionchange need no Reload confirmation |
| T19 | b4b9c2c | fix(pwa-install-update): Reload takes any waiting worker, and the start check waits for registration |
| T20 | fbf3cb5 | fix(pwa-install-update): hide "Install app" while the browser asks, and ignore a second click |
| T21 | 938664a | fix(pwa-install-update): name the busy Reload once, and pin focus return after the confirmation |
| T22 | 39c00b1 | test(pwa-install-update): run every e2e under the service worker and wait for positive signals |
| T27 | 6cced02 | test(pwa-install-update): quiet an offline-ready notice already shown, and check the reopened id again |
| T23 | 971486a | fix(pwa-install-update): hold every editor entry point while leaving, and switch only once |
| T24 | 0a61217 | fix(pwa-install-update): keep the update notice in place when re-raised, so focus returns to Reload |
| T26 | 3bfa5e8 | test(pwa-install-update): negative e2e checks wait on a signal, not a sleep |
| T25 | 8816ace | docs(pwa-install-update): amend ADR-0003 and the sad to the marker order and Reload choice as built |
| T28 | 5929a81 | fix(pwa-install-update): return focus to Reload after the confirmation even when a save wait moved it |
| T29 | b673c80 | fix(pwa-install-update): the Gallery start opens no picker while leaving, and a refused choice says nothing on purpose |
| T30 | ae69e33 | test(pwa-install-update): buildOf waits for the test hooks before it reads the build mark |
| T31 | 2090804 | test(pwa-install-update): the gallery 'leaving' test runs the real hold, and buildOf's hook wait fails fast |

## Verification

Verified at `3151c52` on 2026-10-16 (Apple M1 Pro, latest Playwright browsers).

- Unit: `pnpm test` passes 2600 of 2600 (120 files).
- Lint and vet: `pnpm lint` and `pnpm typecheck` are clean.
- Build: `pnpm build` is clean, and the production `dist/` has no `__imglyTest` hooks.
- e2e: `pnpm test:e2e` on Chromium, Firefox and WebKit has 1084 passing, 40 skipped and 4 failing (17.2 min). All 4 failures were outside this feature, and the hand check and a second build were running at the same time. Three were Firefox open-and-view `reference-set` tests ("Tearing down \"context\" exceeded the test timeout"), and one was the WebKit crop-rotate AC-17 replace test. Re-run alone, they all pass: the Firefox ones 15 of 15 with `--repeat-each=3`, and the WebKit one 5 of 5. Every `e2e/pwa-install-update` test passed in the full run. The skips are conditional: `@perf` without `PERF=1`, WebKit offline by design, and the earlier features' engine-specific skips.
- Perf (`PERF=1`, Chromium, reference Work 4096 × 3072, 20 runs after 2 warm-ups). Both rows pass the spec §6 target:
  - "Reload" to the reopened Work's first Preview: p95 1811 ms (target ≤ 3 s).
  - Longest task while the update downloads: 0 ms (target ≤ 200 ms).
- Ran the feature by hand. A separate Playwright script drove two **production** builds (`dist/`
  and a second `VITE_E2E_BUILD=B` production build, neither with test hooks) through the UI only.
  It ran on Chromium against a local server that switches builds the way a Pages deploy does, with
  `photo.png`. It observed:
  - AC-05: the first service-worker install shows "imgly is ready to work offline.", and a reload doesn't show it again.
  - AC-02: with no offer, the top bar has no "Install app".
  - AC-01 and AC-03: a synthetic `beforeinstallprompt`, handled by the production listener, shows "Install app" titled "Install imgly as an app on this computer". When it is dismissed, the action hides and no notice shows. When it is accepted, followed by `appinstalled`, the action is gone and no notice shows.
  - AC-06: after Brightness 40 was applied and stored, build B was published and the page checked for it. "A new version of imgly is available." with Reload showed and was still there 7 s later. The page wasn't reloaded and still ran build A.
  - AC-10: with Adjust open, Reload said "Apply or cancel the open tool first.", the notice stayed and the page didn't reload.
  - AC-07 and AC-08: after Adjust was closed, Reload loaded a new page on build B (`assets-b`). The Work reopened, and Adjust showed Brightness 40. A fresh window on the same origin opened no Work.
  - AC-15: with the network failing, a check showed no notice.
  - No page errors.
- Not verified here:
  - A real browser install. Playwright can't make a browser raise an install offer, so AC-01 was checked on the synthetic event, as the e2e suite does, and AC-04 only by the e2e test that stubs the standalone display mode.
  - The perf numbers come from an M1 Pro, not the M1 MacBook Air that the spec names as the reference machine.
  - **The light security review that spec §6.1 requires (Security Lead) isn't recorded yet.** The review rounds checked the marker's lifetime (R3), and the "Duplicate tab" case in sad §11 still needs sign-off.
- Review: four rounds on 2026-10-15 and 2026-10-16. The findings were resolved as T15–T31, and round 4 (`docs/features/pwa-install-update/_review/review-2026-10-16-3.md`) returned **PASS**.

## Operational notes

- Migration: none.
- Transition release: windows already open on the current `autoUpdate` build show no notice for
  this first deploy. They keep their version, and the new worker waits until all of them close.
  After that, every release waits for Reload.
- Rollback: revert the merge and redeploy GitHub Pages. The reverted worker uses `skipWaiting`
  again, so it takes over at once and the silent reload returns. No stored data changes.
- Feature flag or config: none. vite-plugin-pwa now runs in `registerType: 'prompt'` without
  `skipWaiting`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
