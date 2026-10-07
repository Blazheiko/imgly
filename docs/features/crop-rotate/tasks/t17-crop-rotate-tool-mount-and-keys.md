---
id: T17
title: "Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View"
layer: "wiring"
deps: ["T9", "T14", "T15", "T16"]
blocks: ["T19"]
acs: ["AC-01", "AC-11", "AC-19", "AC-20"]
files_hint: ["src/features/crop-rotate/CropRotateTool.vue", "src/features/crop-rotate/CropRotateTool.test.ts", "src/features/crop-rotate/shortcuts.ts", "src/features/crop-rotate/shortcuts.test.ts", "src/features/crop-rotate/index.ts", "src/features/editor/EditorView.vue", "src/features/editor/EditorView.test.ts", "src/app/App.vue"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 65 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T17 — Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View

## Place in the sequence

- **Blocked by:** T9 — Make the Preview and the status bar follow the Geometry, and add the setGeometry test hook · T14 — Add the 'Crop and rotate' toolbar action, its hints, the C shortcut and the tool's message catalog · T15 — Build CropOverlay: dimmed outside, frame with 8 focusable handles, both grids, pointer drags and arrow keys · T16 — Build CropRotateControls: rotate and flip buttons, straighten slider and field, proportion, width and height, Reset / Cancel / Apply.
- **Blocks:** T19 — Add the e2e tool-flow suite: three-action paths, export refusals, replace while open, View fit and frame alignment.
- **Wave:** 7.
- **Lane:** shares `src/features/crop-rotate/index.ts` with T13; shares `src/app/App.vue`, `src/features/crop-rotate/index.ts`, `src/features/crop-rotate/shortcuts.test.ts`, `src/features/crop-rotate/shortcuts.ts` with T14 — serialized.

## Why (user story)

> **US-09: Crop and rotate on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the crop and rotate tool and use it by mouse or keyboard without instructions  
> **So that** I can judge the first real edit in the open, edit and save flow
>
> — `spec.md §4, US-09, verbatim` · full text: [spec.md](../spec.md)

It puts the tool on screen in place of the plain canvas and closes the loop: open, edit, then Apply or Cancel by mouse or keyboard.

## Inlined context

> - **Tool layout** (SCR-03): the `CropRotateTool` takes over the area between the top bar and the status bar in place, with no page change (ux-flows §Platform decisions). The canvas area keeps the Preview, with `CropOverlay` laid over it. A **tool panel** of width `--panel-width` sits on the right of the canvas, full height, background `--color-surface-raised`, holding `CropRotateControls`. Below 1024 px the panel moves under the canvas (canon §Platform posture), and nothing else changes.
>
> — `screens.md §Shell changes, Tool layout, verbatim` · full text: [screens.md](../screens.md)

> `EditorView` gets a `tool` slot over the canvas area for the overlay and the tool's controls.
> `CropRotateTool.vue` — SCR-03 wrapper mounted in the editor's tool slot: CropOverlay over the canvas, CropRotateControls beside it · `shortcuts.ts` — C to open; inside the tool Enter, Escape and the arrow keys (AC-20) · `app/App.vue` — mounts CropRotateAction next to ExportAction, and CropRotateTool into the editor's tool slot
>
> — `sad.md §5, Cross-feature changes bullet 3 + Internal decomposition, abridged` · full text: [sad.md](../sad.md)

> | `Tab` | SCR-03 | Reaches every control: the frame, its 4 edges and 4 corners, then the panel's controls in order | AC-20 |
> | `Enter` / `Space` | A focused button | Presses that button | AC-20 |
> | `Enter` | Angle, width or height field | Applies the typed value. Never applies the tool | AC-07, AC-10 |
> | `Enter` | Anywhere else in SCR-03 | Applies the tool | AC-20 |
> | `Esc` | Anywhere in SCR-03, including a field | Cancels the tool; a value still being typed is discarded | AC-11, AC-20 |
> | Zoom keys, `Space`-drag pan | SCR-03 | As in the editor: never change the Draft, never count as an edit | AC-19 |
>
> Focus moves to the frame when the tool opens. After Apply or Cancel it returns to the "Crop and rotate" action.
>
> — `screens.md §Keyboard, rows 6, 10–13, 15 + closing line, verbatim` · full text: [screens.md](../screens.md)

> | closed | Apply (→ SCR-01, `default` or `Geometry applied`), Cancel or `Esc` (→ SCR-01 as before), or a successful replace (→ SCR-01 with the new Work) (F6, F8, AC-11, AC-13, AC-19) | — | — |
> | loading (reading a new image) | "Open image" or a drop while the tool is open, until the new image is read (F8, AC-17). open-and-view's canvas loading overlay shows. The tool stays open with its Draft | as `default` + open-and-view's `Spinner` overlay on the canvas | — |
>
> — `screens.md §SCR-03 rows closed + loading, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** `src/app/` — App shell … `features` (through `index.ts` only). The app shell places the action in the top bar's actions slot next to Export, and places the overlay and controls in a new tool slot of the editor view.
>
> — `CLAUDE.md §Module boundaries + sad.md §5 intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

Today: `EditorView.vue:151` exposes `#actions` → `top-bar-actions`; add a `tool` slot rendered only while `editor.activeTool` is set, over the canvas area, without unmounting `PreviewCanvas`. Fit-View on open/close is the editor store's (T8) — this task only verifies it end to end in component tests. A "tool ready" performance mark (`sad.md` §7) is emitted here when SCR-03 is first drawn, for T20.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Crop and rotate" tool, drags an edge or a corner of the crop frame inwards, and chooses Apply
> **Then** the tool closes, the Preview shows only the area inside the frame, and the size shown for the Work is the Crop's width and height in pixels, followed by the Original's dimensions whenever the width or the height differs, compared in order, so a 90° Rotation alone also shows them (for example "1920×1080, from 4096×3072"), so the Original's dimensions stay visible as open-and-view AC-05 and AC-06 require. While the tool is open, the area outside the frame is dimmed, a rule-of-thirds grid shows inside the frame while it is being dragged, and the whole frame can be moved by dragging inside it. The Work now has Unsaved edits (AC-13)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — happy path

> **Given** the Editor has changed the Rotation, Flip, Straighten angle or crop frame in the open tool
> **When** the Editor chooses Cancel or presses Escape
> **Then** the tool closes and the Work keeps the Geometry it had before the tool was opened, with its Unsaved edits unchanged
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — cross-context

> **Given** an image is open
> **When** the Editor opens the "Crop and rotate" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** on opening, the View fits the whole image with its current Rotation, Flip and Straighten angle, so every edge of the frame can be reached. Zoom and pan keep working inside the tool, and they never change the Geometry or count as an edit. After Apply or Cancel, the View fits the Work
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

### AC-20 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to crop or turn it
> **Then** a "Crop and rotate" action is visible in the toolbar next to Export. It can be reached with Tab and activated with Enter or Space, and the C key opens it as well. The C key does nothing while the export panel is open, while the tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With the frame focused, the arrow keys move it by 1 px of the image (10 px with Shift). With a frame edge or corner focused, they resize it by the same step, and with a proportion locked the other side follows as in AC-08. With the straighten slider focused, they change the angle by 0.1° (1° with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-07, AC-10). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Rotating once and keeping it takes three actions (open the tool, rotate, Apply), and cropping to a square takes three actions (open the tool, choose 1:1, Apply)
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

This task owns AC-01's Apply closing the tool, AC-11's Cancel/Escape, AC-19's View behaviour inside the tool and AC-20's in-tool Enter/Escape/Tab/focus. The frame keys are T15; the three-action paths on real browsers are T19.

## Checklist

- [ ] `tool` slot over the canvas area, shown only while a tool is open — `src/features/editor/EditorView.vue` (+ test)
- [ ] `CropRotateTool.vue`: `CropOverlay` over the canvas area, panel with `CropRotateControls` at `--panel-width`, responsive below 1024 px; emits the "tool ready" mark — `src/features/crop-rotate/CropRotateTool.vue`
- [ ] In-tool key handler: Enter → apply unless target is a field or a button; Escape → cancel from anywhere — `src/features/crop-rotate/shortcuts.ts` (+ test)
- [ ] Focus to the frame on open; back to the action on close — `CropRotateTool.vue`
- [ ] Export `CropRotateTool`; mount in `#tool` — `src/features/crop-rotate/index.ts`, `src/app/App.vue`

## Edge cases

| Case | Behaviour |
|---|---|
| Enter on the focused Reset button | presses Reset only (does not also apply) |
| Escape while typing in Height | tool cancels; pending text discarded |
| Escape while the replace dialog is open over the tool | the dialog handles it (declines); tool stays open |
| Zoom with Ctrl+wheel inside the tool | View changes; Draft unchanged |
| Below 1024 px | panel under the canvas; nothing else changes |
| Display lost while open | overlay hidden, panel stays, Cancel works |

## Definition of Done

- [ ] Component tests prove the slot, the layout, Enter/Escape rules and focus movement (AC-11, AC-20)
- [ ] Component test proves Apply closes the tool and the Preview returns to crop mode with fit-View (AC-01, AC-19)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
