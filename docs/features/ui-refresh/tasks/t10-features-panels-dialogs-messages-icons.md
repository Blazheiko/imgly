---
id: T10
title: "Give the export panel, Replace and Reload dialogs, the zoom bar and the Reload page message their icons"
layer: "ui"
deps: ["T3"]
blocks: ["T14"]
acs: ["AC-02", "AC-03"]
files_hint: ["src/features/export/ExportPanel.vue", "src/features/editor/components/ReplaceDialog.vue", "src/features/pwa-install-update/ReloadDialog.vue", "src/features/editor/components/ZoomBar.vue", "src/features/editor/EditorView.vue"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 46 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Give the export panel, dialogs, zoom bar and messages their icons

## Place in the sequence

- **Blocked by:** T3 — BaseButton · **Blocks:** T14 — e2e checks · **Wave:** 3.
- **Lane:** shares `src/features/editor/EditorView.vue` with T7 and T11 — serialized.

## Why (user story)

> **As an** Editor
> **I want** every action button to carry an icon in one consistent style
> **So that** I find the action I need quickly and the top bar reads as one toolbar
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task covers the remaining SCR-07 surfaces outside the tool panels.

## Inlined context

> | export panel | Its confirm button "Export" is primary with `download` |
> | exporting | The confirm button reads "Exporting…" with a `Spinner` in place of `download` (export screens, unchanged wording) |
> | file ready | "Save…" is primary with `save` |
> | export unavailable | The editor is busy (export `editorBusy`). Neutral disabled look |
> | zoom bar | Zoom out and Zoom in are icon-only (`zoom-out`, `zoom-in`) with their `aria-label` and `title` unchanged. Fit (`scan`) and 100% (`maximize`) keep their labels |
> | replace confirmation | Cancel (secondary, `x`, initial focus as today) and Replace (primary, `replace`). Not `danger`, because only Delete is destructive (AC-12) |
> | reload confirmation | pwa-install-update SCR-06. Cancel (secondary, `x`) and Reload (primary, `refresh-cw`) |
> | display lost | The full-screen message with "Reload page" (primary, `refresh-cw`), as today |
> | unsupported browser | The full-screen message with no action, as today. Only the tokens change |
>
> — `screens.md §SCR-07, rows, abridged` · full text: [screens.md](../screens.md)

> ```text
> 07-c  | 4096 × 3072 px      (⊖)  42%  (⊕)  ( ⌖ Fit )  ( ⤢ 100% )  |  ghost sm
> ```
>
> — `screens.md §SCR-07, wireframe 07-c, verbatim` · full text: [screens.md](../screens.md)

Today: "Reload page" is a `BaseButton` in `EditorView.vue:216`; `ZoomBar.vue` renders "−" / "+" glyphs with `aria-label`s.

> **Hard rule:** names, initial focus, busy wording and order unchanged; existing tests pass unedited.
>
> — `spec.md §6, NFR row «Accessible names», abridged` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-07 and wireframes 07-b to 07-e. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-02 — happy path

> **Given** the Editor is on any screen of the app
> **When** they look at any action button, that is, any button that performs an action anywhere in the app: the top bar, the Gallery and its cards, the notices (Dismiss, Reload, "Delete…"), every tool panel (such as Apply, Cancel, Auto, Compare and Clear), the export panel, every confirmation dialog (both its cancel and its confirming button) and the full-screen messages (such as "Reload page"); choice controls such as a colour swatch, a format option or a proportion option are not action buttons
> **Then** each one shows an icon from one set drawn in one style and size, and the top bar shows, left to right and in the same keyboard order, four groups separated by thin dividers: Gallery and Open image; Undo and Redo; Crop and rotate, Adjust and Draw; Install app and Export, with Export last
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — domain invariant

> **Given** an action button shows an icon; only Undo, Redo, a card's Delete and the buttons that already have no visible label today (Rotate left, Rotate right, Flip horizontal and Flip vertical in Crop and rotate, and Zoom out and Zoom in, whose "−" and "+" become icons) show an icon without a visible label, and every other action button shows its icon next to its label (patched by `screens` on 2026-10-16)
> **When** a screen reader or the keyboard reaches the button
> **Then** the button is announced by the same name as before this feature, the icon itself is not announced, each icon-only button has a tooltip naming its action (Undo and Redo also name their shortcut), and the keyboard order of the top bar is unchanged except that Install app now comes before Export
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Export confirm `download` + `busy`; "Save…" `save`; Cancel `x` if present — `ExportPanel.vue`
- [ ] Cancel `x` / Replace `replace` (primary) — `ReplaceDialog.vue`
- [ ] Cancel `x` / Reload `refresh-cw` — `ReloadDialog.vue`
- [ ] Zoom out/in icon-only (`zoom-out`/`zoom-in`) keeping `aria-label`+`title`; Fit `scan`, 100% `maximize`, `sm` ghost — `ZoomBar.vue`
- [ ] "Reload page" `refresh-cw` — `EditorView.vue`
- [ ] Added test cases (co-located tests, e.g. `ReplaceDialog.test.ts`): each button shows one `aria-hidden` svg, names and initial focus unchanged

## Edge cases

| Case | Behaviour |
|---|---|
| Exporting | "Exporting…" + Spinner replaces `download` |
| Zoom "−"/"+" text gone | Accessible names come from the unchanged `aria-label` |
| Replace dialog | Primary, not danger |

## Definition of Done

- [ ] Added Vitest cases pass; existing export, editor and pwa tests pass unedited
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
