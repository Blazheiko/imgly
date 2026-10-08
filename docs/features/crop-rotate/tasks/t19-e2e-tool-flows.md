---
id: T19
title: "Add the e2e tool-flow suite: three-action paths, export refusals, replace while open, View fit and frame alignment"
layer: "tests"
deps: ["T11", "T17"]
blocks: ["T20"]
acs: ["AC-01", "AC-16", "AC-17", "AC-19", "AC-20"]
files_hint: ["e2e/crop-rotate/tool.spec.ts", "e2e/crop-rotate/helpers.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 64 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T19 — Add the e2e tool-flow suite: three-action paths, export refusals, replace while open, View fit and frame alignment

## Place in the sequence

- **Blocked by:** T11 — Refuse Export and Ctrl/Cmd+S while a tool is open with the 'apply or cancel the crop first' hint, and report the open panel · T17 — Mount CropRotateTool in a new EditorView tool slot, with Enter to apply, Escape to cancel, focus handling and fit-View.
- **Blocks:** T20 — Add the @perf suite: drag and slider frame interval, action-to-Preview and tool-ready times, memory after 50 Applies, export time with a Geometry.
- **Wave:** 8.
- **Lane:** shares `e2e/crop-rotate/helpers.ts` with T18; shares `e2e/crop-rotate/helpers.ts` with T20 — serialized.

## Why (user story)

> **US-09: Crop and rotate on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find the crop and rotate tool and use it by mouse or keyboard without instructions  
> **So that** I can judge the first real edit in the open, edit and save flow
>
> — `spec.md §4, US-09, verbatim` · full text: [spec.md](../spec.md)

It proves the whole tool works in real browsers by mouse and keyboard, including the cross-feature refusals happy-dom can't show end to end.

## Inlined context

> - **Actions for a common edit** — baseline: none (no tool yet), target: ≤ 3 actions to rotate an image once and keep it, and ≤ 3 actions to crop it to a square, by ship.
>
> — `spec.md §7, KPI 2, verbatim` · full text: [spec.md](../spec.md)

> AC-20 … The "three actions" counts are a path length, F1 then F3 or F5 then F6, checked by e2e, not a separate flow
>
> — `sad.md §6, Coverage table row AC-20, abridged` · full text: [sad.md](../sad.md)

> The crop overlay (DOM) and the Preview (WebGL) can disagree by half a pixel at high zoom (ADR-0005) — Mitigation: Both use the same View and `core` maths. An e2e screenshot check of the frame on the image edge at 100% and 800%
>
> — `sad.md §11, risk row 7, verbatim` · full text: [sad.md](../sad.md)

> F8: Opening another image or dropping a file doesn't close the tool straight away. A cancelled file dialog, or a file that can't be opened, leaves the tool exactly as it was. When the new image has been read and the Work has Unsaved edits, the replace confirmation appears: declining keeps the tool and its Draft, and replacing closes the tool and discards the Draft with the old Work. With no Unsaved edits the new Work replaces it directly, and the tool closes the same way (AC-17).
>
> — `sad.md §6, F8 prose, abridged` · full text: [sad.md](../sad.md)

> | export refused | Export or `Ctrl/Cmd+S` while the tool is open (F7, AC-16). The browser's "Save page" never opens | as `default` + `Toast` `info` "Apply or cancel the crop first, then export." | wireframe 03-d |
>
> — `screens.md §SCR-03 row export refused, verbatim` · full text: [screens.md](../screens.md)

> e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions (Tests), verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Keep this suite to what needs a real browser: real key events against `Save page`, pointer drags over a WebGL canvas, drag-and-drop, screenshot alignment. Everything checkable on happy-dom already is (T14–T17). Shares `e2e/crop-rotate/helpers.ts` with T18.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open
> **When** the Editor opens the "Crop and rotate" tool, drags an edge or a corner of the crop frame inwards, and chooses Apply
> **Then** the tool closes, the Preview shows only the area inside the frame, and the size shown for the Work is the Crop's width and height in pixels, followed by the Original's dimensions whenever the width or the height differs, compared in order, so a 90° Rotation alone also shows them (for example "1920×1080, from 4096×3072"), so the Original's dimensions stay visible as open-and-view AC-05 and AC-06 require. While the tool is open, the area outside the frame is dimmed, a rule-of-thirds grid shows inside the frame while it is being dragged, and the whole frame can be moved by dragging inside it. The Work now has Unsaved edits (AC-13)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — cross-context

> **Given** the "Crop and rotate" tool is open
> **When** the Editor tries to export, by the Export action or by Ctrl+S (Cmd+S on a Mac)
> **Then** the export does not start: Export is unavailable while the tool is open, and a hint says to apply or cancel the crop first. Ctrl/Cmd+S shows the same hint and never opens the browser's "Save page", so an Export never contains a Geometry the Editor has not applied
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — cross-context

> **Given** the "Crop and rotate" tool is open with changes that are not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its changes until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its changes that were not applied are discarded with the old Work. If the new image cannot be opened or the replacement is declined, the tool stays open with its changes. Changes in the open tool that are not applied never count as Unsaved edits on their own
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — cross-context

> **Given** an image is open
> **When** the Editor opens the "Crop and rotate" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** on opening, the View fits the whole image with its current Rotation, Flip and Straighten angle, so every edge of the frame can be reached. Zoom and pan keep working inside the tool, and they never change the Geometry or count as an edit. After Apply or Cancel, the View fits the Work
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

### AC-20 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to crop or turn it
> **Then** a "Crop and rotate" action is visible in the toolbar next to Export. It can be reached with Tab and activated with Enter or Space, and the C key opens it as well. The C key does nothing while the export panel is open, while the tool is already open, or while a text field has focus. Inside the tool every control can be reached with Tab. With the frame focused, the arrow keys move it by 1 px of the image (10 px with Shift). With a frame edge or corner focused, they resize it by the same step, and with a proportion locked the other side follows as in AC-08. With the straighten slider focused, they change the angle by 0.1° (1° with Shift). Enter or Space on a focused button presses that button. Enter anywhere else applies the tool, except in a field (AC-07, AC-10). Escape cancels the tool from anywhere in it, including a field, and a value still being typed is discarded with it. Rotating once and keeping it takes three actions (open the tool, rotate, Apply), and cropping to a square takes three actions (open the tool, choose 1:1, Apply)
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] UI helpers: open the tool, drag a handle, press keys, read the status bar — `e2e/crop-rotate/helpers.ts`
- [ ] Three-action paths (mouse and keyboard): rotate once; 1:1 — `e2e/crop-rotate/tool.spec.ts`
- [ ] AC-01: drag an edge inwards + Apply → status bar "w × h px, from W × H px" — same file
- [ ] AC-16: Ctrl/Cmd+S and Export while open → hint, no download, no "Save page" — same file
- [ ] AC-17: drop while open → tool stays during read; decline keeps; confirm closes — same file
- [ ] AC-19 + alignment: View fit on open/Apply/Cancel; screenshot of the frame on the image edge at 100% and 800% — same file

## Edge cases

| Case | Behaviour |
|---|---|
| Mac WebKit uses Cmd+S | same hint as Ctrl+S elsewhere |
| Drop of a corrupt file while open (`e2e/fixtures/corrupt.png`) | failure notice; tool unchanged |
| No Unsaved edits, drop while open | replaced directly, tool closes |
| Arrow keys on a corner with 1:1 locked | stays square |

## Definition of Done

- [ ] `pnpm test:e2e e2e/crop-rotate/tool.spec.ts` passes on Chromium, Firefox and WebKit
- [ ] The three-action paths are asserted by counting user actions in the test
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
