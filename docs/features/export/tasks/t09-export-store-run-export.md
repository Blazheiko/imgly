---
id: T9
title: "Orchestrate the export in the export store: snapshot, encode, Save as… or download, refusals, File ready, save point"
layer: "app"
deps: ["T4", "T7", "T8"]
blocks: ["T12"]
acs: ["AC-01", "AC-01b", "AC-02", "AC-09", "AC-10", "AC-12", "AC-13", "AC-14"]
files_hint: ["src/features/export/store.ts", "src/features/export/store.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 109 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Orchestrate the export in the export store: snapshot, encode, Save as… or download, refusals, File ready, save point

## Place in the sequence

- **Blocked by:** T4 — Add the editor store's exclusive exporting phase, beginExport/finishExport and the save point, T7 — Add the platform save path: Save as… dialog, verified write, empty-target removal and the download hand-off, T8 — Create the export store: panel state, defaults, session memory, format availability and the messages catalog.
- **Blocks:** T12 — Build the export panel (SCR-03) in every state on the export store and the new primitives.
- **Wave:** 5 — after T4, T7, T8.
- **Lane:** shares `src/features/export/store.test.ts`, `src/features/export/store.ts` with T8 — serialized.

## Why (user story)

> **US-01: Save the Work as an image file**
>
> **As a** Editor  
> **I want** to export the open Work as a PNG, JPEG or WebP file  
> **So that** I keep a copy of my edited image outside the app
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

> **US-05: Know that my work is saved**
>
> **As a** Editor  
> **I want** a successful export to count as saving my Work  
> **So that** I am not asked to confirm replacing a Work whose edits I have already saved, and I am still asked when I have not
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

> **US-06: Understand why an export did not happen**
>
> **As a** Editor  
> **I want** a plain reason when a format is unavailable or an export fails  
> **So that** I never end up with a wrong or blank file, or with an export that failed inside the app without my knowing it
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It is the honest save: the Work is marked saved only after the verified file was written or handed off, and every other ending leaves Unsaved edits and a reason.

## Inlined context

> On confirm, the panel first applies any value still being typed (AC-17), then the `editor` store enters `exporting` and snapshots the Work, so the file holds the Work exactly as it was at confirm (AC-11). The export worker renders, encodes and verifies before anything touches the disk (ADR-0001, ADR-0002). In Chromium the dialog then opens; the returned name's extension is checked (AC-01b) and the verified file is written through `createWritable()`. Elsewhere the file is handed to the downloads (AC-02). Only then is the save point set (AC-09).
>
> — `sad.md §6, Critical flow 1, prose, abridged` · full text: [sad.md](../sad.md)

> - Dialog cancelled → no message, panel unchanged, Unsaved edits kept (AC-10).
> - Activation window lapsed before the dialog could open → the panel keeps the verified file and offers "File ready — Save…"; Escape there ends the export as cancelled (§1 Decision override).
> - Render or encode failure, or the context or size limit hit in the worker → `EXPORT_FAILED`, nothing reaches the disk (AC-13).
> - Produced content is not the chosen format or size → `EXPORT_FORMAT_MISMATCH`; the format is disabled for the session and the panel selects PNG (AC-12).
> - Returned extension does not match → `EXPORT_EXTENSION_MISMATCH`, nothing written (AC-01b); the emptied target is handled as below.
> - Write refused → `EXPORT_NOT_PERMITTED` (AC-14).
>
> — `sad.md §6, Failure branches, verbatim` · full text: [sad.md](../sad.md)

> the panel asks for one more click ("File ready — Save…"). That state is still the `exporting` phase, so everything AC-11 refuses stays refused, but Escape or a click outside there ends the export as cancelled (no message, Unsaved edits kept, AC-10)
>
> — `sad.md §1, Decision override (File ready), abridged` · full text: [sad.md](../sad.md)

> | Concept | Convention | Where defined |
> |---|---|---|
> | Save point | Only `finishExport(snapshot, saved: true)` moves `cleanRevision`, and only to the revision at confirm (ADR-0005 extended). "Saved" means written and closed through `createWritable()`, or `click()` on the download link after the file was verified (AC-02, §1 spec override) | here; ADR-0001 |
> | Resource lifetime | The copy of the Original sent to the worker is transferred and closed there; the worker is terminated after each export and after the format check, which frees its WebGL2 context; a download's object URL is revoked 60 s after `click()`; the bitmap ledger counts the copy so the e2e leak test still ends on one retained Original | open-and-view sad.md §8; here |
>
> — `sad.md §8, verbatim` · full text: [sad.md](../sad.md)

> | State | Trigger / condition | Components (from the inventory) | Source-ref |
> |---|---|---|---|
> | file ready | Chromium only: encoding outlasted the activation window, so the "Save as…" dialog could not open by itself (`sad.md` §1 Decision override, ADR-0001). The verified file is kept. Still an export: SCR-01 stays in `loading`. "Save…" opens SCR-04; `Esc` or a click outside ends the export as cancelled, with no message | controls disabled · one line "Your file is ready." · `BaseButton` primary "Save…" (focused) | wireframe 03-d |
> | cancelled | SCR-04 cancelled, or File ready left (AC-10) | → `default` with the same choices, no message, Unsaved edits kept | — |
> | error | The export failed or was refused: `EXPORT_FAILED` (AC-13), `EXPORT_FORMAT_MISMATCH` (AC-12), `EXPORT_EXTENSION_MISMATCH` (AC-01b), `EXPORT_NOT_PERMITTED` (AC-14). The panel stays open with the same choices, except that a refused format is replaced by PNG and shown unavailable. Retrying is one confirm (AC-17). Unsaved edits kept | as `default` (controls enabled again) + `Toast` `failure` (stays until dismissed), copy → §Message catalog | wireframe 03-e |
> | success | The file was written or handed off | → SCR-01 `success`, panel closed | — |
>
> — `screens.md §SCR-03 (export states), verbatim` · full text: [screens.md](../screens.md)

> **Fixed by this breakdown:** `confirm()` = `flushPending()` → `editor.beginExport()` (null → return) → `createImageBitmap(snapshot.original.pixels)` → `exportImage`. Store `status`: `idle | exporting | fileReady`. The success notice names the returned file on the dialog path and the suggested name on the download path. The failure suffix is appended after `EXPORT_EXTENSION_MISMATCH` and `EXPORT_NOT_PERMITTED` whether or not `discardEmptyTarget` removed the file.
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-01 — happy path

> **Given** an image is open and the browser offers a "Save as…" dialog
> **When** the Editor chooses Export, picks a format (or keeps the default, AC-19), confirms in the panel, which opens the "Save as…" dialog, and saves in the dialog under the suggested name
> **Then** a file in the chosen format is written to the chosen folder, containing the Work with all its edits at the chosen size. At full size in PNG it matches the Preview's own rendering at 100% (§6 Fidelity); at a smaller size it keeps the Work's proportions (AC-05), and in JPEG or WebP it differs only by compression at the chosen quality. A notice names the saved file. Saving in the dialog is the confirm step, not an extra one (AC-17)
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-01b — error

> **Given** the Editor is saving through the "Save as…" dialog
> **When** they change the suggested name in the dialog
> **Then** the dialog offers only the chosen format. The check below applies to the name the dialog returns, not the name typed, so when the dialog adds the extension itself (`photo` becomes `photo.jpg`) the file is saved. Any other name with a matching extension is accepted, and the notice names the file as saved. An extension matches when it is one of `.jpg`, `.jpeg`, `.jpe` or `.jfif` for JPEG, `.png` for PNG, or `.webp` for WebP, in any letter case. If the name has no extension or an extension that does not match the chosen format (for example `photo.png` for JPEG), nothing is written, a notice explains why and suggests saving again with the matching extension, and the Work keeps its Unsaved edits
>
> — `spec.md §5, AC-01b, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — happy path

> **Given** an image is open and the browser has no "Save as…" dialog
> **When** the Editor chooses Export, picks a format and confirms
> **Then** the file is handed to the browser's downloads under the suggested name, and a notice names the file and says it was handed to the browser's downloads, so the Editor can look for it there. "Handed to the browser's downloads" means the moment the app starts the download of the finished file, after it has been fully produced and checked (AC-12). On this path the only failures the app can see are failures to produce the file (AC-12, AC-13); anything that goes wrong later inside the browser is covered by the §1 decision override
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-09 — domain invariant

> **Given** the open Work has Unsaved edits
> **When** an export completes (the file is written in the "Save as…" dialog, or handed to the browser's downloads where there is no dialog)
> **Then** the Work no longer has Unsaved edits, and opening another image replaces it without asking for confirmation. Any edit made after that export makes the Work have Unsaved edits again
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — cross-context

> **Given** the open Work has Unsaved edits and the Editor has started an export
> **When** the Editor cancels the "Save as…" dialog, or the file cannot be written or handed off
> **Then** the Work keeps its Unsaved edits, so a later replace still asks for confirmation. Cancelling shows no message, and a failure shows its reason
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — error

> **Given** the browser cannot produce one of the formats (for example WebP in Safari)
> **When** the Editor opens the export panel
> **Then** that format is shown but cannot be chosen, and a one-line hint next to it says it is not available in this browser. Whether a browser can produce a format, and whether a produced file is in the chosen format, is decided by the content the browser actually produces, never by the browser's name or version. If a produced file ever turns out not to be in the chosen format, it is not saved, the Editor is told why, and the Work keeps its Unsaved edits; that format then becomes not selectable, with the same hint, for the rest of the browser session, and the default falls back to PNG (AC-19). The panel then selects PNG straight away, and PNG becomes the remembered format for this Work. The check of every format starts when the first image of the session is opened and runs once per browser session; a check that fails or errors counts as the browser not being able to produce that format. Until the check of a format has finished, that format cannot be chosen; PNG is always available. If the panel opens before the check of the Work's Source format has finished, the format is preset to PNG and stays PNG: the panel never changes the selected format by itself when a check finishes
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — error

> **Given** an image is open
> **When** the export fails, for example because the device's graphics were interrupted or the browser cannot produce an image of that size
> **Then** no blank, black or partial file is saved: a file the Editor chose to overwrite in the "Save as…" dialog is left as it was, and an empty file the dialog may have created is not reported as saved. This holds for every refusal after the "Save as…" dialog (AC-01b, AC-12, AC-13, AC-14): the app removes such an empty file when the browser allows, and when it cannot, the notice says that an empty file with that name may be left in the chosen folder. Where the browser itself empties or replaces the chosen file when the dialog closes, so that a file chosen for overwrite can no longer be left as it was, the notice says that the file with that name may now be empty. A notice explains in plain language that the export failed and suggests trying again or choosing a smaller size, and the Work and its Unsaved edits are unchanged
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — authorization

> **Given** the Editor is saving through the "Save as…" dialog
> **When** the operating system or the browser does not allow the app to write to the chosen place (for example a read-only or protected folder)
> **Then** nothing is saved and a file the Editor chose to overwrite is left as it was (with the same exception and notice as AC-13), a notice says the app was not allowed to save there and suggests choosing another folder, and the Work keeps its Unsaved edits
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write `confirm()`: flush, `beginExport()`, freeze format/quality/size/name at confirm, copy the bitmap, `exportImage(...)` — `src/features/export/store.ts`
- [ ] Map `EXPORT_FAILED` → failure notice; `EXPORT_FORMAT_MISMATCH` → `disableFormat` + notice; both `finishExport(snapshot, false)`, panel stays open — `store.ts`
- [ ] Dialog path: `pickSaveTarget` → `cancelled` → finish(false), no notice; `activationLapsed` → `status = 'fileReady'`, keep the Blob, `saveFromReady()` re-runs the pick, `cancelReady()` → finish(false) — `store.ts`
- [ ] Picked: `matchesExtension(name, format)` else `discardEmptyTarget` + mismatch notice + suffix; `writeFile` → `EXPORT_NOT_PERMITTED` → `discardEmptyTarget` + notice + suffix; ok → finish(true), "Saved {file}.", close panel — `store.ts`
- [ ] Download path: `downloadFile(suggestedName, blob)` → finish(true), downloads notice, close panel — `store.ts`
- [ ] Vitest drives every branch with a fake export client and fake save functions, asserting `hasUnsavedEdits`, notices, panel state and that `writeFile` is never called after a render or format failure — `store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `confirm()` while `status !== 'idle'` or `beginExport()` returns null | nothing happens |
| Render/encode failure | `EXPORT_FAILED` notice, no dialog opened, nothing written, Unsaved edits kept |
| WebP mismatch | not saved, WebP unavailable for the session, panel on PNG, PNG remembered for this Work |
| Dialog returns `photo` (no extension) or `photo.png` for JPEG | nothing written, target removed where possible, mismatch notice + "may now be empty or missing" |
| Dialog returns `photo.jpeg` for JPEG | written; notice "Saved photo.jpeg." |
| Activation lapsed, then Escape | ends as cancelled, no message, Unsaved edits kept |
| Edit attempted during the export | refused by the editor store (T4); the file is the snapshot at confirm |

## Definition of Done

- [ ] Vitest proves the dialog and download paths end with no Unsaved edits and a notice naming the file (AC-01, AC-02, AC-09)
- [ ] Vitest proves cancel, File ready → cancel, `EXPORT_FAILED`, `EXPORT_FORMAT_MISMATCH`, `EXPORT_EXTENSION_MISMATCH` and `EXPORT_NOT_PERMITTED` each keep Unsaved edits, show the specified notice (none for a cancel), keep the panel's choices, and never write after a render or format failure (AC-01b, AC-10, AC-12, AC-13, AC-14)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
