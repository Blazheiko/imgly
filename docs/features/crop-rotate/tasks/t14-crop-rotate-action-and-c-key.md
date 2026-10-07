---
id: T14
title: "Add the 'Crop and rotate' toolbar action, its hints, the C shortcut and the tool's message catalog"
layer: "ui"
deps: ["T12", "T13"]
blocks: ["T17"]
acs: ["AC-15", "AC-18", "AC-20"]
files_hint: ["src/features/crop-rotate/CropRotateAction.vue", "src/features/crop-rotate/CropRotateAction.test.ts", "src/features/crop-rotate/shortcuts.ts", "src/features/crop-rotate/shortcuts.test.ts", "src/features/crop-rotate/messages.ts", "src/features/crop-rotate/index.ts", "src/app/App.vue"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 58 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — Add the 'Crop and rotate' toolbar action, its hints, the C shortcut and the tool's message catalog

## Place in the sequence

- **Blocked by:** T12 — Extend SliderField (step, decimals, marks), NumberField (signed decimal input) and BaseButton (pressed), and register them · T13 — Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset.
- **Blocks:** T17 — Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View.
- **Wave:** 6 — alongside T11, T15, T16, T18.
- **Lane:** shares `src/features/crop-rotate/index.ts` with T13; shares `src/app/App.vue`, `src/features/crop-rotate/index.ts`, `src/features/crop-rotate/shortcuts.test.ts`, `src/features/crop-rotate/shortcuts.ts` with T17 — serialized.

## Why (user story)

> **US-09: Crop and rotate on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the crop and rotate tool and use it by mouse or keyboard without instructions  
> **So that** I can judge the first real edit in the open, edit and save flow
>
> — `spec.md §4, US-09, verbatim` · full text: [spec.md](../spec.md)

It makes the tool findable and reachable by mouse and keyboard, and refuses to open it when it must not.

## Inlined context

> | default | A Work is open, no export running, no tool open. "Crop and rotate" is visible next to Export and reachable by keyboard (AC-20) | `EditorTopBar` with "Open image" + `CropRotateAction` (`BaseButton` secondary) + `ExportAction` · … | wireframe 01-a |
> | exporting | An export is running (export AC-11, F1). "Crop and rotate" is visibly disabled and `C` does nothing; the request is refused, not queued (AC-15) | `CropRotateAction` (`BaseButton` disabled) + export's own exporting state | wireframe 01-c |
>
> — `screens.md §SCR-01 rows default + exporting, abridged` · full text: [screens.md](../screens.md)

> | default | No Work is open (AC-18). "Crop and rotate" is shown but unavailable: it stays focusable (`aria-disabled`, not `disabled`) so a keyboard user can reach it and hear why, and its accessible description is the hint | `EditorTopBar` with `CropRotateAction` (`BaseButton` secondary, `aria-disabled`, styled disabled) + `ExportAction` (unavailable, export SCR-02) · open-and-view's `EmptyCanvas` unchanged | wireframe 02-a |
> | hint | "Crop and rotate" activated, or `C` pressed, with no image open (AC-18) | as `default` + `Toast` `info` "Open an image first to crop or rotate it." (→ §Message catalog) | wireframe 02-a |
>
> — `screens.md §SCR-02 rows default + hint, verbatim` · full text: [screens.md](../screens.md)

> | `C` | SCR-01 | Opens the tool | AC-20 |
> | `C` | SCR-02 | Shows the "open an image first" notice | AC-18 |
> | `C` | Export panel open, tool already open, a text field focused, or an export running | Does nothing | AC-15, AC-20 |
> | `Tab`, `Enter` / `Space` | SCR-01 | Reach and activate "Crop and rotate" | AC-20 |
>
> — `screens.md §Keyboard, rows 1–4, verbatim` · full text: [screens.md](../screens.md)

> - **Top bar** (`EditorTopBar` actions slot): "Open image" (`BaseButton` secondary, unchanged), then `CropRotateAction` (`BaseButton` secondary "Crop and rotate", with a crop icon and the shortcut "C" in its tooltip), then `ExportAction` (`BaseButton` primary "Export"). `App.vue` mounts `CropRotateAction` before `ExportAction` (`sad.md` §5), so the action sits next to Export (AC-20).
>
> — `screens.md §Shell changes, Top bar, verbatim` · full text: [screens.md](../screens.md)

> | Keyboard shortcuts | Each feature owns its keys. crop-rotate owns C (silent while the export panel is open, while the tool is open or while a field has focus, read from `editor.activePanel` and the focus target) and, inside the tool, Enter, Escape and the arrow keys (AC-20). …
>
> — `sad.md §8, Keyboard shortcuts, abridged` · full text: [sad.md](../sad.md)

> **Message catalog seed** (`src/features/crop-rotate/messages.ts`): info "Open an image first to crop or rotate it." (AC-18) · tooltip "Crop and rotate (C)" (AC-20) · labels Rotate left · Rotate right · Flip horizontal · Flip vertical · Straighten · Proportion · Free · Original · 1:1 · 4:3 · 3:2 · 16:9 · Landscape · Portrait · Width · Height · Crop frame · Top edge · Right edge · Bottom edge · Left edge · Top-left corner · Top-right corner · Bottom-right corner · Bottom-left corner · buttons Reset · Cancel · Apply
>
> — `screens.md §Message catalog, rows except AC-16 (export's, T11), abridged` · full text: [screens.md](../screens.md)

Pattern to copy: `src/features/export/ExportAction.vue` (unavailable-with-hint, notices through the editor's single toast boundary) and `shortcuts.ts` (a pure handler factory, installed on `window` by the component). The in-tool Enter/Escape/arrow keys are T15/T17; this task's `shortcuts.ts` holds only C.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-15 — authorization

> **Given** an export is in progress (export AC-11)
> **When** the Editor tries to open the "Crop and rotate" tool, by its button or by its keyboard shortcut
> **Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — error

> **Given** no image is open
> **When** the Editor looks for the "Crop and rotate" tool or presses its keyboard shortcut
> **Then** the tool is unavailable, its hint says to open an image first, and the shortcut shows the same hint
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

### AC-20 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to crop or turn it
> **Then** a "Crop and rotate" action is visible in the toolbar next to Export. It can be reached with Tab and activated with Enter or Space, and the C key opens it as well. The C key does nothing while the export panel is open, while the tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With the frame focused, the arrow keys move it by 1 px of the image (10 px with Shift). With a frame edge or corner focused, they resize it by the same step, and with a proportion locked the other side follows as in AC-08. With the straighten slider focused, they change the angle by 0.1° (1° with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-07, AC-10). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Rotating once and keeping it takes three actions (open the tool, rotate, Apply), and cropping to a square takes three actions (open the tool, choose 1:1, Apply)
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

This task owns the action and C parts of AC-20; the in-tool keyboard and the three-action paths are T15/T16/T17 and T19.

## Checklist

- [ ] Message catalog (all rows above) — `src/features/crop-rotate/messages.ts`
- [ ] `createOpenShortcut(actions)`: `c`/`C` with no modifier; ignore when `activePanel`, `activeTool`, exporting, or the target is an input/textarea/contenteditable; no Work → hint — `src/features/crop-rotate/shortcuts.ts` (+ test)
- [ ] `CropRotateAction.vue`: `BaseButton` secondary with icon and tooltip; `pressed` while open; `disabled` while exporting; `aria-disabled` + hint with no Work; click → `store.open()` — `src/features/crop-rotate/CropRotateAction.vue` (+ test)
- [ ] Export `CropRotateAction` from `src/features/crop-rotate/index.ts`; mount it before `ExportAction` in the top-bar slot — `src/app/App.vue`

## Edge cases

| Case | Behaviour |
|---|---|
| `C` with Ctrl/Cmd/Alt held | ignored (not ours) |
| `C` while typing in the export long-side field | nothing (export panel open / field focus) |
| Click during an export | nothing; no queued open after the export ends |
| No Work, Enter on the focused action | hint notice, tool stays closed |
| Tool already open, `C` | nothing |

## Definition of Done

- [ ] Component tests prove SCR-01 default/exporting/pressed and SCR-02 default/hint (AC-15, AC-18, AC-20)
- [ ] Unit tests prove every C guard
- [ ] every Hard Rule inlined above still holds (crop-rotate does not import export)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
