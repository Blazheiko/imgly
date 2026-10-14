---
id: T22
title: "@perf e2e: first store ≤ 3 s, Step store ≤ 300 ms / 1.5 s, longest task ≤ 200 ms, reopen ≤ 1.5 s, Gallery painted ≤ 500 ms"
layer: "tests"
deps: ["T17", "T18"]
blocks: []
acs: ["AC-01", "AC-03", "AC-04"]
files_hint: ["e2e/gallery/perf.spec.ts", "e2e/perf-memory.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 63 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T22 — @perf e2e: first store ≤ 3 s, Step store ≤ 300 ms / 1.5 s, longest task ≤ 200 ms, reopen ≤ 1.5 s, Gallery painted ≤ 500 ms

## Place in the sequence

- **Blocked by:** T17 — Mount the Gallery in both homes; T18 — Add the Gallery e2e hooks to window.__imglyTest.
- **Blocks:** — (nothing waits on it).
- **Wave:** 9 — in parallel with T19, T20 and T21.
- **Lane:** own lane (`e2e/gallery/perf.spec.ts`); reuses `p95` from `e2e/perf-memory.ts` without changing its existing exports.

## Why (user story)

> **US-01: Keep my work without saving**
>
> **As an** Editor  
> **I want** every change I apply to be kept in this browser without my asking  
> **So that** a reload, a closed tab, a crash or opening another image never costs me the edits I applied
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It proves Autosave, reopen and the Gallery listing meet their time targets without freezing editing.

## Inlined context

> Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view, export, crop-rotate, adjust, draw and undo-redo. The reference Work is 4096 × 3072 px with a Crop, a Straighten angle, all seven Adjustments away from neutral and a Drawing layer covered by marks over the whole image, as draw §6 defines it. Each p95 is taken over 20 runs after 2 warm-up runs. "Stored" means the Work can be read back after a reload.
>
> | From an image's first Preview to the Work being stored, reference-sized image | p95 ≤ 3 s | e2e performance test on the reference machine |
> | From an Apply, Undo or Redo to the change being stored, reference Work | p95 ≤ 300 ms for a Crop or Adjustment Step, p95 ≤ 1.5 s for a drawing Step | e2e performance test on the reference machine |
> | Editing stays responsive while Autosave runs | longest interface freeze ≤ 200 ms (the open-and-view target) | long-task trace during the two Autosave scenarios above |
> | From choosing a Work in the Gallery to its first Preview, reference Work | p95 ≤ 1.5 s (the open-and-view target for opening a 12 MP photo) | e2e performance test on the reference machine |
> | From choosing "Gallery" to every thumbnail painted, 20 reference Works stored | p95 ≤ 500 ms | e2e performance test on the reference machine |
>
> — `spec.md §6, preamble + five timing rows, verbatim` · full text: [spec.md](../spec.md)

> - **First store** (§6 row 1) → open the reference-sized image 20 times. Assert p95 from the first Preview to the commit is ≤ 3 s. Gated on Chromium. Firefox and WebKit are measured and reported, not gated (spec §8 question 2, closed 2026-10-14).
> - **Store after a Step** (§6 row 2) → 20 Crop Steps, 20 Adjustment Steps, 20 drawing Steps and 20 Undos and Redos on the reference Work. Assert p95 from the Apply, Undo or Redo to the commit is ≤ 300 ms for a Crop or Adjustment Step and ≤ 1.5 s for a drawing Step.
> - **Responsiveness during Autosave** (§6 row 3) → a long-task trace across both scenarios above. Assert that the longest main-thread task is ≤ 200 ms.
> - **Reopen** (§6 row 4) → 20 reopens of the reference Work from the Gallery overlay. Assert p95 from the choice to the first Preview is ≤ 1.5 s.
> - **Gallery shows** (§6 row 5) → with 20 reference Works stored, open the overlay 20 times. Assert p95 from choosing "Gallery" to every thumbnail painted is ≤ 500 ms.
>
> — `test-plan.md §NFR validation (load), scenarios, verbatim` · full text: [test-plan.md](../test-plan.md)

> - The **reference Work** for the load scenarios: 4096 × 3072 px, built in the page at run time as the draw and export perf suites already do.
>
> — `test-plan.md §Test data, reference Work bullet, verbatim` · full text: [test-plan.md](../test-plan.md)

> **How verify:** e2e `@perf` tests (`PERF=1`) on the reference machine for each target, and a long-task trace during the two Autosave scenarios. Firefox and WebKit are measured but not gated for the 3 s target until spec §8 question 2 is answered (§11)
>
> — `sad.md §10, QG-3 How verify, verbatim` · full text: [sad.md](../sad.md)

> | The thumbnail pass reads pixels back on the main thread. A slow GPU readback could eat into the 200 ms freeze budget (ADR-0005) | Low | Thumbnail long side ≤ 512 px, and the long-task trace in QG-3 | Tech Lead |
>
> — `sad.md §11, thumbnail readback row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** `@perf` tests run only with `PERF=1`.
>
> — `CLAUDE.md §Commands, pnpm test:e2e, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

"Stored" is the commit of the save's transaction: detect it through T18's `galleryRecords()` (or a commit timestamp the hooks expose), not by sleeping.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [test-plan.md](../test-plan.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** the Editor has opened a photo and applied a Crop, a change in "Adjust" and a drawing
> **When** the Editor reloads the page, closes and reopens the tab, or opens another image, at least two seconds after the last Apply and at least three seconds after the photo opened
> **Then** the Gallery holds that Work with all three changes, its thumbnail shows the image with all of them, and it is listed first as the most recently opened or changed Work. Autosave stored the Work once when the photo opened and again after each Apply, without the Editor doing anything and without interrupting editing
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-03 (US-03) — happy path

> **Given** the Gallery holds several Works, one of which is open
> **When** the Editor chooses "Gallery" in the top bar
> **Then** the Gallery lists every stored Work, most recently opened or changed first. Each entry shows a thumbnail of the Work with all its edits, its Source name ("Untitled" when the Work has none) and when it was last opened or changed: "Just now" under a minute, "N minutes ago" under an hour, "N hours ago" under a day, and otherwise the date in the browser's language. The open Work's entry is marked "Open", and the Gallery shows how many of the 20 places are used. The Gallery can be closed again without changing anything
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 (US-02) — happy path

> **Given** a Work in the Gallery was stored with a Crop, a Straighten angle, all seven Adjustments away from neutral and a drawing
> **When** the Editor chooses it, after a reload or with another Work open and no Unsaved edits left unstored
> **Then** it replaces the open Work and shows exactly the stored Work: a full-size Export of it is identical to the Export of the same Work made before the reload. Its Source name and Source format still name and pick the default format of the next Export. Each part stays editable on its own: "Crop and rotate" shows the whole image with the stored frame, "Adjust" shows the stored slider values, and "Draw" shows the stored Drawing layer, which can be painted on and erased with the Brush and the Eraser as before the reload. The reopened Work starts with an empty Edit history and no Unsaved edits, and the Gallery closes
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Spec tagged `@perf`, skipped without `PERF=1`; build the 4096 × 3072 reference Work in the page as `e2e/draw/perf.spec.ts` and the export perf suite do — `e2e/gallery/perf.spec.ts`
- [ ] First store: 2 warm-ups + 20 opens; first Preview → commit; assert p95 ≤ 3 s on Chromium; log Firefox and WebKit p95 without asserting
- [ ] Store after a Step: 20 each of Crop, Adjust, drawing, Undo and Redo; Apply/Undo/Redo → commit; assert ≤ 300 ms (Crop, Adjust) and ≤ 1.5 s (drawing)
- [ ] Long-task trace (PerformanceObserver `longtask`) across both Autosave scenarios; assert longest ≤ 200 ms
- [ ] Reopen: 20 reopens from the overlay; choice → first Preview frame; assert p95 ≤ 1.5 s
- [ ] Gallery shows: 20 reference Works stored; open the overlay 20 times; choice → every thumbnail `img` decoded and painted; assert p95 ≤ 500 ms
- [ ] Use `p95` from `e2e/perf-memory.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Run without `PERF=1` | skipped |
| First store misses 3 s on Firefox or WebKit | reported, not failed (spec §8 Q2 closed) |
| First store misses 3 s on Chromium | red; raise with the Tech Lead (sad §11 codec risk) — never relax the target |
| Longest task > 200 ms caused by the thumbnail readback | red; report against sad §11's thumbnail row |
| 20 reference Works exceed the test browser's quota | provision enough storage for the context; the cap scenario is T20's, not this one's |

## Definition of Done

- [ ] `PERF=1 pnpm test:e2e e2e/gallery/perf.spec.ts` asserts every spec §6 p95 above on Chromium on the reference machine
- [ ] Firefox and WebKit first-store p95 is printed in the run output
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
