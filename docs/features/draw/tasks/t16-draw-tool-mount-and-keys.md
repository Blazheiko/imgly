---
id: T16
title: "Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark"
layer: "wiring"
deps: ["T8", "T13", "T14", "T15"]
blocks: ["T18", "T19"]
acs: ["AC-04", "AC-06", "AC-16", "AC-18", "AC-19"]
files_hint: ["src/features/draw/DrawTool.vue", "src/features/draw/DrawTool.test.ts", "src/features/draw/shortcuts.ts", "src/features/draw/shortcuts.test.ts", "src/features/draw/index.ts", "src/app/App.vue"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 58 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T16 — Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark

## Place in the sequence

- **Blocked by:** T8 — Make PreviewCanvas show the Draft or the Work's layer, and give the e2e hooks a reference drawing, a scripted Stroke, a layered previewAt100 and the layer ledger · T13 — Add the 'Draw' toolbar action with its hints, the D shortcut and the message catalog, mounted after 'Adjust' · T14 — Add an optional swatch to SegmentedControl, register it, and build DrawControls: mode, palette, custom colour, width slider and field, Clear, Cancel and Apply · T15 — Build DrawOverlay: pointer capture with coalesced positions into the Stroke session, the width circle at width × zoom, the hidden cursor over the image, Space-drag pass-through and a second touch.
- **Blocks:** T18 — Add the e2e tool-flow suite: the live line through every position, a dot, the Eraser, Clear, Apply and Cancel, the clip at the Crop, drag vs pan and zoom in the tool, the keyboard path and the layer ledger · T19 — Add the e2e cross-feature suite: Unsaved edits rules, export and Ctrl/Cmd+S refused while drawing, one tool at a time in both directions, Draw refused during an export and with no image, replace while open, and marks in Crop and rotate and Adjust.
- **Wave:** 7 — alone.
- **Lane:** shares `src/features/draw/index.ts` with T11; shares `src/app/App.vue`, `src/features/draw/index.ts`, `src/features/draw/shortcuts.test.ts`, `src/features/draw/shortcuts.ts` with T13 — serialized.

## Why (user story)

> **US-07: Draw on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the draw tool and its controls by mouse or keyboard without instructions  
> **So that** I can judge the drawing tool in the open, edit and save flow
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It makes the whole tool usable from the keyboard, with Escape always backing out.

## Inlined context

> | `B` / `E` (letter first, else key position) | SCR-03, no text field focused | Select the Brush / the Eraser | AC-19 |
> | `[` / `]` (character first, else the two keys right of P), `Shift` ×10 | SCR-03, no text field focused | Width 1 (10) smaller / larger, repeating while held, kept within 1 to 200 | AC-19 |
> | `Enter` / `Space` | A focused button | Presses that button | AC-19 |
> | `Enter` | The width field | Applies the typed width. Never applies the tool | AC-03 |
> | `Enter` | Anywhere else in SCR-03 | Applies the tool, after the pointer is released if a Stroke is in progress | AC-18, AC-19 |
> | `Esc` | Anywhere in SCR-03, including a field, also during a Stroke | Cancels the tool; a width still being typed and a Stroke in progress are discarded | AC-06, AC-18, AC-19 |
> | `C`, `A` | SCR-03 | Show the "apply or cancel the open tool first" notice; nothing while a text field has focus | AC-16 |
> All of `D`, `B`, `E`, `[` and `]` type normally in a text field (AC-19). … Focus moves to the mode group (on "Brush") when the tool opens. After Apply or Cancel it returns to the "Draw" action.
>
> — `screens.md §Keyboard, in-tool rows + note, abridged` · full text: [screens.md](../screens.md)

> - **app shell** (`App.vue`, `test-hooks.ts`): `DrawAction` sits in `top-bar-actions` after `AdjustAction` (AC-19), with `DrawOverlay` in `tool-canvas` and `DrawTool` in `tool-panel`.
> - **crop-rotate, adjust**: no change. Their actions and keys already refuse with "Apply or cancel the open tool first." whenever another tool is open, and stay silent in a text field (AC-16).
>
> — `sad.md §5, Cross-feature changes, app shell + crop-rotate/adjust bullets, abridged` · full text: [sad.md](../sad.md)

> a "tool ready" mark when SCR-03 is first drawn;
>
> — `sad.md §7, Monitoring, perf marks, verbatim` · full text: [sad.md](../sad.md)

Mirror `src/features/adjust/AdjustTool.vue` and its keys (Enter/Escape, focus handling, tool-ready mark). `[`/`]`: match `event.key` first, else `event.code` `BracketLeft`/`BracketRight` (German ü and + keys), so `Shift+[` (types "{") still works; key repeat is natural. Mount in `App.vue` `#tool-canvas` / `#tool-panel` gated on `editor.activeTool === 'draw'`, like the other two tools.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-06 — happy path

> **Given** the Editor has drawn, erased or cleared in the open "Draw" tool
> **When** the Editor chooses Cancel or presses Escape
> **Then** the tool closes and the Work keeps the Drawing layer it had before the tool was opened, with its Unsaved edits unchanged
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — cross-context

> **Given** an image is open
> **When** the Editor tries to open one of the "Crop and rotate", "Adjust" and "Draw" tools while another of them is open
> **Then** only one of the three tools can be open at a time: while one is open, the other two buttons are unavailable with a hint to apply or cancel the open tool first, and their keyboard shortcuts show the same hint, except while a text field has focus, when the shortcuts do nothing. This extends the one-tool rule of adjust AC-18 and the shortcut behaviour of crop-rotate AC-20 (the C key) and adjust AC-21 (the A key) to the "Draw" tool
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor opens the "Draw" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** opening the tool does not change the View. Inside the tool a drag with the main mouse button draws instead of panning, while the other View controls keep working: Ctrl/Cmd+wheel and pinch zoom, the plain wheel and Shift+wheel pan, a drag with Space held pans, and the zoom keys and controls work as in open-and-view. While a button in the tool has focus, Space presses that button and does not pan, as Space-drag does outside the Compare button in the "Adjust" tool; while a text field has focus, Space types. None of them makes a Stroke, changes the Draft or counts as an edit, and a Stroke in progress is not broken by a zoom. While a Stroke is in progress (the pointer is still pressed), input waits for it to finish: a colour, mode or width change (by control or by B, E, [ or ]) applies from the next Stroke, Space does not start a pan, and Enter applies the tool only after the pointer is released. Escape cancels the tool at once, the partial Stroke included (AC-06). A pointer cancel, the window losing focus or a second touch (for example the start of a pinch) ends the Stroke where it is and keeps what was drawn so far. After Apply or Cancel the View stays as it was
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to draw on it
> **Then** a "Draw" action is visible in the toolbar next to "Adjust". It can be reached with Tab and activated with Enter or Space, and the D key opens it as well, under the same rule as the A key for "Adjust": the letter d, or the D key itself on a layout that types no Latin letter there. The D key does nothing while the export panel is open, while the "Draw" tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab; B selects the Brush and E selects the Eraser under the same letter-first rule, silent in a text field. [ and ] make the width 1 smaller or larger, and 10 with Shift held. Each is recognised by the character it types ([ or ]) or, on a layout that does not type that character there, by its key position (the two keys right of P), so Shift+[ works although it types "{" and the German ü and + keys work too. Holding the key repeats the change, the result stays within 1 to 200 (195 plus 10 gives 200), and both are silent in a text field. Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-03). Escape cancels the tool from anywhere in it, including a field. Drawing a mark itself needs a mouse, a pen or a finger. Circling something and keeping it takes three actions: open the tool, draw, Apply
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] DrawTool panel wrapper around DrawControls; focus + tool-ready mark — `src/features/draw/DrawTool.vue`
- [ ] In-tool keys and their silent rules — `src/features/draw/shortcuts.ts`
- [ ] Mount overlay and tool — `src/app/App.vue`; export — `src/features/draw/index.ts`
- [ ] Tests — `DrawTool.test.ts`, `shortcuts.test.ts` (+ C/A hint while draw open, via the real crop-rotate/adjust handlers)

## Edge cases

| Case | Behaviour |
|---|---|
| Shift+[ (types "{") | width −10 |
| German layout ü key | width −1 (key position) |
| Enter on focused Clear | presses Clear, does not apply |
| Esc in the width field with pending text | cancels the tool, text discarded |
| B in a text field | types b |
| C while draw open | toast "Apply or cancel the open tool first." |

## Definition of Done

- [ ] tool and shortcut tests cover each Edge case row
- [ ] focus returns to "Draw" after Apply and Cancel
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
