---
id: T13
title: "Add the 'Draw' toolbar action with its hints, the D shortcut and the message catalog, mounted after 'Adjust'"
layer: "ui"
deps: ["T11"]
blocks: ["T16"]
acs: ["AC-14", "AC-16", "AC-17", "AC-19"]
files_hint: ["src/features/draw/DrawAction.vue", "src/features/draw/DrawAction.test.ts", "src/features/draw/messages.ts", "src/features/draw/shortcuts.ts", "src/features/draw/shortcuts.test.ts", "src/features/draw/index.ts", "src/app/App.vue"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 60 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Add the 'Draw' toolbar action with its hints, the D shortcut and the message catalog, mounted after 'Adjust'

## Place in the sequence

- **Blocked by:** T11 — Add the draw store: open with a copy of the layer, mode reset to Brush, colour and width kept until reload, width field and steps, Clear with the change flag, Apply, Cancel and release on replace.
- **Blocks:** T16 — Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark.
- **Wave:** 4 — alongside T9, T14, T17.
- **Lane:** shares `src/features/draw/index.ts` with T11; shares `src/features/draw/messages.ts` with T14; shares `src/app/App.vue`, `src/features/draw/index.ts`, `src/features/draw/shortcuts.test.ts`, `src/features/draw/shortcuts.ts` with T16 — serialized.

## Why (user story)

> **US-07: Draw on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the draw tool and its controls by mouse or keyboard without instructions  
> **So that** I can judge the drawing tool in the open, edit and save flow
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It makes the tool findable next to "Adjust" and by D, and gives every refusal its hint.

## Inlined context

> **Top bar** (`EditorTopBar` actions slot): "Open image" (`BaseButton` secondary, unchanged), then `CropRotateAction`, then `AdjustAction`, then `DrawAction` (`BaseButton` secondary "Draw", with a brush icon and the shortcut "D" in its tooltip), then `ExportAction` …
> **Unavailable actions** follow the `CropRotateAction` and `AdjustAction` precedent: an action that cannot run now but is not blocked by an export stays focusable (`aria-disabled`, styled at 0.45 opacity, not `disabled`). Its hint is its accessible description, and activating it, or pressing its key, shows the same hint as a `Toast` `info`. During an export the action is truly `disabled` and its key does nothing (AC-14).
>
> — `screens.md §Shell changes, Top bar + Unavailable actions, abridged` · full text: [screens.md](../screens.md)

> | `D` (the letter d, else the D key's position) | SCR-01 | Opens the tool | AC-19 |
> | `D` | SCR-02 | Shows the "open an image first" notice | AC-17 |
> | `D` | SCR-04 or SCR-05 open | Shows the "apply or cancel the open tool first" notice; nothing while a text field has focus | AC-16 |
> | `D` | Export panel open, the tool already open, a text field focused, or an export running | Does nothing | AC-14, AC-19 |
>
> — `screens.md §Keyboard, D rows, verbatim` · full text: [screens.md](../screens.md)

> | info | "Draw" or `D` with no image open | AC-17 | Open an image first to draw on it. |
> | info | "Crop and rotate", "Adjust", `C` or `A` while Draw is open, and "Draw" or `D` while either of them is open | AC-16 | Apply or cancel the open tool first. |
> | tooltip | "Draw" action | AC-19 | Draw (D) |
>
> — `screens.md §Message catalog, rows 1, 3, 4, verbatim` · full text: [screens.md](../screens.md)

> | default | A Work is open, no export running, no tool open. "Draw" is visible next to "Adjust" and reachable by keyboard (AC-19) | … | wireframe 01-a |
> | exporting | An export is running (F1, AC-14). "Draw" is visibly `disabled` and `D` does nothing; the request is refused, not queued | `DrawAction` (`BaseButton` disabled) + export's own exporting state | wireframe 01-b |
>
> — `screens.md §SCR-01, default + exporting rows, abridged` · full text: [screens.md](../screens.md)

Mirror `src/features/adjust/AdjustAction.vue` and `src/features/adjust/shortcuts.ts` (the A key) — copy the helpers, do not import them across features. `messages.ts` carries the full catalog of screens.md §Message catalog (T14 uses its labels). Reuse `BaseButton` and `Toast` via the shared notices; no new primitive.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-14 — authorization

> **Given** an export is in progress (export AC-11)
> **When** the Editor tries to open the "Draw" tool, by its button or by its keyboard shortcut
> **Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — cross-context

> **Given** an image is open
> **When** the Editor tries to open one of the "Crop and rotate", "Adjust" and "Draw" tools while another of them is open
> **Then** only one of the three tools can be open at a time: while one is open, the other two buttons are unavailable with a hint to apply or cancel the open tool first, and their keyboard shortcuts show the same hint, except while a text field has focus, when the shortcuts do nothing. This extends the one-tool rule of adjust AC-18 and the shortcut behaviour of crop-rotate AC-20 (the C key) and adjust AC-21 (the A key) to the "Draw" tool
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — error

> **Given** no image is open
> **When** the Editor looks for the "Draw" tool or presses its keyboard shortcut
> **Then** the tool is unavailable, its hint says to open an image first, and the shortcut shows the same hint
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to draw on it
> **Then** a "Draw" action is visible in the toolbar next to "Adjust". It can be reached with Tab and activated with Enter or Space, and the D key opens it as well, under the same rule as the A key for "Adjust": the letter d, or the D key itself on a layout that types no Latin letter there. The D key does nothing while the export panel is open, while the "Draw" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab; B selects the Brush and E selects the Eraser under the same letter-first rule, silent in a text field. [ and ] make the width 1 smaller or larger, and 10 with Shift held. Each is recognised by the character it types ([ or ]) or, on a layout that does not type that character there, by its key position (the two keys right of P), so Shift+[ works although it types "{" and the German ü and + keys work too. Holding the key repeats the change, the result stays within 1 to 200 (195 plus 10 gives 200), and both are silent in a text field. Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-03). Escape cancels the tool from anywhere in it, including a field. Drawing a mark itself needs a mouse, a pen or a finger. Circling something and keeping it takes three actions: open the tool, draw, Apply
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Message catalog — `src/features/draw/messages.ts`
- [ ] Action with pressed / disabled / aria-disabled + hint states; click → `drawStore.open()` — `src/features/draw/DrawAction.vue`, `DrawAction.test.ts`
- [ ] D key (letter first, then `KeyD`), silent rules, hints — `src/features/draw/shortcuts.ts`, `shortcuts.test.ts`
- [ ] Export from `src/features/draw/index.ts`; mount after `<AdjustAction />` — `src/app/App.vue`

## Edge cases

| Case | Behaviour |
|---|---|
| Cyrillic layout, D key | opens the tool (key position fallback) |
| d in a text field | types d; no shortcut |
| D during export | nothing, no toast (AC-14) |
| click while Adjust open | toast "Apply or cancel the open tool first." |
| no image, click or D | toast "Open an image first to draw on it." |

## Definition of Done

- [ ] component and shortcut tests cover each Edge case row
- [ ] `src/app/App.vue` order: Open image, Crop and rotate, Adjust, Draw, Export
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
