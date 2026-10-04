---
id: T14
title: "Build SCR-02's PreviewCanvas with the renderer, Fit on open, and the zoom and pan gestures"
layer: "ui"
deps: ["T8", "T11", "T13"]
blocks: ["T18", "T19"]
acs: ["AC-01", "AC-12", "AC-12b", "AC-13"]
files_hint: ["src/features/editor/components/PreviewCanvas.vue", "src/features/editor/EditorView.vue"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 73 inlined lines
status: "done"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — Build SCR-02's PreviewCanvas with the renderer, Fit on open, and the zoom and pan gestures

## Place in the sequence

- **Blocked by:** T8 — Build the WebGL2 preview renderer: mipmapped Original texture, View transform uniform, DPR sizing, draw-on-change, T11 — Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions, T13 — Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary.
- **Blocks:** T18 — Precache the decode worker for offline opens, run e2e on three engines in CI, and record the widened rules, T19 — Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal.
- **Wave:** 7 — after T8, T11, T13 (wave 6).
- **Lane:** shares `src/features/editor/EditorView.vue` with T13, T15, T16, T17 — serialized.

## Why (user story)

> **US-01: Open an image from disk**
>
> **As a** Editor  
> **I want** to choose an image file from my computer with an "Open image" action  
> **So that** I can start editing it
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **US-05: Inspect the image closely**
>
> **As a** Editor  
> **I want** to fit the image to the window, see it at 100%, zoom and pan  
> **So that** I can check details before and while editing
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It puts the opened Original on screen at Fit and makes pinch, Ctrl/Cmd+wheel, wheel pan, Shift+wheel, Space-drag and plain drag move the View smoothly.

## Inlined context

> default | A Work is open at Fit, upright, never above 100% (AC-01, AC-06, `sad.md` flow 1). Auto-fit is on, so a window resize re-fits (AC-12b)
> zoomed / panned | Pinch, `Ctrl/Cmd`+scroll, zoom controls, 100%, pan gestures (AC-12, AC-12b, AC-13, `sad.md` flow 5). […] Auto-fit is off until "Fit". […] The cursor is `grab` / `grabbing` only while the image is larger than the canvas area; an image that fits stays centred and shows the default cursor
> loading | […] The Preview stays visible, and zoom, pan, "Open image" and drop all keep working. […] `Spinner` overlay centred over the live `PreviewCanvas`
>
> — `screens.md §SCR-02, states default/zoomed/loading, abridged` · full text: [screens.md](../screens.md)

> | `Space` + drag | Pan | AC-13 |
> The browser's own `Ctrl/Cmd` `+` / `-` / `0` keep their page-zoom meaning and are never intercepted.
>
> — `screens.md §Keyboard, abridged` · full text: [screens.md](../screens.md)

> | `PreviewCanvas` | Hosts the one WebGL2 canvas of ADR-0003 and turns pointer and wheel input into View changes. No primitive draws pixels |
>
> — `screens.md §New components, abridged` · full text: [screens.md](../screens.md)

> alt pinch, or wheel with Ctrl or Cmd held → zoom by a factor around the pointer, in device pixels
> else two-finger scroll, plain wheel, Shift plus wheel, Space drag, or drag with no tool → pans by the gesture delta
> else window resized → new canvas area size
>
> — `sad.md §6, Flow 5, abridged` · full text: [sad.md](../sad.md)

> WebGL pixel checks stay on Chromium only
>
> — `sad.md §7, Monitoring, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** The View maths in `src/core/view/` works in device pixels, so 100% is one image pixel per physical screen pixel (AC-12). Pointer and wheel positions are converted from CSS pixels by `devicePixelRatio` at the component edge, and the canvas is sized with `device-pixel-content-box` where available
>
> — `sad.md §8, Pixel units row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule (reuse):** All tokens are CSS custom properties in one file. A component or screen never hard-codes a colour, spacing value or font inline. It references `var(--…)`.
>
> — `design-system.md §Token source, verbatim` · full text: [design-system.md](../../../design-system.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** the Editor has no image open
> **When** the Editor chooses a Supported image through the "Open image" action
> **Then** the image is shown at Fit, upright the same way the operating system's photo viewer shows it, and the editor is ready for editing. Fit is the largest zoom at which the whole image fits inside the canvas area (the space left after toolbars and panels), never above 100%, so an image smaller than the canvas area is shown centred at 100% and is never enlarged
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — happy path

> **Given** an image is open
> **When** the Editor pinches on the trackpad, scrolls with Ctrl/Cmd held, or uses the zoom-in and zoom-out controls, "Fit" or "100%"
> **Then** the Preview zooms toward the pointer (or the centre for the controls), the current zoom level is visible, "100%" shows one image pixel per physical screen pixel, and the rest of the app interface never changes size
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-12b — edge

> **Given** an image is open
> **When** the Editor zooms past either end of the range, uses the zoom controls, or resizes the window
> **Then** zoom stays between the smaller of Fit and 10% at the low end and 800% at the high end. The zoom-in and zoom-out controls step through fixed zoom levels. While the Editor has not zoomed or panned since the image opened or "Fit" was last chosen, resizing the window keeps the image at Fit. After a manual zoom or pan, resizing keeps the zoom level
>
> — `spec.md §5, AC-12b, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — happy path

> **Given** an image is open and zoomed in beyond the canvas area
> **When** the Editor scrolls with two fingers or with a plain mouse wheel (vertical), scrolls with Shift held (horizontal), drags while holding Space, or drags while no editing tool is active
> **Then** the Preview pans in that direction and the Work does not change. Panning stops at the image's edge, so the image can never be pushed out of the canvas area. An image that fits inside the canvas area stays centred and does not pan
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Reuse: `Spinner` (T10), renderer (T8), store View actions (T11) — no new primitive
- [ ] `PreviewCanvas.vue`: create the renderer on mount, `ResizeObserver` (`device-pixel-content-box` with a `contentRect × devicePixelRatio` fallback) → `store.setCanvasSize` + `renderer.resize`; watch `work.original` → `setOriginal`, `view` → `setView`; dispose on unmount — `src/features/editor/components/PreviewCanvas.vue`
- [ ] Wheel listener `{ passive: false }`: `ctrlKey`/`metaKey` (incl. trackpad pinch) → `preventDefault` + `zoomAt` at the pointer (CSS px × DPR); plain wheel → vertical pan; `shiftKey` → horizontal pan
- [ ] Pointer drag pans (no tool active in this feature); `Space` held + drag pans; cursor `grab`/`grabbing` only when the image exceeds the canvas area
- [ ] `EditorView.vue`: show `PreviewCanvas` when a Work exists (SCR-02), keep the spinner overlay over it while reading
- [ ] E2E `e2e/open-and-view/view.spec.ts`: open the 12 MP fixture → Fit asserted from the zoom readout/test hook; Ctrl+wheel zoom keeps page layout size; pan stops at the edge; resize re-fits until a manual zoom; Chromium-only pixel check at 100%

## Edge cases

| Case | Behaviour |
|---|---|
| Small image (800×600) in a large canvas area | shown centred at 100%, not enlarged (AC-01) |
| Ctrl+wheel | Preview zooms; the page itself never zooms (AC-12) |
| Browser Ctrl/Cmd `+`/`-`/`0` keys | not intercepted — page zoom as usual |
| Pan beyond the image edge | stops at the edge (AC-13) |
| Image fits the canvas area | no pan, default cursor (AC-13) |
| Resize after a manual zoom | zoom level kept (AC-12b) |

## Definition of Done

- [ ] Playwright e2e (three engines) proves Fit on open, pointer-anchored Ctrl/Cmd+wheel zoom, edge-stopped pan, and both resize branches; Chromium proves one image pixel per device pixel at 100%
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
