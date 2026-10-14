---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-13"
feature_size: "M"
---

# Spec — gallery

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root; Gallery and Autosave added for this feature, Unsaved edits and the replace invariant refined)
> **Reference module / docs / channels used:** `docs/idea-brief.md` (§5, §6, §7, §8), `docs/roadmap.md` (step 8, open decision D2), `docs/adr/0003-persist-works-in-indexeddb-as-original-plus-params-plus-layer.md`, `docs/architecture-map.md`, `docs/design-system.md` (empty states, microcopy tone), `src/core/document.ts`, `src/infra/db/schema.ts`, `src/features/editor/store.ts` (the open and replace flow), and §3 of `docs/features/open-and-view/spec.md`, `docs/features/crop-rotate/spec.md`, `docs/features/adjust/spec.md`, `docs/features/draw/spec.md` and `docs/features/undo-redo/spec.md`, plus open-and-view AC-15 and AC-16 and crop-rotate AC-17. No other channels.

## 1. Context

The open Work lives only in the memory of the current tab. A reload, a closed tab, a browser crash or opening another image loses every Crop, Adjustment and drawing the Editor applied, unless they exported first. An Export does not fully save the work either: it flattens the edits into one image, so the next day the Editor can no longer widen the Crop, move a slider back or erase one mark. They can only start again from the source file and redo everything by hand. The Portfolio reviewer judges the app against the roadmap's destination, which is to "reopen any recent work later and re-edit it without loss". Today the app fails that sentence completely.

Why now: the gallery is roadmap step 8, the last step of the editing story. All three editing tools and undo and redo have shipped, and each of their specs defers keeping the Work between sessions to this step (open-and-view §3, crop-rotate §3, adjust §3, draw §3, undo-redo §3). Repo ADR 0003 already decided to store a Work in the browser as its Original plus its parameters plus its Drawing layer, but the store has only a schema, and nothing reads or writes it yet. Roadmap decision D2 (cap by count or by storage size, and whether to ask the browser for persistent storage) blocks this step, and this spec closes it.

Committed approach: **an autosaved Gallery of the 20 most recently opened or changed Works, kept in this browser only.** Every image that opens successfully enters the Gallery as soon as it has replaced the open Work, as a new Work even when the same file was opened before, and Autosave stores the Work again after every Step, Undo and Redo, never the open tool's Draft or the View. On a start with no Work open, the Gallery sits next to the "Open image" drop zone, and a "Gallery" action in the top bar shows it while a Work is open. Each entry shows a thumbnail of the Work with all its edits, its Source name and when it was last opened or changed. Reopening a Work gives back exactly what was stored: the same Original, Geometry, Adjustments and Drawing layer, each still editable on its own. The Gallery keeps at most 20 Works. It evicts the least recently opened or changed Work that is not open in this tab, both when a 21st arrives and when the browser's storage space runs out, and it says which Work it removed. The Editor can also delete a Work by hand. The app asks the browser once, at the first save, to keep its storage persistent, and the Gallery always says plainly whether the browser may clear it and that an Export is the durable copy. Because Autosave keeps applied changes, replacing the Work asks for confirmation only when its Unsaved edits are not stored in the Gallery. This approach was chosen at easy interview depth (2026-10-12). The owner chose six points explicitly: manual delete, the cap of 20 with eviction when storage is full, asking for persistent storage once at the first save, confirming a replacement only when the edits are not autosaved, saving every Work on open, and the M size. The rest comes from the accepted assumptions ledger. The ideation analyses did not run at that depth.

Traceability and deliberate compromises:

