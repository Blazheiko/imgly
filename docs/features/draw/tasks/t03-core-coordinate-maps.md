---
id: T3
title: "Add frameToOriginal to the Geometry transform and deviceToFrame to the View, both unit-tested against the existing UV transform"
layer: "domain"
deps: []
blocks: ["T5", "T12"]
acs: ["AC-08", "AC-09", "AC-18"]
files_hint: ["src/core/geometry/transform.ts", "src/core/geometry/transform.test.ts", "src/core/geometry/index.ts", "src/core/view/frame.ts", "src/core/view/view.test.ts", "src/core/view/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 52 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T3 — Add frameToOriginal to the Geometry transform and deviceToFrame to the View, both unit-tested against the existing UV transform

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** T5 — Add the painter: paintSegment and paintDot with Brush source-over and Eraser destination-out under setTransform(frameToOriginal) and clip(crop), the dirty rectangle and the alpha-lowered check · T12 — Add the Stroke session: map coalesced positions through the View, paint Catmull–Rom segments and dots, set the change flag, flush the dirty rectangle once per frame, and hold input until the pointer is released.
- **Wave:** 1 — alongside T1, T2, T4.
- **Lane:** own lane.

## Why (user story)

> **US-05: Keep marks in place when I crop or turn later**
>
> **As a** Editor  
> **I want** my drawing to stay on the same part of the photo when I crop, turn, flip or straighten it afterwards  
> **So that** a circle around a face still circles that face after I change the framing
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It is the mapping that pins every mark to the image content, so marks follow every later Geometry change.

## Inlined context

> Three spaces with one direction of mapping. Device pixels on the canvas map through the View (`deviceToFrame`) into the Crop's frame, which maps through the Geometry (`frameToOriginal`) onto the Original's pixel grid, where the layer lives. Widths are in image pixels, the same in the frame and on the Original, because every Geometry step keeps lengths. Nothing is ever mapped back from the layer to the screen except by the shader
>
> — `sad.md §8, Coordinates, verbatim` · full text: [sad.md](../sad.md)

> **Pointer to frame.** … maps each position with the View at that moment into the Crop's frame: `frame = crop.origin + (devicePoint − round(pan)) / zoom`. A zoom mid-Stroke therefore changes only how later positions map, never what was painted (AC-18).
> **Frame to Original.** `src/core/geometry/transform.ts` exports `frameToOriginal(g, original)` beside `cropToOriginalUv`, the pixel-unit form of the transform that `cropToOriginalUv` already composes (crop-rotate ADR-0001). The painter sets it once per segment with `ctx.setTransform`
>
> — `adr/0002 §Decision outcome, How it works «Pointer to frame», «Frame to Original», abridged` · full text: [adr/0002](../adr/0002-paint-each-stroke-segment-straight-into-the-draft-in-original-coordinates.md)

> The Geometry is integer parameters on the Work, with one forward transform from the Crop's frame to the Original in `src/core/geometry/transform.ts` (crop-rotate ADR-0001). Every Geometry step is a rotation, a mirror or a translation, so it keeps lengths: one image pixel in the Crop's frame is one Original pixel
>
> — `sad.md §2, Technical, Geometry bullet, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/core/` — Pure TS domain: Work document, command stack, `Result` and error codes — May import: nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this)
> `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder — May import: `core`, `shared`
> `src/features/<f>/` — One feature: components, a Pinia setup store `store.ts`, a public `index.ts` — May import: `core`, `infra`, `render`, `shared`
> Features never import each other. They coordinate through the `editor` store (`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules only through their `index.ts`.
>
> — `CLAUDE.md §Module boundaries, table rows + paragraph, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

`transform.ts` already has a private `frameToOriginalUv(g, original): Rows` (L41) that `cropToOriginalUv` composes. `frameToOriginal` returns the same affine in pixel units as a Canvas-ready 2×3 `[a, b, c, d, e, f]` (for `ctx.setTransform`). The frame here is the Crop's frame with the crop origin at `crop.x, crop.y` — check how `cropToOriginalUv` composes the crop offset and stay consistent with it. Reuse `src/core/geometry/test-helpers.ts`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Drawing layer lives in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 stores it as a PNG Blob with its own migration.)

## API contract

Internal — no API surface. (`frameToOriginal(g, original): [a,b,c,d,e,f]`, `deviceToFrame(view, crop, point): Point`.)

## Acceptance criteria

### AC-08 — domain invariant

> **Given** the Work has applied marks on its Drawing layer
> **When** the Editor applies any Geometry in "Crop and rotate": a Rotation, a Flip, a Straighten angle or a new Crop
> **Then** every mark stays on the same part of the image: it turns, flips and straightens together with the image and keeps its shape and width relative to it. A mark outside a narrower Crop is hidden, not removed, and shows again when the Crop is widened to include it. Turning the image four quarter turns in either direction, or flipping it twice in the same direction, gives a full-size PNG Export identical to the one made before
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — domain invariant

> **Given** the "Draw" tool is open
> **When** a Stroke starts, passes or ends outside the Work's Crop, for example in the area around the image
> **Then** the Stroke is drawn at its full width along the whole pointer path and then clipped to the Crop: only the painted area that lies inside the Crop is painted or erased, and the rest leaves no mark. So a wide Stroke whose pointer path runs just outside a Crop edge paints the band of it that reaches inside, as the width circle shows, and a press just outside paints the part of its round dot that lies inside. Widening the Crop later shows no mark from the parts that were outside
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-18 — cross-context

> **Given** an image is open and the Editor has zoomed and panned the Preview
> **When** the Editor opens the "Draw" tool, zooms or pans while it is open, and then applies or cancels it
> **Then** opening the tool does not change the View. Inside the tool a drag with the main mouse button draws instead of panning, while the other View controls keep working: Ctrl/Cmd+wheel and pinch zoom, the plain wheel and Shift+wheel pan, a drag with Space held pans, and the zoom keys and controls work as in open-and-view. While a button in the tool has focus, Space presses that button and does not pan, as Space-drag does outside the Compare button in the "Adjust" tool; while a text field has focus, Space types. None of them makes a Stroke, changes the Draft or counts as an edit, and a Stroke in progress is not broken by a zoom. While a Stroke is in progress (the pointer is still pressed), input waits for it to finish: a colour, mode or width change (by control or by B, E, [ or ]) applies from the next Stroke, Space does not start a pan, and Enter applies the tool only after the pointer is released. Escape cancels the tool at once, the partial Stroke included (AC-06). A pointer cancel, the window losing focus or a second touch (for example the start of a pinch) ends the Stroke where it is and keeps what was drawn so far. After Apply or Cancel the View stays as it was
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `frameToOriginal(g, original)` beside `cropToOriginalUv`, built from the same rows — `src/core/geometry/transform.ts`
- [ ] Tests: equals `cropToOriginalUv` × (W₀, H₀) for 0/90/180/270, flips, a Straighten angle and a Crop; determinant ±1 (lengths kept) — `src/core/geometry/transform.test.ts`
- [ ] `deviceToFrame(view, crop, point)` = `crop.origin + (point − round(pan)) / zoom` — `src/core/view/frame.ts`, exported from `src/core/view/index.ts`
- [ ] Tests: round trip with the View's forward mapping at several zooms and fractional pans — `src/core/view/view.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| four quarter turns composed | the identity transform exactly (AC-08 round trip by construction) |
| two Flips in the same direction | the identity transform exactly |
| Straighten angle | rotation part is orthonormal (|det| = 1, width kept) |
| fractional pan | pan rounded as the View rounds it, so the mark lands under the pointer |

## Definition of Done

- [ ] transform and view tests cover every Edge case row
- [ ] no change to `cropToOriginalUv` output (existing tests unchanged)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
