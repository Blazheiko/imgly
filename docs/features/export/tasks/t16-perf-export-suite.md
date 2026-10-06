---
id: T16
title: "Write the @perf export suite: export time p95, longest freeze and memory after 10 exports"
layer: "tests"
deps: ["T15"]
blocks: []
acs: []
files_hint: ["e2e/export/perf.spec.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 40 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T16 — Write the @perf export suite: export time p95, longest freeze and memory after 10 exports

## Place in the sequence

- **Blocked by:** T15 — Write the functional e2e suite: format honesty, fidelity, quality and size, naming, metadata, downloads and Save as….
- **Blocks:** nothing — a leaf of the DAG.
- **Wave:** 9 — after T15.
- **Lane:** shares `e2e/export/perf.spec.ts` with T15 — serialized.

## Why (user story)

> **US-01: Save the Work as an image file**
>
> **As a** Editor  
> **I want** to export the open Work as a PNG, JPEG or WebP file  
> **So that** I keep a copy of my edited image outside the app
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It proves the export is fast and leak-free on the reference machine, which is the third quality goal.

## Inlined context

> - **How verify:** the `@perf` suite on the reference machine times confirm-to-written with a stubbed dialog that resolves at once, and records `longtask` entries during the PNG export. The memory row uses the whole-page measurement chosen when the e2e setup is planned (spec §8, due before `sdd:plan-tests`) on Chromium, plus the bitmap ledger returning to one retained Original. Offline: functional e2e on all three engines loads, waits for the service worker, goes offline, reloads, opens and exports
>
> — `sad.md §10, QG-3 How verify, verbatim` · full text: [sad.md](../sad.md)

> Reference machine: Apple M1 MacBook Air with the latest stable Chrome (as in open-and-view). "Export time" runs from confirming the export in the panel to the file being written or handed to the browser's downloads, minus the time the "Save as…" dialog is open, so the encoding always counts wherever it happens. Each p95 is taken over 20 runs after 2 warm-up runs.
>
> — `spec.md §6, preamble, verbatim` · full text: [spec.md](../spec.md)

> - [ ] Which Chromium memory measurement does the §6 Memory row use (it must include canvases and file data, not only the JavaScript heap)? Default now: the browser's whole-page memory measurement, chosen when the e2e setup is planned. — owner: Blazheiko (owner), due: before `sdd:plan-tests`
>
> — `spec.md §8, Open question 4, verbatim` · full text: [spec.md](../spec.md)

> `@perf` tests run only with `PERF=1`.
>
> — `CLAUDE.md §Commands, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Fixed by this breakdown:** follow `e2e/open-and-view/perf.spec.ts`; reuse T15's Save as… stub (resolves at once) and the `bitmaps()` hook. Use `performance.measureUserAgentSpecificMemory()` (or CDP `Memory`) after a forced GC unless spec §8 OQ 4 is resolved otherwise first.
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

No spec §5 AC is owned by this task: it verifies the spec §6 performance and memory rows, quoted here as its criteria.

> | Aspect | Target | Measurement |
> |---|---|---|
> | Export time p95, 4096×3072 Work, full size, JPEG at quality 90 | ≤ 1 s | e2e performance test on the reference machine |
> | Export time p95, 4096×3072 Work, full size, PNG | ≤ 2 s | e2e performance test on the reference machine |
> | Longest interface freeze during a full-size PNG export of a 4096×3072 Work | ≤ 200 ms (progress indicator keeps animating) | long-task trace in the e2e performance test |
> | Memory after 10 consecutive full-size exports of a 4096×3072 Work opened from JPEG, exported as PNG | ≤ 110% of memory after the first export | whole-page memory as the browser reports it (including canvases and file data), after a forced garbage collection, Chromium e2e |
>
> — `spec.md §6, NFR, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write the timing tests (JPEG q90 and PNG, 4096×3072, 2 warm-up + 20 runs, p95) — `e2e/export/perf.spec.ts`
- [ ] Record `longtask` entries during the PNG export and assert the longest ≤ 200 ms — `e2e/export/perf.spec.ts`
- [ ] Ten consecutive full-size PNG exports of a JPEG-opened Work: memory ≤ 110% of after the first, bitmap ledger back to one retained — `e2e/export/perf.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Run without `PERF=1` | suite skipped |
| Not the reference machine | numbers are informative only; the release gate is the reference run |

## Definition of Done

- [ ] `PERF=1 pnpm test:e2e e2e/export/perf.spec.ts` passes on the reference machine on Chromium with the §6 targets
- [ ] the suite is tagged `@perf` and skipped in the default run
- [ ] `pnpm lint && pnpm typecheck` clean
