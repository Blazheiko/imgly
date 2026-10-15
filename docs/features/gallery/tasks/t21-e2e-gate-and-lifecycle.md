---
id: T21
title: "e2e: the replace gate, blocked storage, the leave warning, 50 interrupted saves (Chromium), two pages and a version upgrade, and offline use"
layer: "tests"
deps: ["T17", "T18"]
blocks: []
acs: ["AC-12", "AC-16", "AC-17", "AC-18", "AC-19", "AC-20", "AC-21"]
files_hint: ["e2e/gallery/gate-and-lifecycle.spec.ts", "e2e/gallery/interrupted-saves.spec.ts", "e2e/gallery/helpers.ts"]
owner: "Blazheiko"
estimate: "L"
context_budget: "M"   # measured: 87 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T21 — e2e: the replace gate, blocked storage, the leave warning, 50 interrupted saves (Chromium), two pages and a version upgrade, and offline use

## Place in the sequence

- **Blocked by:** T17 — Mount the Gallery in both homes; T18 — Add the Gallery e2e hooks to window.__imglyTest.
- **Blocks:** — (nothing waits on it).
- **Wave:** 9 — in parallel with T19, T20 and T22.
- **Lane:** shares `e2e/gallery/helpers.ts` with T19 and T20 — serialized; whichever runs first creates it.

## Why (user story)

> **US-06: Switch images without needless dialogs**
>
> **As an** Editor  
> **I want** opening another image to ask for confirmation only when I would really lose something  
> **So that** autosave saves me clicks instead of adding them
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It proves in real browsers that the replace gate, the leave warning and interrupted or concurrent saves never lose an applied change and never ask needlessly.

## Inlined context

> | AC-12 authorization | blocked site data in a real browser | e2e-through-UI | with storage refused for the context (or the hook failing `openDb` where the engine can't refuse it), the start screen shows unavailable; an image opens, is edited and exported; nothing is stored; opening another image after an edit asks to confirm; all three engines |
> | AC-16 cross-context | switching images with stored edits asks nothing in a real browser | e2e-through-UI | after an Apply, opening a file, dropping one and choosing a Work each replace with no dialog; the previous Work is listed with its edits; all three engines |
> | AC-17 cross-context | a failed save, then an open, asks in a real browser | e2e-through-UI | a hook fails the save; opening another image asks; Cancel keeps the Work; Confirm replaces; all three engines |
> | AC-18 cross-context | a newer version in another page closes the old page's connection | e2e-through-UI | the second page asks for the next version; the first shows the "newer version" notice, keeps editing, and asks to confirm a replace with Unsaved edits; all three engines |
> | AC-19 invariant | 50 reloads during Autosave leave no damaged or mixed Work | e2e-through-UI | the hook holds the transaction at each point for first and later saves, plus 10 random-delay reloads; after each reload every stored Work equals its last committed state, a first save's Work is absent, and no Work left without a notice; Chromium (§6 NFR) |
> | AC-20 invariant | the browser warns on leaving during a save, and not after | e2e-through-UI | with a save held, a reload triggers the page's leave dialog; staying lets the save commit; after the commit a reload shows no dialog; all three engines |
> | AC-21 cross-context | the Work open here survives eviction by another page | e2e-through-UI | two pages in one context, the Gallery full; the second page's open evicts the first page's Work; an Apply in the first page writes it back as the newest, with a notice naming the evicted Work; all three engines |
>
> — `test-plan.md §AC coverage, e2e-through-UI rows for AC-12, AC-16..AC-21, verbatim` · full text: [test-plan.md](../test-plan.md)

> - **Interrupted saves are held by a hook (owner, 2026-10-14).** A test hook can hold the `storeWork` transaction open at a chosen point: after the evictions, after the record, after the Original, or after the layer. The test then reloads the page. The 50 forced reloads of the §6 NFR are made of every hold point × first save and later save, repeated, plus 10 reloads at a random delay after an Apply with no hold. After each reload every stored Work is compared with its last committed state. A random reload alone would mostly land before or after the transaction and prove nothing.
> - **"Storage blocked" uses blocked site data, not a private window** (`sad.md` §11). Current private windows usually open IndexedDB in memory. The AC-12 rows make the database refuse to open: storage access is denied for the browser context where the engine allows it, otherwise a test hook fails `openDb` before it runs. A private window is no longer used as the example.
> - **Two tabs are two pages in one browser context**, so they share the real store (AC-21, ADR-0006). The version-upgrade row opens the second page with a test hook that asks for the next database version, so the first page gets a real `versionchange`.
>
> — `test-plan.md §Decisions taken in this plan, interrupted / blocked / two tabs bullets, verbatim` · full text: [test-plan.md](../test-plan.md)

> - Offline after the first load → listing, reopening, Autosave and deleting all succeed (§6). WebKit is checked without reloading while offline, since its test driver can't reload a page offline (as in export's offline test).
> - Close the overlay while a reopen is reading → the reopen still completes or fails cleanly, never half replaces.
> - The browser clears the Gallery while the page is open → the next save stores the open Work as a first save, asks for persistence again and doesn't fail.
>
> — `test-plan.md §Edge cases / error paths, three bullets, verbatim` · full text: [test-plan.md](../test-plan.md)

