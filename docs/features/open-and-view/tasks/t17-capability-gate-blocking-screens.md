---
id: T17
title: "Add the start-up capability gate and the blocking screens SCR-04, SCR-05 plus SCR-02's restoring state"
layer: "ui"
deps: ["T7", "T9", "T10", "T13"]
blocks: ["T19"]
acs: ["AC-18", "AC-19", "AC-19b"]
files_hint: ["src/render/capabilities.ts", "src/app/", "src/features/editor/EditorView.vue", "src/features/editor/store.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 57 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T17 — Add the start-up capability gate and the blocking screens SCR-04, SCR-05 plus SCR-02's restoring state

## Place in the sequence

- **Blocked by:** T7 — Add the platform intake: window drop guard, files from a DataTransfer, and the single-file picker, T9 — Handle WebGL context loss: restore from the kept bitmap within the deadline, else report DISPLAY_LOST, T10 — Add the notice queue and the shared UI primitives Spinner, Toast, ToastStack, Dialog and CanvasMessage, T13 — Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary.
- **Blocks:** T19 — Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal.
- **Wave:** 7 — after T7, T9, T10, T13 (wave 6).
- **Lane:** shares `src/features/editor/store.ts` with T11, T12, T20 — serialized; shares `src/app/` with T13 — serialized; shares `src/features/editor/EditorView.vue` with T14, T15, T16 — serialized.

## Why (user story)

> **US-08: Get an honest message when the browser can't render**
>
> **As a** Portfolio reviewer  
> **I want** to be told clearly when my browser can't display the editor, and to have the Preview come back by itself after a temporary graphics interruption  
> **So that** I don't judge the app on a blank or black canvas
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It replaces a blank or black canvas with an honest full-canvas message — for a browser that cannot render, and for graphics that could not recover — and shows a spinner while a restore is pending.

## Inlined context

> **Capability gate at start-up** (`src/render/capabilities.ts`): a WebGL2 context, `MAX_TEXTURE_SIZE` ≥ 4096, `createImageBitmap` and `OffscreenCanvas` 2D in a worker. Any missing → SCR-04 (AC-18). The window-level drop guard is installed before the gate, so a drop never navigates away even on SCR-04.
>
> — `adr/0003 §Decision outcome, How it works bullet 3, verbatim` · full text: [adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md](../adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md)

> The gate runs once per page load; nothing in it depends on the user agent string.
>
> — `sad.md §6, Flow 6 note, verbatim` · full text: [sad.md](../sad.md)

> default | […] `EditorTopBar` (app name only; "Open image" is absent) · `CanvasMessage` (role `status`): "This browser can't display the editor." / "The editor needs WebGL2 graphics, which this browser doesn't support or has turned off. Try a current version of Chrome, Edge, Firefox or Safari."
> drag-over / drop | Files dragged or dropped onto the window (AC-18) | No `DropOverlay`. Nothing opens, the browser never navigates away, and the same message stays
>
> — `screens.md §SCR-04, rows default + drag-over/drop, abridged` · full text: [screens.md](../screens.md)

> default | […] This replaces the canvas area, and the status bar is hidden. Focus moves to "Reload page" | `EditorTopBar` (app name only) · `CanvasMessage` (role `alert`): "The display couldn't recover." / "Your graphics were interrupted and the editor couldn't restore them. Reload the page to continue. The open image and any edits will be lost." + `BaseButton` primary "Reload page"
> drag-over / drop | Files dragged or dropped onto the window | Ignored, with no `DropOverlay`. The drop guard stops navigation
>
> — `screens.md §SCR-05, rows default + drag-over/drop, abridged` · full text: [screens.md](../screens.md)

> restoring | The graphics context was lost and a restore is pending before the deadline (AC-19, `sad.md` flow 7). The canvas area never shows black: it is filled with `--color-canvas-surround` and a `Spinner`. The zoom controls stay visible
>
> — `screens.md §SCR-02, restoring row, abridged` · full text: [screens.md](../screens.md)

> The window-level drop guard is always installed. On every screen a drop never navigates away from the app or shows the file in place of it (AC-02, AC-18).
>
> — `screens.md §Shell shared by every screen, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule (reuse):** All tokens are CSS custom properties in one file. A component or screen never hard-codes a colour, spacing value or font inline. It references `var(--…)`.
>
> — `design-system.md §Token source, verbatim` · full text: [design-system.md](../../../design-system.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-18 — cross-context

> **Given** the browser lacks the graphics capability the editor requires
> **When** the Portfolio reviewer opens the app
> **Then** the canvas area shows a full message explaining that this browser can't display the editor and naming browsers that can. The "Open image" action is unavailable, and a file dropped onto the app opens nothing and never makes the browser navigate away or show the file in place of the app; the same message stays in place
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — cross-context

> **Given** an image is open
> **When** the device's graphics are interrupted temporarily, for example by sleep and wake or a graphics switch
> **Then** the Preview comes back by itself without reopening the file, and the Work and View are unchanged
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

### AC-19b — error

> **Given** an image is open
> **When** the device's graphics are interrupted and the browser does not let the editor restore them
> **Then** the canvas area shows a full message in plain language instead of a blank or black canvas. The message says the display could not recover, suggests reloading the page, and says plainly that the open Work will be lost on reload
>
> — `spec.md §5, AC-19b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `probeCapabilities(): Promise<{ ok: true } | { ok: false }>` — WebGL2 context, `MAX_TEXTURE_SIZE ≥ 4096`, `createImageBitmap`, `OffscreenCanvas` 2D inside a tiny inline worker; no UA sniffing — `src/render/capabilities.ts`
- [ ] Start-up order in `src/app/`: install the drop guard first, then run the gate, then mount SCR-01 or SCR-04
- [ ] Store: `display: 'ok' | 'unsupported' | 'restoring' | 'lost'`; renderer status `restoring`/`ready`/`lost` maps onto it (`lost` = `DISPLAY_LOST`) — `src/features/editor/store.ts`
- [ ] Reuse `CanvasMessage` + `BaseButton` (T10) for SCR-04 (no Open image, no `Ctrl/Cmd+O`, drops ignored) and SCR-05 (status bar hidden, focus to "Reload page" → `location.reload()`); restoring = surround colour + `Spinner` — `src/features/editor/EditorView.vue`
- [ ] E2E `e2e/open-and-view/blocking.spec.ts`: init script removing `WebGL2RenderingContext` → SCR-04 copy, drop opens nothing and URL unchanged; `WEBGL_lose_context` → `loseContext()` then `restoreContext()` → same View; `loseContext()` without restore → SCR-05 after 5000 ms (Chromium)

## Edge cases

| Case | Behaviour |
|---|---|
| No WebGL2 | SCR-04; Open image absent; `Ctrl/Cmd+O` does nothing app-side |
| `MAX_TEXTURE_SIZE` < 4096 | SCR-04 |
| File dropped on SCR-04 or SCR-05 | nothing opens, no overlay, no navigation |
| Context restored within the deadline | Preview back at the same View, readout unchanged (AC-19) |
| Context not restored | SCR-05 with focus on "Reload page" (AC-19b) |

## Definition of Done

- [ ] Playwright e2e proves AC-18 (SCR-04 + drop without navigation), AC-19 (restored, same View) and AC-19b (SCR-05 after the deadline)
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
