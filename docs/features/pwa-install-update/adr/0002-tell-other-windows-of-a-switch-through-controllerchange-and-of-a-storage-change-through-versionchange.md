---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-15"
feature_size: "S"
ticket: "roadmap step 9 — pwa-install-update"
---

# 0002 — Tell other windows of a switch through controllerchange and of a storage change through versionchange

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth)

## Context

The app can be open in several windows, as tabs, as the Installed app, or both. When the Editor chooses "Reload" in one window, the waiting worker takes over for every window (ADR-0001). The spec requires every other window to say that imgly was updated in another window. It also requires an older window to stop saving once the newer version has changed how the Gallery is stored, instead of writing in the older shape (AC-14). Gallery ADR-0006 already makes an older tab close its database connection and stop saving on IndexedDB's `versionchange`, but it raises its own info notice.

## Decision drivers

- spec AC-14: every other window shows the notice, even after a dismissal. A window shows at most one update notice, and the newest replaces the one before
- spec §7 KPI: 0 windows left on an outdated version without a notice, in the two-window e2e flow
- sad.md §2: features coordinate through the `editor` store, with no event bus. Gallery ADR-0006 is the existing storage-change mechanism

## Considered options

1. **`controllerchange` plus `versionchange`.** The browser fires `controllerchange` in every window when the new worker activates. Gallery ADR-0006's `versionchange` covers the storage change, and it now raises a flag instead of a notice.
2. **`BroadcastChannel`.** The new version announces its build and schema version on a channel at start, and each window compares them with its own.
3. **Both.** `controllerchange` first, and `BroadcastChannel` as a backup for windows that no worker controls.

## Decision outcome

**Chosen:** Option 1. Both signals already exist and fire at exactly the moments AC-14 names: the version switch and the storage upgrade. Option 2 needs a build id in the bundle and a new cross-window protocol, which would need versioning of its own, and the first release's windows would not speak it. Option 3 doubles the paths to one notice and needs de-duplication, only to cover windows that a hard reload has left without a controller.

How it works:

- The feature store subscribes to `controllerchange` through `src/infra/platform/service-worker.ts`. When this window asked for the switch, it reloads. When the page loaded with no controller, it ignores the event, because a first install with `clientsClaim` fires it without any version switch (AC-05). Otherwise it sets the update notice to `updated-elsewhere`, even if the Editor had dismissed the `available` notice.
- `src/features/editor/autosave.ts` keeps ADR-0006's steps: let the running save finish, drop the pending one, close the connection and mark the Gallery unavailable. It sets `storageSuperseded` on the `editor` store instead of pushing `infoNewerVersion()`. The feature rewords the one update notice to `reload-to-save`.
- Autosave treats a codec worker that fails to load (`APP_PART_UNAVAILABLE`, an outdated window) the same way, and raises `storageSuperseded` instead of the could-not-save notice.
- After that, `isStored()` is false for every edit, so "Reload" asks for confirmation as AC-12 says.

## Consequences

**Positive**
- No new mechanism, no build id and no protocol to version.
- One owner, the feature store, decides the single update notice for all three wordings.

**Negative**
- A window that no service worker controls, for example after a hard reload that bypassed the worker, gets no `controllerchange`. It still stops saving on `versionchange` when the storage changes (§11).

**Neutral**
- A `BroadcastChannel` can be added later behind the same store state, if the hard-reload case turns out to matter.

## Links

- Spec: [[../spec.md]] AC-12, AC-14, §7
- SAD: [[../sad.md]] §4, §6, §8, §11
- Related ADR: [[0001-hold-each-new-version-in-a-waiting-service-worker-until-the-editor-chooses-reload]]; gallery [[../../gallery/adr/0006-close-an-older-tabs-database-connection-when-a-newer-version-upgrades-it]]
