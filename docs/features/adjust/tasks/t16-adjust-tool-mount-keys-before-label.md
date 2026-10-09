---
id: T16
title: "Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark"
layer: "wiring"
deps: ["T9", "T14", "T15"]
blocks: ["T18", "T19"]
acs: ["AC-08", "AC-09", "AC-17", "AC-20", "AC-21"]
files_hint: ["src/features/adjust/AdjustTool.vue", "src/features/adjust/AdjustTool.test.ts", "src/features/adjust/shortcuts.ts", "src/features/adjust/shortcuts.test.ts", "src/features/adjust/index.ts", "src/app/App.vue"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 69 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T16 — Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark

## Place in the sequence

- **Blocked by:** T9 — Make PreviewCanvas draw previewAdjustments ?? work.adjustments, and give the e2e hooks setAdjustments and an adjusted previewAt100 · T14 — Add the 'Adjust' toolbar action with its hints, the A shortcut and the tool's message catalog, mounted next to 'Crop and rotate' · T15 — Build AdjustControls: seven SliderFields in three groups with neutral marks, press-and-hold Compare, Auto with its hint line, Reset / Cancel / Apply.
- **Blocks:** T18 — Add the e2e tool-flow suite: three-action paths, live Preview on drag, Compare by mouse, keys and backslash, Cancel and Reset, Auto values and the nothing hint, keyboard-only use · T19 — Add the e2e cross-feature suite: Unsaved edits, export and crop refusals in both directions, replace while open, no-image hint, View untouched, Crop and rotate shows the adjusted image.
- **Wave:** 7 — alone in its wave.
- **Lane:** shares `src/features/adjust/index.ts` with T12; shares `src/app/App.vue`, `src/features/adjust/index.ts`, `src/features/adjust/shortcuts.test.ts`, `src/features/adjust/shortcuts.ts` with T14 — serialized.

## Why (user story)

> **US-04: See before and after**
>
> **As a** Editor  
> **I want** to hold a control and see the photo without any adjustments, then let go to see my changes again  
> **So that** I can judge whether my changes actually improve it
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

> **US-08: Adjust on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the adjust tool and use it by mouse or keyboard without instructions  
> **So that** I can judge the colour tools in the open, edit and save flow
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It turns the store and the panel into a working tool: placed in the slot, keyboard-complete, and leaving the View alone.

## Inlined context

> - **Tool layout** (SCR-03): `AdjustTool` takes the editor's tool slot in place, like `CropRotateTool`: a **tool panel** of width `--panel-width` on the right of the canvas, full height, background `--color-surface-raised`, holding `AdjustControls`. The canvas area keeps the `PreviewCanvas` at the current zoom and pan, with no overlay except the "Before" label while Compare is held. Below 1024 px the panel moves under the canvas …
>
> — `screens.md §Shell changes, Tool layout, abridged` · full text: [screens.md](../screens.md)

> While Compare is held, a "Before" label sits at the top left of the canvas area, inset by `--space-3`. It is a small pill in `--color-surface-raised` with `--color-text`, `--font-size-xs`, announced through `aria-live="polite"`.
>
> — `screens.md §SCR-03, canvas area, verbatim` · full text: [screens.md](../screens.md)

> | `\` held (`KeyboardEvent.code === 'Backslash'`, any layout) | SCR-03, no text field focused | Holds Compare; releasing the key ends it. In a text field it does nothing | AC-08 |
> | `Enter` | A number field | Applies the typed value. Never applies the tool | AC-05 |
> | `Enter` | Anywhere else in SCR-03 (a slider, the panel) | Applies the tool | AC-21 |
> | `Esc` | Anywhere in SCR-03, including a field | Cancels the tool; a value still being typed is discarded | AC-09, AC-21 |
> | Zoom keys, `Space`-drag pan | SCR-03 (outside the Compare button) | As in the editor: never change the Draft, never count as an edit | AC-20 |
>
> Focus moves to the brightness slider when the tool opens. After Apply or Cancel it returns to the "Adjust" action.
>
> — `screens.md §Keyboard, rows + focus note, abridged` · full text: [screens.md](../screens.md)

> Performance marks in the e2e build are the measurement points for spec §6. There is a "tool ready" mark when SCR-03 is first drawn …
>
> — `sad.md §7, Monitoring, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts`. May import `core`, `infra`, `render`, `shared`. Features never import each other. They coordinate through the `editor` store … Like crop-rotate, its only cross-feature import is `useEditorStore` from `@/features/editor`.
>
> — `CLAUDE.md §Module boundaries + sad.md §5 intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

Precedent: `CropRotateTool.vue` (`createToolKeys`, `TOOL_READY_MARK`, focus on mount). Write adjust's own `createToolKeys` and backslash handler in `src/features/adjust/shortcuts.ts` (no import from crop-rotate). **Slot fix:** today `App.vue` puts `CropRotateTool` / `CropOverlay` in the slots unconditionally and `EditorView` renders them whenever any tool is open — gate each by `editor.activeTool` (`'crop-rotate'` vs `'adjust'`) in `App.vue`. The `Before` label goes into `#tool-canvas`. `blur` on `window` → `endCompare()`. Mark `imgly:adjust-tool-ready` after the first `nextTick`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-08 — happy path

> **Given** the "Adjust" tool is open with any Draft
> **When** the Editor holds the Compare button (with the mouse, or with Space or Enter while it has focus), or holds the \ key while no text field has focus. The \ key is the key in that position on a US keyboard, whatever the keyboard layout
> **Then** while it is held, the Preview shows the Work with its Geometry and no Adjustments at all, and a "Before" label is shown over it; when it is released, the Preview shows the Draft again. Compare also ends when the window loses focus or the tool closes. Any change to the Draft while Compare is held (moving a slider, typing a value, Auto, Reset or a per-slider reset) changes the Draft, but the Preview keeps showing "Before" until Compare is released. Compare never changes the Work, the Draft or the Unsaved edits
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — happy path

> **Given** the Editor has changed one or more sliders in the open "Adjust" tool
> **When** the Editor chooses Cancel or presses Escape
> **Then** the tool closes and the Work keeps the Adjustments it had before the tool was opened, with its Unsaved edits unchanged
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — cross-context

> **Given** the "Adjust" tool is open with a Draft that is not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with neutral Adjustments. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-20 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor opens the "Adjust" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** opening the tool does not change the View, zoom and pan keep working inside the tool, and none of them changes the Draft or counts as an edit. After Apply or Cancel the View stays as it was
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

### AC-21 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to change its light or colour
> **Then** an "Adjust" action is visible in the toolbar next to "Crop and rotate". It can be reached with Tab and activated with Enter or Space, and the A key opens it as well. The A key does nothing while the export panel is open, while the "Adjust" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With a slider focused, the arrow keys change it by 1 (10 with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-05). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Lightening a photo and keeping it takes three actions (open the tool, drag brightness, Apply), and an automatic fix takes three actions (open the tool, Auto, Apply)
>
> — `spec.md §5, AC-21, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] AdjustTool: panel + `Before` pill, focus brightness on mount, restore focus to the action on close, `TOOL_READY_MARK` — `src/features/adjust/AdjustTool.vue`
- [ ] Tool keys: Enter applies except in a text field or on a button; Escape cancels from anywhere; backslash keydown/keyup by `code` (silent in text fields, ignore repeats); window blur ends Compare — `src/features/adjust/shortcuts.ts`
- [ ] Export `AdjustTool` — `src/features/adjust/index.ts`; gate both tools by `activeTool` in the slots — `src/app/App.vue`
- [ ] Tests: key routing, focus, label visibility, blur, crop-rotate tool still mounts only for its own tool — `AdjustTool.test.ts`, `shortcuts.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Enter in a number field | commits the value; tool stays open (AC-05) |
| Enter on the Reset button | presses Reset only |
| Escape in a field with pending text | pending discarded, tool cancelled |
| Backslash while a field has focus | nothing; Compare not started |
| Backslash on an AZERTY / Cyrillic layout | Compare (matched by `code`) |
| Window loses focus while comparing | Compare ends |
| Replace dialog open over the tool | Enter / Escape belong to the dialog |
| Zoom / Space-pan while open | View changes only; Draft untouched (AC-20) |
| Crop and rotate opened | only `CropRotateTool` mounts; AdjustTool does not |

## Definition of Done

- [ ] Component tests prove every key row above, the Before label, blur, focus in and out, and that each tool mounts only for its own `activeTool`
- [ ] Tool-ready mark is emitted once per open
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
