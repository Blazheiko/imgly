---
id: T7
title: "Add the undo-redo feature's messages and the pure shortcut handler for Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y"
layer: "ui"
deps: ["T6"]
blocks: ["T8"]
acs: ["AC-05", "AC-07", "AC-08", "AC-14"]
files_hint: ["src/features/undo-redo/messages.ts", "src/features/undo-redo/shortcuts.ts", "src/features/undo-redo/shortcuts.test.ts", "src/features/undo-redo/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 69 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Add the undo-redo feature's messages and the pure shortcut handler for Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y

## Place in the sequence

- **Blocked by:** T6 — Move isTextTarget to src/shared/keyboard.ts so undo-redo can skip text and number fields.
- **Blocks:** T8 — Build UndoRedoActions (two ghost BaseButtons with hints) and mount it first in the top bar with the shortcuts.
- **Wave:** 2 — alongside T2.
- **Lane:** shares `src/features/undo-redo/index.ts` with T8 — serialized.

## Why (user story)

> **US-06: Find undo on the first try**
>
> **As a** Portfolio reviewer  
> **I want** undo and redo where every desktop editor has them, with the usual shortcuts  
> **So that** I find them without looking for them and judge the app a complete editor
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It gives the reviewer the shortcuts every desktop editor has, with the refusal hints, as a pure function testable without the store.

## Inlined context

> | Keyboard | A `keydown` handler in `undo-redo/shortcuts.ts`. Undo is Ctrl/Cmd+Z (`ctrlKey` or `metaKey`, no Shift or Alt). Redo is Shift+Ctrl/Cmd+Z, or Ctrl+Y (`ctrlKey` only, so Cmd+Y stays the browser's). It skips `isTextTarget` fields (now in `src/shared/keyboard.ts`) and held-key repeats, and calls `preventDefault` on keys it handles. No platform sniffing, as the export's Ctrl/Cmd+S | `src/features/export/shortcuts.ts` precedent; ADR-0004 |
>
> — `sad.md §8, Keyboard row, verbatim` · full text: [sad.md](../sad.md)

> | `Ctrl/Cmd+Z` | SCR-01, outside a focused text or number field | Undo, when a kept Step is there. Otherwise does nothing | AC-01, AC-05, AC-14 |
> | `Shift+Ctrl/Cmd+Z`, `Ctrl+Y` | SCR-01, outside a focused text or number field | Redo, when an undone Step is waiting. Otherwise does nothing. `Cmd+Y` is never handled, so it stays the browser's | AC-02, AC-05 |
> | Any of the three | SCR-02 | Does nothing | AC-05 |
> | Any of the three | SCR-03, outside a focused text or number field | Shows the "apply or cancel the open tool first" notice; the Work and the tool's Draft do not change | AC-08 |
> | Any of the three | SCR-04 | Shows the "export in progress" notice; refused, not queued | AC-07 |
> | Any of the three | SCR-05 (the replace dialog owns the keys) | Does nothing | AC-10 (ledger L7) |
> | Any of the three | A focused text or number field, on any screen | The field's own text undo or redo; the Edit history is untouched | AC-08, AC-14 |
> A held key's repeats are ignored, so holding `Ctrl/Cmd+Z` undoes one Step (ledger L8). Handled keys call `preventDefault`.
>
> — `screens.md §Keyboard, table rows 1–7 + note, abridged` · full text: [screens.md](../screens.md)

> | label | the two buttons' accessible names | AC-14 | Undo · Redo |
> | tooltip | Undo, with a kept Step | AC-01, AC-14 | Undo {tool} (Ctrl/Cmd+Z) |
> | tooltip | Redo, with an undone Step waiting | AC-01, AC-14 | Redo {tool} (Shift+Ctrl/Cmd+Z) |
> | tooltip | Undo with nothing to undo, or no image | AC-05 | Nothing to undo |
> | tooltip | Redo with nothing to redo, or no image | AC-04, AC-05 | Nothing to redo |
> | tooltip + info | either button or shortcut while a tool is open | AC-08 | Apply or cancel the open tool first. |
> | tooltip + info | either button (tooltip) or shortcut (info) during an export | AC-07 | An export is in progress. Undo and Redo work again when it ends. |
> | value | `{tool}` | AC-01 | Crop and rotate · Adjust · Draw |
>
> — `screens.md §Message catalog, rows, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:**
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, features row + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Pattern to follow: `createSaveShortcut(actions)` in `src/features/export/shortcuts.ts` — a factory over an actions interface returning `(event: KeyboardEvent) => void`, no store import. `{tool}` maps from `ToolId` (`'crop-rotate' | 'adjust' | 'draw'`); import the type through `@/features/editor` only if needed, else keep messages keyed by string.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-05 (US-01) — error

> **Given** an image has just been opened, or the Editor has undone every kept Step
> **When** the Editor chooses Undo, by its button or its shortcut
> **Then** nothing changes: the Undo button is visibly unavailable with a hint that there is nothing to undo, and the shortcut does nothing. In the same way, when nothing has been undone, Redo is unavailable with a hint that there is nothing to redo. With no image open, both buttons are unavailable
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-07 (US-05) — authorization

> **Given** an export is in progress (export AC-11)
> **When** the Editor tries to Undo or Redo, by the buttons or by the shortcuts
> **Then** the request is refused, not queued: both buttons are visibly unavailable and the shortcuts only show a hint that an export is in progress, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export. When the export ends, Undo and Redo become available again with the same Edit history
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-08 (US-05) — cross-context

> **Given** "Crop and rotate", "Adjust" or "Draw" is open
> **When** the Editor tries to Undo or Redo, by the buttons or by the shortcuts
> **Then** the Work does not change and the open tool keeps its unapplied changes: Undo and Redo are unavailable with a hint to apply or cancel the open tool first, and the shortcuts show the same hint. While a text or number field has focus, the shortcuts keep their usual meaning inside that field and do not touch the Edit history. After Apply or Cancel, Undo and Redo work on the Edit history, which now includes that tool's Step if its Apply counted as an edit
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-14 (US-06) — happy path

> **Given** a Portfolio reviewer has opened an image and applied one change with any tool
> **When** they look for a way to take it back
> **Then** Undo and Redo are two buttons in the top bar, in the place desktop editors use, each with a hint that names the action and its shortcut. They can be reached and used by keyboard alone, and Ctrl/Cmd+Z works from anywhere in the editor except a focused text or number field, so the change is taken back in at most one action
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Copy catalog as constants + `undoHint(tool|null)`, `redoHint(tool|null)`, `TOOL_NAMES` — `src/features/undo-redo/messages.ts`
- [ ] `isUndoShortcut`, `isRedoShortcut` and `createUndoRedoShortcuts(actions)` with `hasWork`, `confirming`, `exporting`, `toolOpen`, `canUndo`, `canRedo`, `undo`, `redo`, `notifyToolOpen`, `notifyExporting` — `src/features/undo-redo/shortcuts.ts`
- [ ] Order: not a match → return; `isTextTarget` → return (no `preventDefault`); else `preventDefault`; `repeat` → return; no Work or `confirming` → nothing; exporting → notice; tool open → notice; else undo/redo when possible — `src/features/undo-redo/shortcuts.ts`
- [ ] Barrel — `src/features/undo-redo/index.ts`
- [ ] Unit tests per Edge case below — `src/features/undo-redo/shortcuts.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Cmd+Y (metaKey only) | not handled; no `preventDefault` |
| Ctrl+Alt+Z, or Ctrl+Shift+Alt+Z | not handled |
| Ctrl+Z with `event.repeat` | ignored (one Step per press) |
| Ctrl+Z in a focused number field | not handled; field keeps its text undo |
| Ctrl+Z with nothing to undo | does nothing, no notice (AC-05) |
| Ctrl+Z with the replace dialog open | does nothing |

## Definition of Done

- [ ] `shortcuts.test.ts` covers every Edge case row plus the tool-open and export notices
- [ ] Message strings match the catalog verbatim
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
