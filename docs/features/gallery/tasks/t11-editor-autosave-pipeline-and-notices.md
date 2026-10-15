---
id: T11
title: "Compose autosave.ts: prepare the Original, layer and thumbnail PNGs, call storeWork, keep the encoded Blobs, ask for persistence once, react to versionchange, and raise the eviction, full-storage, failed-save and newer-version notices"
layer: "app"
deps: ["T4", "T6", "T7", "T8", "T9", "T10"]
blocks: ["T12"]
acs: ["AC-01", "AC-09", "AC-10", "AC-11", "AC-12", "AC-14", "AC-21"]
files_hint: ["src/features/editor/autosave.ts", "src/features/editor/autosave.test.ts", "src/features/editor/messages.ts", "src/features/editor/messages.test.ts"]
owner: "Blazheiko"
estimate: "L"
context_budget: "M"   # measured: 107 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Compose autosave.ts: prepare the Original, layer and thumbnail PNGs, call storeWork, keep the encoded Blobs, ask for persistence once, react to versionchange, and raise the notices

## Place in the sequence

- **Blocked by:** T4 — Add storeWork to the works repository · T6 — Open the Gallery database as a Result with the versionchange hand-off, and add storage-persistence · T7 — Add infra/work-codec · T8 — Add renderThumbnail to the Preview renderer · T9 — Extend Toast and useNotices with an optional action and returned ids · T10 — Add the Autosave save queue.
- **Blocks:** T12 — Wire Autosave into the editor store.
- **Wave:** 3 — it joins the repository, codec, thumbnail, persistence and queue pieces.
- **Lane:** shares `src/features/editor/autosave.ts` with T13 and `src/features/editor/messages.ts` with T14 — serialized.

## Why (user story)

> **As an** Editor
> **I want** every change I apply to be kept in this browser without my asking
> **So that** a reload, a closed tab, a crash or opening another image never costs me the edits I applied
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It is the save pipeline itself: what one Autosave prepares, stores and tells the Editor.

## Inlined context

> ```
> Store->>Store: queue the newest Work, latest wins, saving on
> opt first save of this Work, or the layer changed
>     Store->>Codec: encode the Original or the layer as PNG
>     Codec-->>Store: PNG Blob, kept in memory for this Work
> end
> Store->>GPU: render the thumbnail of the applied Work
> GPU-->>Store: small image, encoded as PNG
> opt first save in this browser
>     Store->>SM: ask once for persistent storage
> end
> Store->>DB: one transaction - pick evictions, delete them, write record, Original if missing, layer if changed
> alt committed → one notice naming every evicted Work, if any
> else quota full and other Works can still go → same transaction with one more Work evicted
> else quota full even with this Work alone → notice - could not save to the Gallery, export to keep a copy
> else another failure → one notice until a save succeeds, retried at the next Step
> end
> Store->>Store: newer state pending, save again, else saving off
> ```
>
> — `sad.md §6, Critical flow 1, abridged` · full text: [sad.md](../sad.md)

> - **Prepare** outside any transaction: the Original's PNG at the first save, the layer's PNG when its id changed (ADR-0003), and the thumbnail (sad.md §5).
> - **Notices** are raised only after the commit resolves: one notice names every evicted Work. A save that fails for another reason returns `STORAGE_FAILED` and is handled as AC-11 says.
>
> — `adr/0004 §Decision outcome, Prepare + Notices bullets, verbatim` · full text: [adr/0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota.md](../adr/0004-evict-and-store-in-one-indexeddb-transaction-and-retry-on-a-full-quota.md)

> Autosave keeps the open Work's encoded Original and layer Blobs in memory until the Work is replaced. A later save can then write them again without re-encoding, when another tab has evicted the Work (AC-21) or when a quota retry needs them (ADR-0004).
>
> — `adr/0003 §Decision outcome, How it works bullet 3, verbatim` · full text: [adr/0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker.md](../adr/0003-encode-the-original-and-the-drawing-layer-as-png-in-a-fresh-worker.md)

> `renderThumbnail(work, maxSide)` […] reads the pixels back into an `ImageData`. Autosave encodes that `ImageData` as a PNG Blob with `OffscreenCanvas.convertToBlob` before the save transaction opens (ADR-0004). […] When the display is lost or restoring, no thumbnail can be drawn. […] Autosave waits for the renderer before preparing the save.
>
> — `adr/0005 §Decision outcome, How it works, abridged` · full text: [adr/0005-render-the-gallery-thumbnail-with-the-preview-renderer.md](../adr/0005-render-the-gallery-thumbnail-with-the-preview-renderer.md)

