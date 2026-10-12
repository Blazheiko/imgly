---
id: T13
title: "Record what undo-redo supersedes in open-and-view ADR-0005, draw spec §6 and sad §11, and tick export §8 and crop-rotate §8"
layer: "docs"
deps: []
blocks: []
acs: ["AC-09"]
files_hint: ["docs/features/open-and-view/adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md", "docs/features/draw/spec.md", "docs/features/draw/sad.md", "docs/features/export/spec.md", "docs/features/crop-rotate/spec.md", "CONTEXT.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 32 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T13 — Record what undo-redo supersedes in open-and-view ADR-0005, draw spec §6 and sad §11, and tick export §8 and crop-rotate §8

## Place in the sequence

- **Blocked by:** — (starts immediately).
- **Blocks:** — (nothing waits on it).
- **Wave:** 1 — alongside T1, T6.
- **Lane:** own lane.

## Why (user story)

> **US-04: Know whether my work is saved after undoing**
>
> **As an** Editor  
> **I want** the app to know when undoing has brought the image back to what I last exported or opened  
> **So that** I am asked to confirm replacing the image only when I would really lose something
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It keeps every other feature's documents honest about the new save-point rule before ship.

## Inlined context

> Other features' documents now describe the old behaviour. open-and-view ADR-0005 says undo and redo raise the revision and accepts a confirmation after a full undo. draw `spec.md` §6 has the 50-Apply memory row this spec replaces, and draw `sad.md` §11 has the undo-stack row this SAD resolves. export §8 and crop-rotate §8 checkboxes are unticked (spec §1) — Mitigation: The owner adds "partly superseded by undo-redo ADR-0003" to open-and-view ADR-0005, marks the two draw rows as replaced or resolved by undo-redo, and ticks the two checkboxes. Resolve before `/sdd:ship undo-redo`
>
> — `sad.md §11, other features' documents row, abridged` · full text: [sad.md](../sad.md)

> | Draft | An open tool's unapplied changes. For "Draw", a full copy of the layer owned by the `draw` store (draw ADR-0004). Used by the CONTEXT definition of Step but not defined there. Flagged for `/sdd:glossary` |
>
> — `sad.md §12, Draft row, verbatim` · full text: [sad.md](../sad.md)

> Decision: the save point is the last successful Export, and undoing or redoing back to it clears Unsaved edits (AC-09). This closes export §8's open question with its stated default, and crop-rotate §8's question that moved its due date to this step. Their checkboxes are left for the owner to tick.
>
> — `spec.md §1, traceability bullet 2, verbatim` · full text: [spec.md](../spec.md)

**Hard rule:** never rewrite a released ADR's decision — add a dated note pointing at undo-redo ADR-0003. Docs only; no code. Independent of every other task (wave 1).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-09 (US-04) — cross-context

> **Given** the Editor has applied two Steps, exported the image successfully, and then applied a third Step, so the Work has Unsaved edits
> **When** the Editor undoes the third Step, then undoes once more, then redoes once
> **Then** after the first Undo the Work is back at the exported state and has no Unsaved edits, so opening another image replaces the Work without asking for confirmation; after the second Undo it has Unsaved edits again; after the Redo it has none. Likewise, undoing every Step of a Work that was never exported brings it back to the state it was opened in, with no Unsaved edits. After an Export, undoing past the save point back to the opened state leaves Unsaved edits, because the save point is now the Export. A cancelled or failed export never sets the save point (export AC-09, AC-10)
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add a dated "Partly superseded by undo-redo ADR-0003" note — `docs/features/open-and-view/adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md`
- [ ] Mark the "memory after 50 Applies ≤ 110%" row as replaced by undo-redo spec §6 — `docs/features/draw/spec.md`
- [ ] Mark the undo-stack risk row as resolved by undo-redo ADR-0002 — `docs/features/draw/sad.md`
- [ ] Tick the §8 save-point checkboxes with a pointer to undo-redo AC-09 — `docs/features/export/spec.md`, `docs/features/crop-rotate/spec.md`
- [ ] Add the Draft glossary line (one sentence + NOT-reference) — `CONTEXT.md`

## Edge cases

| Case | Behaviour |
|---|---|
| a row already annotated | leave it; do not duplicate the note |

## Definition of Done

- [ ] All five documents carry the change, and each note links to the undo-redo artifact it cites
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
