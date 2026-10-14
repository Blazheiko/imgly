---
status: Draft
owner: "Blazheiko"
reviewers: ["Blazheiko (implementing engineer)", "Tech Lead", "Security Lead"]
updated_at: "2026-10-14"
feature_size: "M"
---

# Test plan — gallery

The Gallery keeps up to 20 recent Works in this browser. Autosave stores the open Work's applied
state (Original, Source name, Source format, Geometry, Adjustments, Drawing layer) once the image
has replaced the open Work and again after every Step, Undo and Redo, never a Draft, the View or the
Edit history. A reopened Work is exactly the stored Work and stays editable piece by piece. The
Gallery evicts the least recently opened or changed Work that is not open in this tab, and names
every Work that leaves. The replace confirmation now asks only when the latest applied state is not
stored.

Inputs: `spec.md` §5 (AC-01 to AC-21), §6, §6.1 and §7; `sad.md` §5, §6 (Critical flows 1 and 2,
Flows 3 to 7), §8, §10 (QG-1 to QG-4) and §11; ADR-0001 to ADR-0006; `data-model.md` (stores,
indexes and the test fixtures); `ux-flows.md` (the e2e-through-UI scripts); `screens.md` SCR-01 to
SCR-07 (the component states and the message catalog). `target_surfaces: [web-frontend]`, so the
frontend tiers apply. `tasks.json` does not exist yet, so `tasks` assigns these rows to tasks.

## Decisions taken in this plan

- **Levels (chosen by the owner, 2026-10-14).** Each AC group runs at every level that has something
  to check:
  - Rules and storage (AC-07 to AC-10, AC-18, AC-19): unit (with property tests), integration and
    e2e-through-UI.
  - Autosave and the replace gate (AC-01, AC-02, AC-11, AC-12, AC-14, AC-16, AC-17, AC-20, AC-21):
    unit, integration, component and e2e-through-UI.
  - Gallery UI (AC-03, AC-05 to AC-07, AC-13, AC-15): unit, component and e2e-through-UI.
  - Exact reopen (AC-04, AC-18, the thumbnail of AC-01 and AC-03): unit, integration and
    e2e-through-UI.
- **Spec §8 question 2 is closed with its default (owner, 2026-10-14).** The 3 s storing target is
  gated on Chromium on the reference machine. Firefox and WebKit are measured and reported, not
  gated (`sad.md` QG-3, §11).
- **The datastore is never mocked.** Integration rows run the real `works-repository`, the real
  migrations and the real `editor` store against an in-memory IndexedDB that implements the
  standard (real transactions, aborts and version changes), with a fresh database per test. This
  is the repo's existing migration-test approach. Where `sad.md` QG-4 says "a fake repository",
  this plan reads it as the real repository with injected faults: a thin wrapper around the
  database that makes a chosen write fail with a quota error or another error. The real
  repository is then also checked in three real browsers by e2e-through-UI.
- **A full quota is tested at three depths (owner, 2026-10-14).**
  1. Integration: the fault wrapper fails the N-th write with a quota error. This covers the
     retry loop, "nothing evicted when the Work can't fit alone" and the notice.
  2. e2e-through-UI on all three engines: a test hook sets a byte budget in the repository, so the
     real UI gets a real-shaped refusal.
  3. One Chromium-only e2e row shrinks the site's real quota through the browser's DevTools
     protocol. It proves the browser's own error is classified as a full quota, not as another
     failure.
- **Interrupted saves are held by a hook (owner, 2026-10-14).** A test hook can hold the
  `storeWork` transaction open at a chosen point: after the evictions, after the record, after the
  Original, or after the layer. The test then reloads the page. The 50 forced reloads of the §6
  NFR are made of every hold point × first save and later save, repeated, plus 10 reloads at a
  random delay after an Apply with no hold. After each reload every stored Work is compared with
  its last committed state. A random reload alone would mostly land before or after the
  transaction and prove nothing.
- **No visual-regression (owner, 2026-10-14, as in draw and adjust).** Entry states, the "Open"
  border, the count and the storage line are checked by component tests. Thumbnail pixels are
  checked by comparing them, within one engine, with the Preview renderer's own render of the
  same Work. No baseline images are kept.
