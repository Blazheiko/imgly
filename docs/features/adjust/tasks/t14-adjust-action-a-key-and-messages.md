---
id: T14
title: "Add the 'Adjust' toolbar action with its hints, the A shortcut and the tool's message catalog, mounted next to 'Crop and rotate'"
layer: "ui"
deps: ["T12"]
blocks: ["T16"]
acs: ["AC-15", "AC-17", "AC-18", "AC-19", "AC-21"]
files_hint: ["src/features/adjust/AdjustAction.vue", "src/features/adjust/AdjustAction.test.ts", "src/features/adjust/shortcuts.ts", "src/features/adjust/shortcuts.test.ts", "src/features/adjust/messages.ts", "src/features/adjust/index.ts", "src/app/App.vue"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 71 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — Add the 'Adjust' toolbar action with its hints, the A shortcut and the tool's message catalog, mounted next to 'Crop and rotate'

## Place in the sequence

- **Blocked by:** T12 — Add the adjust store: Draft and values at open, set / commit typed fields, reset one or all, apply and cancel.
- **Blocks:** T16 — Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark.
- **Wave:** 4 — alongside T6, T7, T9.
- **Lane:** shares `src/features/adjust/index.ts` with T12; shares `src/features/adjust/messages.ts` with T15; shares `src/app/App.vue`, `src/features/adjust/index.ts`, `src/features/adjust/shortcuts.test.ts`, `src/features/adjust/shortcuts.ts` with T16 — serialized.

## Why (user story)

> **US-08: Adjust on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the adjust tool and use it by mouse or keyboard without instructions  
> **So that** I can judge the colour tools in the open, edit and save flow
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It makes the tool findable and reachable by mouse, Tab and A, and explains every refusal on the control itself.

## Inlined context

> - **Top bar** (`EditorTopBar` actions slot): "Open image" …, then `CropRotateAction`, then `AdjustAction` (`BaseButton` secondary "Adjust", with a sliders icon and the shortcut "A" in its tooltip), then `ExportAction` …
> - **Unavailable actions** follow the `CropRotateAction` precedent: an action that cannot run now but is not blocked by an export stays focusable (`aria-disabled`, styled at 0.45 opacity, not `disabled`). Its hint is its accessible description, and activating it, or pressing its key, shows the same hint as a `Toast` `info`. During an export the action is truly `disabled` and its key does nothing (AC-15).
>
> — `screens.md §Shell changes, Top bar + Unavailable actions, abridged` · full text: [screens.md](../screens.md)

> | `A` | SCR-01 | Opens the tool | AC-21 |
> | `A` | SCR-02 | Shows the "open an image first" notice | AC-19 |
> | `A` | SCR-04 (Crop and rotate open) | Shows the "apply or cancel the open tool first" notice; nothing while a text field has focus | AC-18 |
> | `A` | Export panel open, the tool already open, a text field focused, or an export running | Does nothing | AC-15, AC-21 |
>
> — `screens.md §Keyboard, A rows, verbatim` · full text: [screens.md](../screens.md)

> | info | "Adjust" or `A` with no image open | AC-19 | Open an image first to adjust it. |
> | info | … "Adjust" or `A` while Crop and rotate is open | AC-18 | Apply or cancel the open tool first. |
> | hint | "Auto" with nothing to measure (inline, `role="status"`) | AC-13 | Nothing to correct automatically. |
> | label | over the canvas while Compare is held | AC-08 | Before |
> | tooltip | "Adjust" action | AC-21 | Adjust (A) |
> | tooltip | "Compare" button | AC-08 | Hold to see the photo before adjusting (\\) |
> | tooltip | each slider | AC-10 | Double-click to reset |
> | label | group headings | AC-01 | Light · Colour · Effects |
> | label | sliders and their fields | AC-01 | Brightness · Contrast · Saturation · Temperature · Tint · Grayscale · Sepia |
> | button | actions and footer | AC-08, AC-09, AC-10, AC-12 | Compare · Auto · Reset · Cancel · Apply |
>
> — `screens.md §Message catalog, adjust rows, abridged` · full text: [screens.md](../screens.md)

> | default | No Work is open (AC-19). "Adjust" is shown but unavailable: focusable (`aria-disabled`), with the hint as its accessible description | … |
> | exporting | … "Adjust" is visibly `disabled` and `A` does nothing; the request is refused, not queued (AC-15) | … |
> | default (SCR-03) | … "Adjust" shows as pressed (`aria-pressed`). … |
>
> — `screens.md §SCR-02 default, SCR-01 exporting, SCR-03 default, abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts`. May import `core`, `infra`, `render`, `shared`. Features never import each other. They coordinate through the `editor` store … Like crop-rotate, its only cross-feature import is `useEditorStore` from `@/features/editor`.
>
> — `CLAUDE.md §Module boundaries + sad.md §5 intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

Precedent to mirror (not import — features never import each other): `src/features/crop-rotate/CropRotateAction.vue` and `createOpenShortcut` / `isTextTarget` in `src/features/crop-rotate/shortcuts.ts`. Match A like C: `event.key === 'a'`, or `event.code === 'KeyA'` on a layout that types no Latin letter; ignore repeats and Ctrl/Cmd/Alt. Reuses `BaseButton` (`pressed` option) and `useNotices`/`Toast` as crop-rotate does. Add the action to `App.vue`'s `#top-bar-actions` right after `CropRotateAction`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-15 — authorization

> **Given** an export is in progress (export AC-11)
> **When** the Editor tries to open the "Adjust" tool, by its button or by its keyboard shortcut
> **Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — cross-context

> **Given** the "Adjust" tool is open with a Draft that is not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with neutral Adjustments. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** an image is open with applied Adjustments
> **When** the Editor opens the "Crop and rotate" tool, or tries to open one tool while the other is open
> **Then** the "Crop and rotate" tool shows the whole image with its applied Adjustments, including the area outside the crop frame, so widening the frame never shows a seam, and any Geometry the Editor applies keeps the Adjustments as they are. Only one of the two tools can be open at a time: while one is open, the other's button is unavailable with a hint to apply or cancel the open tool first, and its keyboard shortcut shows the same hint, except while a text field has focus, when the shortcut does nothing (AC-21, crop-rotate AC-20)
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — error

> **Given** no image is open
> **When** the Editor looks for the "Adjust" tool or presses its keyboard shortcut
> **Then** the tool is unavailable, its hint says to open an image first, and the shortcut shows the same hint
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

### AC-21 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to change its light or colour
> **Then** an "Adjust" action is visible in the toolbar next to "Crop and rotate". It can be reached with Tab and activated with Enter or Space, and the A key opens it as well. The A key does nothing while the export panel is open, while the "Adjust" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With a slider focused, the arrow keys change it by 1 (10 with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-05). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Lightening a photo and keeping it takes three actions (open the tool, drag brightness, Apply), and an automatic fix takes three actions (open the tool, Auto, Apply)
>
> — `spec.md §5, AC-21, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] The whole copy catalog (all rows above) — `src/features/adjust/messages.ts`
- [ ] `createOpenShortcut` for A with the guards in the table — `src/features/adjust/shortcuts.ts` (+ test)
- [ ] AdjustAction: pressed / disabled during export / `aria-disabled` + hint (no Work, Crop and rotate open) / open — `src/features/adjust/AdjustAction.vue` (+ test)
- [ ] Export `AdjustAction` — `src/features/adjust/index.ts`; mount after `CropRotateAction` — `src/app/App.vue`

## Edge cases

| Case | Behaviour |
|---|---|
| A with no Work | notice "Open an image first to adjust it." |
| A during an export | nothing; button `disabled` (refused, not queued) |
| A with Crop and rotate open, focus on its Width field | nothing |
| A with Crop and rotate open, focus elsewhere | notice "Apply or cancel the open tool first." |
| A with the export panel open, or Adjust already open | nothing |
| A held (repeat) | opens once |
| A on a Cyrillic layout (key "ф", code KeyA) | opens |

## Definition of Done

- [ ] Component and shortcut tests prove every A row and every action state above
- [ ] Hard rule holds: only `@/features/editor` imported across features
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
