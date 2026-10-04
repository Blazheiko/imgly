---
id: T13
title: "Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary"
layer: "ui"
deps: ["T7", "T10", "T12"]
blocks: ["T14", "T15", "T16", "T17"]
acs: ["AC-02", "AC-04", "AC-17"]
files_hint: ["src/features/editor/EditorView.vue", "src/features/editor/components/EditorTopBar.vue", "src/features/editor/components/EmptyCanvas.vue", "src/features/editor/components/DropOverlay.vue", "src/app/"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 72 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary

## Place in the sequence

- **Blocked by:** T7 — Add the platform intake: window drop guard, files from a DataTransfer, and the single-file picker, T10 — Add the notice queue and the shared UI primitives Spinner, Toast, ToastStack, Dialog and CanvasMessage, T12 — Add drop sequencing, the messages catalog and the notices raised by each open.
- **Blocks:** T14 — Build SCR-02's PreviewCanvas with the renderer, Fit on open, and the zoom and pan gestures, T15 — Build the status bar: Original dimensions readout, zoom controls with the live zoom level, and the zoom shortcuts, T16 — Build SCR-03, the replace confirmation dialog, on the store's confirming phase, T17 — Add the start-up capability gate and the blocking screens SCR-04, SCR-05 plus SCR-02's restoring state.
- **Wave:** 6 — after T7, T10, T12 (wave 5).
- **Lane:** shares `src/features/editor/EditorView.vue` with T14, T15, T16, T17 — serialized.

## Why (user story)

> **US-07: Understand the app on first visit**
>
> **As a** Portfolio reviewer  
> **I want** the empty app to show me clearly how to open an image  
> **So that** I can try it within seconds, without instructions
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

> **US-02: Drop an image onto the app**
>
> **As a** Editor  
> **I want** to drop an image file anywhere on the app window  
> **So that** I can open it without going through a file dialog
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It delivers the first impression: one primary Open image action, a one-line drop hint, whole-window drop feedback, and a drop that never makes the browser leave the app.

## Inlined context

> **Top bar** (`EditorTopBar`, height `--toolbar-size`). It shows the app name on the left and, only on SCR-02, the "Open image" action on the right.
> **Canvas area.** The SCR-01, SCR-02, SCR-04 and SCR-05 contents swap in here. Fit (AC-01) is measured against this region.
> Notices appear in `ToastStack` at the bottom right of the canvas area, above the status bar.
>
> — `screens.md §Shell shared by every screen, abridged` · full text: [screens.md](../screens.md)

> default | App load with graphics available […]. AC-17 | `EditorTopBar` (app name only) · `EmptyCanvas`: `BaseButton` primary "Open image" + one-line hint "or drop an image anywhere in this window" · `ToastStack`
> drag-over | Files dragged over the window […]. Dragging out returns to `default` | `DropOverlay` over the whole window: "Drop an image to open it"
> loading | File chosen in SCR-06 or dropped, and the read is in progress […]. "Open image" **stays enabled** and drops are still accepted, so a newer open supersedes this one (AC-16b) | `Spinner` overlay centred in the canvas area, labelled "Opening image" for screen readers · `EmptyCanvas` stays underneath
> error | The open was refused […]. Canvas unchanged, no confirmation asked | `EmptyCanvas` unchanged · `Toast` variant `failure` (stays until dismissed) in `ToastStack`
>
> — `screens.md §SCR-01, states default/drag-over/loading/error, abridged (wireframes 01-a…01-d)` · full text: [screens.md](../screens.md)

> | `Ctrl/Cmd+O` | Open image | Prevents the browser's own "open file". Works on SCR-01 and SCR-02 |
>
> — `screens.md §Keyboard, row 1, verbatim` · full text: [screens.md](../screens.md)

> features expose `index.ts` and are mounted from `src/app/App.vue`; plain CSS with tokens from `src/shared/styles/tokens.css`
>
> — `sad.md §2, Conventions, abridged` · full text: [sad.md](../sad.md)

> | `EditorTopBar` | Layout region: app name plus, on SCR-02, `BaseButton` "Open image" |
> | `EmptyCanvas` | The SCR-01 content: `BaseButton` primary + the one-line hint (AC-17) |
> | `DropOverlay` | Whole-window drop feedback with the editor's drop copy. It is shown only where drops are accepted (SCR-01, SCR-02) |
>
> — `screens.md §New components, feature composites, abridged` · full text: [screens.md](../screens.md)

> The window-level drop guard is always installed. On every screen a drop never navigates away from the app or shows the file in place of it (AC-02, AC-18).
>
> — `screens.md §Shell shared by every screen, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule (reuse):** All tokens are CSS custom properties in one file. A component or screen never hard-codes a colour, spacing value or font inline. It references `var(--…)`.
>
> — `design-system.md §Token source, verbatim` · full text: [design-system.md](../../../design-system.md)

> **Hard rule:** Every control (Open image, zoom in and out, Fit, 100%, the replace dialog, notice dismiss) is a focusable button with a visible focus ring; the replace dialog traps focus and returns it on close.
>
> — `sad.md §8, Keyboard and focus row, abridged` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — happy path

> **Given** the app is open, with or without an image
> **When** the Editor drops a Supported image anywhere on the app window
> **Then** the image opens exactly as in AC-01 (subject to AC-15 and AC-16 when a Work is open), and the app never navigates away or shows the file in place of itself
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-04 — error

> **Given** the app is open
> **When** the Editor drops something that is not an image file, such as a folder, a document or a link dragged from another browser tab
> **Then** nothing is opened or replaced, and a notice says that only image files can be opened
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — happy path

> **Given** a Portfolio reviewer opens the app for the first time and no image is open
> **When** the app finishes loading
> **Then** the canvas area shows one primary "Open image" action and a one-line hint that an image can also be dropped onto the app
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Reuse: `BaseButton` (inventory), `Spinner` / `ToastStack` (T10), `tokens.css` — no new primitive
- [ ] `EditorTopBar.vue`, `EmptyCanvas.vue`, `DropOverlay.vue` — `src/features/editor/components/`
- [ ] `EditorView.vue`: top bar + canvas area + `ToastStack`; SCR-01 when `work === null`; `Spinner` overlay while `phase === 'reading'` (Open image stays enabled)
- [ ] Wire intake: "Open image" button and `Ctrl/Cmd+O` (`preventDefault`) → `pickImageFile()` → `store.openFile`; `installDropGuard` → `filesFromDataTransfer` → `store.openDrop`; `DropOverlay` on drag-enter, hidden on leave/drop
- [ ] E2E test hooks for later tasks: `src/app/test-hooks.ts` exposes `window.__imglyTest = { work(), applyEdit() }` only when `import.meta.env.VITE_E2E_HOOKS === 'true'`; Playwright's web server builds with it
- [ ] Component tests (`@vue/test-utils`) + `e2e/open-and-view/empty-and-drop.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Drop of a `.txt` file on SCR-01 | SCR-01 unchanged, failure toast "Only image files can be opened.", URL unchanged (AC-04) |
| Folder dragged from Finder/Explorer | same as above |
| Drag enters then leaves without dropping | overlay appears, then disappears; nothing opens |
| Second file chosen while loading | spinner stays; the newer open supersedes (store, T11) |
| Narrow window (< 1024 px) | Open image still works (screens.md §Shell) |

## Definition of Done

- [ ] Component tests for SCR-01 states pass
- [ ] Playwright e2e on Chromium, Firefox and WebKit: first load shows one primary "Open image" + the hint (AC-17); dropping a non-image shows the AC-04 notice and the page URL never changes (AC-02/AC-04)
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