> | Works offline | 100% of Gallery listing, reopening, Autosave and deleting runs succeed offline after the first load | e2e in offline mode |
> | No half-stored Work after an interrupted save | 0 damaged or mixed Works in 50 reloads forced at random moments during Autosave | e2e on Chromium |
>
> — `spec.md §6, two NFR rows, verbatim` · full text: [spec.md](../spec.md)

> - **On every PR, three engines:** e2e-through-UI […] including the […] two-page, leave-warning, unavailable and offline rows. **On every PR, Chromium only:** the real-quota row and the 50-reload interrupted-save row.
>
> — `test-plan.md §CI placement, abridged` · full text: [test-plan.md](../test-plan.md)

> **Hard rule:** e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do (WebGL, the service worker and offline reload, downloads).
>
> — `CLAUDE.md §Conventions, Tests, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [test-plan.md](../test-plan.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-12 (US-05) — authorization

> **Given** storage cannot be opened for this app when the page loads, for example in a private window or with site data blocked for the site
> **When** the Editor opens an image and edits it
> **Then** opening, editing and exporting work as before. The Gallery shows that it is unavailable in this browser window and why in plain words, nothing is stored, and the app does not try to store anything again until the page is next loaded. Replacing the Work asks for confirmation whenever the open Work has Unsaved edits, as open-and-view AC-15 always did
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-16 (US-06) — cross-context

> **Given** the open Work has Unsaved edits and Autosave has stored its latest applied state, or is storing it and then succeeds
> **When** the Editor opens another image by "Open image", by dropping a file or by choosing a Work in the Gallery, and it is read successfully
> **Then** if a save was still running, the replacement waits for it to finish. It then replaces the open Work without asking for confirmation, and the previous Work stays in the Gallery with all its applied edits. An open tool's unapplied changes are discarded with the old Work, as crop-rotate AC-17 already requires
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-17 (US-06) — cross-context

> **Given** the open Work has Unsaved edits that are not stored in the Gallery, because Autosave failed, including a save that was still running when the Editor chose and then failed, or because the Gallery is unavailable
> **When** the Editor opens another image or chooses a Work in the Gallery
> **Then** the app asks for confirmation before replacing it, saying the latest edits are not saved in the Gallery and would be lost. Cancelling keeps the Work exactly as it was. Choosing a Work that cannot be read never replaces the open Work and never asks (open-and-view AC-16)
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-18 (US-02) — cross-context

> **Given** the Gallery holds Works stored by an earlier version of the app
> **When** the app updates to a new version and the Editor reopens one of them
> **Then** the Work opens with exactly the stored data: the same Original pixels, Source name, Source format, Geometry, Adjustments and Drawing layer. When the update did not change how a Work is drawn, a full-size Export of it is identical to the Export the earlier version made. An update never empties the Gallery or loses a Work
>
> — `spec.md §5, AC-18, verbatim` · full text: [spec.md](../spec.md)

### AC-19 (US-01) — domain invariant

> **Given** the Editor opens an image and the app reloads or crashes while Autosave is storing it
> **When** the Editor reopens the Gallery
> **Then** every Work in it is either in its last fully stored state or absent, never half stored. A Work whose first save was interrupted is simply not listed, and a Work whose later save was interrupted reopens in its previous stored state. Evicting to make room and storing the new state happen as one step, so an interrupted save also removes no Work, and no Work ever leaves the Gallery without its notice
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

### AC-20 (US-01) — domain invariant

> **Given** Autosave is storing the open Work after an Apply, Undo or Redo
> **When** the Editor reloads the page or closes the tab before that save finishes
> **Then** the browser shows its own warning that leaving may lose changes. Staying lets the save finish. Once no save is running, reloading or closing the tab shows no warning, even when the Work has Unsaved edits, because they are stored in the Gallery
>
> — `spec.md §5, AC-20, verbatim` · full text: [spec.md](../spec.md)

### AC-21 (US-01) — cross-context

> **Given** the same Work is open in two tabs, and the Gallery in the other tab has evicted it to make room
> **When** the Editor applies a Step, Undo or Redo in this tab
> **Then** Autosave adds the Work back to the Gallery as the most recently opened or changed Work, evicting the least recently opened or changed Work that is not open in this tab, with the usual notice. The Work open in this tab is never lost. When both tabs store the same Work, the last save wins (§8)
>
> — `spec.md §5, AC-21, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Helpers: second page in the same context, hold/release a save, snapshot stored state via `galleryRecords()` — `e2e/gallery/helpers.ts`
- [ ] AC-12: deny storage for the context (or `galleryFailOpen` + reload) → unavailable start screen; open, edit, export work; nothing stored; another open after an edit asks — `e2e/gallery/gate-and-lifecycle.spec.ts`
- [ ] AC-16: after a committed Apply, "Open image", a drop and choosing a Work each replace with no dialog; previous Work listed with its edits; with a save held, the replacement waits, then no dialog
- [ ] AC-17: `galleryFailNextSave` → Apply → open another image asks; Cancel keeps Work; Confirm replaces
- [ ] AC-18: page B `galleryOpenNextVersion()` → page A shows the newer-version notice, keeps editing, asks on replace with Unsaved edits
- [ ] AC-20: `galleryHoldSave('record')` → reload triggers the `beforeunload` dialog; dismiss to stay → save commits; reload after commit → no dialog
- [ ] AC-21: two pages, Gallery full; page B's open evicts page A's Work; Apply in page A writes it back as newest with a notice
- [ ] Offline: after the first load, go offline; list, reopen, Autosave and delete succeed (WebKit without an offline reload)
- [ ] AC-19 on Chromium: every hold point (`evictions`, `record`, `original`, `layer`) × first save and later save, repeated to 40, plus 10 random-delay reloads after an Apply; after each reload every stored Work equals its last committed snapshot, a first save's Work is absent, no Work missing without a notice — `e2e/gallery/interrupted-saves.spec.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Cancel the confirmation | Work, revision and Draft unchanged; read image dropped; nothing stored or evicted |
| A save that fails while the gate waits | the gate asks (AC-17) |
| Choosing a damaged Work with unstored edits | damaged notice; no confirmation; Work unchanged |
| An open tool's Draft at replace | discarded with the old Work |
| Reload with Unsaved edits but no save running | no leave dialog |
| Engine can't deny storage for the context | use the `galleryFailOpen` hook instead |
| Browser clears the Gallery while the page is open | next save is a first save, asks for persistence again, doesn't fail |
| Both pages save the same Work | the later save wins, no warning |

## Definition of Done

- [ ] `pnpm test:e2e e2e/gallery/gate-and-lifecycle.spec.ts` passes on Chromium, Firefox and WebKit
- [ ] `pnpm test:e2e e2e/gallery/interrupted-saves.spec.ts` runs 50 reloads on Chromium with 0 damaged or mixed Works
- [ ] the offline rows pass, WebKit without an offline reload
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
