---
id: T14
title: "Add EditorView's start-screen and overlay slots and EditorTopBar's leading-actions slot, arm beforeunload only while saving, and reword ReplaceDialog"
layer: "ui"
deps: ["T12"]
blocks: ["T17"]
acs: ["AC-17", "AC-20"]
files_hint: ["src/features/editor/EditorView.vue", "src/features/editor/EditorView.test.ts", "src/features/editor/components/EditorTopBar.vue", "src/features/editor/components/ReplaceDialog.vue", "src/features/editor/components/ReplaceDialog.test.ts", "src/features/editor/messages.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 44 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — Add EditorView's start-screen and overlay slots and EditorTopBar's leading-actions slot, arm beforeunload only while saving, and reword ReplaceDialog

## Place in the sequence

- **Blocked by:** T12 — Wire Autosave into the editor store (provides `saving`).
- **Blocks:** T17 — Mount the Gallery in both homes (fills these slots).
- **Wave:** 5 — runs alongside T13 and T18.
- **Lane:** shares `src/features/editor/messages.ts` with T11 — serialized (T11 is already upstream).

## Why (user story)

> **As an** Editor
> **I want** every change I apply to be kept in this browser without my asking
> **So that** a reload, a closed tab, a crash or opening another image never costs me the edits I applied
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It gives the shell its Gallery mount points, warns on leave only while a save runs, and words the replace dialog for unstored edits.

## Inlined context

> - **Top bar** (`EditorTopBar`): […] "Open image" is rendered by `EditorTopBar` itself, so it gains a `leading-actions` slot before it, which `EditorView` forwards and `App.vue` fills with `GalleryAction`. On SCR-01 the Gallery is already on screen, so "Gallery" is absent from the top bar, as "Open image" is.
> - **Start screen** (SCR-01): `EditorView`'s new `start-screen` slot (`sad.md` §5) holds `GalleryStart` **under** open-and-view's `EmptyCanvas`. The drop zone becomes a band at the top of the canvas area, with `--space-8` padding above and below its "Open image" button and hint. The Gallery section follows below. The canvas area scrolls vertically when the entries don't fit.
> - **Overlay** (SCR-03): `EditorView`'s new `overlay` slot holds `GalleryOverlay`. It covers the canvas area and the status bar, under the top bar, with a `--color-surface` background.
>
> — `screens.md §Shell changes, Top bar + Start screen + Overlay bullets, abridged` · full text: [screens.md](../screens.md)

> | Leave warning | `EditorView` installs a `beforeunload` handler only while Autosave's `saving` is true, so reloading with a stored Work shows no warning (AC-20) | `src/features/editor/EditorView.vue` |
>
> — `sad.md §8, Leave warning row, verbatim` · full text: [sad.md](../sad.md)

> The browser's own "leave site?" prompt. It is not designed here: browsers ignore custom text, so the app sets none.
>
> — `screens.md §SCR-06, intro, verbatim` · full text: [screens.md](../screens.md)

> | default | The replace gate reached with Unsaved edits whose latest state is **not** stored: […] Modal over SCR-02 or SCR-03. Focus starts on **Cancel** | `ReplaceDialog` (`Dialog`): title "Replace the current image?", body "Your latest edits aren't saved in the Gallery and will be lost.", `BaseButton` secondary "Cancel" + `BaseButton` primary "Replace" | wireframe 05-a |
> | cancel | "Cancel", `Esc` or a backdrop click. The Work and View stay, the read image is dropped, nothing is stored and nothing evicted (AC-09) | → SCR-02 or SCR-03 unchanged | — |
>
> — `screens.md §SCR-05, rows default + cancel, abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** plain CSS with `<style scoped>`. Every colour, spacing value and font comes from `var(--…)` in `src/shared/styles/tokens.css`.
>
> — `CLAUDE.md §Conventions Styling, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. New slots for T17: `EditorView` `#start-screen` (rendered with no Work, under `EmptyCanvas`), `#overlay` (over canvas area + status bar), `#top-bar-leading-actions` forwarded to `EditorTopBar`'s new `#leading-actions` (slot names from `sad.md` §5 / screens; the forwarded name is a breakdown-time choice matching the existing `top-bar-actions`).

## Acceptance criteria

### AC-17 (US-06) — cross-context

> **Given** the open Work has Unsaved edits that are not stored in the Gallery, because Autosave failed, including a save that was still running when the Editor chose and then failed, or because the Gallery is unavailable
> **When** the Editor opens another image or chooses a Work in the Gallery
> **Then** the app asks for confirmation before replacing it, saying the latest edits are not saved in the Gallery and would be lost. Cancelling keeps the Work exactly as it was. Choosing a Work that cannot be read never replaces the open Work and never asks (open-and-view AC-16)
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-20 (US-01) — domain invariant

> **Given** Autosave is storing the open Work after an Apply, Undo or Redo
> **When** the Editor reloads the page or closes the tab before that save finishes
> **Then** the browser shows its own warning that leaving may lose changes. Staying lets the save finish. Once no save is running, reloading or closing the tab shows no warning, even when the Work has Unsaved edits, because they are stored in the Gallery
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `<slot name="leading-actions" />` before "Open image" — `src/features/editor/components/EditorTopBar.vue`
- [ ] Forward it, and add `start-screen` (no Work: `EmptyCanvas` as a band + the slot below, area scrolls) and `overlay` slots — `src/features/editor/EditorView.vue`
- [ ] `watch(() => editor.saving)`: add a `beforeunload` handler (`preventDefault()` + `returnValue = ''`, no custom text) when true, remove it when false and on unmount — `src/features/editor/EditorView.vue`
- [ ] Replace the dialog body with the catalog text — `src/features/editor/messages.ts`, `src/features/editor/components/ReplaceDialog.vue`
- [ ] Tests: slots render where stated; handler added/removed with `saving`; none with Unsaved edits and no save — `src/features/editor/EditorView.test.ts`; new body, Cancel/Esc/backdrop keep the Work — `src/features/editor/components/ReplaceDialog.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Unsaved edits, no save running | no `beforeunload` handler (AC-20) |
| `saving` flips true → false → true | exactly one handler installed at a time |
| EditorView unmounts while saving | handler removed |
| no Work open | `start-screen` slot shown; `overlay` and `leading-actions` content not shown (top bar has no actions on SCR-01) |
| ReplaceDialog with the Gallery unavailable | same body text (SCR-05 covers both reasons) |

## Definition of Done

- [ ] EditorView tests prove the start-screen slot renders under `EmptyCanvas` with no Work, the overlay slot renders over the canvas area, and leading-actions renders before "Open image"
- [ ] a `beforeunload` handler is added when `saving` turns true and removed when it turns false; none with Unsaved edits and no save
- [ ] ReplaceDialog test shows "Your latest edits aren't saved in the Gallery and will be lost.", with Cancel, Esc and backdrop keeping the Work
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
