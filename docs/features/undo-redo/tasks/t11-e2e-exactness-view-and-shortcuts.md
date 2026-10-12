---
id: T11
title: "e2e (Chromium, Firefox, WebKit): pixel-exact Undo and Redo for each tool, View fit, marks follow Geometry, shortcuts per engine"
layer: "tests"
deps: ["T10"]
blocks: []
acs: ["AC-03", "AC-12", "AC-13", "AC-14"]
files_hint: ["e2e/undo-redo/fidelity.spec.ts", "e2e/undo-redo/flows.spec.ts", "e2e/undo-redo/helpers.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 50 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — e2e (Chromium, Firefox, WebKit): pixel-exact Undo and Redo for each tool, View fit, marks follow Geometry, shortcuts per engine

## Place in the sequence

- **Blocked by:** T10 — e2e (Chromium): the 512 MB budget, Steps kept and layer release after replace, discard and drop.
- **Blocks:** — (nothing waits on it).
- **Wave:** 8.
- **Lane:** shares `e2e/undo-redo/helpers.ts` with T10 — serialized.

## Why (user story)

> **US-03: Step back through several changes**
>
> **As an** Editor  
> **I want** to undo several changes in a row, across all three tools  
> **So that** I can return to how the image looked several steps ago
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

It proves Undo and Redo never approximate a state, on every engine.

## Inlined context

> | Exactness of undo and redo | difference 0 per channel between a full-size PNG Export after Undo (or Redo) and the Export of the same state made before it | e2e pixel comparison on Chromium, Firefox and WebKit, for Steps of each tool, with all seven Adjustments away from neutral and a Straighten angle |
>
> — `spec.md §6, Exactness row, verbatim` · full text: [spec.md](../spec.md)

> Shortcut collisions: Shift+Ctrl/Cmd+Z and Ctrl+Y have no default action in the target browsers outside text fields, but Cmd+Y opens Safari's History — Mitigation: Redo handles Ctrl+Y with `ctrlKey` only and never Cmd+Y. Handled keys call `preventDefault`. A shortcut test per engine in e2e
>
> — `sad.md §11, shortcut collisions row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Reuse: the export-download pixel comparison used by `e2e/draw/fidelity.spec.ts` and `e2e/adjust/*`; `setGeometry`/`setAdjustments`/reference-drawing hooks to reach exact states; `e2e/undo-redo/helpers.ts` from T10 (shared file — serialized after T10, which sad §11 wants as the first e2e task). Drive Undo/Redo through the real buttons and shortcuts, not hooks.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-03 (US-03) — domain invariant

> **Given** the Editor has opened an image, then applied a Crop, Adjustments and a drawing in that order
> **When** the Editor chooses Undo three times, and then Redo three times
> **Then** after the three Undos the Work is exactly the Work as it was opened, and after the three Redos it is exactly the Work as it was after the drawing: a full-size Export at each point is identical, pixel for pixel, to an Export of that same state made before any Undo. Undo and redo never approximate a state; they restore it
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-03) — cross-context

> **Given** the Editor has applied a Crop or a Rotation that changed the image's size, and then zoomed in
> **When** the Editor undoes that Step
> **Then** the View fits the restored image, as it does after an Apply in "Crop and rotate" that changes the image's size. Undoing or redoing a Step that keeps the image's size, such as Adjustments, a drawing or a Crop of the same size, keeps the View as it was
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 (US-03) — cross-context

> **Given** the Editor has drawn marks and applied them, then applied a Crop and a Rotation, and then applied "Draw" again after Clear
> **When** the Editor undoes the last Step, and then undoes the Rotation
> **Then** after the first Undo every mark is back on the same image content it was drawn on (draw AC-08), and after the second Undo the marks follow the image back to its earlier orientation. The Drawing layer always returns together with the Geometry it was applied under, never shifted or stretched
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-14 (US-06) — happy path

> **Given** a Portfolio reviewer has opened an image and applied one change with any tool
> **When** they look for a way to take it back
> **Then** Undo and Redo are two buttons in the top bar, in the place desktop editors use, each with a hint that names the action and its shortcut. They can be reached and used by keyboard alone, and Ctrl/Cmd+Z works from anywhere in the editor except a focused text or number field, so the change is taken back in at most one action
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Exactness: for each tool, Export state S, apply Step, Undo → Export equals S; Redo → Export equals the post-Step Export; AC-03 three-Undo/three-Redo sequence — `e2e/undo-redo/fidelity.spec.ts`
- [ ] AC-13: draw, Crop + Rotation, Draw after Clear; Undo, Undo; compare Exports — `e2e/undo-redo/fidelity.spec.ts`
- [ ] AC-12: zoom in, Undo a size-changing Crop → View fitted; Undo Adjust → View kept — `e2e/undo-redo/flows.spec.ts`
- [ ] AC-14 + shortcuts per engine: Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y act; Cmd+Y does nothing to the history; Tab to Undo + Enter — `e2e/undo-redo/flows.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| WebKit / Firefox float differences | none allowed: tolerance is 0 per channel |
| Ctrl+Z inside the export panel's number field | field text undo; history unchanged (AC-08) |
| Undo of a same-size Crop | View kept (AC-12) |

## Definition of Done

- [ ] `fidelity.spec.ts` and `flows.spec.ts` green on Chromium, Firefox and WebKit
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