- **Exactness tolerance is 0 (spec §6, QG-2).** Reopen rows compare a full-size PNG Export after
  the reopen with the Export of the same Work made before the reload, within one engine.
  - The reference set includes `alpha-patches.png` and `soft-edge.png` to expose the premultiplied
    alpha risk of `sad.md` §11.
  - If a semi-transparent pixel differs, the row stays red. The owner then narrows AC-04 and the §6
    row to opaque pixels, or a new ADR changes how such Originals are stored. The tolerance is never
    loosened silently.
- **"Storage blocked" uses blocked site data, not a private window** (`sad.md` §11). Current private
  windows usually open IndexedDB in memory. The AC-12 rows make the database refuse to open:
  storage access is denied for the browser context where the engine allows it, otherwise a test
  hook fails `openDb` before it runs. A private window is no longer used as the example.
- **Two tabs are two pages in one browser context**, so they share the real store (AC-21, ADR-0006).
  The version-upgrade row opens the second page with a test hook that asks for the next database
  version, so the first page gets a real `versionchange`.
- **Contract is N/A.** The main thread ↔ codec worker message (`encodePng` / `decodePng`) is one
  shared TypeScript type. The typecheck gate is the contract check, and the e2e reopen rows send the
  real message.

## Levels

| Level | Scope | Strategy (generic — no tool names) |
|---|---|---|
| Unit | Pure `src/core/gallery` rules: the cap (20), `evictionCandidates`, `validateStoredWork`, `touchedLabel`, `storageLine`, `entryName`. The save queue's ordering rule in `src/features/editor/autosave.ts`, written as a pure function of requests and completions. The message catalogs in `src/features/editor/messages.ts` and `src/features/gallery/messages.ts`. The new `AppError` codes. | In memory, no DOM, an injected clock. Example tests for the named cases, plus **property tests** that generate hundreds of random record sets, open-Work ids, touched times, request and completion orders and stored records. Each asserts one invariant. |
| Integration | (a) `src/infra/db`: migration `0002-gallery`, `storeWork` (evict and store in one transaction, the quota retry), `listWorks`, `loadWork`, `deleteWork`, the `meta` marker, `versionchange` handling. (b) `src/infra/work-codec/worker-handler.ts`: PNG encode and decode, and the decoded size check. (c) `renderThumbnail` against the **recording GL**. (d) The `editor` store with its composed `autosave.ts`, and the `gallery` store, working together: Autosave triggers, the queue, the replace gate, reopen, availability, notices and persistence. | A real in-memory IndexedDB, created fresh per test and never mocked. Faults are injected by a wrapper that fails a chosen write. Only what the simulated DOM lacks is replaced: the codec worker by a direct call to `worker-handler`, the WebGL renderer by the recording GL, and `navigator.storage` by a recording stub. |
| Contract | <!-- N/A: the main thread ↔ codec worker message is one shared TypeScript type; the typecheck gate is the contract check, and the e2e reopen rows exercise the real message. --> | — |
| E2E | Covered by E2E-through-UI: every flow in this feature is driven through the UI. | — |
| Load | The numeric §6 timing NFRs, on the reference machine. | The load/perf tool already in your repo (the existing perf-tagged browser suite, run by hand with the perf switch), or e.g. k6 or Locust. |
| Component | `GalleryStart` (SCR-01), `GalleryOverlay` (SCR-03), `GalleryList`, `GalleryEntry`, `DeleteWorkDialog` (SCR-04), `GalleryAction`, the reworded `ReplaceDialog` (SCR-05), `EditorView`'s new slots and its leave warning, and the Gallery notices in `ToastStack`. Each `screens.md` state row is a case. | Mount the component with real stores on an in-memory IndexedDB, without booting the app. Assert the rendered text, focus, `inert`, keyboard handling, ARIA names and store calls. |
| Visual-regression | <!-- N/A: decided by the owner; entry states are checked by component tests and thumbnail pixels by same-engine comparisons. --> | — |
| E2E-through-UI | The `ux-flows.md` flows in a real browser on Chromium, Firefox and WebKit: real IndexedDB, real reloads and closed pages, real Exports decoded back to pixels, two pages in one context, offline mode, the browser's own leave warning. | The app's own hooks-enabled build. New `__imglyTest` Gallery hooks: read the stored records, write a record in an earlier shape, damage a stored part, set a byte budget, hold a transaction, ask for the next database version, count persistence requests. Each test gets a fresh browser context, so storage starts empty. |

