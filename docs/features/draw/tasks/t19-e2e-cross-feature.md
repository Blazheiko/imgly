---
id: T19
title: "Add the e2e cross-feature suite: Unsaved edits rules, export and Ctrl/Cmd+S refused while drawing, one tool at a time in both directions, Draw refused during an export and with no image, replace while open, and marks in Crop and rotate and Adjust"
layer: "tests"
deps: ["T10", "T16"]
blocks: ["T20"]
acs: ["AC-11", "AC-12", "AC-13", "AC-14", "AC-15", "AC-16", "AC-17"]
files_hint: ["e2e/draw/cross-feature.spec.ts", "e2e/draw/helpers.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 67 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T19 — Add the e2e cross-feature suite: Unsaved edits rules, export and Ctrl/Cmd+S refused while drawing, one tool at a time in both directions, Draw refused during an export and with no image, replace while open, and marks in Crop and rotate and Adjust

## Place in the sequence

- **Blocked by:** T10 — Send the applied layer to the export worker and its window fallback, render it in one or two passes, and make the crop-transparency check include the layer · T16 — Mount DrawTool in the tool slot with the overlay, add the in-tool keys B, E, [ ], Enter and Escape, focus on open and close, and the tool-ready mark.
- **Blocks:** T20 — Complete the @perf suite: drawing frame interval and latency through the real overlay, tool-ready, Apply / Cancel / Clear and Crop-and-rotate Apply over a full layer, export time with a full layer, and memory after 50 Applies.
- **Wave:** 8 — alongside T18.
- **Lane:** shares `e2e/draw/helpers.ts` with T17; shares `e2e/draw/helpers.ts` with T18 — serialized.

## Why (user story)

> **US-06: Export what I see after drawing**
>
> **As a** Editor  
> **I want** the Export and the other tools to show the drawing I applied, exactly as the Preview shows it  
> **So that** the saved file looks exactly like what I approved
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It proves the tool plays by the editor's shared rules, so no unapplied Draft can reach an Export and no tool steps on another.

## Inlined context

> *QG-2d. Unsaved edits change only with a real change*
> - **When:** Applies are made with no Stroke, with Brush Strokes only outside the Crop, with an Eraser Stroke only where nothing was drawn, with a Clear of an empty layer, with a mark drawn and erased again in one Draft, and with a mark drawn in one Apply and erased in a later one after an Export.
> - **Then:** the first four leave the Unsaved edits as they were, and the last two give the Work Unsaved edits (AC-12).
>
> — `sad.md §10, QG-2d, abridged` · full text: [sad.md](../sad.md)

> While "Draw" is open, Export and Ctrl/Cmd+S show "apply or cancel the drawing first" and never open the browser's "Save page" (AC-15). "Crop and rotate" and "Adjust" show "apply or cancel the open tool first", and C and A do nothing in a text field (AC-16).
>
> — `sad.md §6, F7 prose, abridged` · full text: [sad.md](../sad.md)

Mirror `e2e/adjust/cross-feature.spec.ts` (export-in-progress gating, replace while open, Unsaved-edits checks through the replace dialog). Lane: shares `e2e/draw/helpers.ts` with T17 and T18.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-11 — cross-context

> **Given** the Work has applied marks on its Drawing layer
> **When** the Editor opens the "Adjust" tool or the "Crop and rotate" tool, or opens the "Draw" tool on a Work with applied Geometry and Adjustments
> **Then** in the "Adjust" tool the Preview shows the marks over the image unchanged by the Draft, and Compare's "Before" view shows them too, because Adjustments never touch the Drawing layer. The "Crop and rotate" tool shows the whole image with all its marks, including the ones outside the crop frame, so widening the frame shows them where they will be. In the "Draw" tool the Editor draws over the image as it stands with its Geometry and its applied Adjustments
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — cross-context

> **Given** an image is open
> **When** the Editor applies the "Draw" tool
> **Then** the Work has Unsaved edits when the applied Draft contains at least one change: a Brush Stroke with any painted part inside the Crop, or an Eraser Stroke or a Clear that removed any mark. The layer is not compared pixel by pixel, so drawing a mark and erasing it again in the same Draft still counts as a change. An Apply with no Stroke, with Brush Strokes only outside the Crop, with an Eraser Stroke only where nothing was drawn, or with a Clear of an already empty Drawing layer leaves the Unsaved edits as they were, as an Apply with no change does in crop-rotate AC-13 and adjust AC-11. The comparison is only with the Drawing layer from when the tool was opened: after an Export, drawing a mark in one Apply and erasing it in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — cross-context

> **Given** the "Draw" tool is open with a Draft that is not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with an empty Drawing layer. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — authorization

> **Given** an export is in progress (export AC-11)
> **When** the Editor tries to open the "Draw" tool, by its button or by its keyboard shortcut
> **Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — cross-context

> **Given** the "Draw" tool is open
> **When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
> **Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the drawing first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page"
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

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

## Checklist

- [ ] Unsaved-edits table, refusals both ways, export gating, no-image hint, replace accept/decline/fail, marks in Crop and rotate and Adjust/Compare — `e2e/draw/cross-feature.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| replace declined | tool open, Draft intact |
| new image fails to open | tool open, Draft intact |
| Ctrl/Cmd+S in the tool | hint toast; no Save page dialog |
| D during export | nothing happens |

## Definition of Done

- [ ] suite green on Chromium, Firefox and WebKit
- [ ] every listed AC has at least one assertion
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
