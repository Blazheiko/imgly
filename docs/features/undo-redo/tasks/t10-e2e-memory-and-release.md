---
id: T10
title: "e2e (Chromium): the 512 MB budget, Steps kept and layer release after replace, discard and drop"
layer: "tests"
deps: ["T8", "T9"]
blocks: ["T11"]
acs: ["AC-04", "AC-10", "AC-11"]
files_hint: ["e2e/undo-redo/memory.spec.ts", "e2e/undo-redo/helpers.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 48 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — e2e (Chromium): the 512 MB budget, Steps kept and layer release after replace, discard and drop

## Place in the sequence

- **Blocked by:** T8 — Build UndoRedoActions (two ghost BaseButtons with hints) and mount it first in the top bar with the shortcuts; T9 — Expose the editor store's historyStats through window.__imglyTest for the e2e memory checks.
- **Blocks:** T11 — e2e (Chromium, Firefox, WebKit): pixel-exact Undo and Redo for each tool, View fit, marks follow Geometry, shortcuts per engine.
- **Wave:** 7 — alongside T12.
- **Lane:** shares `e2e/undo-redo/helpers.ts` with T11 — serialized.

## Why (user story)

> **US-05: Keep a long session safe**
>
> **As an** Editor  
> **I want** undo to stay reliable while a tool is open, while an export runs, and through a long session  
> **So that** undoing never mixes with an unapplied tool, never changes a file being saved and never makes the app run out of memory
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It proves a long session stays inside the fixed memory budget and never leaks a layer.

## Inlined context

> Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view, export, crop-rotate, adjust and draw. The reference Work is 4096 × 3072 px. Each p95 is taken over 20 runs after 2 warm-up runs. "A drawing over the whole image" means a Drawing layer covered by marks over the whole image, as draw §6 defines it.
>
> — `spec.md §6, preamble, verbatim` · full text: [spec.md](../spec.md)

> | No hidden growth beyond the budget | whole-page memory after 100 Applies of a new drawing over the whole image ≤ whole-page memory after the 10th such Apply + 10% | whole-page memory as export §6 measures it, Chromium e2e |
> | Memory released when Steps leave the Edit history | 0 retained layers that no kept Step, the Work or an open Draft refers to, after each of: replacing the Work, a new Step discarding redoable Steps (AC-04), and the oldest Steps being dropped (AC-11) | the DEV resource ledger, asserted in e2e for each of the three cases with 10 drawing Steps |
>
> — `spec.md §6, rows hidden growth + memory released, verbatim` · full text: [spec.md](../spec.md)

> The whole-page memory row (≤ +10% between the 10th and the 100th drawing Apply) is tight. […] — Mitigation: The memory e2e is the first e2e task, measured as export §6 does (`settledKiB` in `e2e/perf-memory.ts`: renderer and GPU processes after a forced garbage collection). If it misses, release evicted layers before the new layer's texture upload. If it still misses, raise it to the owner as a spec §6 clarification rather than loosen the ≥ 10-Step rule
>
> — `sad.md §11, whole-page memory row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Reuse: `e2e/perf-memory.ts` (`settledKiB`), `window.__imglyTest.applyReferenceDrawing`-style hook used by `e2e/draw/*` (see `e2e/draw/helpers.ts`), `historyStats()` (T9) and the bitmap ledger hook. Undo via `Control+Z`/`Meta+Z` keyboard. This task creates `e2e/undo-redo/helpers.ts` (open reference Work, apply N drawing Steps, count available Undos); T11 reuses it.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-04 (US-02) — domain invariant

> **Given** the Editor has undone one or more Steps
> **When** the Editor applies a new change with any of the three tools
> **Then** the new change becomes the last Step, the Steps that could have been redone are discarded, and Redo becomes unavailable with a hint that there is nothing to redo. The Edit history is one line: there is never more than one way forward
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-10 (US-05) — cross-context

> **Given** the Editor has an Edit history for the open Work
> **When** another image replaces the Work, after the confirmation when there are Unsaved edits
> **Then** the new Work starts with an empty Edit history: Undo and Redo are unavailable, and no Step of the previous Work can be undone or redone any more. If the Editor cancels the replacement, the Work and its Edit history stay exactly as they were
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 (US-05) — domain invariant

> **Given** the Editor keeps applying Steps on the 4096 × 3072 px reference Work, each one a drawing over the whole image or a Crop or Adjustment
> **When** the Edit history reaches its limit of 50 Steps, or its memory budget
> **Then** the oldest Steps are dropped first, without a message, and the newest are kept: the Editor can always undo at least the last 10 Steps, and up to the last 50 when they take less memory. Undoing past the oldest kept Step is not possible; Undo becomes unavailable there as in AC-05. The memory the Edit history takes never exceeds its budget (§6)
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Helpers: open the 4096×3072 reference Work, apply a new full-image drawing N times, read `historyStats()` and ledger — `e2e/undo-redo/helpers.ts`
- [ ] 100 Applies: assert `heldBytes ≤ 512_000_000`, `steps ≥ 10`, and that ≥ 10 Undos succeed — `e2e/undo-redo/memory.spec.ts`
- [ ] Whole-page memory: `settledKiB` after the 10th and the 100th Apply, ratio ≤ 1.10 (Chromium only) — `e2e/undo-redo/memory.spec.ts`
- [ ] Three release cases with 10 drawing Steps: replace the Work; Undo ×3 then a new Step; drop by exceeding the budget — ledger shows 0 retained layers beyond kept + Work + Draft — `e2e/undo-redo/memory.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| whole-page row misses | apply the sad §11 mitigation (release before upload); if still missing, stop and raise a spec §6 clarification — do not loosen the 10-Step rule |
| Firefox / WebKit | skip the whole-page row (Chromium-only measurement); ledger rows may run everywhere |
| replace cancelled at confirmation | history and ledger unchanged (AC-10) |

## Definition of Done

- [ ] `memory.spec.ts` green on Chromium in `pnpm test:e2e`
- [ ] Each of the three release cases asserts 0 retained layers
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
