---
id: T4
title: "Implement the pure View model (Fit, zoom steps, clamp, zoom-at-point, pan clamp, auto-fit) and the Work revision rule"
layer: "domain"
deps: []
blocks: ["T8", "T11"]
acs: ["AC-01", "AC-12", "AC-12b", "AC-13", "AC-14"]
files_hint: ["src/core/view/", "src/core/document.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 77 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Implement the pure View model (Fit, zoom steps, clamp, zoom-at-point, pan clamp, auto-fit) and the Work revision rule

## Place in the sequence

- **Blocked by:** nothing — can start immediately.
- **Blocks:** T8 — Build the WebGL2 preview renderer: mipmapped Original texture, View transform uniform, DPR sizing, draw-on-change, T11 — Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions.
- **Wave:** 1 — no deps, starts in the first wave.
- **Lane:** own lane.

## Why (user story)

> **US-05: Inspect the image closely**
>
> **As a** Editor  
> **I want** to fit the image to the window, see it at 100%, zoom and pan  
> **So that** I can check details before and while editing
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

> **US-06: Keep my work when opening another image**
>
> **As a** Editor  
> **I want** the app to protect the open Work when I open a different image  
> **So that** I never lose Unsaved edits by accident
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It turns every zoom/pan/Fit/resize gesture into a new View with pure maths, and gives the Work the revision counter that makes View changes structurally unable to count as Unsaved edits.

## Inlined context

> The Original is uploaded once per Work as an RGBA8 texture with mipmaps. The View (zoom, pan) from the pure View model in `src/core/view/` becomes one transform uniform.
>
> — `adr/0003 §Decision outcome, How it works bullet 2, abridged` · full text: [adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md](../adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md)

> **Hard rule:** The View maths in `src/core/view/` works in device pixels, so 100% is one image pixel per physical screen pixel (AC-12). Pointer and wheel positions are converted from CSS pixels by `devicePixelRatio` at the component edge, and the canvas is sized with `device-pixel-content-box` where available
>
> — `sad.md §8, Pixel units row, verbatim` · full text: [sad.md](../sad.md)

> ED->>ED: clamps between the smaller of Fit and 10 percent, and 800 percent, keeping the pointer point fixed
> UI->>ED: steps to the next fixed zoom level around the centre
> UI->>ED: sets Fit and turns auto-fit back on, or sets one image pixel per device pixel
> ED->>ED: stops at the image edge, and keeps an image that fits centred
> alt not zoomed or panned since the open or the last Fit → re-fits to the new canvas area; else keeps the zoom level and re-clamps the pan
> Note over ED: any manual zoom or pan turns auto-fit off
>
> — `sad.md §6, Flow 5, abridged` · full text: [sad.md](../sad.md)

> `src/core/document.ts`: `Work = { id, original, revision, cleanRevision, … }`; a new Work starts with `revision = cleanRevision = 0`. `hasUnsavedEdits(work)` is a pure function next to it.
> Every operation that changes the Work (an edit command, undo, redo) returns a Work with `revision + 1`. View changes live outside the Work in the `editor` store and never touch it (AC-14).
>
> — `adr/0005 §Decision outcome, How it works bullets 1–2, verbatim` · full text: [adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md](../adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md)

> **Fixed by this breakdown** (left to `tasks` by screens.md §Source): the zoom-in/zoom-out controls step through `10, 25, 33.33, 50, 66.67, 100, 150, 200, 300, 400, 600, 800 (%)`; the low end is still `min(Fit, 10%)` and the high end 800%.
>
> — `tasks/_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

> **Hard rule:** Functional core with feature folders: `src/core/` is pure TypeScript with no Vue, Pinia or DOM; imports flow `features → core | render | infra | shared`; features never import each other and coordinate through the `editor` store — repo ADR 0002
>
> — `sad.md §2, Technical constraints, verbatim (link dropped)` · full text: [sad.md](../sad.md)

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

### AC-14 — domain invariant

> **Given** the Editor has only zoomed or panned the open Work
> **When** the Editor opens another image
> **Then** no confirmation is asked, because View changes never count as Unsaved edits
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `View = { zoom, panX, panY, autoFit }` in device pixels; `fitZoom(image, canvas) = min(cw/iw, ch/ih, 1)` — `src/core/view/view.ts`
- [ ] `ZOOM_STEPS` = 10, 25, 33.33, 50, 66.67, 100, 150, 200, 300, 400, 600, 800 (%); `zoomRange(fit) = { min: min(fit, 0.1), max: 8 }`; `stepZoom(view, ±1, ctx)` to the next step strictly beyond the current zoom, around the centre — `src/core/view/zoom.ts`
- [ ] `zoomAt(view, factor, point, ctx)` keeps the image point under `point` fixed and clamps; `setFit(ctx)` (autoFit on), `setActualSize(ctx)` (zoom 1) — same file
- [ ] `panBy(view, dx, dy, ctx)` and `clampPan` — stop at the image edge, centre any axis where the image fits — `src/core/view/pan.ts`
- [ ] `resizeView(view, ctx)` — autoFit on → re-fit; off → keep zoom (re-clamped to the new range) and re-clamp pan; every manual zoom/pan sets `autoFit: false` — `src/core/view/view.ts`
- [ ] Extend `Work` with `revision` / `cleanRevision`, add `createWork(original, id)`, `hasUnsavedEdits(work)`, `withEdit(work)` (returns `revision + 1`) — keep the scaffold's existing fields — `src/core/document.ts`
- [ ] Co-located Vitest suites — `src/core/view/*.test.ts`, `src/core/document.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Image smaller than the canvas area | Fit = 1 (100%), centred, never enlarged (AC-01) |
| Zoom gesture past 800% or below `min(Fit, 10%)` | clamped to the bound (AC-12b) |
| Zoom-in from 42% (not a step) | next step strictly greater: 50% |
| Pan on an axis where the image fits | stays centred, no pan (AC-13) |
| Window resize after a manual zoom | zoom kept, pan re-clamped (AC-12b) |
| Window resize after "Fit" | re-fit to the new canvas area |
| Any View operation | the Work object and its `revision` are untouched (AC-14) |

## Definition of Done

- [ ] Vitest proves Fit (never above 100%), the clamp range, fixed steps, zoom-at-point invariance, pan clamping/centering and both resize branches
- [ ] Vitest proves `hasUnsavedEdits` is false for a new Work, true after `withEdit`, and that no View function accepts or returns a Work
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
