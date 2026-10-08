---
id: T11
title: "Refuse Export and Ctrl/Cmd+S while a tool is open with the 'apply or cancel the crop first' hint, and report the open panel"
layer: "app"
deps: ["T8", "T10"]
blocks: ["T19"]
acs: ["AC-16"]
files_hint: ["src/features/export/store.ts", "src/features/export/store.test.ts", "src/features/export/shortcuts.ts", "src/features/export/ExportAction.vue", "src/features/export/ExportAction.test.ts", "src/features/export/messages.ts", "src/features/export/messages.test.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 41 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Refuse Export and Ctrl/Cmd+S while a tool is open with the 'apply or cancel the crop first' hint, and report the open panel

## Place in the sequence

- **Blocked by:** T8 — Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View · T10 — Size the export from workSize, send the Geometry, and base the transparency hint on the GPU check.
- **Blocks:** T19 — Add the e2e tool-flow suite: three-action paths, export refusals, replace while open, View fit and frame alignment.
- **Wave:** 6 — alongside T14, T15, T16, T18.
- **Lane:** shares `src/features/export/store.test.ts`, `src/features/export/store.ts` with T10 — serialized.

## Why (user story)

> **US-08: Export what I see after cropping**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Geometry I applied  
> **So that** the saved file, its size and the warnings I get match the cropped and rotated image
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It guarantees an Export never contains a Geometry that was not applied, and tells crop-rotate when the export panel is open without either feature importing the other.

## Inlined context

> Export and Ctrl/Cmd+S check `editor.activeTool` and show "apply or cancel the crop first" instead (AC-16).
>
> — `sad.md §5, Cross-feature changes bullet 5, last sentence, verbatim` · full text: [sad.md](../sad.md)

> - **export** reads `editor.activeTool` to disable Export and to turn Ctrl/Cmd+S into the "apply or cancel the crop first" hint (AC-16); it never imports the crop-rotate feature.
>
> — `adr/0003 §How it works, export bullet, verbatim` · full text: [adr/0003](../adr/0003-open-tools-in-an-active-tool-slot-with-the-draft-in-the-feature-store.md)

> It also gains `activePanel: 'export' | null`, which the export feature sets when its panel opens and closes, so the C key can stay silent while the panel is open (AC-20) without crop-rotate importing export.
>
> — `sad.md §5, Cross-feature changes bullet 2, last sub-bullet, verbatim` · full text: [sad.md](../sad.md)

> | Keyboard shortcuts | … export owns Ctrl/Cmd+S and turns it into the "apply or cancel the crop first" hint while `editor.activeTool` is set (AC-16). …
>
> — `sad.md §8, Keyboard shortcuts, abridged` · full text: [sad.md](../sad.md)

> | export refused | Export or `Ctrl/Cmd+S` while the tool is open (F7, AC-16). The browser's "Save page" never opens | as `default` + `Toast` `info` "Apply or cancel the crop first, then export." | wireframe 03-d |
> | info | Export or `Ctrl/Cmd+S` while the tool is open | AC-16 | Apply or cancel the crop first, then export. |
>
> — `screens.md §SCR-03 row "export refused" + §Message catalog row 2, verbatim` · full text: [screens.md](../screens.md)

> "Crop and rotate" shows as pressed (`aria-pressed`), "Export" as unavailable (AC-16), "Open image" stays available (AC-17)
>
> — `screens.md §SCR-03 default row, abridged` · full text: [screens.md](../screens.md)

Today: `createSaveShortcut(actions)` in `shortcuts.ts` already calls `preventDefault()` first and branches on `hasWork / exporting / panelOpen`; add a `toolOpen()` + `notifyToolOpen()` branch before `panelOpen`. Unavailable-with-hint follows export's SCR-02 pattern (`aria-disabled`, still focusable). The hint copy lives in export's own `messages.ts` (it's export's refusal).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-16 — cross-context

> **Given** the "Crop and rotate" tool is open
> **When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
> **Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the crop first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page", so an Export never contains a Geometry the Editor has not applied
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `SaveShortcutActions.toolOpen()` / `notifyToolOpen()`; branch after `hasWork`, before `panelOpen` — `src/features/export/shortcuts.ts`
- [ ] `openPanel()` refuses while `editor.activeTool` is set and raises the hint; set `editor.setActivePanel('export' | null)` on open/close — `src/features/export/store.ts`
- [ ] `ExportAction` unavailable (`aria-disabled`, hint as accessible description) while a tool is open — `src/features/export/ExportAction.vue`
- [ ] Copy "Apply or cancel the crop first, then export." — `src/features/export/messages.ts`
- [ ] Tests — `store.test.ts`, `ExportAction.test.ts`, `messages.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Ctrl/Cmd+S with the tool open | `preventDefault`, hint notice, panel stays closed |
| Ctrl/Cmd+S with no image | unchanged (export's "no image" hint) |
| Ctrl/Cmd+S during an export | unchanged (nothing) |
| Export clicked with the tool open | hint notice; no `beginExport` |
| Tool closes | Export available again with no extra action |

## Definition of Done

- [ ] Unit tests prove the shortcut's tool-open branch and `preventDefault` (AC-16)
- [ ] Component test proves the Export action is unavailable with the hint while a tool is open
- [ ] Store test proves `activePanel` follows the panel
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
