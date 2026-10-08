---
id: T7
title: "Send the applied Adjustments to the export worker, set them as uniforms, and reduce smaller adjusted Exports in two passes"
layer: "infra"
deps: ["T5", "T8"]
blocks: ["T17"]
acs: ["AC-14", "AC-06"]
files_hint: ["src/render/export/worker-handler.ts", "src/render/export/worker-handler.test.ts", "src/render/export/client.ts", "src/render/export/client.test.ts", "src/features/export/store.ts", "src/features/export/store.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 44 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Send the applied Adjustments to the export worker, set them as uniforms, and reduce smaller adjusted Exports in two passes

## Place in the sequence

- **Blocked by:** T5 — Add the seven-step colour block to the shared shader (u_adjust) and PreviewRenderer.setAdjustments · T8 — Give the editor's tool slot the 'adjust' tool: per-tool open/close side effects, previewAdjustments, applyAdjustments and the snapshot's Adjustments.
- **Blocks:** T17 — Add the e2e fidelity suite: each slider at its anchors vs Preview, all seven combined, with and without a Geometry, neutral = 0 difference, exact alpha, lossless round trip, smaller sizes.
- **Wave:** 4 — alongside T6, T9, T14.
- **Lane:** own lane.

## Why (user story)

> **US-07: Export what I see after adjusting**
>
> **As a** Editor  
> **I want** the Export and the rest of the app to follow the Adjustments I applied  
> **So that** the saved file looks exactly like the Preview, and other tools show the same image
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It makes every Export contain exactly the applied Adjustments, with a smaller size reduced after adjusting.

## Inlined context

> **A smaller Export is reduced after the Adjustments, in two passes** … When the size is smaller than the Work and the Adjustments are not neutral, the export render first draws the Crop at full size with the Adjustments into a texture of the same context. It then builds that texture's mipmaps and draws it at the export size through the existing mipmapped minification, flattening onto white for JPEG in that second pass. A full-size Export, and any Export with neutral Adjustments, keeps today's single pass, so neutral Exports stay identical at every size. The window fallback (export ADR-0003) runs the same code.
>
> — `sad.md §5, two-pass reduction paragraph, abridged` · full text: [sad.md](../sad.md)

> **Export.** The worker sets the same uniforms from `ExportRequest.adjustments`. A full-size Export samples texel centres 1:1 as the Preview at 100% does, so both run the same steps on the same texels. …
>
> — `adr/0002 §Decision outcome, How it works, Export, abridged` · full text: [adr/0002](../adr/0002-apply-the-adjustments-in-the-shared-fragment-shader-on-stored-srgb-values.md)

> `ExportSnapshot` and `ExportRequest` gain `adjustments`. The crop-rotate transparency check does not, because Adjustments never change transparency (AC-06, AC-14).
>
> — `adr/0001 §Decision outcome, How it works bullet 3, verbatim` · full text: [adr/0001](../adr/0001-model-the-adjustments-as-seven-integer-fields-on-the-work.md)

> | Resource lifetime | … The export worker's full-size pass texture is deleted with the export's context, as the bitmap copy is closed today. … |
>
> — `sad.md §8, Resource lifetime row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/render/` — WebGL2 adjustments, Canvas 2D compositor, export encoder. May import `core`, `shared`.
>
> — `CLAUDE.md §Module boundaries, src/render row, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Contract change, folded in:** `ExportRequest` (in `worker-handler.ts`) gains a required `adjustments`, so this task also updates its constructors: the export store (`adjustments: snapshot.adjustments`, from T8) and `handleCheck`'s probe request (`NEUTRAL_ADJUSTMENTS`). Use T5's `setAdjustmentUniforms`. `AlphaRequest` is unchanged.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (The Adjustments live in session memory only and IndexedDB is not touched — `sad.md` §2 Constraints, §8 Persistence; step 8 adds them to `WorkRecord` with its own migration.)

## API contract

Internal — no API surface. (`ExportRequest.adjustments: Adjustments`; the worker message shape is otherwise unchanged.)

## Acceptance criteria

### AC-14 — cross-context

> **Given** Adjustments have been applied to the open Work
> **When** the Editor exports it
> **Then** the Export contains the Work with its Geometry and its Adjustments, matching the Preview (§6 Fidelity) at full size. An Export at a smaller size is the full-size adjusted Export reduced to that size, so the Adjustments are applied before the size is reduced; its numeric tolerance follows the export spec's open §8 question on smaller sizes. The transparency hint of export AC-15 is shown exactly when it would be without the Adjustments, because they never change transparency (AC-06). An Export never contains a Draft that has not been applied (AC-16)
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — domain invariant

> **Given** an image is open, with or without transparent pixels
> **When** the Editor applies any Adjustments
> **Then** only colours change: every pixel keeps exactly the transparency it has without Adjustments, the Work keeps its size and its Geometry, and an image with no transparent pixels stays fully opaque, in the Preview and in every Export. With all seven values at their neutral values the Work's pixels are exactly the pixels it would have without any Adjustments, because a neutral value changes no pixel. Every colour rule in AC-02 to AC-04 applies to a pixel's colour independent of its transparency: a partly transparent pixel changes colour exactly as the same fully opaque pixel would, so soft edges get no dark or light fringe
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `ExportRequest.adjustments`; `render()` sets the uniforms; two-pass path (full-size adjusted texture → mipmaps → draw at size, flatten in pass 2) when smaller and not neutral; delete the pass texture — `src/render/export/worker-handler.ts`
- [ ] Pass `adjustments` through the client and the window fallback — `src/render/export/client.ts`
- [ ] Send `snapshot.adjustments` — `src/features/export/store.ts`
- [ ] Tests (fake GL): neutral + full size = one pass as today, adjusted + full size = one pass with uniforms, adjusted + smaller = two passes with flatten only in pass 2, texture deleted; store sends the snapshot's values — `worker-handler.test.ts`, `client.test.ts`, `src/features/export/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| All neutral at a smaller size | single pass, exactly as today |
| Adjusted at full size | single pass with the uniforms |
| Adjusted JPEG at a smaller size | flatten onto white only in the second pass |
| A Draft open in the tool | never exported: the snapshot holds only `work.adjustments` (Export is refused while a tool is open) |
| Transparency check (alpha request) | unchanged, no Adjustments |

## Definition of Done

- [ ] Fake-GL tests prove one pass vs two passes by the rule above, uniforms set from the request, flatten in the last pass only, the pass texture freed
- [ ] Export store test proves the request carries the snapshot's applied Adjustments
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
