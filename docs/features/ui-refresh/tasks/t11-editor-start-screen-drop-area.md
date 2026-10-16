---
id: T11
title: "Restyle the start screen: EmptyCanvas as a drop area highlighted while dragging, DropOverlay on a scrim, one column aligned with the Gallery"
layer: "ui"
deps: ["T3"]
blocks: ["T14"]
acs: ["AC-04", "AC-05"]
files_hint: ["src/features/editor/components/EmptyCanvas.vue", "src/features/editor/components/EmptyCanvas.test.ts", "src/features/editor/components/DropOverlay.vue", "src/features/editor/EditorView.vue"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 41 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Restyle the start screen's drop area

## Place in the sequence

- **Blocked by:** T3 — BaseButton · **Blocks:** T14 — e2e checks · **Wave:** 3.
- **Lane:** shares `src/features/editor/EditorView.vue` with T7 and T10 — serialized.

## Why (user story)

> **As an** Editor
> **I want** the start screen to offer one prominent place to open or drop an image
> **So that** I know at once how to begin
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

This task delivers the drop area, its drag highlight and the shared column the Gallery sits in.

## Inlined context

> The canvas area scrolls vertically. Its content is one column, centred, at most 1120 px wide, with `--space-7` side padding, so the drop area's left and right edges line up with the Gallery below (AC-04).
>
> - **Drop area** (`EmptyCanvas`, restyled): a `--radius-xl` card with a 2 px dashed `--color-border-strong` border on `--color-surface-raised`, `--space-8` padding, centred content: the `image-plus` icon at `--icon-size-lg` in `--color-accent-text`, the heading "Open an image to start" (`--font-size-2xl`, `--font-weight-bold`, a `<p>`, not a heading, so the outline is unchanged), the `BaseButton` primary `lg` "Open image" with `image-plus`, and the hint "or drop an image anywhere in this window" (`--font-size-sm`, `--color-text-muted`, as today). The card itself is not focusable and has no click handler (AC-04).
>
> | drag-over | A file is dragged anywhere over the window (AC-04). The drop area's border turns 2 px solid `--color-accent-text` and its background `--color-accent-subtle`. Over it, `DropOverlay` shows "Drop an image to open it" in a solid pill on `--color-scrim`, so the highlight shows through |
> | drop refused | The dropped file is not a Supported image (AC-05). The highlight and the overlay end, no Work opens, and open-and-view's refusal shows with its wording unchanged |
>
> — `screens.md §SCR-02, intro + Drop area + rows, abridged` · full text: [screens.md](../screens.md)

> **Drop overlay.** open-and-view's `DropOverlay` stays and keeps its text "Drop an image to open it" (pinned by `EditorView.test.ts` and `e2e/open-and-view/empty-and-drop.spec.ts`, which QG-2 forbids editing). Its background becomes `--color-scrim` (translucent) with the text in a solid pill.
>
> — `screens.md §Source, Decisions, Drop overlay, abridged` · full text: [screens.md](../screens.md)

Today: the window-wide drag state is `dragging` in `EditorView.vue:15` (`onDragEnter`/`onDragLeave` at :139-140); `<DropOverlay v-if="dragging" />` at :250; the start screen is `EmptyCanvas` above the `#start-screen` slot (GalleryStart).

> **Hard rule:** 1120 px is a `max-width` — `tokens.test.ts` forbids hard-coded px widths in components, so add it as a token (e.g. `--content-max-width`).
>
> — `src/shared/styles/tokens.test.ts`, «sizes every box from tokens», abridged

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-02 (wireframes 02-a, 02-e). Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. `EmptyCanvas` gains a `highlighted: boolean` prop fed from `dragging`.

## Acceptance criteria

### AC-04 — happy path

> **Given** no Work is open
> **When** the Editor looks at the start screen
> **Then** a large drop area shows an image icon, a short heading, a prominent "Open image" button and a hint that an image can be dropped anywhere in the window, and its left and right edges line up with the Gallery below it; the area itself is decoration, so only its button opens the file picker and the area adds no stop to the keyboard order, and it is highlighted while a file is dragged anywhere over the window
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — error

> **Given** no Work is open and the Editor drags a file over the window
> **When** they drop a file that is not a Supported image
> **Then** the drop area's highlight ends, no Work opens, and the app names the reason in plain language exactly as it does today
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Drop-area card, icon, `<p>` heading, primary `lg` "Open image" with `image-plus`, hint; `highlighted` styles — `EmptyCanvas.vue`
- [ ] Scrim background + solid pill, text unchanged — `DropOverlay.vue`
- [ ] Pass `dragging` to `EmptyCanvas`; one centred column (`max-width` token, `--space-7` padding) wrapping `EmptyCanvas` and the start-screen slot — `EditorView.vue` (+ the token in `tokens.css` if T1 didn't add it)
- [ ] Tests: the card has no `tabindex` and no click handler (clicking it opens nothing); only the button emits `open`; `highlighted` toggles the class — `EmptyCanvas.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Click on the card outside the button | Nothing happens |
| Drop of an unsupported file | Highlight ends with `dragging = false`; existing refusal notice, wording unchanged |
| Drag leaves the window | Highlight ends |
| Reduced motion | Highlight is a colour change only |

## Definition of Done

- [ ] `EmptyCanvas.test.ts` passes; `EditorView.test.ts` and `e2e/open-and-view/empty-and-drop.spec.ts` pass unedited
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