- Decision: closes roadmap D2. The Gallery is capped by count (20 Works), not by a storage-size budget, and it also evicts the oldest Works when the browser reports that its storage is full (AC-09, AC-10). The app asks for persistent storage once, at the first save (AC-14).
- Cross-feature change: replacing the Work, whether by opening a file, dropping one or reopening a Work from the Gallery, asks for confirmation only when the open Work has Unsaved edits that Autosave has not stored (AC-16, AC-17). This narrows open-and-view AC-15, whose dialog said the edits "will be lost", which stops being true once they are stored. The root CONTEXT invariant and the Unsaved edits entry are refined to match. Crop-rotate AC-17 and its siblings in adjust and draw keep their rule that an open tool's unapplied changes are discarded with the old Work.
- Cross-feature change: reopening a Work from the Gallery is a new way to replace the Work, with the same rules as opening a file. It is refused while an export runs or while a replacement waits for confirmation, a Work that cannot be read never replaces the open one (open-and-view AC-16), and it starts an empty Edit history with the state at reopen as the save point (undo-redo AC-09, AC-10; AC-04 here).
- Decision: the Edit history is not stored, as undo-redo §3 and idea-brief §5 require. Reopening gives back the Work's editable state, not its Steps.
- Decision: the Original is stored without any loss, so a reopened Work is pixel-identical to the one that was saved and its Export matches the Export made before the reload (AC-04, §6). This makes each stored Work cost roughly its lossless image size, which is why the Gallery is capped (ADR 0003, Consequences).
- Decision (clarify, 2026-10-13): a Work's place in the Gallery is set when it opens or is reopened and again after every Step, Undo and Redo, so "most recently opened or changed" decides both the order and the eviction (AC-03, AC-09).
- Decision (clarify, 2026-10-13): a replacement that starts while Autosave is still storing the open Work waits for that save to finish before deciding whether to ask (AC-16, AC-17), and leaving the page while a save is running triggers the browser's own leave warning (AC-20).
- Decision (clarify, 2026-10-13): "the open Work" in the eviction rule means the Work open in this tab. Another tab may evict it, and this tab's next save adds it back as the most recent Work (AC-07, AC-21). The root CONTEXT invariant is scoped to match.
- Decision: nothing reopens on its own after a reload (assumptions ledger A2). This keeps a shared machine from greeting the next person with the last photo, and keeps one damaged Work from breaking every start.

## 2. Goals

- The Editor never loses applied work to a reload, a closed tab, a crash or opening another image: every applied change reaches the Gallery moments after it is made, and reopening a Work gives back exactly that Work, still editable piece by piece.
- The app is honest about where Works are kept. The Gallery says that it lives in this browser only, whether the browser may clear it, and that an Export is the durable copy, and no Work ever leaves the Gallery without the Editor being told.
- Storage use stays bounded and predictable. The Gallery holds at most 20 Works, it never removes the open one, and editing keeps working when storage is full, refused or damaged.

## 3. Non-goals

- Keeping the Edit history when a Work is reopened. The idea brief keeps the Work's editable state between sessions, not its Steps (idea-brief §5, undo-redo §3).
- Sync, cloud backup, accounts, or sharing Works between browsers or devices. They need a server, which contradicts a client-only app (ADR 0001, idea-brief §5).
- Organizing the Gallery: renaming, search, folders, tags, multi-select or bulk delete. Twenty Works fit on one screen, and each of these needs its own design.
- Exporting or editing a Work straight from the Gallery without opening it, and project-file export or import. A Work is edited and exported only while open, and the exported image is the durable copy (idea-brief §5).
- Keeping an open tool's Draft or the View. Only applied changes are part of the Work (CONTEXT: Draft, View).
- Reopening the last Work automatically when the app starts (assumptions ledger A2).

## 4. User stories

### US-01: Keep my work without saving

**As an** Editor
**I want** every change I apply to be kept in this browser without my asking
**So that** a reload, a closed tab, a crash or opening another image never costs me the edits I applied

### US-02: Reopen and keep editing

**As an** Editor
**I want** to reopen a recent Work and find its Crop, Adjustments and drawing exactly as I left them
**So that** I can change any of them separately later instead of starting again from the source file

### US-03: Find the right Work

**As an** Editor
**I want** to see my recent Works as thumbnails with their names and when I last opened or changed them, newest first
**So that** I recognise the one I want at a glance

### US-04: Remove a Work

**As an** Editor
**I want** to delete a Work from the Gallery
**So that** I can free space and stop keeping a photo I no longer want stored in this browser

### US-05: Know how safe my Works are

