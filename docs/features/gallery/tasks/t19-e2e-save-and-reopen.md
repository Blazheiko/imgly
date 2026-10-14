---
id: T19
title: "e2e (Chromium, Firefox, WebKit): Autosave survives reload, close and another open; exact reopen of opaque and semi-transparent Works; list order, start screen and a v1-shaped Work"
layer: "tests"
deps: ["T17", "T18"]
blocks: []
acs: ["AC-01", "AC-02", "AC-03", "AC-04", "AC-05", "AC-18"]
files_hint: ["e2e/gallery/save-and-reopen.spec.ts", "e2e/gallery/helpers.ts"]
owner: "Blazheiko"
estimate: "L"
context_budget: "M"   # measured: 85 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T19 — e2e (Chromium, Firefox, WebKit): Autosave survives reload, close and another open; exact reopen of opaque and semi-transparent Works; list order, start screen and a v1-shaped Work

## Place in the sequence

- **Blocked by:** T17 — Mount the Gallery in both homes; T18 — Add the Gallery e2e hooks to window.__imglyTest.
- **Blocks:** — (nothing waits on it).
- **Wave:** 9 — in parallel with T20, T21 and T22.
- **Lane:** shares `e2e/gallery/helpers.ts` with T20 and T21 — serialized; whichever runs first creates it.

## Why (user story)

> **US-02: Reopen and keep editing**
>
> **As an** Editor  
> **I want** to reopen a recent Work and find its Crop, Adjustments and drawing exactly as I left them  
> **So that** I can change any of them separately later instead of starting again from the source file
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

It proves in three real browsers that applied edits survive a reload and come back pixel-exact and editable.

## Inlined context

> | AC-01 happy | a Crop, an Adjustment and a drawing survive a reload, a closed page and opening another image | e2e-through-UI | after each of the three, the Gallery lists the Work first; reopening it shows all three changes; its thumbnail matches the Preview renderer's render of that Work in the same engine; all three engines |
> | AC-01 happy | Autosave never interrupts editing | e2e-through-UI | during a save the tools, Undo and Redo stay usable; no dialog, spinner or notice is shown for a committed save |
> | AC-02 invariant | after a reload, an undone drawing, a zoom and an open Draft are all gone | e2e-through-UI | the reopened Work has no marks, the Preview is fitted, and Undo and Redo show unavailable; all three engines |
> | AC-03 happy | the Gallery lists several Works newest first, with the open one marked | e2e-through-UI | after opening three images and editing the first again, "Gallery" lists first, third, second; the first is "Open"; "3 of 20 places used"; Close returns to the Work unchanged |
> | AC-04 happy | a reopened Work's Export is identical to its Export before the reload | e2e-through-UI | for `photo.png` and `ref.png` with a Crop, a Straighten angle, all seven Adjustments away from neutral and a drawing, a full-size PNG Export after the reopen differs from the one before the reload by 0 per channel; all three engines (QG-2, spec §7 KPI) |
> | AC-04 happy | semi-transparent Originals reopen exactly | e2e-through-UI | the same comparison for `alpha-patches.png` and `soft-edge.png` with a drawing gives difference 0, alpha included; all three engines (`sad.md` §11 risk; a failure goes to the owner, not to the tolerance) |
> | AC-04 happy | each part stays editable after the reopen, and the Source name picks the Export | e2e-through-UI | "Crop and rotate" shows the whole image with the stored frame; "Adjust" shows the stored values; "Draw" shows the stored layer and the Brush and Eraser paint and erase it; the Export's default name and format follow the Source name and format; the Gallery has closed |
> | AC-05 happy | a first visit, an edit and a reload put the Work on the start screen, and one action reopens it | e2e-through-UI | the empty state first; after open, Apply and reload the start screen lists the Work and opens nothing; choosing it reopens it with the change (spec §7 KPI: 1 action); all three engines |
> | AC-18 cross-context | a Work stored by the earlier version reopens exactly | e2e-through-UI | a hook writes a Work in the v1 shape, the page reloads into the current build, and the reopened Work's Export equals the Export made before the write by 0 per channel; the Gallery has lost nothing; all three engines |
>
> — `test-plan.md §AC coverage, e2e-through-UI rows for AC-01..AC-05 and AC-18, verbatim` · full text: [test-plan.md](../test-plan.md)

> - **Exactness tolerance is 0 (spec §6, QG-2).** Reopen rows compare a full-size PNG Export after the reopen with the Export of the same Work made before the reload, within one engine.
>   - The reference set includes `alpha-patches.png` and `soft-edge.png` to expose the premultiplied alpha risk of `sad.md` §11.
>   - If a semi-transparent pixel differs, the row stays red. The owner then narrows AC-04 and the §6 row to opaque pixels, or a new ADR changes how such Originals are stored. The tolerance is never loosened silently.
> - **No visual-regression** […] Thumbnail pixels are checked by comparing them, within one engine, with the Preview renderer's own render of the same Work. No baseline images are kept.
>
> — `test-plan.md §Decisions taken in this plan, exactness + visual bullets, abridged` · full text: [test-plan.md](../test-plan.md)

