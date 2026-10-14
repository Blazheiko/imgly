---
id: T12
title: "Wire Autosave into the editor store: save after replace, commit, undo and redo only; the replace gate waits for settled() and asks only when the latest state is unstored or the Gallery is unavailable; expose saving, galleryAvailable and openWorkId, and widen PanelId with 'gallery'"
layer: "app"
deps: ["T11"]
blocks: ["T13", "T14", "T18"]
acs: ["AC-01", "AC-02", "AC-09", "AC-12", "AC-16", "AC-17"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/store.test.ts", "src/features/editor/index.ts", "src/features/editor/testing.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 77 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Wire Autosave into the editor store: triggers, the replace gate, and the new getters

## Place in the sequence

- **Blocked by:** T11 — Compose autosave.ts.
- **Blocks:** T13 — Add reopenWork(id) to the editor store · T14 — Add EditorView's slots, the leave warning and the reworded ReplaceDialog · T18 — Add the Gallery e2e hooks.
- **Wave:** 4.
- **Lane:** shares `src/features/editor/store.ts`, `store.test.ts` and `index.ts` with T13 — serialized.

## Why (user story)

> **As an** Editor
> **I want** opening another image to ask for confirmation only when I would really lose something
> **So that** autosave saves me clicks instead of adding them
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It makes every applied change reach Autosave and narrows the replace confirmation to unstored edits.

## Inlined context

> - `replace()` hands the new Work to Autosave after the swap, which is how a new image enters the Gallery only once it has replaced the open Work (AC-09). `edits.commit`, `undo` and `redo` hand over the Work after each change. Nothing else does: View changes, open Drafts and Applies that do not count as an edit never reach Autosave (AC-02).
> - The replace gate in `openImage` and in the new `reopenWork(id)` waits for Autosave to settle once the new image or Work has been read. It then asks (`phase = 'confirming'`) only when the Work has Unsaved edits and its latest revision is not the stored one, or the Gallery is unavailable (AC-12, AC-16, AC-17).
> - The store exposes `saving`, `galleryAvailable`, `openWorkId` (the id that the Gallery must never delete or evict, AC-07) and `reopenWork`.
>
> — `adr/0001 §Decision outcome, How it works bullets 2, 3, 5, verbatim` · full text: [adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md](../adr/0001-own-autosave-and-reopen-in-the-editor-store-and-keep-the-gallery-feature-to-the-ui.md)

> ```
> alt refused or unreadable → Work unchanged, reason shown, no dialog, nothing stored
> else read successfully
>     S->>S: wait until no save is running or pending
>     alt no Unsaved edits, or their latest state is stored → replace without asking, discard an open tool's Draft
>     else latest state not stored (save failed) or Gallery unavailable → ask for confirmation
>         cancel → Work unchanged, the new image dropped, nothing stored, nothing evicted
>         confirm → replace, discard an open tool's Draft
>     opt replaced and the Gallery is available → new Work with a new id, queue its first save (Flow 1)
> ```
>
> — `sad.md §6, Flow 5, abridged` · full text: [sad.md](../sad.md)

> The overlay sets `editor.activePanel` to `'gallery'` (`PanelId` widens to `'export' | 'gallery'`), so the existing "a panel is open" guards make every tool, Undo, Redo, Export and `Ctrl/Cmd+O` shortcut do nothing while it shows.
>
> — `screens.md §Shell changes, Overlay bullet, abridged` · full text: [screens.md](../screens.md)

> | Regression in the replace path. Open-and-view, crop-rotate and undo-redo tests assume "Unsaved edits → confirm", and the gate now also waits for a running save | Medium | Change the existing tests deliberately, not by loosening them. The editor store tests cover every gate branch (QG-4), and the existing e2e replace flows run unchanged on all three engines | Tech Lead |
>
> — `sad.md §11, replace-path regression row, verbatim` · full text: [sad.md](../sad.md)

**Code facts (breakdown time):** `openImage` (store.ts ~278) decodes, then today asks whenever `workHasUnsavedEdits(work)`; `confirmReplace`/`cancelReplace` follow; `replace()` (~382) swaps via `createWork(..., newId(), ...)` and `edits.clear`; `PanelId = 'export'` at line 82. The `waiting` state keeps `phase = 'reading'` so open-and-view's spinner stays (screens SCR-05 `waiting for save`).

> **Hard rule:** Features never import each other. They coordinate through the `editor` store […] and there is no event bus.
>
> — `CLAUDE.md §Module boundaries, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Saves reach `works`, `originals`, `layers` and `meta` only through T11's Autosave.

## API contract

Internal — no API surface. New store getters (ADR-0001): `saving: boolean`, `galleryAvailable: boolean`, `openWorkId: string | null`, plus `connectGallery(result)` forwarded from Autosave (breakdown-time choice; App.vue calls it in T17). `PanelId = 'export' | 'gallery'`.

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** the Editor has opened a photo and applied a Crop, a change in "Adjust" and a drawing
> **When** the Editor reloads the page, closes and reopens the tab, or opens another image, at least two seconds after the last Apply and at least three seconds after the photo opened
> **Then** the Gallery holds that Work with all three changes, its thumbnail shows the image with all of them, and it is listed first as the most recently opened or changed Work. Autosave stored the Work once when the photo opened and again after each Apply, without the Editor doing anything and without interrupting editing
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 (US-01) — domain invariant

> **Given** the Editor has applied a drawing, undone it, zoomed into the Preview and opened "Draw" again with strokes that are not applied
> **When** the page is reloaded and the Editor reopens the Work from the Gallery
> **Then** the Work has no drawing, because the Undo was stored like any Step, and none of the unapplied strokes, because an open tool's Draft is never stored. The Preview is fitted to the screen, not zoomed, because the View is never stored, and Undo and Redo are unavailable, because the Edit history is never stored
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-09 (US-05) — domain invariant

> **Given** the Gallery holds 20 Works, with or without one of them open in this tab
> **When** the Editor opens a new image and it replaces the open Work
> **Then** the new image enters the Gallery only once it has replaced the open Work, as a new Work even if the same file was opened before, and the least recently opened or changed Work that is not open in this tab is evicted, so the Gallery still holds 20 Works. The Work just replaced has been opened or changed more recently than the others, so it is not the one evicted unless it is the only candidate. A notice names the evicted Work and says it was removed to make room. If the replacement is cancelled or the image cannot be read, nothing is stored and nothing is evicted
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-05) — authorization

> **Given** storage cannot be opened for this app when the page loads, for example in a private window or with site data blocked for the site
> **When** the Editor opens an image and edits it
> **Then** opening, editing and exporting work as before. The Gallery shows that it is unavailable in this browser window and why in plain words, nothing is stored, and the app does not try to store anything again until the page is next loaded. Replacing the Work asks for confirmation whenever the open Work has Unsaved edits, as open-and-view AC-15 always did
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-16 (US-06) — cross-context

> **Given** the open Work has Unsaved edits and Autosave has stored its latest applied state, or is storing it and then succeeds
> **When** the Editor opens another image by "Open image", by dropping a file or by choosing a Work in the Gallery, and it is read successfully
> **Then** if a save was still running, the replacement waits for it to finish. It then replaces the open Work without asking for confirmation, and the previous Work stays in the Gallery with all its applied edits. An open tool's unapplied changes are discarded with the old Work, as crop-rotate AC-17 already requires
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-17 (US-06) — cross-context

> **Given** the open Work has Unsaved edits that are not stored in the Gallery, because Autosave failed, including a save that was still running when the Editor chose and then failed, or because the Gallery is unavailable
> **When** the Editor opens another image or chooses a Work in the Gallery
> **Then** the app asks for confirmation before replacing it, saying the latest edits are not saved in the Gallery and would be lost. Cancelling keeps the Work exactly as it was. Choosing a Work that cannot be read never replaces the open Work and never asks (open-and-view AC-16)
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Compose `createAutosave` in the store; call `autosave.request(work)` at the end of `replace()`, after `edits.commit`, `undo` and `redo` — nowhere else (not `touch`, tool open, Draft, View) — `src/features/editor/store.ts`
- [ ] In `openImage`, after a successful decode and the supersede check: `await autosave.settled()`, re-check supersede, then ask only if `hasUnsavedEdits && (!galleryAvailable || !isStored(work))`
- [ ] Expose `saving`, `galleryAvailable`, `openWorkId`, `connectGallery`; widen `PanelId` to `'export' | 'gallery'`; re-export types — `src/features/editor/store.ts`, `src/features/editor/index.ts`
- [ ] Test helpers: a store factory on a fresh fake-indexeddb database with the codec handler, recording GL and fault wrapper — `src/features/editor/testing.ts`
- [ ] Store tests for every gate branch and trigger; update existing "Unsaved edits → confirm" tests deliberately (give them an unavailable Gallery or a failed save) — `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| refused or unreadable file | no wait, no dialog, nothing stored or evicted |
| a newer open supersedes one that is waiting for `settled()` | the older one returns `superseded`, its bitmap closed |
| the save running while the gate waits fails | the gate asks (AC-17) |
| no Unsaved edits | replaces without asking, whatever the save state |
| Gallery unavailable, Unsaved edits | asks, as open-and-view AC-15 |
| Cancel | Work, revision and the open tool's Draft unchanged; the read bitmap closed; nothing stored |
| `applyEdit` / `edits.touch` (test-only edit) | does not reach Autosave |

## Definition of Done

- [ ] one save is queued after a successful replace, commit, undo and redo; none after opening a tool, a Draft change, zoom or pan
- [ ] a cancelled or refused open stores and evicts nothing
- [ ] with a save held the gate waits, then replaces without asking
- [ ] after a failed save, a save that fails while waiting, or an unavailable Gallery with Unsaved edits, the gate asks and Cancel keeps the Work, revision and Draft
- [ ] existing open-and-view, crop-rotate and undo-redo store tests are changed deliberately, not loosened
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