## AC coverage

Test names are intent-based. Level tokens: `unit`, `integration`, `component`, `e2e-through-UI`.

**Narrowed on purpose** marks a row with no test at its level, and names the rows that hold the AC
instead.

| AC (spec.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 happy | Autosave is triggered by an open that replaced the Work, and by each Step, Undo and Redo | integration | one save is queued after a successful replace, after `commit`, after `undo` and after `redo`; none after opening a tool, changing a Draft, zooming or panning |
| AC-01 happy | a save stores the record, the Original once and the layer only when it changed | integration | the first save writes `works`, `originals` and `layers` (when there is a layer); a Crop or Adjustment Step after it writes only the record; a drawing Step writes the record and the layer; nothing is encoded again for a Crop or Adjustment Step |
| AC-01 happy | each save prepares a fresh thumbnail of the applied Work | integration | `renderThumbnail` is called with the applied Work for every save; the stored thumbnail is that call's result; the long side is at most 512 px |
| AC-01 happy | the newest stored Work is listed first | integration | after saves of Works A then B, `listWorks` gives B, A; touching A by a Step gives A, B |
| AC-01 happy | a Crop, an Adjustment and a drawing survive a reload, a closed page and opening another image | e2e-through-UI | after each of the three, the Gallery lists the Work first; reopening it shows all three changes; its thumbnail matches the Preview renderer's render of that Work in the same engine; all three engines |
| AC-01 happy | Autosave never interrupts editing | e2e-through-UI | during a save the tools, Undo and Redo stay usable; no dialog, spinner or notice is shown for a committed save |
| AC-02 invariant | only applied state is stored, never a Draft, the View or the Edit history | integration | with "Draw" open and strokes in the Draft, the stored record and layer equal the applied Work; zoom and pan change nothing stored; the record has no history field |
| AC-02 invariant | an Undo is stored like any Step | integration | apply a drawing, Undo: the stored Work has `layerId: null` and no `layers` entry |
| AC-02 invariant | a reopened Work starts fitted, with Undo and Redo unavailable | integration | after `reopenWork` the View is fitted, the Edit history is empty, and `canUndo` and `canRedo` are false |
| AC-02 invariant | after a reload, an undone drawing, a zoom and an open Draft are all gone | e2e-through-UI | the reopened Work has no marks, the Preview is fitted, and Undo and Redo show unavailable; all three engines |
| AC-03 happy | the touched label follows the age | unit | 0 s and 59 s give "Just now"; 60 s gives "1 minute ago"; 59 min gives "59 minutes ago"; 60 min gives "1 hour ago"; 23 h 59 min gives "23 hours ago"; 24 h gives the date in the browser's language |
| AC-03 happy | a Work with no Source name is listed as "Untitled" | unit | `entryName('')` gives "Untitled"; any other name is returned unchanged |
| AC-03 happy | the list shows each entry's thumbnail, name, touched label and the count | component | entries in the order given; each shows its thumbnail, name (full name as its title) and label; the open Work's entry has the accent border and "Open"; "{n} of 20 places used" |
| AC-03 happy | the entry's accessible name is "{name}, {status}" | component | each entry button has that name; Delete has "Delete “{name}”" |
| AC-03 happy | the overlay is modal and closes without changing anything | component | `role="dialog"`, `aria-modal`, labelled "Gallery"; everything outside is `inert`; focus stays inside; Close and Esc close it and return focus to "Gallery"; the Work, its revision and the View are unchanged |
| AC-03 happy | the Gallery lists several Works newest first, with the open one marked | e2e-through-UI | after opening three images and editing the first again, "Gallery" lists first, third, second; the first is "Open"; "3 of 20 places used"; Close returns to the Work unchanged |
| AC-04 happy | a stored record and its parts serialise and read back to the same Work (property) | unit | for random valid Geometries, Adjustments, sizes, Source names and formats, `toRecord` then `validateStoredWork` gives the same values |
| AC-04 happy | PNG encode and decode keep the pixels and check the size | integration | `worker-handler` encodes an opaque RGBA buffer and decodes it to the same bytes; a decoded size that differs from the record's is refused |
| AC-04 happy | reopen gives the stored Work with an empty history, no Unsaved edits and the loaded Blobs kept | integration | after `reopenWork(id)` the Work's id, Source name, Source format, Geometry and Adjustments equal the stored ones; the layer has a new id; the history is empty; there are no Unsaved edits; the next Adjustment Step encodes nothing |
| AC-04 happy | a reopened Work's Export is identical to its Export before the reload | e2e-through-UI | for `photo.png` and `ref.png` with a Crop, a Straighten angle, all seven Adjustments away from neutral and a drawing, a full-size PNG Export after the reopen differs from the one before the reload by 0 per channel; all three engines (QG-2, spec §7 KPI) |
| AC-04 happy | semi-transparent Originals reopen exactly | e2e-through-UI | the same comparison for `alpha-patches.png` and `soft-edge.png` with a drawing gives difference 0, alpha included; all three engines (`sad.md` §11 risk; a failure goes to the owner, not to the tolerance) |
| AC-04 happy | each part stays editable after the reopen, and the Source name picks the Export | e2e-through-UI | "Crop and rotate" shows the whole image with the stored frame; "Adjust" shows the stored values; "Draw" shows the stored layer and the Brush and Eraser paint and erase it; the Export's default name and format follow the Source name and format; the Gallery has closed |
| AC-05 happy | the empty start screen says Works will appear here and offers "Open image" | component | SCR-01 `empty`: the plain text and the same "Open image" action; the storage line; no count |
| AC-05 happy | nothing reopens on its own after a reload | integration | at start-up with stored Works, no Work is loaded and no record, Original or layer is read beyond the list |
| AC-05 happy | a first visit, an edit and a reload put the Work on the start screen, and one action reopens it | e2e-through-UI | the empty state first; after open, Apply and reload the start screen lists the Work and opens nothing; choosing it reopens it with the change (spec §7 KPI: 1 action); all three engines |
| AC-06 happy | the delete confirmation names the Work and says an Export is the only copy | component | SCR-04: the Work's name ("Untitled" when it has none), "can't be brought back", the Export sentence; Cancel, Esc and a backdrop click keep the Work and return focus to its Delete |
| AC-06 happy | deleting removes the record, the Original and the layer in one transaction | integration | after `deleteWork(id)` none of the three stores holds the id; the other Works are untouched; the count drops by one |
| AC-06 happy | delete then reload leaves no stored part behind | e2e-through-UI | after confirming, the entry is gone and the count drops; after a reload the hooks find no `works`, `originals` or `layers` entry for that id (spec §6.1); cancelling keeps the Work exactly as it was; all three engines |
| AC-06 error | a failed delete keeps the entry and says so | integration + component | the injected fault fails the delete: nothing is removed; the notice says "“{name}” couldn't be deleted. Try again."; the entry and count are unchanged (SCR-01 `delete failed`) |
| AC-07 invariant | the eviction rule never picks the Work open in this tab (property) | unit | for random record sets of 0 to 21 Works and any open-Work id, the candidates never include the open Work, and the stored count never exceeds 20 |
| AC-07 invariant | Delete is unavailable on the open Work's entry, with its hint | component | SCR-03 `delete unavailable`: `aria-disabled`, the hint "The open Work can't be deleted. Open another image first."; activating it opens no dialog |
| AC-07 invariant | the repository refuses to delete the Work open in this tab | integration | `deleteWork` with the open Work's id is refused and removes nothing |
| AC-07 invariant | the open Work's entry can't be deleted in a real browser | e2e-through-UI | Delete on the "Open" entry shows the hint; the Work stays listed and open; all three engines |
| AC-08 error | each kind of damage makes `validateStoredWork` refuse the Work | unit | `missing-original`, `layer-without-record-id`, `size-mismatch`, `bad-geometry` and `unknown-format-version` from `damagedWorkFixture` each make it refuse the Work as damaged; a valid stored Work passes |
| AC-08 error | listing checks only the shape and the thumbnail, choosing checks everything | integration | a Work with a damaged Original lists normally and fails only when chosen; a Work with a damaged thumbnail lists as damaged; the other Works list normally |
| AC-08 error | a damaged Work never replaces the open Work and never asks to confirm | integration | choosing it leaves the Work, its revision, the View and the history unchanged; no replace confirmation; the notice names the Work and offers Delete |
| AC-08 error | a damaged Work is evicted first | unit + integration | the rule orders damaged Works before the oldest readable one; a save at 20 Works evicts the damaged one and names it in the notice |
| AC-08 error | the damaged entry shows "Can't be read" and stays chooseable and deletable | component | SCR-01 `damaged entry`: the box text, the name or "Untitled", the status "Damaged"; Delete opens SCR-04; the notice's Delete opens SCR-04 too |
| AC-08 error | damaged stored data in a real browser | e2e-through-UI | a hook damages one Work's Original and another's thumbnail: the first lists normally and gives the notice when chosen, the second lists as damaged; both delete normally; every other Work opens; all three engines |
| AC-09 invariant | the 21st Work evicts the least recently touched Work not open here, in the same transaction | integration | with 20 stored, a new Work's first save evicts the oldest non-open Work and stores the new one in one commit; the Work just replaced is evicted only when it is the only candidate |
| AC-09 invariant | the same file opened twice is two Works | integration | each successful open creates a new id; both are stored |
| AC-09 invariant | a cancelled or unreadable open stores nothing and evicts nothing | integration | the replace cancelled, or the file refused, leaves the stored records exactly as before |
| AC-09 invariant | the eviction notice names the evicted Work | unit + component | the catalog text “{name}” was removed from the Gallery to make room; the `info` toast shows it with "Untitled" for a nameless Work |
| AC-09 invariant | opening 25 images keeps 20 Works and names each one evicted | e2e-through-UI | after each of images 21 to 25, one notice names the evicted Work; the Gallery holds 20; the open Work is listed; all three engines (§6 Gallery cap) |
| AC-10 error | a full quota evicts one more Work per retry until the open Work fits | integration | the fault wrapper refuses the first two writes with a quota error: the third attempt evicts the two oldest non-open Works and commits; one notice names both |
| AC-10 error | when the open Work doesn't fit even alone, nothing is evicted and the earlier state is kept | integration | the wrapper refuses every attempt: no Work is evicted, the earlier stored state of the open Work is unchanged, and the full-storage notice shows: "This Work couldn't be saved to the Gallery because the browser's storage is full. Export it to keep a copy." (ADR-0004; `sad.md` §11 notes the AC-10 wording to align) |
| AC-10 error | the several-Works notice names every evicted Work | unit + component | the catalog text "{n} Works were removed from the Gallery to make room: “{a}”, …"; one toast, not one per Work |
| AC-10 error | a byte budget makes the real UI evict and then refuse | e2e-through-UI | a hook sets a budget for three Works: the fourth evicts the oldest with a notice; a Work larger than the budget gives the could-not-save notice, evicts nothing and stays editable; all three engines |
| AC-10 error | the browser's own quota error is recognised as a full quota | e2e-through-UI | Chromium only: the site quota is shrunk through the DevTools protocol; the save gives the eviction or could-not-save notice, never the generic failure notice |
| AC-11 error | another failure raises one notice, retries at the next Step and withdraws the notice on success | integration | the wrapper fails three saves in a row: one `failure` notice; each later Step retries with no new notice; the first success withdraws it; a later failure raises it again |
| AC-11 error | the failure notice stays until dismissed and is not repeated | component | SCR-02 `save failed`: one toast while the failures run; gone after a success |
| AC-11 error | a failing save in a real browser | e2e-through-UI | a hook fails the next save: the notice shows once; editing continues; the next Apply succeeds and the notice goes; all three engines |
| AC-12 authorization | a database that can't be opened makes the Gallery unavailable for the page load | integration | `openDb` refused: the Gallery is marked unavailable with its reason; no save, list or persistence request is attempted afterwards; opening, editing and exporting go on |
| AC-12 authorization | the unavailable state says why in plain words, with the drop zone | component | SCR-01 and SCR-03 `unavailable`: "The Gallery is unavailable in this window." and the body for its reason (refused or blocked, held by an older tab, closed for a newer version); no list, no count; "Open image" still works |
| AC-12 authorization | with the Gallery unavailable, replacing asks whenever there are Unsaved edits | integration | the gate asks with Unsaved edits and replaces without asking without them, as open-and-view AC-15 |
| AC-12 authorization | blocked site data in a real browser | e2e-through-UI | with storage refused for the context (or the hook failing `openDb` where the engine can't refuse it), the start screen shows unavailable; an image opens, is edited and exported; nothing is stored; opening another image after an edit asks to confirm; all three engines |
| AC-13 happy | the storage line follows the browser's answer | unit | `storageLine(true)` gives the persisted wording; `false` and a missing API give the not-persisted wording |
| AC-13 happy | the line is read each time the Gallery shows, empty or full | component | SCR-01 and SCR-03 show the line under the header in both the empty and the listed states; it is read again when the overlay opens again |
| AC-13 happy | the line in a real browser | e2e-through-UI | with persistence granted and with it refused (a stubbed answer), the line shows the matching wording on the start screen and in the overlay; all three engines |
| AC-14 authorization | persistence is asked once, at the first save, and the marker is written in that save | integration | the recording `navigator.storage` stub sees one `persist()` call at the first save and none at start-up or at later saves; the `meta` marker commits in the same transaction |
| AC-14 authorization | a declined request changes only the line | integration | `persist()` resolving false: the save commits; the line uses the not-persisted wording; nothing else changes |
| AC-14 authorization | after the browser clears the Gallery, the next first save asks again | integration | deleting the database and saving again gives one more `persist()` call |
| AC-14 authorization | the request counted in a real browser | e2e-through-UI | a hook counts `persist()` calls: none at load, one at the first save, none after a reload and further saves; all three engines |
| AC-15 cross-context | choosing a Work is refused while an export runs or a replacement waits | integration | `reopenWork` is refused and not queued in both cases; the open Work is unchanged |
| AC-15 cross-context | the entries show the hint while choosing is unavailable | component | SCR-03 `choose unavailable`: entries `aria-disabled` with "Wait for the export to finish, then choose a Work." or "Answer the open question first, then choose a Work."; activating one does nothing |
| AC-15 cross-context | choosing during a real export or confirmation | e2e-through-UI | **Narrowed on purpose:** held by the integration and component rows. An export in a real browser is too short to aim a choice at reliably (as in draw AC-14), and the overlay is inert while the replace confirmation shows |
| AC-16 cross-context | the replace gate waits for a running or pending save, then replaces without asking | integration | with a save held open, an open or a reopen waits; when the save commits it replaces with no confirmation; an open tool's Draft is discarded with the old Work |
| AC-16 cross-context | the save queue runs one save at a time and keeps only the newest pending state (property) | unit | for random interleavings of requests and completions, at most one save runs, the pending state is always the newest request, and the last stored state is the newest one |
| AC-16 cross-context | the previous Work stays in the Gallery with its applied edits | integration | after the replace, the previous Work's stored record equals its last applied state |
| AC-16 cross-context | waiting shows the spinner, not a dialog | component | SCR-03 `waiting for save` and open-and-view's canvas spinner while the gate waits; no SCR-05 |
| AC-16 cross-context | switching images with stored edits asks nothing in a real browser | e2e-through-UI | after an Apply, opening a file, dropping one and choosing a Work each replace with no dialog; the previous Work is listed with its edits; all three engines |
| AC-17 cross-context | the gate asks when the latest applied state is not stored | integration | after a failed save, or a save that fails while the gate waits, replacing asks; Cancel keeps the Work, its revision and its Draft; Confirm replaces |
| AC-17 cross-context | a Work that can't be read never asks and never replaces | integration | choosing a damaged Work with unstored edits gives the damaged notice and no confirmation |
| AC-17 cross-context | the confirmation says the latest edits aren't saved in the Gallery | unit + component | the reworded SCR-05 text; Cancel, Esc and a backdrop click keep the Work |
| AC-17 cross-context | a failed save, then an open, asks in a real browser | e2e-through-UI | a hook fails the save; opening another image asks; Cancel keeps the Work; Confirm replaces; all three engines |
| AC-18 cross-context | migration 0002 keeps every v1 record and reshapes it forward | integration | a v1 database with records in the old shape upgrades to v2 with each record's fields, Original pixels, layer and Source name kept; the new stores and the `touchedAt` index exist; no record is dropped |
| AC-18 cross-context | an older connection gives way to a newer version | integration | a second connection at the next version: the first finishes its running save, drops the pending one, closes, marks the Gallery unavailable and raises the "newer version" notice |
| AC-18 cross-context | a Work stored by the earlier version reopens exactly | e2e-through-UI | a hook writes a Work in the v1 shape, the page reloads into the current build, and the reopened Work's Export equals the Export made before the write by 0 per channel; the Gallery has lost nothing; all three engines |
| AC-18 cross-context | a newer version in another page closes the old page's connection | e2e-through-UI | the second page asks for the next version; the first shows the "newer version" notice, keeps editing, and asks to confirm a replace with Unsaved edits; all three engines |
| AC-19 invariant | a save interrupted at any point leaves every Work committed or absent | integration | aborting the transaction after the evictions, the record, the Original or the layer leaves the database exactly as before the save; a first save leaves the Work absent; no eviction remains |
| AC-19 invariant | 50 reloads during Autosave leave no damaged or mixed Work | e2e-through-UI | the hook holds the transaction at each point for first and later saves, plus 10 random-delay reloads; after each reload every stored Work equals its last committed state, a first save's Work is absent, and no Work left without a notice; Chromium (§6 NFR) |
| AC-20 invariant | the leave warning is set only while a save runs or is pending | component | `EditorView` adds the `beforeunload` handler when `saving` turns true and removes it when it turns false; with Unsaved edits and no save, no handler |
| AC-20 invariant | the browser warns on leaving during a save, and not after | e2e-through-UI | with a save held, a reload triggers the page's leave dialog; staying lets the save commit; after the commit a reload shows no dialog; all three engines |
| AC-21 cross-context | a save that finds its Work evicted writes it back in full | integration | another connection evicts the Work; the next Step's save writes the record, the Original and the layer from memory as the newest Work, evicting the oldest non-open Work with a notice |
| AC-21 cross-context | the Work open here survives eviction by another page | e2e-through-UI | two pages in one context, the Gallery full; the second page's open evicts the first page's Work; an Apply in the first page writes it back as the newest, with a notice naming the evicted Work; all three engines |
| AC-21 cross-context | the last save wins when both pages store the same Work | integration | two connections save the same id in turn; the stored record is the later one |

## Edge cases / error paths

The error and authorization ACs each have their own rows above: AC-08, AC-10 and AC-11 (error),
and AC-12 and AC-14 (authorization). AC-06's delete failure and AC-17's unstored-edits path also
have their own rows. The spec, the SAD and the data
model also imply these boundaries:

- Exactly 20 Works and the open Work is one of them → a replace evicts the oldest of the other 19;
  the Work just replaced is evicted only when it is the only candidate (AC-09).
- 20 Works and all of them damaged except the open one → the damaged ones go first, oldest first.
- Two Works with the same `touchedAt` → the order is stable (the id breaks the tie), in both the
  list and the eviction choice.
- A Source name that is empty, very long, or holds markup such as `<img onerror>` → shown as
  "Untitled", cut with an ellipsis, and rendered as text only (spec §6.1).
- A record whose thumbnail is missing or isn't a PNG → listed as damaged; nothing else fails.
- A record from an unknown future `formatVersion` → damaged, never guessed at.
- A layer stored without the record pointing to it, or a record pointing to a missing layer → damaged
  when chosen.
- A Work with no Drawing layer → no `layers` entry; an Undo that removes the only drawing deletes
  the stored layer.
- A 1×1 Work → stored, listed, reopened and exported exactly.
- A 4096×4096 Original (the Downscale limit) → stored and reopened; the thumbnail's long side is at
  most 512 px.
- Undo and Redo pressed quickly ten times → at most one save runs and one waits; the stored state is
  the last one.
- Close the overlay while a reopen is reading → the reopen still completes or fails cleanly, never
  half replaces.
- The browser clears the Gallery while the page is open → the next save stores the open Work as a
  first save, asks for persistence again and doesn't fail.
- Offline after the first load → listing, reopening, Autosave and deleting all succeed (§6). WebKit
  is checked without reloading while offline, since its test driver can't reload a page offline
  (as in export's offline test).
- The display is lost while the Gallery shows → thumbnails already painted stay; the Preview follows
  open-and-view's display-lost path; nothing stored changes.
- Thumbnail object URLs → revoked when the list unmounts (a component row counts create and revoke).
- Decoded bitmaps rejected by the size check or superseded by a reopen → released through the bitmap
  ledger; each reopen e2e ends with a check of the ledger's retained count.

## Test data

- **Seed strategy.**
  - Unit property tests generate random record sets (0 to 21 Works, random `touchedAt`, some
    damaged), open-Work ids, request and completion orders, Geometries, Adjustments, sizes, Source
    names (empty, Unicode, very long, markup) and ages for the label.
  - Integration and component tests use the `data-model.md` factories in `src/infra/db/testing.ts`:
    `workRecordFixture`, `storedWorkFixture` and `damagedWorkFixture(kind)`. Works in memory come
    from the existing `createWork` in `src/core/document.ts`. The clock is injected.
  - A **v1 record factory** builds a record in the released v1 shape for the migration rows.
- **Fixtures for e2e-through-UI.**
  - The **opaque reference set**: the existing `photo.png` and `ref.png`.
  - The **semi-transparent set**: the existing `alpha-patches.png` and `soft-edge.png`.
  - The **reference edits**: a Crop, a Straighten angle, all seven Adjustments away from neutral and
    the draw reference drawing, applied through the existing e2e helpers of crop-rotate, adjust and
    draw.
  - **25 small distinct images**, generated in the page at run time (a coloured rectangle with its
    number), for the cap and eviction rows.
  - The **reference Work** for the load scenarios: 4096 × 3072 px, built in the page at run time as
    the draw and export perf suites already do.
- **Independent oracle.** Reopen rows compare two full-size Exports made in the same engine, before
  and after. Thumbnail rows compare with the Preview renderer's own render of the same Work. Stored
  state is read back through the hooks, not through the code under test. The label and message rows
  compare with the texts written in the test, not with the catalog.
- **Integration dependency.** A real in-memory IndexedDB, created fresh per test. Stores are never
  mocked. Faults come from a wrapper that fails chosen writes. The codec worker is replaced by a
  direct call to its handler, and the WebGL renderer by the recording GL, at this level only. The
  real ones run in e2e-through-UI.
- **Cleanup boundary.** Per test. Unit and integration tests open a uniquely named database, or reset
  the in-memory IndexedDB, in each test and close every connection at the end. e2e-through-UI tests
  get a fresh browser context in each test, so IndexedDB and the `meta` marker start empty.
  Downloaded Exports are read from the test's temporary output and dropped with it.

## NFR validation (load)

The load/perf tool already in your repo, or e.g. k6 or Locust. Every scenario runs on the reference
machine (Apple M1 MacBook Air, latest stable Chrome) with the reference Work: 4096 × 3072 px with a
Crop, a Straighten angle, all seven Adjustments away from neutral and a Drawing layer covered by
marks over the whole image. Each scenario takes p95 over **20 runs after 2 warm-up runs** and is
tagged as a perf test, so it runs by hand rather than on every PR. "Stored" means the save's
transaction committed, so the Work can be read back after a reload.

- **First store** (§6 row 1) → open the reference-sized image 20 times. Assert p95 from the first
  Preview to the commit is ≤ 3 s. Gated on Chromium. Firefox and WebKit are measured and reported,
  not gated (spec §8 question 2, closed 2026-10-14).
- **Store after a Step** (§6 row 2) → 20 Crop Steps, 20 Adjustment Steps, 20 drawing Steps and 20
  Undos and Redos on the reference Work. Assert p95 from the Apply, Undo or Redo to the commit is
  ≤ 300 ms for a Crop or Adjustment Step and ≤ 1.5 s for a drawing Step.
- **Responsiveness during Autosave** (§6 row 3) → a long-task trace across both scenarios above.
  Assert that the longest main-thread task is ≤ 200 ms.
- **Reopen** (§6 row 4) → 20 reopens of the reference Work from the Gallery overlay. Assert p95 from
  the choice to the first Preview is ≤ 1.5 s.
- **Gallery shows** (§6 row 5) → with 20 reference Works stored, open the overlay 20 times. Assert
  p95 from choosing "Gallery" to every thumbnail painted is ≤ 500 ms.

The §6 exactness, interrupted-save, cap and offline rows carry counts and tolerances, not rates.
They are verified by the e2e-through-UI rows of AC-04, AC-19, AC-09 and the offline edge case.

## CI placement

- **On every PR:** unit (with property tests), integration and component, together with lint and
  typecheck. These are the fast suites.
- **On every PR, three engines:** e2e-through-UI, as the repo's CI already runs the earlier features'
  browser suites. This includes the reopen exactness, reload, delete, eviction, quota, two-page,
  leave-warning, unavailable and offline rows. A lost or inexact Work must block a merge.
- **On every PR, Chromium only:** the real-quota row and the 50-reload interrupted-save row.
- **By hand before release, on the reference machine:** the load scenarios above (the perf-tagged
  suite).