**As an** Editor
**I want** the app to tell me plainly where my Works are kept, whether the browser may clear them, and when a Work was removed or could not be saved
**So that** I export what I must not lose and am never surprised by a missing Work

### US-06: Switch images without needless dialogs

**As an** Editor
**I want** opening another image to ask for confirmation only when I would really lose something
**So that** autosave saves me clicks instead of adding them

### US-07: See the Gallery work on a first visit

**As a** Portfolio reviewer
**I want** to find the Gallery on the start screen and see a Work I just edited come back after a reload
**So that** I can confirm on my first try that the app keeps work between sessions

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** the Editor has opened a photo and applied a Crop, a change in "Adjust" and a drawing
**When** the Editor reloads the page, closes and reopens the tab, or opens another image, at least two seconds after the last Apply and at least three seconds after the photo opened
**Then** the Gallery holds that Work with all three changes, its thumbnail shows the image with all of them, and it is listed first as the most recently opened or changed Work. Autosave stored the Work once when the photo opened and again after each Apply, without the Editor doing anything and without interrupting editing

### AC-02 (US-01) — domain invariant

**Given** the Editor has applied a drawing, undone it, zoomed into the Preview and opened "Draw" again with strokes that are not applied
**When** the page is reloaded and the Editor reopens the Work from the Gallery
**Then** the Work has no drawing, because the Undo was stored like any Step, and none of the unapplied strokes, because an open tool's Draft is never stored. The Preview is fitted to the screen, not zoomed, because the View is never stored, and Undo and Redo are unavailable, because the Edit history is never stored

### AC-03 (US-03) — happy path

**Given** the Gallery holds several Works, one of which is open
**When** the Editor chooses "Gallery" in the top bar
**Then** the Gallery lists every stored Work, most recently opened or changed first. Each entry shows a thumbnail of the Work with all its edits, its Source name ("Untitled" when the Work has none) and when it was last opened or changed: "Just now" under a minute, "N minutes ago" under an hour, "N hours ago" under a day, and otherwise the date in the browser's language. The open Work's entry is marked "Open", and the Gallery shows how many of the 20 places are used. The Gallery can be closed again without changing anything

### AC-04 (US-02) — happy path

**Given** a Work in the Gallery was stored with a Crop, a Straighten angle, all seven Adjustments away from neutral and a drawing
**When** the Editor chooses it, after a reload or with another Work open and no Unsaved edits left unstored
**Then** it replaces the open Work and shows exactly the stored Work: a full-size Export of it is identical to the Export of the same Work made before the reload. Its Source name and Source format still name and pick the default format of the next Export. Each part stays editable on its own: "Crop and rotate" shows the whole image with the stored frame, "Adjust" shows the stored slider values, and "Draw" shows the stored Drawing layer, which can be painted on and erased with the Brush and the Eraser as before the reload. The reopened Work starts with an empty Edit history and no Unsaved edits, and the Gallery closes

### AC-05 (US-07) — happy path

**Given** a first visit, so the Gallery is empty
**When** the start screen appears
**Then** next to the "Open image" drop zone, the Gallery shows plain text saying that Works the Editor opens will appear here, with the same "Open image" action. After the Portfolio reviewer opens an image, applies a change and reloads the page, the start screen lists that Work, and choosing it reopens it with the change. Nothing reopens on its own after a reload

### AC-06 (US-04) — happy path

**Given** the Gallery holds a Work that is not open
**When** the Editor chooses to delete it
**Then** the app asks for confirmation, naming the Work and saying it cannot be brought back and that an Export is the only copy kept outside this browser. Confirming removes the Work from the Gallery and from this browser at once, and the count of used places goes down by one. Cancelling keeps the Work exactly as it was

### AC-07 (US-04) — domain invariant

**Given** the Gallery is showing and one of its Works is open
**When** the Editor tries to delete the open Work's entry
**Then** deleting is unavailable for that entry, and its hint says that the open Work cannot be deleted and to open another image first. The Gallery never deletes or evicts the Work open in this tab; a Work open only in another tab can be evicted there (AC-21)

### AC-08 (US-02) — error