> - The **opaque reference set**: the existing `photo.png` and `ref.png`. The **semi-transparent set**: the existing `alpha-patches.png` and `soft-edge.png`.
> - The **reference edits**: a Crop, a Straighten angle, all seven Adjustments away from neutral and the draw reference drawing, applied through the existing e2e helpers of crop-rotate, adjust and draw.
> - **Independent oracle.** Reopen rows compare two full-size Exports made in the same engine, before and after. […] Stored state is read back through the hooks, not through the code under test.
> - **Cleanup boundary.** […] e2e-through-UI tests get a fresh browser context in each test, so IndexedDB and the `meta` marker start empty.
>
> — `test-plan.md §Test data, abridged` · full text: [test-plan.md](../test-plan.md)

> - Decoded bitmaps rejected by the size check or superseded by a reopen → released through the bitmap ledger; each reopen e2e ends with a check of the ledger's retained count.
>
> — `test-plan.md §Edge cases / error paths, ledger bullet, verbatim` · full text: [test-plan.md](../test-plan.md)

> - **On every PR, three engines:** e2e-through-UI, as the repo's CI already runs the earlier features' browser suites. This includes the reopen exactness, reload, delete, eviction, quota, two-page, leave-warning, unavailable and offline rows. A lost or inexact Work must block a merge.
>
> — `test-plan.md §CI placement, verbatim` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

AC-18 here uses T18's `galleryWriteStored` (a Work in the `formatVersion: 1` record layout, written directly); see T18's note on why a DB-v1 database cannot hold a Work.

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [test-plan.md](../test-plan.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

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

### AC-02 (US-01) — domain invariant

> **Given** the Editor has applied a drawing, undone it, zoomed into the Preview and opened "Draw" again with strokes that are not applied
> **When** the page is reloaded and the Editor reopens the Work from the Gallery
> **Then** the Work has no drawing, because the Undo was stored like any Step, and none of the unapplied strokes, because an open tool's Draft is never stored. The Preview is fitted to the screen, not zoomed, because the View is never stored, and Undo and Redo are unavailable, because the Edit history is never stored
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

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

### AC-05 (US-07) — happy path

> **Given** a first visit, so the Gallery is empty
> **When** the start screen appears
> **Then** next to the "Open image" drop zone, the Gallery shows plain text saying that Works the Editor opens will appear here, with the same "Open image" action. After the Portfolio reviewer opens an image, applies a change and reloads the page, the start screen lists that Work, and choosing it reopens it with the change. Nothing reopens on its own after a reload
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-18 (US-02) — cross-context

> **Given** the Gallery holds Works stored by an earlier version of the app
> **When** the app updates to a new version and the Editor reopens one of them
> **Then** the Work opens with exactly the stored data: the same Original pixels, Source name, Source format, Geometry, Adjustments and Drawing layer. When the update did not change how a Work is drawn, a full-size Export of it is identical to the Export the earlier version made. An update never empties the Gallery or loses a Work
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Shared helpers (create if absent): wait for a committed save via `galleryRecords()`, open the Gallery, choose an entry by name, export full-size PNG and decode to pixels, compare per channel, read the ledger — `e2e/gallery/helpers.ts`
- [ ] AC-01: Crop + Adjust + drawing via the crop-rotate/adjust/draw e2e helpers; reload, close-and-reopen page, open another image; Work first; thumbnail vs Preview renderer render; no dialog/spinner/notice on a committed save — `e2e/gallery/save-and-reopen.spec.ts`
- [ ] AC-02: drawing → Undo → zoom → open Draw with strokes → reload → reopen: no marks, fitted, Undo/Redo unavailable
- [ ] AC-03: three opens, edit the first again → order first, third, second; "Open"; "3 of 20 places used"; Close unchanged
- [ ] AC-04: Export before reload, reopen, Export after → 0 difference for `photo.png`, `ref.png`, `alpha-patches.png`, `soft-edge.png`; each tool shows its stored part; Brush/Eraser work; Export name/format follow the source
- [ ] AC-05: empty state on first visit; open, Apply, reload → listed, nothing reopened; one choice reopens
- [ ] AC-18: `galleryWriteStored` a Work, reload, reopen, Export equals the pre-write Export by 0
- [ ] End every reopen test with 0 retained bitmaps in the ledger

## Edge cases

| Case | Behaviour |
|---|---|
| A semi-transparent pixel differs after reopen | the row stays red; report to the owner (narrow AC-04 or new ADR) — never loosen the tolerance |
| Reload less than 2 s after the last Apply | outside AC-01's precondition; wait for the committed save via the hooks instead of sleeping |
| A Work with no Source name | listed as "Untitled" |
| A 1×1 Work | stored, listed, reopened and exported exactly |
| A 4096×4096 Original | stored and reopened; thumbnail long side ≤ 512 px |
| Nothing reopens after reload | start screen with the list; no Preview |

## Definition of Done

- [ ] `pnpm test:e2e e2e/gallery/save-and-reopen.spec.ts` passes on Chromium, Firefox and WebKit for every row above
- [ ] the four reference images reopen with 0 difference per channel; a failure is escalated, not tolerated
- [ ] every reopen ends with 0 retained bitmaps in the ledger
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
