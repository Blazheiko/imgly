---
id: T10
title: "Add the Popover and SegmentedControl shared primitives and register them in the design system"
layer: "ui"
deps: []
blocks: ["T12"]
acs: ["AC-17"]
files_hint: ["src/shared/ui/Popover.vue", "src/shared/ui/SegmentedControl.vue", "src/shared/ui/index.ts", "src/shared/ui/primitives.test.ts", "docs/design-system.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 43 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Add the Popover and SegmentedControl shared primitives and register them in the design system

## Place in the sequence

- **Blocked by:** nothing — can start immediately.
- **Blocks:** T12 — Build the export panel (SCR-03) in every state on the export store and the new primitives.
- **Wave:** 1 — no deps, starts in the first wave.
- **Lane:** shares `docs/design-system.md`, `src/shared/ui/index.ts`, `src/shared/ui/primitives.test.ts` with T11, T13 — serialized.

## Why (user story)

> **US-08: Export on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find and complete the export without instructions  
> **So that** I can judge the open, edit and save flow end to end
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It gives the panel a non-modal, keyboard-reachable container and a choice group whose options can be shown but not chosen.

## Inlined context

> | Component | Why no existing primitive fits | Registered in design-system |
> |---|---|---|
> | `Popover` (shared primitive) | A non-modal panel anchored to a button: no backdrop, focus moves in but is not trapped, `Esc` and a click outside close it unless the owner locks it (during an export). `Dialog` is modal (`alertdialog`, backdrop, focus trap), which would block zoom and pan (AC-11) | pending |
> | `SegmentedControl` (shared primitive) | A single-choice group (`radiogroup`, arrow keys) with a per-option disabled state and a one-line hint. Used for format (AC-12 unavailable options) and size presets. `BaseButton` has no selected state or group semantics | pending |
>
> — `screens.md §New components, verbatim` · full text: [screens.md](../screens.md)

> - **Export panel** (SCR-03) is a `Popover` anchored under the Export button, right-aligned to it, width `--panel-width`. It sits over the canvas area, never replaces it, and has no backdrop, so the Preview stays visible and can be zoomed and panned.
>
> — `screens.md §Shell changes, bullet 2, verbatim` · full text: [screens.md](../screens.md)

> Focus moves into the panel on open: to the selected format option. It is not trapped, because the panel is non-modal. On close, focus returns to the Export button.
>
> — `screens.md §Keyboard, focus, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** **Styling:** plain CSS with `<style scoped>`. Every colour, spacing value and font comes from
>
> — `CLAUDE.md §Conventions, Styling, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Shared primitives** go to `src/shared/ui/`, and `implement` registers each one in `docs/design-system.md` §Component inventory. **Feature composites** go to `src/features/export/` and stay out of the shared inventory.
>
> — `screens.md §New components, intro, verbatim` · full text: [screens.md](../screens.md)

> **Fixed by this breakdown:** `Popover` props: `open`, `anchor` (element), `locked`; emits `close` on Escape or a pointerdown outside it and the anchor, unless `locked`. Add a `--panel-width` token to `tokens.css` if it does not exist yet.
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-17 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to save it
> **Then** an "Export" action is visible next to the canvas and reachable by keyboard: it can be reached with Tab and activated with Enter or Space, and Ctrl+S (Cmd+S on a Mac) opens the export panel instead of the browser's "Save page". The export completes in at most three steps: Export, choose a format (no step when the default fits), confirm. Where the browser has a "Save as…" dialog, the confirm in the panel opens the dialog and saving there completes the same step. With no image open, Export is unavailable and its hint says to open an image first; Ctrl/Cmd+S then shows the same hint and never opens the browser's "Save page". While the export panel is open and no export is running, Ctrl/Cmd+S confirms it, like the confirm button. During an export (AC-11), Ctrl/Cmd+S does nothing. Enter in the quality or size field only applies the value as if the Editor had left the field and does not start the export; Enter or Space on the confirm button confirms. Confirming, by the confirm button or Ctrl/Cmd+S, first applies a value still being typed in the quality or size field as if the Editor had left the field (AC-04, AC-05), so the file always has the values the panel shows. The panel stays open during an export, showing the progress with its controls disabled, and closes when the export succeeds. After a cancelled dialog or a refusal (AC-01b, AC-10, AC-12, AC-13, AC-14) it stays open with the same choices, except that a format refused by AC-12 is replaced by PNG, so trying again is one confirm. Escape or a click outside closes the panel only when no export is running
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write `Popover.vue`: anchored, right-aligned, no backdrop, focus moves in (initial-focus target), not trapped, Escape / outside click → `close` unless `locked`, focus back to the anchor on close — `src/shared/ui/Popover.vue`
- [ ] Write `SegmentedControl.vue`: `role="radiogroup"`, `v-model`, options `{ value, label, disabled?, hint? }`, arrow keys skip disabled options, hint lines under the group — `src/shared/ui/SegmentedControl.vue`
- [ ] Export both from `src/shared/ui/index.ts`; tokens only (`--panel-width` added to `src/shared/styles/tokens.css` if missing)
- [ ] Register both in `docs/design-system.md` §Component inventory
- [ ] Component tests on happy-dom — `src/shared/ui/primitives.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Escape or outside click while `locked` | nothing happens |
| Click on the anchor itself | not treated as "outside" |
| Arrow key onto a disabled option | skipped; a disabled option is never selected |
| All options but one disabled | arrow keys stay on the enabled one |

## Definition of Done

- [ ] Component tests prove Popover closes on Escape / outside click only when unlocked, moves focus in on open and back to the anchor on close
- [ ] Component tests prove SegmentedControl is a radiogroup, arrow keys skip disabled options, and hints render
- [ ] both primitives are listed in `docs/design-system.md`; every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