**Given** a Work in the Gallery can no longer be read back, because its stored data is damaged or incomplete
**When** the Editor chooses it, or the Gallery tries to show its thumbnail
**Then** the open Work stays exactly as it was. Listing the Gallery checks only what the entry shows (its thumbnail and details), and choosing a Work checks all of it. The entry is marked as damaged instead of failing silently, and choosing it shows a notice that names the Work, says it cannot be opened and offers to delete it. Every other Work in the Gallery lists, opens and deletes normally. A damaged Work still counts toward the 20 places and is the first to be evicted when room is needed, with the usual notice naming it

### AC-09 (US-05) — domain invariant

**Given** the Gallery holds 20 Works, with or without one of them open in this tab
**When** the Editor opens a new image and it replaces the open Work
**Then** the new image enters the Gallery only once it has replaced the open Work, as a new Work even if the same file was opened before, and the least recently opened or changed Work that is not open in this tab is evicted, so the Gallery still holds 20 Works. The Work just replaced has been opened or changed more recently than the others, so it is not the one evicted unless it is the only candidate. A notice names the evicted Work and says it was removed to make room. If the replacement is cancelled or the image cannot be read, nothing is stored and nothing is evicted

### AC-10 (US-05) — error

**Given** the browser reports that the app's storage space is full when Autosave stores the open Work
**When** Autosave runs after an image opens or after a Step, Undo or Redo
**Then** the app evicts the least recently opened or changed Works that are not open in this tab, one at a time, until the open Work fits, and one notice names every Work it removed. If the open Work still does not fit once it is the only Work left, a notice says it could not be saved to the Gallery and to export it to keep a copy. The Work stays open and editable either way, and the Gallery keeps the earlier stored state of the open Work if there was one

### AC-11 (US-05) — error

**Given** the Gallery was available when the page loaded, and an Autosave later fails for a reason other than full storage
**When** the failure happens
**Then** one notice says the Work could not be saved to the Gallery and to export it to keep a copy, and editing continues. The next Step, Undo or Redo tries again without a new notice. Once a save succeeds, the notice is withdrawn, and a later failure shows it again. While the latest applied state is not stored, replacing the Work follows AC-17

### AC-12 (US-05) — authorization

**Given** storage cannot be opened for this app when the page loads, for example in a private window or with site data blocked for the site
**When** the Editor opens an image and edits it
**Then** opening, editing and exporting work as before. The Gallery shows that it is unavailable in this browser window and why in plain words, nothing is stored, and the app does not try to store anything again until the page is next loaded. Replacing the Work asks for confirmation whenever the open Work has Unsaved edits, as open-and-view AC-15 always did

### AC-13 (US-05) — happy path

**Given** the Gallery is showing
**When** the Editor looks at it, empty or full
**Then** one line always says where the Works are kept. The line follows the browser's current answer. When the browser has agreed to keep the app's storage, it reads that Works are kept in this browser and to export one to keep a copy elsewhere. Otherwise it reads that Works are saved in this browser only, that the browser may clear them when space runs low, and to export to keep a copy

### AC-14 (US-05) — authorization

**Given** the app has never asked the browser to keep its storage
**When** Autosave stores a Work for the first time
**Then** the app asks the browser once to keep its storage persistent. Where the browser asks the person, the request appears at that moment and not when the app starts. Whatever the answer, saving carries on and the storage line of AC-13 shows the result: declining only changes that line to its non-persistent wording, and the Gallery keeps working. The app does not ask again while the Gallery's stored data exists; if the browser clears the Gallery, the app asks once more at the next first save

### AC-15 (US-02) — cross-context

**Given** an export is running, or a replacement of the Work is waiting for the Editor's confirmation
**When** the Editor chooses a Work in the Gallery
**Then** choosing a Work is unavailable, with a hint to wait for the export or to answer the confirmation first, and the open Work does not change

### AC-16 (US-06) — cross-context