> - it waits for the save that is running, whose transaction completes, then drops the pending save;
> - it closes the connection, sets `galleryAvailable` to false for the rest of the page's life, and raises one info notice that a newer version is open in another tab and to reload to keep saving.
>
> — `adr/0006 §Decision outcome, versionchange bullets, verbatim` · full text: [adr/0006-close-an-older-tabs-database-connection-when-a-newer-version-upgrades-it.md](../adr/0006-close-an-older-tabs-database-connection-when-a-newer-version-upgrades-it.md)

> | Persistent storage | Requested once, at the first save, when the `meta` marker is absent. The marker is written in that save's transaction (AC-14). […] |
> | Notices | […] Eviction notices are `info` and name every evicted Work, using "Untitled" for a nameless one. The failed-save notice is a `failure` notice that stays until it is dismissed. It is raised once per run of failures and withdrawn when a save succeeds (AC-11). […] |
>
> — `sad.md §8, rows Persistent storage + Notices, abridged` · full text: [sad.md](../sad.md)

> | info | Works evicted, one | AC-09, AC-10, AC-21 | “{name}” was removed from the Gallery to make room. |
> | info | Works evicted, several | AC-10 | {n} Works were removed from the Gallery to make room: “{a}”, “{b}” and “{c}”. |
> | failure | `STORAGE_QUOTA`, doesn't fit alone | AC-10 | This Work couldn't be saved to the Gallery because the browser's storage is full. Export it to keep a copy. |
> | failure (withdrawable) | `STORAGE_FAILED` on a save | AC-11 | This Work couldn't be saved to the Gallery. Export it to keep a copy. |
> | info | newer version open in another tab | — (ADR-0006) | A newer version of the editor is open in another tab. Reload this page to keep saving to the Gallery. |
>
> — `screens.md §Message catalog, Autosave rows, verbatim` · full text: [screens.md](../screens.md)

**Breakdown-time choices:** `autosave.ts` builds on T10's `createSaveQueue`, passing a `save(work)` that prepares then calls T4's `storeWork`. It receives T6's `openGalleryDb` result through a store action (e.g. `connectGallery(result)`, called by App.vue in T17); until then and after a failure or versionchange, `galleryAvailable` is false and `request()` is a no-op.

