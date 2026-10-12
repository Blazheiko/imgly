---
id: T8
title: "Build UndoRedoActions (two ghost BaseButtons with hints) and mount it first in the top bar with the shortcuts"
layer: "ui"
deps: ["T5", "T7"]
blocks: ["T10", "T12"]
acs: ["AC-01", "AC-05", "AC-07", "AC-14"]
files_hint: ["src/features/undo-redo/UndoRedoActions.vue", "src/features/undo-redo/UndoRedoActions.test.ts", "src/features/undo-redo/index.ts", "src/app/App.vue", "src/app/App.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 65 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Build UndoRedoActions (two ghost BaseButtons with hints) and mount it first in the top bar with the shortcuts

## Place in the sequence

- **Blocked by:** T5 — Expose undo, redo, canUndo, canRedo, undoTool, redoTool and historyStats on the editor store, with the refusals and the View fit; T7 — Add the undo-redo feature's messages and the pure shortcut handler for Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y.
- **Blocks:** T10 — e2e (Chromium): the 512 MB budget, Steps kept and layer release after replace, discard and drop; T12 — @perf e2e: Undo and Redo p95 ≤ 150 ms for a Step of each tool with a full-image drawing.
- **Wave:** 6 — alongside T9.
- **Lane:** shares `src/features/undo-redo/index.ts` with T7 — serialized.

## Why (user story)

> **US-01: Take back the last change**
>
> **As an** Editor  
> **I want** to undo the last change I applied with a tool  
> **So that** a wrong Crop, Adjustment or drawing costs me one keystroke instead of redoing it by hand
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It puts Undo and Redo where desktop editors have them, so the change is taken back in at most one action.

## Inlined context

> **Top bar** (`EditorTopBar`): "Open image" (`BaseButton` secondary, unchanged), then the new **`UndoRedoActions`** (two icon `BaseButton`s, `ghost`: Undo with a counter-clockwise arrow, Redo with a clockwise arrow), then `CropRotateAction`, `AdjustAction`, `DrawAction` and `ExportAction` as before. `App.vue` mounts `UndoRedoActions` first in the `top-bar-actions` slot (`sad.md` §5), so Undo and Redo sit right after the file action, where desktop editors put them (AC-14). A `--space-2` gap follows Redo, so the pair reads as one group apart from the tools.
> **Accessible names and hints:** each button's accessible name is its action ("Undo", "Redo"). Its hint is both the tooltip (`title`) and the accessible description (`aria-describedby`), and it names the tool of the Step and the shortcut, for example "Undo Adjust (Ctrl/Cmd+Z)" (AC-01, AC-14). An unavailable button's hint says why (→ §Message catalog).
> **Unavailable buttons** follow the `CropRotateAction` / `AdjustAction` / `DrawAction` precedent. When the reason is not an export, the button stays focusable (`aria-disabled`, styled at 0.45 opacity, not `disabled`) and its hint is its accessible description. Activating it while a tool is open shows the hint as a `Toast` `info`. Activating it with nothing to undo or redo, or with no image, does nothing (AC-05). During an export both buttons are truly `disabled` (AC-07).
> **Outcome:** an Undo or Redo shows no notice. The Preview is the outcome, and the hints update to the next Steps (ux-flows §Platform decisions).
>
> — `screens.md §Shell changes, bullets 1–4, abridged` · full text: [screens.md](../screens.md)

> SCR-01 default (nothing to undo): both `aria-disabled`, "Nothing to undo" / "Nothing to redo" · can undo: Undo enabled, Redo `aria-disabled` · can undo and redo: both enabled, each hint naming its Step's tool · oldest reached: Undo "Nothing to undo", Redo available.
> SCR-02 default: no Work; both `aria-disabled`, activation and shortcuts do nothing.
> SCR-03 default: a tool is open; both `aria-disabled` with "Apply or cancel the open tool first."; hint: activation shows that text as a `Toast` `info`.
> SCR-04 default: an export runs; both truly `disabled`; hint (shortcut): `Toast` `info` "An export is in progress. Undo and Redo work again when it ends."
> SCR-05 default: the `Dialog` traps focus; Undo and Redo are under the backdrop and their shortcuts do nothing.
>
> — `screens.md §Screens SCR-01…SCR-05, state tables, abridged` · full text: [screens.md](../screens.md)

> Focus stays on the button after an Undo or Redo by click or keyboard. If that button becomes unavailable, it keeps focus as an `aria-disabled` button and announces its new hint.
>
> — `screens.md §Keyboard, closing note, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** Plain CSS with `<style scoped>`. Every colour, spacing value and font comes from `var(--…)` in `src/shared/styles/tokens.css`. Don't add a UI kit or CSS framework. Reuse `src/shared/ui/` primitives, and register any new primitive in `docs/design-system.md`.
>
> — `CLAUDE.md §Conventions, Styling, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Hard rule:**
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, features row + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Precedent to copy: `src/features/draw/DrawAction.vue` (aria-disabled + `useNotices` info on activate; inline SVG icon; `onMounted(() => window.addEventListener('keydown', onKeydown))` with removal on unmount). Install the T7 handler the same way, wiring its actions to the editor store and `useNotices`. Slot today: `src/app/App.vue` L17 `<CropRotateAction /><AdjustAction /><DrawAction /><ExportAction />`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** an image is open and the Editor has applied at least one Step with "Crop and rotate", "Adjust" or "Draw"
> **When** the Editor chooses Undo, by its button in the top bar or by Ctrl+Z (Cmd+Z on a Mac)
> **Then** the Preview shows the Work as it was before the last Step: the Geometry, the Adjustments or the Drawing layer that Step changed returns to its earlier value, and nothing else changes. Redo becomes available, and the Undo and Redo buttons' hints name the tool of the Step each would take back or restore next, for example "Undo Adjust" and "Redo Crop and rotate"
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

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

### AC-14 (US-06) — happy path

> **Given** a Portfolio reviewer has opened an image and applied one change with any tool
> **When** they look for a way to take it back
> **Then** Undo and Redo are two buttons in the top bar, in the place desktop editors use, each with a hint that names the action and its shortcut. They can be reached and used by keyboard alone, and Ctrl/Cmd+Z works from anywhere in the editor except a focused text or number field, so the change is taken back in at most one action
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Build the component: two `BaseButton variant="ghost"` icon buttons, inline SVG arrows, `title` + `aria-describedby` hints from `messages.ts`, `aria-disabled` vs `disabled` per the rules above, `--space-2` trailing gap via tokens — `src/features/undo-redo/UndoRedoActions.vue`
- [ ] Install/remove the `keydown` handler from `createUndoRedoShortcuts` on mount/unmount, actions bound to `useEditorStore()` and `useNotices()` — `src/features/undo-redo/UndoRedoActions.vue`
- [ ] Export `UndoRedoActions` from `src/features/undo-redo/index.ts`
- [ ] Mount `<UndoRedoActions />` first in `#top-bar-actions` — `src/app/App.vue`
- [ ] Component tests for every SCR state above; App test for top-bar order — `src/features/undo-redo/UndoRedoActions.test.ts`, `src/app/App.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Undo clicked with nothing to undo | nothing happens, no toast (AC-05) |
| Undo clicked while a tool is open | info toast "Apply or cancel the open tool first."; Work unchanged |
| during an export | both buttons `disabled` (not focusable); shortcut shows the export toast |
| Redo becomes unavailable after the last Redo by keyboard | focus stays on the `aria-disabled` button, hint updated |
| no image open | both `aria-disabled`, "Nothing to undo" / "Nothing to redo" |

## Definition of Done

- [ ] `UndoRedoActions.test.ts` covers SCR-01 (4 availability states), SCR-02, SCR-03, SCR-04
- [ ] `App.test.ts` asserts the top-bar order: Open image, Undo, Redo, tools, Export
- [ ] No new shared primitive; only tokens in `<style scoped>`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
