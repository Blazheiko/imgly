---
id: T6
title: "Move isTextTarget to src/shared/keyboard.ts so undo-redo can skip text and number fields"
layer: "ui"
deps: []
blocks: ["T7"]
acs: ["AC-08", "AC-14"]
files_hint: ["src/shared/keyboard.ts", "src/shared/keyboard.test.ts", "src/shared/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 36 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Move isTextTarget to src/shared/keyboard.ts so undo-redo can skip text and number fields

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** T7 — Add the undo-redo feature's messages and the pure shortcut handler for Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z and Ctrl+Y.
- **Wave:** 1 — alongside T1, T13.
- **Lane:** own lane.

## Why (user story)

> **US-06: Find undo on the first try**
>
> **As a** Portfolio reviewer  
> **I want** undo and redo where every desktop editor has them, with the usual shortcuts  
> **So that** I find them without looking for them and judge the app a complete editor
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It lets the shortcuts work "from anywhere in the editor except a focused text or number field" without the new feature importing another feature.

## Inlined context

> `isTextTarget` moves to `src/shared/keyboard.ts`, so the new feature can skip text and number fields (AC-08, AC-14) without importing another feature. The existing copies in `adjust`, `crop-rotate` and `draw` stay until they are next touched (sad.md §11).
>
> — `adr/0004 §Decision outcome, How it works bullet 5, verbatim` · full text: [adr/0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature.md](../adr/0004-run-the-history-in-core-own-it-in-the-editor-store-and-add-an-undo-redo-feature.md)

> **Hard rule:**
> `src/shared/` — Design tokens, UI primitives (`src/shared/ui/`), `ids.ts` — May import: `core` (types) only — never `features`, `infra`, `render`
>
> — `CLAUDE.md §Module boundaries, src/shared row, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Source to copy: `src/features/draw/shortcuts.ts` L30 `isTextTarget` with its `NON_TEXT_INPUTS` set (identical copies in `adjust/shortcuts.ts` L22 and `crop-rotate/shortcuts.ts` L22). Do **not** edit those three features in this task (accepted debt, sad.md §11).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

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

- [ ] Create `isTextTarget` (+ `NON_TEXT_INPUTS`) — `src/shared/keyboard.ts`
- [ ] Re-export from `src/shared/index.ts`
- [ ] Unit tests on happy-dom — `src/shared/keyboard.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `<input type="number">` focused | text target (true) — Ctrl+Z belongs to the field (AC-08) |
| `<input type="range">` / checkbox / button focused | not a text target (false) |
| `contenteditable` element | true |
| `null` or `window` target | false |

## Definition of Done

- [ ] `keyboard.test.ts` covers every Edge case row
- [ ] No file under `src/features/` changed
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
