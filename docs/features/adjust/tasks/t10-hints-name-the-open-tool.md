---
id: T10
title: "Make the export refusal name the open tool and make 'Crop and rotate' and C hint 'apply or cancel the open tool first' while Adjust is open"
layer: "app"
deps: ["T8"]
blocks: ["T19"]
acs: ["AC-16", "AC-18"]
files_hint: ["src/features/export/messages.ts", "src/features/export/messages.test.ts", "src/features/export/ExportAction.vue", "src/features/export/ExportAction.test.ts", "src/features/export/shortcuts.ts", "src/features/crop-rotate/CropRotateAction.vue", "src/features/crop-rotate/CropRotateAction.test.ts", "src/features/crop-rotate/shortcuts.ts", "src/features/crop-rotate/shortcuts.test.ts", "src/features/crop-rotate/messages.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 43 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Make the export refusal name the open tool and make 'Crop and rotate' and C hint 'apply or cancel the open tool first' while Adjust is open

## Place in the sequence

- **Blocked by:** T8 — Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments.
- **Blocks:** T19 — Add the e2e cross-feature suite: Unsaved edits, export and crop refusals in both directions, replace while open, no-image hint, View untouched, Crop and rotate shows the adjusted image.
- **Wave:** 3 — alongside T4, T5, T12.
- **Lane:** own lane.

## Why (user story)

> **US-07: Export what I see after adjusting**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Adjustments I applied  
> **So that** the saved file looks exactly like the Preview, and other tools show the same image
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It keeps an unapplied Draft out of every Export and keeps the two tools from opening over each other, with hints that say why.

## Inlined context

> - export: the hint for Export and Ctrl/Cmd+S while a tool is open names the open tool. "Apply or cancel the adjustments first" is shown for adjust (AC-16), and the crop text is kept for crop-rotate. …
> - crop-rotate: while the adjust tool is open, its action shows "apply or cancel the open tool first" and the C key shows the same hint, but stays silent while a text field has focus (AC-18). …
>
> — `sad.md §5, Cross-feature changes, export + crop-rotate bullets, abridged` · full text: [sad.md](../sad.md)

> Brownfield: … Crop-rotate's C key and action are silent or generic while any tool is open, and export's tool-open hint says "the crop" (`src/features/export/messages.ts`, `CropRotateAction.vue`). … One task … makes both hints name the open tool, and the AC-16 and AC-18 e2e tests run with each tool open
>
> — `sad.md §11, Brownfield risk, abridged` · full text: [sad.md](../sad.md)

> | info | Export or `Ctrl/Cmd+S` while the tool is open (export's `messages.ts`, chosen by the open tool) | AC-16 | Apply or cancel the adjustments first, then export. |
> | info | "Crop and rotate" or `C` while Adjust is open, and "Adjust" or `A` while Crop and rotate is open | AC-18 | Apply or cancel the open tool first. |
>
> — `screens.md §Message catalog, rows 2–3, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts`. May import `core`, `infra`, `render`, `shared`. Features never import each other. They coordinate through the `editor` store … Like crop-rotate, its only cross-feature import is `useEditorStore` from `@/features/editor`.
>
> — `CLAUDE.md §Module boundaries + sad.md §5 intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

Current code: `infoToolOpen()` returns 'Apply or cancel the crop first, then export.'; crop-rotate's `createOpenShortcut` returns silently when `toolOpen()`. Make it `infoToolOpen(tool: ToolId)` (type from `@/features/editor`). In crop-rotate split "this tool is open" (silent, crop-rotate AC-20) from "another tool is open" (hint, unless a text field has focus — already the first guard). The action is `aria-disabled` with the hint as its description while Adjust is open (SCR-04 / SCR-03 crop refused).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-16 — cross-context

> **Given** the "Adjust" tool is open
> **When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
> **Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the adjustments first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page"
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** an image is open with applied Adjustments
> **When** the Editor opens the "Crop and rotate" tool, or tries to open one tool while the other is open
> **Then** the "Crop and rotate" tool shows the whole image with its applied Adjustments, including the area outside the crop frame, so widening the frame never shows a seam, and any Geometry the Editor applies keeps the Adjustments as they are. Only one of the two tools can be open at a time: while one is open, the other's button is unavailable with a hint to apply or cancel the open tool first, and its keyboard shortcut shows the same hint, except while a text field has focus, when the shortcut does nothing (AC-21, crop-rotate AC-20)
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `infoToolOpen(tool)` with both copies — `src/features/export/messages.ts` (+ test)
- [ ] ExportAction hint and notice, and the Ctrl/Cmd+S path, pass `editor.activeTool` — `ExportAction.vue`, `shortcuts.ts` (+ `ExportAction.test.ts`)
- [ ] `infoOtherToolOpen()` copy — `src/features/crop-rotate/messages.ts`
- [ ] C: `otherToolOpen()` → notify; own tool open → silent — `src/features/crop-rotate/shortcuts.ts` (+ test)
- [ ] Action: `aria-disabled` + hint + notice when `activeTool === 'adjust'` — `CropRotateAction.vue` (+ test)

## Edge cases

| Case | Behaviour |
|---|---|
| Ctrl/Cmd+S with Adjust open | adjust copy; `preventDefault` so "Save page" never opens |
| Ctrl/Cmd+S with Crop and rotate open | crop copy, unchanged |
| C in a number field with Adjust open | nothing happens |
| C with Crop and rotate open | nothing (unchanged) |
| C held (repeat) with Adjust open | no repeated notices (repeats ignored, as today) |

## Definition of Done

- [ ] Unit/component tests prove both export copies by open tool, and C/action hint vs silence in each state
- [ ] Existing crop-rotate and export tests still pass
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