**Given** the open Work has Unsaved edits and Autosave has stored its latest applied state, or is storing it and then succeeds
**When** the Editor opens another image by "Open image", by dropping a file or by choosing a Work in the Gallery, and it is read successfully
**Then** if a save was still running, the replacement waits for it to finish. It then replaces the open Work without asking for confirmation, and the previous Work stays in the Gallery with all its applied edits. An open tool's unapplied changes are discarded with the old Work, as crop-rotate AC-17 already requires

### AC-17 (US-06) — cross-context

**Given** the open Work has Unsaved edits that are not stored in the Gallery, because Autosave failed, including a save that was still running when the Editor chose and then failed, or because the Gallery is unavailable
**When** the Editor opens another image or chooses a Work in the Gallery
**Then** the app asks for confirmation before replacing it, saying the latest edits are not saved in the Gallery and would be lost. Cancelling keeps the Work exactly as it was. Choosing a Work that cannot be read never replaces the open Work and never asks (open-and-view AC-16)

### AC-18 (US-02) — cross-context

**Given** the Gallery holds Works stored by an earlier version of the app
**When** the app updates to a new version and the Editor reopens one of them
**Then** the Work opens with exactly the stored data: the same Original pixels, Source name, Source format, Geometry, Adjustments and Drawing layer. When the update did not change how a Work is drawn, a full-size Export of it is identical to the Export the earlier version made. An update never empties the Gallery or loses a Work

### AC-19 (US-01) — domain invariant

**Given** the Editor opens an image and the app reloads or crashes while Autosave is storing it
**When** the Editor reopens the Gallery
**Then** every Work in it is either in its last fully stored state or absent, never half stored. A Work whose first save was interrupted is simply not listed, and a Work whose later save was interrupted reopens in its previous stored state. Evicting to make room and storing the new state happen as one step, so an interrupted save also removes no Work, and no Work ever leaves the Gallery without its notice

### AC-20 (US-01) — domain invariant

**Given** Autosave is storing the open Work after an Apply, Undo or Redo
**When** the Editor reloads the page or closes the tab before that save finishes
**Then** the browser shows its own warning that leaving may lose changes. Staying lets the save finish. Once no save is running, reloading or closing the tab shows no warning, even when the Work has Unsaved edits, because they are stored in the Gallery

### AC-21 (US-01) — cross-context

**Given** the same Work is open in two tabs, and the Gallery in the other tab has evicted it to make room
**When** the Editor applies a Step, Undo or Redo in this tab
**Then** Autosave adds the Work back to the Gallery as the most recently opened or changed Work, evicting the least recently opened or changed Work that is not open in this tab, with the usual notice. The Work open in this tab is never lost. When both tabs store the same Work, the last save wins (§8)

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view, export, crop-rotate, adjust, draw and undo-redo. The reference Work is 4096 × 3072 px with a Crop, a Straighten angle, all seven Adjustments away from neutral and a Drawing layer covered by marks over the whole image, as draw §6 defines it. Each p95 is taken over 20 runs after 2 warm-up runs. "Stored" means the Work can be read back after a reload.

| Aspect | Target | Measurement |
|---|---|---|
| From an image's first Preview to the Work being stored, reference-sized image | p95 ≤ 3 s | e2e performance test on the reference machine |
| From an Apply, Undo or Redo to the change being stored, reference Work | p95 ≤ 300 ms for a Crop or Adjustment Step, p95 ≤ 1.5 s for a drawing Step | e2e performance test on the reference machine |
| Editing stays responsive while Autosave runs | longest interface freeze ≤ 200 ms (the open-and-view target) | long-task trace during the two Autosave scenarios above |
| From choosing a Work in the Gallery to its first Preview, reference Work | p95 ≤ 1.5 s (the open-and-view target for opening a 12 MP photo) | e2e performance test on the reference machine |
| From choosing "Gallery" to every thumbnail painted, 20 reference Works stored | p95 ≤ 500 ms | e2e performance test on the reference machine |
| Exactness of a reopened Work | difference 0 per channel between a full-size PNG Export after reopening and the Export of the same Work made before the reload | e2e pixel comparison on Chromium, Firefox and WebKit |
| No half-stored Work after an interrupted save | 0 damaged or mixed Works in 50 reloads forced at random moments during Autosave | e2e on Chromium |
| Gallery cap | at most 20 Works stored at any time; the Work open in this tab is never evicted | unit test of the eviction rule, and e2e opening 25 images |
| Works offline | 100% of Gallery listing, reopening, Autosave and deleting runs succeed offline after the first load | e2e in offline mode |

