---
id: T13
title: "Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset"
layer: "app"
deps: ["T4", "T8"]
blocks: ["T14", "T15", "T16"]
acs: ["AC-08", "AC-11", "AC-12", "AC-17"]
files_hint: ["src/features/crop-rotate/store.ts", "src/features/crop-rotate/store.test.ts", "src/features/crop-rotate/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 68 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Add the crop-rotate store: Draft, Geometry at open, remembered proportion per Work, field state, apply / cancel / reset

## Place in the sequence

- **Blocked by:** T4 — Add proportions, typed crop sizes and the field input rules (parseAngle, parseCropSize, plain decimal only) · T8 — Add the editor store's tool slot: activeTool, openTool/closeTool, previewGeometry, applyGeometry, activePanel and tool-aware fit-View.
- **Blocks:** T14 — Add the 'Crop and rotate' toolbar action, its hints, the C shortcut and the tool's message catalog · T15 — Build CropOverlay: dimmed outside, frame with 8 focusable handles, both grids, pointer drags and arrow keys · T16 — Build CropRotateControls: rotate and flip buttons, straighten slider and field, proportion, width and height, Reset / Cancel / Apply.
- **Wave:** 5 — alongside T10.
- **Lane:** shares `src/features/crop-rotate/index.ts` with T14; shares `src/features/crop-rotate/index.ts` with T17 — serialized.

## Why (user story)

> **US-07: Change my mind without losing pixels**
>
> **As a** Editor  
> **I want** to cancel, reset or widen a crop I applied earlier  
> **So that** trying a frame never costs me part of the photo for good
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

> **US-05: Crop to a set shape**
>
> **As a** Editor  
> **I want** to lock the crop frame to a common proportion such as 1:1 or 16:9  
> **So that** the result fits an avatar, a post or a screen without manual measuring
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It holds the Draft apart from the Work, so Cancel, Reset and a replace never cost a pixel, and a chosen proportion is remembered for the Work.

## Inlined context

> - **`crop-rotate` store** (`src/features/crop-rotate/store.ts`): on open, it copies `work.geometry` as the draft and the Geometry to return to. Every change goes through `core/geometry` and is pushed to `editor.previewGeometry`. Apply calls `editor.applyGeometry(draft)` then `closeTool()`, Cancel calls only `closeTool()`, and Reset changes only the draft (AC-12). It remembers the proportion per Work id until the Work is replaced (AC-08). It watches `activeTool` and drops the draft when the editor closes the tool.
>
> — `adr/0003 §How it works, crop-rotate store, verbatim` · full text: [adr/0003](../adr/0003-open-tools-in-an-active-tool-slot-with-the-draft-in-the-feature-store.md)

> Two stores must stay in step: the tool store's watcher on `activeTool` is the only thing that discards a draft after a replace, and a missed watcher shows a stale draft on the next open. A store test covers it.
>
> — `adr/0003 §Consequences, Negative bullet 1, verbatim` · full text: [adr/0003](../adr/0003-open-tools-in-an-active-tool-slot-with-the-draft-in-the-feature-store.md)

> `store.ts` — `cropRotate` store: draft, Geometry at open, proportion per Work (AC-08), field state, apply / cancel / reset
>
> — `sad.md §5, Internal decomposition, verbatim` · full text: [sad.md](../sad.md)

> S->>S: opens the tool slot, copies the Work's Geometry as the Draft and as the Geometry to return to
> S->>S: picks the proportion: remembered for this Work, else Free
> … Reset: Draft becomes no Geometry, no Rotation, no Flip, 0 degrees, Crop covering the whole image, proportion Free · the Work itself is unchanged until Apply
> … Cancel: cancel the tool, a value still being typed is discarded · drops the Draft, the proportion stays remembered
>
> — `sad.md §6, F1 steps 5–6 + F6 Reset and Cancel branches, abridged` · full text: [sad.md](../sad.md)

> | ID strategy | No new entities and no new IDs. The remembered proportion is keyed by the Work's existing `id` (`newId()`, UUIDv7) | repo `CLAUDE.md` §Conventions |
>
> — `sad.md §8, ID strategy, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts`. May import `core`, `infra`, `render`, `shared`. Features never import each other … Like export, its only cross-feature import is `useEditorStore` from `@/features/editor`.
>
> — `CLAUDE.md §Module boundaries + sad.md §5 intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md) · [sad.md](../sad.md)

Field state: per field (`angle`, `width`, `height`) a `pending: string | null`; `commitField(field)` runs T4's `parseAngle` / `parseCropSize` + `setStraighten` / `setCropSize`; `cancel()` drops all pending text. This store does not handle keys or DOM (T15–T17).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The remembered proportion is session memory keyed by Work id — `sad.md` §8 Persistence.)

## API contract

Internal — no API surface. (Store surface: `open()`, `draft`, `proportion`, `rotate(dir)`, `flip(axis)`, `setAngle(tenths)`, `moveBy`, `resizeBy`, `chooseProportion`, `setPending`, `commitField`, `reset()`, `apply()`, `cancel()`.)

## Acceptance criteria

### AC-08 — happy path

> **Given** the "Crop and rotate" tool is open
> **When** the Editor chooses a proportion: Free, Original, 1:1, 4:3, 3:2 or 16:9, optionally switched between landscape and portrait
> **Then** the crop frame becomes the largest frame of that proportion that fits inside the current frame, centred on it, and keeps that proportion while it is dragged or resized until the Editor chooses Free. Free is the default when the tool opens for a Work for the first time. Original always means the proportions of the image as it stands after its current Rotation, so it follows a later Rotation or Reset. The frame's long side is the input: the short side is the long side divided by the proportion, rounded to the nearest whole pixel, and an exact half pixel rounds up, the same rule as export AC-05. A proportion is kept when the short side is within 0.5 px of the exact value. The tool remembers the chosen proportion and its landscape or portrait orientation for the same Work until the Work is replaced. It is remembered as soon as it is chosen, even if the tool is then cancelled
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — happy path

> **Given** the Editor has changed the Rotation, Flip, Straighten angle or crop frame in the open tool
> **When** the Editor chooses Cancel or presses Escape
> **Then** the tool closes and the Work keeps the Geometry it had before the tool was opened, with its Unsaved edits unchanged
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — domain invariant

> **Given** a Crop was applied earlier to the open Work
> **When** the Editor opens the "Crop and rotate" tool again
> **Then** the tool shows the whole image with the current Rotation, Flip and Straighten angle, and the crop frame where the Crop is, so the Editor can widen it. Widening the frame back to the whole image and applying gives exactly the pixels the Work had before the Crop, because the Geometry never removes pixels from the Original. Reset in the tool returns to no Geometry (no Rotation, no Flip, a Straighten angle of 0° and the Crop covering the whole image), sets the proportion to Free, and takes effect only on Apply
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-17 — cross-context

> **Given** the "Crop and rotate" tool is open with changes that are not applied
> **When** the Editor opens another image, by the "Open image" action or by dropping a file
> **Then** the tool stays open with its changes until the new image has been read and, when the Work has Unsaved edits, the Editor has confirmed the replacement, as open-and-view requires. Only then does the tool close, and its changes that were not applied are discarded with the old Work. If the new image cannot be opened or the replacement is declined, the tool stays open with its changes. Changes in the open tool that are not applied never count as Unsaved edits on their own
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Setup store `useCropRotateStore`: `open()` calls `editor.openTool('crop-rotate')` and returns its refusal; on success copy Draft + `atOpen`, pick proportion — `src/features/crop-rotate/store.ts`
- [ ] Actions delegating to `core/geometry` (T1–T4), each pushing `editor.setPreviewGeometry(draft)` — `src/features/crop-rotate/store.ts`
- [ ] `apply()` → `editor.applyGeometry(draft)` + `closeTool()`; `cancel()` → `closeTool()`; `reset()` → `identityGeometry` + Free on the Draft only — `src/features/crop-rotate/store.ts`
- [ ] Remembered proportion map keyed by Work id, written at choose time, cleared when the Work id changes — `src/features/crop-rotate/store.ts`
- [ ] Watch `editor.activeTool` → null: drop Draft and pending text — `src/features/crop-rotate/store.ts`
- [ ] Public `useCropRotateStore` — `src/features/crop-rotate/index.ts`; tests in `store.test.ts` against a real editor store

## Edge cases

| Case | Behaviour |
|---|---|
| `open()` with no Work / during export | returns the refusal reason; no Draft |
| Choose 4:3, then Cancel, then reopen | 4:3 is selected (remembered at once) |
| Replace the Work, then open | proportion Free (new Work id), Draft from the new Work |
| Reset, then Cancel | Work keeps its earlier Geometry |
| Reset, then Apply on a Work that had a Crop | Work gets the identity; widening back gives the earlier pixels |
| Rotate with 4:3 landscape locked | becomes 3:4 (orientation turns) |
| Typing pending in Width, then Cancel | pending discarded, nothing committed |
| Drop while open and read fails | Draft kept (no `activeTool` change) |

## Definition of Done

- [ ] Store tests prove AC-11 (Cancel leaves Work + revision), AC-12 (whole-image Draft, Reset only on Apply), AC-08 (memory per Work, even after Cancel) and AC-17 (Draft discarded only when the slot closes on replace)
- [ ] Store tests prove every edit action updates `editor.previewGeometry` and never the Work
- [ ] every Hard Rule inlined above still holds (only `@/features/editor` imported across features)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
