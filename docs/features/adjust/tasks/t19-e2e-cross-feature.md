---
id: T19
title: "Add the e2e cross-feature suite: Unsaved edits, export and crop refusals in both directions, replace while open, no-image hint, View untouched, Crop and rotate shows the adjusted image"
layer: "tests"
deps: ["T10", "T16"]
blocks: ["T20"]
acs: ["AC-11", "AC-15", "AC-16", "AC-17", "AC-18", "AC-19", "AC-20"]
files_hint: ["e2e/adjust/cross-feature.spec.ts", "e2e/adjust/helpers.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 65 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T19 — Add the e2e cross-feature suite: Unsaved edits, export and crop refusals in both directions, replace while open, no-image hint, View untouched, Crop and rotate shows the adjusted image

## Place in the sequence

- **Blocked by:** T10 — Make the export refusal name the open tool and make 'Crop and rotate' and C hint 'apply or cancel the open tool first' while Adjust is open · T16 — Mount AdjustTool in the editor's tool slot with the 'Before' label, Enter / Escape / held backslash keys, window-blur end of Compare, focus handling and the tool-ready mark.
- **Blocks:** T20 — Add the @perf suite: drag frame interval, Apply / Cancel / Reset / Compare-release and tool-ready times, Auto time, memory after 50 Applies, and export time with all seven set.
- **Wave:** 8 — alongside T18.
- **Lane:** shares `e2e/adjust/helpers.ts` with T17; shares `e2e/adjust/helpers.ts` with T18 — serialized.

## Why (user story)

> **US-07: Export what I see after adjusting**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Adjustments I applied  
> **So that** the saved file looks exactly like the Preview, and other tools show the same image
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It proves the tool plays by the rules of open-and-view, export and crop-rotate in real browsers.

## Inlined context

> One task makes the slot's preview and fit per tool (§5), with store tests for both tools and an AC-20 e2e that checks zoom and pan after opening, applying and cancelling. Another makes both hints name the open tool, and the AC-16 and AC-18 e2e tests run with each tool open
>
> — `sad.md §11, Brownfield risk mitigation, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Ctrl/Cmd+S must be checked for the browser's "Save page" never opening (preventDefault observed via no download/dialog). The AC-18 seam check: open Crop and rotate on an adjusted Work and compare the pixels just outside and inside the frame with the adjusted Work.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-11 — cross-context

> **Given** an image is open
> **When** the Editor applies the "Adjust" tool
> **Then** the Work has Unsaved edits only when the applied Adjustments differ from the ones the Work had when the tool was opened. The seven values are compared one by one, not by the pixels they produce, and an Apply with no change, or with values changed and then changed back by hand in the same tool, leaves the Unsaved edits as they were. The comparison is only with the values from when the tool was opened: after an Export, changing a value in one Apply and changing it back in a later Apply still leaves the Work with Unsaved edits. After a change has been applied, opening another image asks for confirmation as open-and-view AC-15 requires, and a successful Export clears the Unsaved edits again (export AC-09)
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — authorization

> **Given** an export is in progress (export AC-11)
> **When** the Editor tries to open the "Adjust" tool, by its button or by its keyboard shortcut
> **Then** the tool is not allowed to open: its button is visibly disabled and the shortcut does nothing, and the request is refused, not queued, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — cross-context

> **Given** the "Adjust" tool is open
> **When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
> **Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the adjustments first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page"
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — cross-context

> **Given** the "Adjust" tool is open with a Draft that is not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its Draft until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its Draft is discarded with the old Work; the new Work starts with neutral Adjustments. If the new image cannot be opened or the replacement is declined, the tool stays open with its Draft. A Draft never counts as Unsaved edits on its own
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** an image is open with applied Adjustments
> **When** the Editor opens the "Crop and rotate" tool, or tries to open one tool while the other is open
> **Then** the "Crop and rotate" tool shows the whole image with its applied Adjustments, including the area outside the crop frame, so widening the frame never shows a seam, and any Geometry the Editor applies keeps the Adjustments as they are. Only one of the two tools can be open at a time: while one is open, the other's button is unavailable with a hint to apply or cancel the open tool first, and its keyboard shortcut shows the same hint, except while a text field has focus, when the shortcut does nothing (AC-21, crop-rotate AC-20)
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — error

> **Given** no image is open
> **When** the Editor looks for the "Adjust" tool or presses its keyboard shortcut
> **Then** the tool is unavailable, its hint says to open an image first, and the shortcut shows the same hint
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

### AC-20 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor opens the "Adjust" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** opening the tool does not change the View, zoom and pan keep working inside the tool, and none of them changes the Draft or counts as an edit. After Apply or Cancel the View stays as it was
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] AC-11: Apply with no change / change-and-back keeps Unsaved edits; change after Export raises them; replace asks for confirmation — `e2e/adjust/cross-feature.spec.ts`
- [ ] AC-15/16/18/19: refusals in both directions with each tool open, and no image — `cross-feature.spec.ts`
- [ ] AC-17: drop a file while open (success, failure, decline) — `cross-feature.spec.ts`
- [ ] AC-20: zoom/pan before, inside and after the tool — `cross-feature.spec.ts`
- [ ] AC-18: Crop and rotate shows the adjusted whole image; a Geometry keeps the Adjustments — `cross-feature.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Export running when A is pressed | nothing, and no queued open after the export |
| Dropped file fails to decode while open | tool and Draft unchanged |

## Definition of Done

- [ ] `pnpm test:e2e e2e/adjust/cross-feature.spec.ts` green on Chromium, Firefox and WebKit
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
