---
id: T12
title: "@perf e2e: Undo and Redo p95 ≤ 150 ms for a Step of each tool with a full-image drawing"
layer: "tests"
deps: ["T8", "T9"]
blocks: []
acs: ["AC-01", "AC-02"]
files_hint: ["e2e/undo-redo/perf.spec.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 44 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — @perf e2e: Undo and Redo p95 ≤ 150 ms for a Step of each tool with a full-image drawing

## Place in the sequence

- **Blocked by:** T8 — Build UndoRedoActions (two ghost BaseButtons with hints) and mount it first in the top bar with the shortcuts; T9 — Expose the editor store's historyStats through window.__imglyTest for the e2e memory checks.
- **Blocks:** — (nothing waits on it).
- **Wave:** 7 — alongside T10.
- **Lane:** own lane.

## Why (user story)

> **US-01: Take back the last change**
>
> **As an** Editor  
> **I want** to undo the last change I applied with a tool  
> **So that** a wrong Crop, Adjustment or drawing costs me one keystroke instead of redoing it by hand
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It proves the one keystroke that takes a change back feels instant even for a full-image drawing.

## Inlined context

> Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view, export, crop-rotate, adjust and draw. The reference Work is 4096 × 3072 px. Each p95 is taken over 20 runs after 2 warm-up runs. "A drawing over the whole image" means a Drawing layer covered by marks over the whole image, as draw §6 defines it.
>
> — `spec.md §6, preamble, verbatim` · full text: [spec.md](../spec.md)

> | From choosing Undo or Redo to the updated Preview, for a Step of each tool, with a drawing over the whole image | p95 ≤ 150 ms (the same target as an Apply in draw §6) | e2e performance test on the reference machine |
>
> — `spec.md §6, latency row, verbatim` · full text: [spec.md](../spec.md)

> **How verify:** e2e performance test on the reference machine (`@perf`, run with `PERF=1`), 20 runs after 2 warm-ups, timed from the shortcut's `keydown` to the next presented frame of the Preview.
>
> — `sad.md §10, QG-3 How verify, verbatim` · full text: [sad.md](../sad.md)

> Undoing a "Draw" Step re-uploads a whole layer: a readback of 50 MB plus a texture upload, and mipmaps below 100% (draw ADR-0003). This may miss p95 ≤ 150 ms (QG-3) — Mitigation: It is the same re-upload path as the draw tool's Cancel, which draw §10 holds to the same 150 ms. The `@perf` test runs in the first UI task. If it misses, the fallback is to keep the GPU texture of the most recently replaced layer for one Step, keyed by layer id, which costs one more texture
>
> — `sad.md §11, Draw re-upload row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Reuse the timing harness of `e2e/draw/perf.spec.ts` (keydown → next presented frame). Run it as soon as T8 lands (sad §11 wants latency checked with the first UI task); it is in its own file, so it parallelizes with T10.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. The Edit history lives in session memory only and is never written to IndexedDB or any storage (`sad.md` §8 Persistence; spec §3, §6.1).

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** an image is open and the Editor has applied at least one Step with "Crop and rotate", "Adjust" or "Draw"
> **When** the Editor chooses Undo, by its button in the top bar or by Ctrl+Z (Cmd+Z on a Mac)
> **Then** the Preview shows the Work as it was before the last Step: the Geometry, the Adjustments or the Drawing layer that Step changed returns to its earlier value, and nothing else changes. Redo becomes available, and the Undo and Redo buttons' hints name the tool of the Step each would take back or restore next, for example "Undo Adjust" and "Redo Crop and rotate"
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 (US-02) — happy path

> **Given** the Editor has undone one or more Steps and has applied nothing since
> **When** the Editor chooses Redo, by its button or by Shift+Ctrl+Z (Shift+Cmd+Z on a Mac), or Ctrl+Y on Windows and Linux
> **Then** the Preview shows the Work with the most recently undone Step applied again, exactly as it was before that Undo, and Redo stays available while undone Steps remain
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Spec tagged `@perf`, skipped without `PERF=1` — `e2e/undo-redo/perf.spec.ts`
- [ ] For Crop (with size change), Adjust and Draw Steps: 2 warm-ups + 20 timed Undos and Redos; compute p95; assert ≤ 150 ms — `e2e/undo-redo/perf.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Draw Undo misses 150 ms | apply the sad §11 fallback (keep the last replaced layer's GPU texture for one Step, keyed by id) in the renderer, then re-measure; do not relax the target |
| run without `PERF=1` | skipped |

## Definition of Done

- [ ] `PERF=1 pnpm test:e2e e2e/undo-redo/perf.spec.ts` reports p95 ≤ 150 ms for each tool's Undo and Redo on the reference machine
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