> **Hard rule:** `core` and `infra` return `Result<T, AppError>` […] The UI shows errors through the single toast boundary. […] No raw browser error text is ever shown.
>
> — `CLAUDE.md §Conventions Errors + screens.md §Message catalog intro, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Through T4's `storeWork` it writes `works`, `originals`, `layers` and `meta` (`data-model.md` §Entities); the schema is T3's.

## API contract

Internal — no API surface. The composable's surface for T12/T13 (ADR-0001 names, shape a breakdown-time choice):

- `createAutosave(deps)` → `{ request(work), saving, settled(), isStored(work), galleryAvailable, connectGallery(result), keepEncoded(workId, { original, layer, layerId }) }` — `keepEncoded` lets T13 hand over the loaded Blobs (`sad.md` §8 ID strategy).

## Acceptance criteria

### AC-01 (US-01) — happy path

> **Given** the Editor has opened a photo and applied a Crop, a change in "Adjust" and a drawing
> **When** the Editor reloads the page, closes and reopens the tab, or opens another image, at least two seconds after the last Apply and at least three seconds after the photo opened
> **Then** the Gallery holds that Work with all three changes, its thumbnail shows the image with all of them, and it is listed first as the most recently opened or changed Work. Autosave stored the Work once when the photo opened and again after each Apply, without the Editor doing anything and without interrupting editing
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-09 (US-05) — domain invariant

> **Given** the Gallery holds 20 Works, with or without one of them open in this tab
> **When** the Editor opens a new image and it replaces the open Work
> **Then** the new image enters the Gallery only once it has replaced the open Work, as a new Work even if the same file was opened before, and the least recently opened or changed Work that is not open in this tab is evicted, so the Gallery still holds 20 Works. The Work just replaced has been opened or changed more recently than the others, so it is not the one evicted unless it is the only candidate. A notice names the evicted Work and says it was removed to make room. If the replacement is cancelled or the image cannot be read, nothing is stored and nothing is evicted
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 (US-05) — error

> **Given** the browser reports that the app's storage space is full when Autosave stores the open Work
> **When** Autosave runs after an image opens or after a Step, Undo or Redo
> **Then** the app evicts the least recently opened or changed Works that are not open in this tab, one at a time, until the open Work fits, and one notice names every Work it removed. If the open Work still does not fit once it is the only Work left, a notice says it could not be saved to the Gallery and to export it to keep a copy. The Work stays open and editable either way, and the Gallery keeps the earlier stored state of the open Work if there was one
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md) · note: `sad.md` §1 Decision override — nothing is evicted when the Work can't fit alone (ADR-0004)

### AC-11 (US-05) — error

> **Given** the Gallery was available when the page loaded, and an Autosave later fails for a reason other than full storage
> **When** the failure happens
> **Then** one notice says the Work could not be saved to the Gallery and to export it to keep a copy, and editing continues. The next Step, Undo or Redo tries again without a new notice. Once a save succeeds, the notice is withdrawn, and a later failure shows it again. While the latest applied state is not stored, replacing the Work follows AC-17
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-05) — authorization

> **Given** storage cannot be opened for this app when the page loads, for example in a private window or with site data blocked for the site
> **When** the Editor opens an image and edits it
> **Then** opening, editing and exporting work as before. The Gallery shows that it is unavailable in this browser window and why in plain words, nothing is stored, and the app does not try to store anything again until the page is next loaded. Replacing the Work asks for confirmation whenever the open Work has Unsaved edits, as open-and-view AC-15 always did
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-14 (US-05) — authorization

> **Given** the app has never asked the browser to keep its storage
> **When** Autosave stores a Work for the first time
> **Then** the app asks the browser once to keep its storage persistent. Where the browser asks the person, the request appears at that moment and not when the app starts. Whatever the answer, saving carries on and the storage line of AC-13 shows the result: declining only changes that line to its non-persistent wording, and the Gallery keeps working. The app does not ask again while the Gallery's stored data exists; if the browser clears the Gallery, the app asks once more at the next first save
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-21 (US-01) — cross-context

> **Given** the same Work is open in two tabs, and the Gallery in the other tab has evicted it to make room
> **When** the Editor applies a Step, Undo or Redo in this tab
> **Then** Autosave adds the Work back to the Gallery as the most recently opened or changed Work, evicting the least recently opened or changed Work that is not open in this tab, with the usual notice. The Work open in this tab is never lost. When both tabs store the same Work, the last save wins (§8)
>
> — `spec.md §5, AC-21, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add the five catalog texts above (one/several evicted, full storage, save failed, newer version) — `src/features/editor/messages.ts`; tests compare with strings written in the test — `src/features/editor/messages.test.ts`
- [ ] `createAutosave` over T10's queue; `save(work)`: wait for the renderer, encode the Original if not held for this Work id, encode the layer if `drawing.id` ≠ held layer id, `renderThumbnail` → `convertToBlob` PNG — `src/features/editor/autosave.ts`
- [ ] Call T4's `storeWork(db, record, blobs, { keep: work.id, damaged, onFirstSave })` with `touchedAt` from the injected clock. `onFirstSave` is a synchronous callback that fires T6's `requestPersistence()` without awaiting it. The repository calls it only when the `meta` marker is absent inside the save transaction, and writes the marker in that transaction (T4 §API contract, AC-14)
- [ ] Map the result: committed → stored + one eviction notice if names returned + withdraw the failed-save notice; `STORAGE_QUOTA` → the full-storage failure notice; `STORAGE_FAILED` → push the failed-save notice once per run (keep its id from `pushAll`)
- [ ] Drop held Blobs when the Work id changes (replaced); expose `keepEncoded` for reopen
- [ ] `connectGallery(result)`: `err` → unavailable for the page; `ok` → wire `onVersionChange`: `await settled-running`, `dropPending()`, close, unavailable, one info notice
- [ ] Integration tests (real repository on fake-indexeddb, codec handler called directly, recording GL, recording `navigator.storage`) per the DoD — `src/features/editor/autosave.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Gallery unavailable (open refused, or closed for a newer version) | `request` is a no-op; nothing is encoded or stored; `isStored` false |
| display lost while a save is requested | the save waits for the renderer, then prepares (ADR-0005) |
| a Work evicted by another tab, then a Step here | `storeWork` writes record + held Original + held layer back; notice names any Work evicted for room (AC-21) |
| `persist()` resolves false or the API is missing | the save commits; only the storage line differs |
| three failures in a row, then success | one failure notice, withdrawn on the success; a later failure raises it again |
| the Work's layer becomes `null` (Undo of the only drawing) | nothing encoded; `storeWork` deletes the stored layer |
| an evicted Work with an empty Source name | named "Untitled" in the notice |
| versionchange while a save runs | that save finishes; the pending one is dropped; one info notice |

## Definition of Done

- [ ] the first save encodes the Original once; a Crop or Adjustment save encodes nothing and writes only the record; a drawing save encodes the layer
- [ ] `persist()` is called once at the first save, none at start-up or later saves
- [ ] one info notice names every evicted Work; `STORAGE_QUOTA` gives the full-storage failure notice; `STORAGE_FAILED` gives one withdrawable notice that a later success dismisses
- [ ] unavailable makes every save a no-op; versionchange finishes the running save, drops the pending one, closes, marks unavailable and raises the newer-version notice
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
