---
status: draft             # draft | approved
feature_size: "S"
tool: "code"
updated_at: "2026-10-15"
---

# Screens — pwa-install-update

> The canonical **screen manifest**, with every screen in every state. It is produced by `screens` (between
> `api` and `tasks`) and read by `tasks` (each `ui` task cites SCR ids + states), `implement`
> (builds the screen to the declared states) and `review` (the built screen must match this).
> Downstream stages reference **only this manifest**, never the raw Figma / `.pen` file.

## Source

- **Tool:** code (from `docs/design-system.md`). No degradation: the canon itself chose code mode.
- **File:** the wireframes are inline below.
- **Inputs:** screen inventory from `ux-flows.md` (SCR-01 to SCR-07, all covered). States come from spec §5 ACs (AC-01 to AC-15), the `sad.md` §6 Critical flows 1 to 6 with their `alt`/`else` branches, and the `sad.md` §8 `AppError` codes (`INSTALL_FAILED`, `APP_PART_UNAVAILABLE`, and the gallery's existing `WORK_DAMAGED` and `STORAGE_FAILED`). There is no `contracts/` folder, because the app has no backend and the feature has no external interface (`target_surfaces: [web-frontend]`). `api` and `data-model` were skipped for that reason, so no state comes from a contract error response.
- **States with no AC wording but with a design source:**
  - The "Reloading…" look of the update notice while "Reload" waits for a save comes from AC-11 and `sad.md` Critical flow 1, which say the Editor keeps working during the wait. It follows the canon's §Loading convention (a busy button with a `Spinner`, never an overlay).
  - The catch-all "couldn't be reopened" notice covers the case where the Work's record can't be read after the reload, or the Gallery is unavailable. AC-08 names only "damaged" and "evicted", but the reopen goes through the gallery's existing read, which can also fail that way.
  - The SCR-07 `repeated` state (the same refusal again replaces its earlier copy) keeps a "Reload" pressed several times with a tool open from stacking identical notices. The feature store does the de-duplication, not the shared `useNotices`. Confirmed with the owner on 2026-10-15.
- **Decisions taken here:**
  - "Install app" is a `BaseButton` **ghost**, last in the top bar's right-hand group. It is the quietest look the canon has, as spec §6.1 asks ("a quiet top-bar entry, never a dialog on start").
  - The update notice is one `Toast` of the new kind `lasting` in the `app-update` slot. The three wordings replace each other in place (`sad.md` §5).
  - Refusals (SCR-07) are `failure` notices, as `sad.md` §8 says. They appear beside the update notice, which stays.
- **Reused unchanged:** the gallery's SCR-01 `reopening` state (a `Spinner` overlay labelled "Opening {name}") and its damaged-Work notice with "Delete…" show the reopen after an update. Open-and-view's unsupported canvas message, every tool and the export panel are not redrawn here.

### Shell changes

- **Top bar** (`EditorTopBar`): `InstallAction` is mounted **last** in `EditorView`'s `top-bar-actions` slot, after `ExportAction`, so `App.vue` fills it as `…<DrawAction /><ExportAction /><InstallAction />`. The slot is rendered whenever the display is live, with or without a Work. On the start screen, "Install app" is therefore the only action at the right. When the display is unsupported (no WebGL2), the slot is not rendered and "Install app" is absent too, so the app never offers to install a copy that can't edit.
- **Install action** (`InstallAction`): a `BaseButton` ghost "Install app" with the tooltip (`title`) "Install imgly as an app on this computer". It renders nothing unless the feature store holds an install offer and the window is not the Installed app (AC-02, AC-04). It is never disabled: installing doesn't touch the open Work, so a tool, an Export or a waiting replacement doesn't block it. It has no keyboard shortcut.
- **Notices** stay in `ToastStack` at the bottom right. The update notice is placed like any other notice in the order it arrived. A newer wording replaces it **in place** (same slot, same position), so the stack doesn't jump. Refusals and failures are pushed after it.
- **Reload confirmation** (`ReloadDialog`, SCR-06) is mounted by `App.vue` at the root, beside `DeleteWorkDialog`, and is rendered while the editor store's Reload gate is in its `confirm` state. It is modal through `Dialog`, so the top bar and the notices can't be reached while it shows.
- No other screen changes. Saving that stopped after a storage change (AC-14) shows **only** through the update notice's "reload to keep saving" wording, so there is no status-bar badge.
- Below 1024 px the same layout applies: "Install app" stays in the top bar (it wraps with the other actions), and the notice keeps `--toast-max-width` (canon §Platform posture).

### Keyboard

| Key | Where | Action | AC |
|---|---|---|---|
| `Tab` | Top bar | Reaches "Install app" last in the top bar, after Export, when it is shown | AC-01 |
| `Enter` / `Space` | "Install app" | Opens the browser's install confirmation (SCR-02) | AC-01 |
| `Tab` | Update notice | Reaches "Reload", then the notice's Dismiss, in the order of `ToastStack` | AC-06 |
| `Enter` / `Space` | "Reload" | Runs the Reload checks. Focus stays on "Reload" when the reload is refused or while it waits for a save | AC-07, AC-10, AC-11, AC-13 |
| `Enter` / `Space` | Notice Dismiss | Hides the update notice until this page loads again (or a still newer version waits, or another window switches) | AC-09, AC-14 |
| `Esc` | SCR-06 open | Cancels the confirmation (`Dialog`). Focus returns to "Reload" in the update notice | AC-12 |
| `F5` / `Ctrl/Cmd+R` | Anywhere | The browser's own reload. It doesn't switch versions while another window of the app is open, and it shows the update notice again while the App update still waits | AC-09 |

The update notice never takes focus when it appears (it is `role="status"`, polite). When SCR-06 opens, focus moves to "Cancel".

## Screens

### SCR-01 — Editor

The existing editor, in a browser tab, with or without a Work open. Only the states this feature adds are listed, and every other state of the earlier features is unchanged.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default (install offered) | A tab whose browser holds an install offer, and the window is not the Installed app (Critical flow 4, AC-01, AC-02). "Install app" is last in the top bar | `EditorTopBar` · `InstallAction` (`BaseButton` ghost) | wireframe 01-a, 01-b |
| default (no offer) | Firefox, Safari, a browser that has stopped offering for now, or the app is already installed (Critical flow 4 `no offer`, AC-02). The top bar is exactly as before this feature, and nothing else changes | `EditorTopBar` | — (as before) |
| offer changes | The browser starts offering while the tab is open, or stops offering or installs the app (Critical flow 4 `opt`, AC-02). "Install app" appears or disappears at once, with no notice | `InstallAction` | wireframe 01-a |
| installing | "Install app" chosen. The browser's own confirmation is on top (→ SCR-02). The app doesn't change its look, and the action keeps its focus | `InstallAction` | — |
| install dismissed | The confirmation was dismissed (Critical flow 3 `dismissed`, AC-03). "Install app" hides until the browser offers again, and no notice is shown | `EditorTopBar` | — |
| install failed | The confirmation couldn't show, or no installation followed within the bounded wait after it was accepted (Critical flow 3 last branch, `INSTALL_FAILED`, AC-03). The Work is untouched, and a failure notice is shown (→ SCR-07). "Install app" stays only while the browser still offers | `Toast` `failure` | wireframe 07-a |
| installed | Accepted and installed (Critical flow 3, AC-01). "Install app" disappears from this tab, and the Installed app opens in its own window (→ SCR-03) | `EditorTopBar` | — |
| update waiting | A newer version has downloaded and waits (Critical flow 6, AC-06). The update notice shows (→ SCR-05), and editing, Autosave and Export carry on | `ToastStack` · `Toast` `lasting` | wireframe 01-b |
| first offline-ready | The app's files were stored for offline use for the first time (Critical flow 5, AC-05) | → SCR-04 | — |
| outdated window | Another window switched versions (Critical flow 2, AC-14). The Work and everything already loaded stay. The update notice shows its "updated in another window" wording, even after a dismissal (→ SCR-05) | `Toast` `lasting` | wireframe 05-b |
| part unavailable | In an outdated window, opening, reopening or exporting needs a worker script this window can no longer load (Critical flow 2 `alt`, `APP_PART_UNAVAILABLE`, AC-14). The action changes nothing, and a failure notice asks to reload (→ SCR-07) | `Toast` `failure` | wireframe 07-a |
| saving stopped | Another window's version changed the Gallery's storage (Critical flow 2 `versionchange`, AC-14). Editing goes on, but nothing is saved, and only the update notice says so in its "reload to keep saving" wording (→ SCR-05). The gallery's earlier "newer version open in another tab" notice is no longer pushed (`sad.md` §5, `infoNewerVersion()` moves) | `Toast` `lasting` | wireframe 05-c |
| reopening after the update | The page reloaded into the new version and the marker names a Work (Critical flow 1, AC-08). The start screen shows the gallery's `reopening` state, a `Spinner` overlay labelled "Opening {name}" over the Gallery section (target: first Preview p95 ≤ 3 s from "Reload", spec §6) | gallery SCR-01 `reopening`, unchanged | gallery wireframe 01-d |
| reopened | The Work was readable (Critical flow 1 `readable`, AC-08). The editor with the Work: same Original, Geometry, Adjustments and Drawing layer, empty Edit history (Undo and Redo disabled), View fitted. No notice | gallery SCR-02 `reopened`, unchanged | — |
| reopen failed | The Work is damaged, was evicted, or can't be read (Critical flow 1 `damaged or evicted`, AC-08). The start screen stays with no Work open, and a notice says why (→ SCR-07). A Damaged Work stays in the Gallery, marked damaged | gallery SCR-01 `default` · `Toast` `failure` | wireframe 07-b |
| started without a reload | Any other start: a new window, a browser reload, or the first start after every window closed (AC-08, AC-09). No Work opens, as gallery AC-05 says. After every window has closed, the new version runs with no update notice | as before | — |
| loading / empty | N/A: this feature adds no loading or empty state of its own. The reopen spinner and the empty start screen are the gallery's and open-and-view's | — | — |
| validation | N/A: the feature has no typed input | — | — |

```text
01-a  start screen, install offered (tab, no Work)
+--------------------------------------------------------------------------------------+
| imgly                                                                (Install app)  |  InstallAction, BaseButton ghost, last
+--------------------------------------------------------------------------------------+
|                                   [ Open image ]                                     |  EmptyCanvas band (unchanged)
|                        or drop an image anywhere in this window                      |
|--------------------------------------------------------------------------------------|
|  Gallery                                                       3 of 20 places used   |  GalleryStart (unchanged)
|  ...                                                                                 |
+--------------------------------------------------------------------------------------+
```

```text
01-b  editor with a Work, install offered, update waiting
+--------------------------------------------------------------------------------------+
| imgly   [Gallery] [Open image]  (↶)(↷)  [Crop] [Adjust] [Draw] [Export] (Install app) |  top bar, "Install app" last
+--------------------------------------------------------------------------------------+
|                                                                                      |
|                                   canvas                                             |
|                                                                                      |
|                                         +------------------------------------------+ |
|                                         | A new version of imgly is available.     | |  Toast lasting, slot app-update
|                                         |                     (Reload)          ×  | |  action ghost + Dismiss
|                                         +------------------------------------------+ |
+--------------------------------------------------------------------------------------+
| 4096 × 3072 px                                                         Fit  [-] [+] |  status bar (unchanged)
+--------------------------------------------------------------------------------------+
```

### SCR-02 — Browser install confirmation

The browser's own install question. It is drawn by the browser, not designed by us, and its look and wording differ between Chrome and Edge.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | "Install app" chosen on SCR-01 (Critical flow 3, AC-01). The app calls `prompt()` only from that click (`sad.md` §8 security) | — (browser UI) | — |
| accepted | The Portfolio reviewer installs (AC-01) | → SCR-03, and SCR-01 `installed` | — |
| dismissed | The reviewer closes or declines it (AC-03) | → SCR-01 `install dismissed` | — |
| error | The confirmation can't show (the stored offer was already used or refused), or no installation follows an acceptance (`INSTALL_FAILED`, AC-03) | → SCR-01 `install failed` + SCR-07 | — |
| loading / empty / validation | N/A: browser-owned, nothing of ours is drawn | — | — |

### SCR-03 — Installed app window

SCR-01 in its own window, started from the operating system's list of apps or right after installing. The window title is "imgly", from the web app manifest's `name` (unchanged).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | Display mode `standalone` (Critical flow 4 `Installed app`, AC-04). The top bar never shows "Install app", whatever the browser's offer does. Every other state is SCR-01's, apart from those about installing | `EditorTopBar` without `InstallAction` | wireframe 03-a |
| offer arrives | The browser offers installation again while this window is open, for example after the app was removed from another browser profile (AC-04) | as `default`, no change | — |
| offline start | The Installed app is started without a connection after its first load (spec §6, 100 % on Chromium). It starts on its stored version, and no notice and no error appear (AC-15) | as `default` | — |
| update states | The same SCR-05, SCR-06 and SCR-07 states as SCR-01 (AC-06: "in a tab or as the Installed app") | as SCR-01 | — |
| error / empty / loading / validation | N/A: no state of its own beyond SCR-01's | — | — |

```text
03-a  Installed app window (own window, no address bar)
+--------------------------------------------------------------------------------------+
| ●●●                                  imgly                                           |  system title bar
+--------------------------------------------------------------------------------------+
| imgly   [Gallery] [Open image]  (↶)(↷)  [Crop] [Adjust] [Draw] [Export]              |  no "Install app", ever
+--------------------------------------------------------------------------------------+
|                                   canvas                                             |
+--------------------------------------------------------------------------------------+
```

### SCR-04 — Offline-ready notice

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default | The browser has stored every file the app needs to start and edit offline, for the first time in this browser or after the browser cleared them (Critical flow 5 `every file stored`, AC-05). It closes by itself after 6000 ms, like every `info` notice | `Toast` `info` | wireframe 04-a |
| not shown | An App update, files already stored before this release, or storing that failed or didn't finish (Critical flow 5 other branches, AC-05). No notice, and the next start tries again in the failed case | — | — |
| error / empty / loading / validation | N/A: a one-time `info` notice, with nothing to fail visibly (a failed store shows nothing, AC-05) | — | — |

```text
04-a  offline-ready
+------------------------------------------+
| imgly is ready to work offline.       ×  |  Toast info, closes after 6 s
+------------------------------------------+
```

### SCR-05 — Update notice

One `Toast` of the new kind `lasting` in the `app-update` slot. It has no timeout, and its "Reload" can leave it open. Its wording follows the feature store's `updateNotice`. `reload-to-save` wins over `updated-elsewhere`, which wins over `available` (`sad.md` §5).

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default (available) | A newer version has downloaded and waits, and this waiting version wasn't dismissed in this page (Critical flow 6 `a newer version`, AC-06). It doesn't disappear by itself | `Toast` `lasting` + action "Reload" | wireframe 05-a |
| updated elsewhere | Another window switched versions under this one (Critical flow 2 `controllerchange`, AC-14). Replaces any update notice in place, and shows even after a dismissal | `Toast` `lasting` + action "Reload" | wireframe 05-b |
| reload to keep saving | The newer version changed the Gallery's storage, and this window stopped saving (Critical flow 2 `storageSuperseded`, AC-14). Replaces the notice in place, and shows even after a dismissal | `Toast` `lasting` + action "Reload" | wireframe 05-c |
| waiting for a save | "Reload" chosen while Autosave stores the Work (Critical flow 1 wait step, AC-11). The action reads "Reloading…" with a `Spinner` and is `aria-disabled`. The Editor keeps working. When the save ends, the checks run again and move to one of the states below | `Toast` `lasting` + busy action (`Spinner`) | wireframe 05-d |
| refused | A tool is open or an Export runs (Critical flow 1 first two branches, AC-10, AC-13). The notice stays as it was, "Reload" is enabled again, and a refusal notice is pushed (→ SCR-07) | `Toast` `lasting` · `Toast` `failure` | wireframe 07-a |
| confirming | Edits not stored in the Gallery (Critical flow 1 third branch, AC-12, and AC-14 after saving stopped). SCR-06 opens over it, and the notice stays under the backdrop | → SCR-06 | — |
| reloading | Nothing to wait for or lose, or SCR-06 confirmed (AC-07, AC-12). The action keeps "Reloading…" until the page reloads, which happens within this window | `Toast` `lasting` + busy action | wireframe 05-d |
| dismissed | Dismiss chosen (Critical flow 6 `dismisses`, AC-09). Hidden until this page loads again. It comes back at once for a still newer waiting version, or with the `updated elsewhere` or `reload to keep saving` wording | — | — |
| ignored | The Editor keeps working (AC-09). The notice stays. The next start after every window has closed runs the new version, with no notice | `Toast` `lasting` | wireframe 05-a |
| check failed | Offline, or the check failed (Critical flow 6 first branch, AC-15). No notice and no error, and the state stays whatever it was | — | — |
| empty / validation | N/A: a notice, with no list and no input | — | — |

```text
05-a  available                                  05-b  updated elsewhere
+------------------------------------------+     +------------------------------------------+
| A new version of imgly is available.     |     | imgly was updated in another window.     |
|                     (Reload)          ×  |     | Reload to use the new version.           |
+------------------------------------------+     |                     (Reload)          ×  |
                                                 +------------------------------------------+

05-c  reload to keep saving                      05-d  waiting for a save / reloading
+------------------------------------------+     +------------------------------------------+
| imgly was updated in another window.     |     | A new version of imgly is available.     |
| Reload this window to keep saving to the |     |              (◌ Reloading…)           ×  |  action aria-disabled + Spinner
| Gallery.                                 |     +------------------------------------------+
|                     (Reload)          ×  |
+------------------------------------------+
```

The `lasting` look is the `info` look (a `--color-accent` left border, `role="status"`, polite). It differs only in that it never times out.

### SCR-06 — Reload confirmation

`ReloadDialog`, composed from `Dialog` and two `BaseButton`s, like `ReplaceDialog`.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| default (a Stored state exists) | "Reload" with edits not stored in the Gallery, and an earlier Stored state of the Work exists (Critical flow 1 `confirm` with an id, AC-12, AC-14). The body says what's lost and what comes back | `Dialog` · `BaseButton` secondary "Cancel" · `BaseButton` primary "Reload" | wireframe 06-a |
| default (no Stored state) | The same, but the Work was never stored in the Gallery, for example because the Gallery is unavailable (Critical flow 1 `confirm` with none, AC-12). The body says the image won't come back | as above | wireframe 06-b |
| cancelled | "Cancel", `Esc` or a backdrop click (Critical flow 1 `cancel`, AC-12). The Work, its Edit history and the update notice stay as they were. Focus returns to "Reload" | → SCR-05 (as it was) | — |
| confirmed | "Reload" (Critical flow 1 `confirm`, AC-12). The marker is written only when a Stored state exists, then the page reloads | → SCR-05 `reloading` | — |
| loading / error / empty / validation | N/A: a two-button question. A reload can't fail visibly, because the page is replaced | — | — |

```text
06-a  a Stored state exists                                06-b  never stored
+------------------------------------------------+         +------------------------------------------------+
| Reload and lose your latest edits?             |         | Reload and lose this image?                    |
|                                                |         |                                                |
| Your latest edits aren't saved in the Gallery  |         | This image isn't saved in the Gallery, so it   |
| and will be lost. The last saved version will  |         | won't come back after the reload. Export it    |
| reopen. Export the image first to keep them.   |         | first to keep it.                              |
|                                                |         |                                                |
|                       [Cancel]  [■ Reload ■]   |         |                       [Cancel]  [■ Reload ■]   |
+------------------------------------------------+         +------------------------------------------------+
  initial focus: Cancel                                       initial focus: Cancel
```

### SCR-07 — Refusal and failure notices

One `failure` notice per case. Each stays until dismissed, and the update notice, where shown, stays beside it.

| State | Trigger / condition | Components (from the inventory) | Source-ref |
|---|---|---|---|
| tool open | "Reload" while a tool is open with its Draft (Critical flow 1 `a tool is open`, AC-10) | `Toast` `failure` | wireframe 07-a |
| export running | "Reload" while an Export runs, from choosing to export until the file is saved or cancelled (Critical flow 1 `an Export is running`, AC-13) | `Toast` `failure` | wireframe 07-a |
| install failed | `INSTALL_FAILED` (Critical flow 3 last branch, AC-03) | `Toast` `failure` | — |
| part unavailable | `APP_PART_UNAVAILABLE` in an outdated window (Critical flow 2 `alt`, AC-14) | `Toast` `failure` | — |
| reopen failed: damaged | `WORK_DAMAGED` when reopening after the update (Critical flow 1 `damaged`, AC-08). This is the gallery's existing notice with "Delete…", unchanged | `Toast` `failure` with action "Delete…" | gallery wireframe 01-e |
| reopen failed: evicted | The marked Work is no longer in the Gallery (Critical flow 1 `evicted`, AC-08). The Work's name is gone with its record, so the notice names none | `Toast` `failure` | wireframe 07-b |
| reopen failed: can't be read | The record can't be read, or the Gallery is unavailable in this window (§Source, design source) | `Toast` `failure` | — |
| repeated | The same refusal again, for example "Reload" twice with a tool open. The earlier notice of the same text is dismissed first, so they don't pile up | `Toast` `failure` | — |
| loading / empty / validation | N/A: notices only | — | — |

```text
07-a  a refused Reload: the update notice stays, the refusal follows
+------------------------------------------+
| A new version of imgly is available.     |  Toast lasting (unchanged)
|                     (Reload)          ×  |
+------------------------------------------+
| Apply or cancel the open tool first.  ×  |  Toast failure, --color-danger border
+------------------------------------------+

07-b  reopen failed after the update: start screen, no Work open
+--------------------------------------------------------------------------------------+
| imgly                                                                                |
+--------------------------------------------------------------------------------------+
|                                   [ Open image ]                                     |
|  Gallery                                                       2 of 20 places used   |
|  ...                                    +------------------------------------------+ |
|                                         | The image you had open couldn't be       | |
|                                         | reopened: it was removed from the        | |
|                                         | Gallery to make room.                 ×  | |
|                                         +------------------------------------------+ |
+--------------------------------------------------------------------------------------+
```

## Message catalog

The seed for `src/features/pwa-install-update/messages.ts`, and for the `APP_PART_UNAVAILABLE` wording in each worker owner's `messages.ts` (`sad.md` §5). **info** notices dismiss themselves after 6000 ms, **failure** notices stay until dismissed, and **lasting** notices stay until dismissed and survive their own action. No raw browser error text is ever shown.

| Kind | Code / trigger | AC | Copy |
|---|---|---|---|
| button | top bar | AC-01 | Install app (tooltip "Install imgly as an app on this computer") |
| failure | `INSTALL_FAILED` | AC-03 | imgly couldn't be installed. Try installing it from the browser's menu instead. |
| info | first offline-ready | AC-05 | imgly is ready to work offline. |
| lasting + action | update `available` | AC-06 | A new version of imgly is available. Action: **Reload** |
| lasting + action | update `updated-elsewhere` | AC-14 | imgly was updated in another window. Reload to use the new version. Action: **Reload** |
| lasting + action | update `reload-to-save` (replaces `infoNewerVersion()`) | AC-14 | imgly was updated in another window. Reload this window to keep saving to the Gallery. Action: **Reload** |
| action (busy) | Reload waiting for a save, or reloading | AC-11, AC-07 | Reloading… (the `Spinner` is `aria-hidden`; the button is named "Reloading…" once) |
| failure | Reload with a tool open | AC-10 | Apply or cancel the open tool first. |
| failure | Reload during an Export | AC-13 | Wait for the export to finish, then reload. |
| failure | `APP_PART_UNAVAILABLE` | AC-14 | imgly was updated in another window. Reload this window to continue. |
| failure | reopen after the update: evicted | AC-08 | The image you had open couldn't be reopened: it was removed from the Gallery to make room. |
| failure | reopen after the update: can't be read or Gallery unavailable | AC-08 | The image you had open couldn't be reopened. Open it from the Gallery if it's there. |
| failure + action | reopen after the update: `WORK_DAMAGED` | AC-08 | (gallery, unchanged) “{name}” can't be opened: its stored data is damaged. Action: **Delete…** |
| dialog | SCR-06, a Stored state exists | AC-12 | Title "Reload and lose your latest edits?" · body "Your latest edits aren't saved in the Gallery and will be lost. The last saved version will reopen. Export the image first to keep them." · Cancel · Reload |
| dialog | SCR-06, never stored | AC-12 | Title "Reload and lose this image?" · body "This image isn't saved in the Gallery, so it won't come back after the reload. Export it first to keep it." · Cancel · Reload |

## New components

**Shared primitives** go to `src/shared/ui/` and `src/shared/notices/`, and `implement` registers each change in `docs/design-system.md` §Component inventory. **Feature composites** go to `src/features/pwa-install-update/` and stay out of the shared inventory. One shared primitive is extended. No new shared primitive and no new token are needed.

| Component | Why no existing primitive fits | Registered in design-system |
|---|---|---|
| `Toast` + `ToastStack` + `useNotices` (extended: kind `lasting`, `slot`, keep-open action, busy action) | AC-06 needs a notice that never times out, and `info` closes after 6000 ms while `failure` reads as an error. AC-10, AC-12 and AC-13 need "Reload" to leave the notice open, but today's action always dismisses. AC-14 needs at most one update notice, with the newer replacing the older in place, and `pushAll` only appends. AC-11 needs the action to show it is waiting. So `NoticeKind` gains `'lasting'` (the `info` look, no timeout), `NoticeInput` gains `slot?: string` (a push into an occupied slot replaces that notice in place, keeping its id's position), `action.run` may return `'keep-open'`, and `action.busy?: boolean` renders the action as an `aria-disabled` `BaseButton` with a `Spinner` and its busy label. Existing callers keep their behaviour | registered |
| `InstallAction` (feature composite) | `BaseButton` ghost "Install app", rendered only while an offer is held and the window is not the Installed app, mounted last in the top bar's `actions` slot, like `ExportAction` | n/a (feature-local) |
| `ReloadDialog` (feature composite) | SCR-06, composed from `Dialog` and `BaseButton` ×2, with two bodies, like `ReplaceDialog` | n/a (feature-local) |