## 6.1 Security / privacy

- **Data classification:** confidential. The photos can be personal, and for the first time the app keeps them after the tab closes.
- **Personal data touched:** new data at rest in this browser: each Work's Original (image pixels only, with no embedded metadata such as capture location, because the Original never keeps it), its Source name (the file name, which can contain a personal name), its Source format, an identifier for the Work, its Geometry, Adjustments and Drawing layer, a thumbnail and when it was last opened or changed, plus one app-wide marker saying the app has asked for persistent storage. Nothing leaves the device. Deleting a Work (AC-06) or eviction (AC-09, AC-10) removes all of it.
- **AuthZ/AuthN impact:** none in the app, which has no accounts. The browser keeps the stored Works separate for each site, so other websites cannot read them. Anyone using the same browser profile on the same computer can see the Gallery, which is why nothing reopens on its own (AC-05) and the Editor can delete Works (AC-06). Storage may be blocked or unavailable (AC-12), and persistent storage may be declined, which only changes the storage line (AC-14).
- **Abuse cases:**
  - A shared computer: the next person sees the Gallery's thumbnails and can reopen them. Response: nothing reopens on start, any Work can be deleted, and the storage line says the Works are kept in this browser. Private windows store nothing (AC-12).
  - Stored data altered by hand or damaged: it is treated as a Work that cannot be read (AC-08). It never replaces the open Work, never stops the Gallery listing the others, and is never shown as anything but an image.
  - Filling the disk by opening many large images: the Gallery is capped at 20 Works and evicts the oldest when the browser's storage is full (AC-09, AC-10), and it says what it removed.
  - A Work believed to be deleted that is still stored: deleting removes the Work's every stored part at once, and the e2e test checks that no part of it remains after a reload.
- **Security review:** Required. The feature adds personal data at rest (photos and file names kept after the tab closes), so a review must confirm that nothing beyond §6.1's list is stored, that deleting and eviction leave no stored part behind, and that damaged stored data is handled as AC-08 says.

## 7. Metrics / KPIs

- **Applied changes lost to a reload** — baseline: 100% (every applied change is lost unless exported), target: 0% of changes applied at least two seconds before the reload and at least three seconds after the image opened, on the e2e reload set, gated on Chromium and measured on Firefox and WebKit (§8), by ship.
- **Reopen exactness on the reference set** (Works with changes from each tool, on Chromium, Firefox and WebKit) — baseline: impossible (no way to reopen a Work), target: 100% of reopened Works identical to their Export made before the reload, by ship.
- **Actions to get back to editing yesterday's Work** — baseline: open the source file again and redo every edit by hand (and a drawing cannot be redone exactly), target: 1 action from the start screen (choose the Work), or 2 with a Work open ("Gallery", then the Work), by ship.
- **Works that leave the Gallery without a notice** — baseline: not applicable (no Gallery), target: 0 across the eviction, full-storage and deletion e2e flows, by ship.

## 8. Open questions

- [x] Should the Gallery warn when the same Work is open in two tabs, before one tab's Autosave overwrites the other's changes? Default now: each tab autosaves its own open Work and the last save wins, with no warning (assumptions ledger A13). Eviction across tabs is settled by AC-21. — owner: Blazheiko, due: before `sdd:design`. **Closed 2026-10-13** with the default (`sad.md` §8, Concurrency across tabs)
- [x] Is the 3 s target for storing a newly opened reference-sized image (§6) reachable in all three engines when the Original is stored without loss? Default now: 3 s on the reference machine in Chrome, and Firefox and WebKit are measured but not gated. — owner: Tech Lead, due: before `sdd:plan-tests`. **Closed 2026-10-14** with the default: gated on Chromium, measured on Firefox and WebKit (`test-plan.md`, NFR validation)
