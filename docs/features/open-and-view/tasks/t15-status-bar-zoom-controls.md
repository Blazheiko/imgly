---
id: T15
title: "Build the status bar: Original dimensions readout, zoom controls with the live zoom level, and the zoom shortcuts"
layer: "ui"
deps: ["T11", "T13"]
blocks: ["T19", "T20"]
acs: ["AC-05", "AC-06", "AC-12", "AC-12b"]
files_hint: ["src/features/editor/components/EditorStatusBar.vue", "src/features/editor/components/DimensionsReadout.vue", "src/features/editor/components/ZoomBar.vue", "src/features/editor/EditorView.vue"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 69 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T15 — Build the status bar: Original dimensions readout, zoom controls with the live zoom level, and the zoom shortcuts

## Place in the sequence

- **Blocked by:** T11 — Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions, T13 — Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary.
- **Blocks:** T19 — Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal, T20 — Add the @perf suite: time to first Preview, long tasks, zoom/pan frame rate and memory after 10 opens.
- **Wave:** 7 — after T11, T13 (wave 6).
- **Lane:** shares `src/features/editor/EditorView.vue` with T13, T14, T16, T17 — serialized.

## Why (user story)

> **US-03: Know when an image was reduced**
>
> **As a** Editor  
> **I want** to be told when my image was reduced to the Downscale limit, and from what size to what size  
> **So that** I know what resolution I am editing and exporting
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

> **US-05: Inspect the image closely**
>
> **As a** Editor  
> **I want** to fit the image to the window, see it at 100%, zoom and pan  
> **So that** I can check details before and while editing
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It keeps the Original's dimensions visible for as long as the Work is open, and gives zoom-in/out, Fit and 100% as buttons and shortcuts with a live zoom readout.

## Inlined context

> `EditorStatusBar`: `DimensionsReadout` ("4096 × 2731 px", `--font-mono`, visible as long as the Work is open, AC-05/AC-06) + `ZoomBar` (`BaseButton` ghost "−" / "+" / "Fit" / "100%" + zoom level readout)
>
> — `screens.md §SCR-02, default row components, abridged (wireframe 02-a)` · full text: [screens.md](../screens.md)

> | `Shift+1` | Fit | Turns auto-fit back on (AC-12b) |
> | `Shift+0` | 100% | One image pixel per physical screen pixel (AC-12) |
> | `+` or `=` | Zoom in to the next fixed level, around the centre | |
> | `-` | Zoom out to the previous fixed level, around the centre | |
> The browser's own `Ctrl/Cmd` `+` / `-` / `0` keep their page-zoom meaning and are never intercepted. The shortcuts are listed in the zoom controls' tooltips
>
> — `screens.md §Keyboard, rows 2–5 + note, abridged` · full text: [screens.md](../screens.md)

> Below 1024 px the same screens apply. The status bar may wrap onto two lines
>
> — `screens.md §Shell shared by every screen, abridged` · full text: [screens.md](../screens.md)

> **Fixed by this breakdown:** zoom steps `10, 25, 33.33, 50, 66.67, 100, 150, 200, 300, 400, 600, 800 (%)` (implemented in `src/core/view`, T4).
>
> — `tasks/_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

> **Hard rule:** Every control (Open image, zoom in and out, Fit, 100%, the replace dialog, notice dismiss) is a focusable button with a visible focus ring; the replace dialog traps focus and returns it on close.
>
> — `sad.md §8, Keyboard and focus row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule (reuse):** All tokens are CSS custom properties in one file. A component or screen never hard-codes a colour, spacing value or font inline. It references `var(--…)`.
>
> — `design-system.md §Token source, verbatim` · full text: [design-system.md](../../../design-system.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-05 — domain invariant

> **Given** an image whose long side, once upright, is larger than the Downscale limit
> **When** the Editor opens it
> **Then** the Original's long side equals the Downscale limit with proportions kept, the short side rounded to the nearest whole pixel and never below 1 px, and a one-line notice states the original and the new dimensions (for example 6000×4000 → 4096×2731). The Original's dimensions stay visible in the interface for as long as the Work is open
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — happy path

> **Given** an image whose long side is at or below the Downscale limit
> **When** the Editor opens it
> **Then** the Original keeps the image's own dimensions, no downscale notice is shown, and the Original's dimensions stay visible in the interface for as long as the Work is open
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

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

## Checklist

- [ ] Reuse: `BaseButton` ghost variant, `--font-mono` token — no new primitive
- [ ] `DimensionsReadout.vue` — `{width} × {height} px` of `work.original` — `src/features/editor/components/`
- [ ] `ZoomBar.vue` — "−" / "+" (`stepZoom`), "Fit" (`fit`), "100%" (`actualSize`), zoom readout as a rounded percentage; tooltips list the shortcuts
- [ ] `EditorStatusBar.vue` — holds both; shown only on SCR-02; wraps below 1024 px
- [ ] Shortcuts on the editor (not inside text inputs; disabled while the replace dialog is open): `Shift+1`, `Shift+0`, `+`/`=`, `-`; never bind `Ctrl/Cmd` + `+`/`-`/`0`
- [ ] Component tests + extend `e2e/open-and-view/view.spec.ts` with readout and controls

## Edge cases

| Case | Behaviour |
|---|---|
| 6000×4000 opened | readout shows `4096 × 2731 px` for as long as the Work is open (AC-05) |
| 3000×2000 opened | readout `3000 × 2000 px`, no downscale notice (AC-06) |
| "+" pressed at 800% | stays 800% (AC-12b) |
| `Ctrl/Cmd` + `+` | browser page zoom — not intercepted |
| Shortcut while SCR-03 is open | ignored |

## Definition of Done

- [ ] Component tests for the readout and controls pass
- [ ] Playwright e2e proves the dimensions readout for a downscaled and a within-limit image, the fixed steps, Fit/100% buttons and their shortcuts
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
