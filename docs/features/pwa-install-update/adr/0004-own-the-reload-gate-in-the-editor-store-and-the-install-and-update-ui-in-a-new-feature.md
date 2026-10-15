---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-15"
feature_size: "S"
ticket: "roadmap step 9 — pwa-install-update"
---

# 0004 — Own the Reload gate in the editor store and the install and update UI in a new feature

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth)

## Context

Every "Reload" passes the same checks in a fixed order (ux-flows §Platform decisions). It waits for a running save, refuses while a tool is open or an Export runs, asks for confirmation when edits are not stored in the Gallery, and otherwise reloads (AC-07, AC-10 to AC-13). These are the Replace gate's rules applied to leaving the page (spec §1 ¶4, gallery AC-16, AC-17, AC-20). All the state they read lives in the `editor` store: `activeTool`, `phase`, Autosave's `settled()` and `isStored()`. Features never import each other (repo ADR 0002).

## Decision drivers

- spec §1 ¶4: the reload follows the same confirmation rule as the Replace gate
- spec AC-11: after a save finishes, every condition is checked again
- sad.md §1 quality goal 1: 0 Drafts and 0 applied changes lost without the Editor's confirmation
- sad.md §2: features coordinate through the `editor` store, and `src/app/` is the shell

## Considered options

1. **The `editor` store owns `requestReload()`, and a new `pwa-install-update` feature owns the UI and the update lifecycle.**
2. **Everything goes in the app shell** (`src/app/pwa.ts`, `App.vue`).
3. **Everything goes in the new feature**, which reads the `editor` store's state and runs the checks itself.

## Decision outcome

**Chosen:** Option 1, which matches how gallery ADR-0001 split Autosave (editor store) from the Gallery's UI (feature). The rules that decide whether the Work may be replaced or left stay in one place, so the Replace gate and the Reload gate cannot drift apart. Option 2 puts a business rule and a Pinia-less state machine into the shell, which CLAUDE.md keeps to wiring. Option 3 duplicates the "wait, then ask only for unstored edits" rule and needs `isStored()` exposed.

How it works:

- `editor.requestReload()` does nothing while `phase` is `reading` or `confirming`. Otherwise it awaits `settled()`, then returns `tool-open` when `activeTool` is set, `exporting` while `phase === 'exporting'`, and `confirm` when the open Work has Unsaved edits that are not stored. In every other case it returns `ready`. `confirm` and `ready` carry `reopenId`, the Work's id when it has a Stored state, else `null`.
- The feature store maps the outcome to its effects. `tool-open` and `exporting` raise their refusal notice and keep the update notice (AC-10, AC-13). `confirm` opens `ReloadDialog`, where Cancel changes nothing (AC-12). On `ready` or a confirmation, it calls `markReopen(reopenId)` when the id is not `null`, then activates the waiting worker or reloads the page (ADR-0001, ADR-0003).
- `src/features/pwa-install-update/` exports `InstallAction`, `ReloadDialog` and `usePwaInstallUpdate` from `index.ts`. `App.vue` mounts the components, and `src/app/pwa.ts` connects the service-worker client to the store.

## Consequences

**Positive**
- One rule set for leaving or replacing the Work, which is tested in one place.
- The new feature is UI and lifecycle only, and it reaches the editor through its public store API.

**Negative**
- The `editor` store gains one more public function and a `storageSuperseded` flag.

**Neutral**
- If a third "leave the Work" path appears, for example OS integration's "Open with…" (roadmap step 10), it reuses the same checks.

## Links

- Spec: [[../spec.md]] AC-07, AC-10, AC-11, AC-12, AC-13, §1
- SAD: [[../sad.md]] §4, §5, §6
- Related ADR: [[0001-hold-each-new-version-in-a-waiting-service-worker-until-the-editor-chooses-reload]], [[0003-keep-the-work-to-reopen-as-a-take-once-id-in-this-tabs-sessionstorage]]; gallery ADR-0001
