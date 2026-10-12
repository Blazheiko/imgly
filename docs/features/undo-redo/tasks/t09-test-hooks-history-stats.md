---
id: T9
title: "Expose the editor store's historyStats through window.__imglyTest for the e2e memory checks"
layer: "wiring"
deps: ["T5"]
blocks: ["T10", "T12"]
acs: ["AC-11"]
files_hint: ["src/app/test-hooks.ts", "e2e/test-hooks.d.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 33 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Expose the editor store's historyStats through window.__imglyTest for the e2e memory checks

## Place in the sequence

- **Blocked by:** T5 — Expose undo, redo, canUndo, canRedo, undoTool, redoTool and historyStats on the editor store, with the refusals and the View fit.
- **Blocks:** T10 — e2e (Chromium): the 512 MB budget, Steps kept and layer release after replace, discard and drop; T12 — @perf e2e: Undo and Redo p95 ≤ 150 ms for a Step of each tool with a full-image drawing.
- **Wave:** 6 — alongside T8.
- **Lane:** own lane.

## Why (user story)

> **US-05: Keep a long session safe**
>
> **As an** Editor  
> **I want** undo to stay reliable while a tool is open, while an export runs, and through a long session  
> **So that** undoing never mixes with an unapplied tool, never changes a file being saved and never makes the app run out of memory
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It lets the e2e suite read how much image data the Edit history holds and how many Steps it keeps.

## Inlined context

> | Observability | No logging, as in the rest of the app. In e2e builds `window.__imglyTest` exposes the editor store's `historyStats` (held bytes and Step count) next to the bitmap ledger | `src/app/test-hooks.ts` |
>
> — `sad.md §8, Observability row, verbatim` · full text: [sad.md](../sad.md)

> src/app/test-hooks.ts       reads editor.historyStats through @/features/editor for e2e (ledger L11)
>
> — `sad.md §5, internal decomposition, test-hooks line, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:**
> `src/app/` — App shell, Pinia install, service-worker registration — May import: `features` (through `index.ts` only)
>
> — `CLAUDE.md §Module boundaries, src/app row, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Code facts: `ImglyTestHooks` interface in `src/app/test-hooks.ts` (installed only with `VITE_E2E_HOOKS`); `bitmapLedger` is already exposed from `@/shared`. The e2e side declares the same shape in `e2e/test-hooks.d.ts`.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-11 (US-05) — domain invariant

> **Given** the Editor keeps applying Steps on the 4096 × 3072 px reference Work, each one a drawing over the whole image or a Crop or Adjustment
> **When** the Edit history reaches its limit of 50 Steps, or its memory budget
> **Then** the oldest Steps are dropped first, without a message, and the newest are kept: the Editor can always undo at least the last 10 Steps, and up to the last 50 when they take less memory. Undoing past the oldest kept Step is not possible; Undo becomes unavailable there as in AC-05. The memory the Edit history takes never exceeds its budget (§6)
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `historyStats(): { heldBytes: number; steps: number }` to `ImglyTestHooks` and implement it from `useEditorStore().historyStats` — `src/app/test-hooks.ts`
- [ ] Mirror the type — `e2e/test-hooks.d.ts`
- [ ] Extend the existing test-hooks unit test if one exists, else rely on typecheck + T11

## Edge cases

| Case | Behaviour |
|---|---|
| no Work open | `{ heldBytes: 0, steps: 0 }` |
| non-e2e build | hook absent, as every other hook |

## Definition of Done

- [ ] `pnpm typecheck` passes for `src/` and `e2e/`
- [ ] Hook returns 0/0 with no Work (unit or smoke assertion)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
