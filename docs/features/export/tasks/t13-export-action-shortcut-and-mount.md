---
id: T13
title: "Mount the Export action in the editor top bar with its states, the Ctrl/Cmd+S shortcut and the exporting lock"
layer: "wiring"
deps: ["T12"]
blocks: ["T15"]
acs: ["AC-11", "AC-17"]
files_hint: ["src/features/export/ExportAction.vue", "src/features/export/shortcuts.ts", "src/features/export/ExportAction.test.ts", "src/features/export/index.ts", "src/features/editor/components/EditorTopBar.vue", "src/features/editor/EditorView.vue", "src/app/App.vue", "docs/design-system.md"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 73 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Mount the Export action in the editor top bar with its states, the Ctrl/Cmd+S shortcut and the exporting lock

## Place in the sequence

- **Blocked by:** T12 — Build the export panel (SCR-03) in every state on the export store and the new primitives.
- **Blocks:** T15 — Write the functional e2e suite: format honesty, fidelity, quality and size, naming, metadata, downloads and Save as….
- **Wave:** 7 — after T12.
- **Lane:** shares `docs/design-system.md`, `src/features/export/index.ts` with T8, T10, T11, T12 — serialized.

## Why (user story)

> **US-08: Export on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find and complete the export without instructions  
> **So that** I can judge the open, edit and save flow end to end
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

> **US-05: Know that my work is saved**
>
> **As a** Editor  
> **I want** a successful export to count as saving my Work  
> **So that** I am not asked to confirm replacing a Work whose edits I have already saved, and I am still asked when I have not
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It puts Export where a first-time reviewer looks for it, makes Ctrl/Cmd+S do the right thing in every state, and shows the lock while an export runs.

## Inlined context

> - `EditorTopBar` gets a named slot for actions next to "Open image"; `src/app/App.vue` fills it with the export feature's `ExportAction`.
>
> — `sad.md §5, Cross-feature changes bullet 4, verbatim` · full text: [sad.md](../sad.md)

> | Concept | Convention | Where defined |
> |---|---|---|
> | Keyboard and focus | Export is a focusable button; Ctrl/Cmd+S is intercepted at the window with `preventDefault` in every state, so the browser's "Save page" never opens (AC-17). Enter in the quality or size field only applies the value | `docs/design-system.md`; here |
>
> — `sad.md §8, verbatim` · full text: [sad.md](../sad.md)

> | State | Trigger / condition | Components (from the inventory) | Source-ref |
> |---|---|---|---|
> | default | A Work is open (open-and-view), no export running. Export is visible next to the canvas and reachable by keyboard (AC-17) | `EditorTopBar` with `BaseButton` secondary "Open image" + `ExportAction` (`BaseButton` primary "Export") · `PreviewCanvas` · `EditorStatusBar` · `ToastStack` | wireframe 01-a |
> | loading (exporting) | From confirm until the export ends, including while SCR-04 is open (AC-11, `sad.md` §6 "While an export runs"). "Open image", Export and the editing controls are disabled. Export shows progress. The canvas has no overlay: zoom and pan keep working, and the View does not change the file (AC-03) | `ExportAction`: `BaseButton` primary disabled, label "Exporting…" + `Spinner` · "Open image" `BaseButton` disabled · `PreviewCanvas` live | wireframe 01-b |
> | drop while exporting | A file is dropped during an export (AC-11). It is not opened. This is the only action that shows a notice; a disabled control does nothing | as `loading` + `Toast` `info` "Wait for the export to finish…" (→ §Message catalog). No `DropOverlay` while exporting | wireframe 01-b |
>
> — `screens.md §SCR-01, verbatim` · full text: [screens.md](../screens.md)

> | State | Trigger / condition | Components (from the inventory) | Source-ref |
> |---|---|---|---|
> | default | No Work is open (AC-17). Export is shown but unavailable: it stays focusable (`aria-disabled`, not `disabled`) so the keyboard user can reach it and hear why, and its accessible description is the hint | `EditorTopBar` with `ExportAction` (`BaseButton` primary, `aria-disabled`, styled disabled) · open-and-view's `EmptyCanvas` unchanged | wireframe 02-a |
> | hint | Export activated, or `Ctrl/Cmd+S` pressed, with no image open (AC-17). The browser's "Save page" never opens | as `default` + `Toast` `info` "Open an image first to export it." | wireframe 02-a |
>
> — `screens.md §SCR-02, verbatim` · full text: [screens.md](../screens.md)

> | Key | Where | Action | AC |
> |---|---|---|---|
> | `Ctrl/Cmd+S` | SCR-01, panel closed | Opens the export panel. Never the browser's "Save page" | AC-17 |
> | `Ctrl/Cmd+S` | SCR-03 idle | Confirms, like the confirm button, after applying a value still being typed | AC-17 |
> | `Ctrl/Cmd+S` | During an export | Does nothing (the browser's "Save page" still never opens) | AC-17 |
> | `Ctrl/Cmd+S` | SCR-02 | Shows the "open an image first" notice | AC-17 |
>
> — `screens.md §Keyboard, verbatim` · full text: [screens.md](../screens.md)

> - **One deviation from the canon, deliberate:** `docs/design-system.md` §Loading puts a spinner overlay on the canvas while exporting. Here the progress is on the Export button and in the panel instead, and the canvas has no overlay, because AC-11 keeps zoom and pan available during an export and the Preview must stay unobstructed. `implement` updates the canon's Loading line when it lands.
>
> — `screens.md §Source, deviation from the canon, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** Features never import each other. They coordinate through the `editor` store
>
> — `CLAUDE.md §Module boundaries, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Fixed by this breakdown:** `EditorTopBar` gets `<slot name="actions" />` after "Open image"; `EditorView` forwards it as `<slot name="top-bar-actions" />`; `App.vue` fills it with `ExportAction` from `@/features/export`. "Open image" is disabled while `editor.phase === 'exporting'`. The Ctrl/Cmd+S listener is installed by `ExportAction` on mount (window, `keydown`, capture) and removed on unmount.
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-11 — cross-context

> **Given** an export is in progress, from the moment the Editor confirms in the panel, including while the "Save as…" dialog is open
> **When** the Editor tries to edit the Work, open another image, or start a second export
> **Then** these actions are unavailable until the export has finished or failed, and they are refused, not queued: "Open image", Export and the editing controls are visibly disabled, and Export shows the progress. A file dropped during an export is not opened, and a notice asks the Editor to wait for the export to finish; only a drop shows this notice. A progress indicator is shown. Zooming and panning stay available. The file contains the Work exactly as it was at the moment the Editor confirmed in the panel
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to save it
> **Then** an "Export" action is visible next to the canvas and reachable by keyboard: it can be reached with Tab and activated with Enter or Space, and Ctrl+S (Cmd+S on a Mac) opens the export panel instead of the browser's "Save page". The export completes in at most three steps: Export, choose a format (no step when the default fits), confirm. Where the browser has a "Save as…" dialog, the confirm in the panel opens the dialog and saving there completes the same step. With no image open, Export is unavailable and its hint says to open an image first; Ctrl/Cmd+S then shows the same hint and never opens the browser's "Save page". While the export panel is open and no export is running, Ctrl/Cmd+S confirms it, like the confirm button. During an export (AC-11), Ctrl/Cmd+S does nothing. Enter in the quality or size field only applies the value as if the Editor had left the field and does not start the export; Enter or Space on the confirm button confirms. Confirming, by the confirm button or Ctrl/Cmd+S, first applies a value still being typed in the quality or size field as if the Editor had left the field (AC-04, AC-05), so the file always has the values the panel shows. The panel stays open during an export, showing the progress with its controls disabled, and closes when the export succeeds. After a cancelled dialog or a refusal (AC-01b, AC-10, AC-12, AC-13, AC-14) it stays open with the same choices, except that a format refused by AC-12 is replaced by PNG, so trying again is one confirm. Escape or a click outside closes the panel only when no export is running
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add the named `actions` slot to `EditorTopBar.vue`, forward it from `EditorView.vue`, and disable "Open image" while exporting — `src/features/editor/components/EditorTopBar.vue`, `src/features/editor/EditorView.vue`
- [ ] Write `ExportAction.vue`: `BaseButton` primary "Export"; no Work → `aria-disabled` + accessible hint, activation raises "Open an image first to export it."; exporting → disabled "Exporting…" + `Spinner`; otherwise toggles the panel, rendering `ExportPanel` anchored to itself — `src/features/export/ExportAction.vue`
- [ ] Write `shortcuts.ts`: Ctrl/Cmd+S always `preventDefault`; no Work → hint notice; exporting → nothing; panel open → `store.confirm()`; else open the panel — `src/features/export/shortcuts.ts`
- [ ] Mount `ExportAction` into the slot from `src/app/App.vue` through `@/features/export` (index only)
- [ ] Update the canon's Loading line (progress on the Export button and panel while exporting, no canvas overlay) — `docs/design-system.md`
- [ ] Component tests: Tab/Enter/Space reach and activate Export, each Ctrl/Cmd+S row, the disabled states during an export — `src/features/export/ExportAction.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Ctrl/Cmd+S with no image | "Open an image first to export it." notice; the browser's Save page never opens |
| Ctrl/Cmd+S during an export | `preventDefault`, nothing else |
| Ctrl/Cmd+S with a value typed in a panel field | applied first (flush), then confirm |
| Export activated by keyboard on SCR-02 | focusable (`aria-disabled`), hint announced, notice shown |
| Drop during an export | the editor's "Wait for the export to finish…" notice (T4), no `DropOverlay` |
| Zoom / pan during an export | still work; no canvas overlay |

## Definition of Done

- [ ] Component tests prove Export is reachable with Tab and activated with Enter or Space, and every Ctrl/Cmd+S row of screens.md §Keyboard (AC-17)
- [ ] Component tests prove "Open image" and Export are disabled with progress shown during `exporting` and enabled again after (AC-11)
- [ ] `docs/design-system.md` Loading line updated; every Hard Rule inlined above still holds (export imports the editor only through `@/features/editor`)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
