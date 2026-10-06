---
id: T7
title: "Add the platform save path: Save as… dialog, verified write, empty-target removal and the download hand-off"
layer: "infra"
deps: ["T1"]
blocks: ["T9"]
acs: ["AC-01b", "AC-02", "AC-10", "AC-14"]
files_hint: ["src/infra/platform/save-file.ts", "src/infra/platform/save-file.test.ts", "src/infra/platform/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 78 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T7 — Add the platform save path: Save as… dialog, verified write, empty-target removal and the download hand-off

## Place in the sequence

- **Blocked by:** T1 — Add the export error codes and the pure file-name rules (Source name, suggested name, extension match).
- **Blocks:** T9 — Orchestrate the export in the export store: snapshot, encode, Save as… or download, refusals, File ready, save point.
- **Wave:** 2 — after T1.
- **Lane:** own lane.

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

It is the only code that touches the disk or the downloads, and it reports every outcome — written, cancelled, lapsed, refused — as a value.

## Inlined context

> **Chosen:** Option 1. Every render and format failure (AC-12, AC-13) happens before the disk is touched, so only two refusals remain after the dialog: an extension that doesn't match (AC-01b) and a refused write (AC-14). With option 2 every one of those rarer but real failures would also cost the Editor a file. On the reference machine encoding takes 1–2 s (spec §6), well inside the activation window.
>
> — `adr/0001 §Decision outcome, verbatim` · full text: [adr/0001-encode-and-verify-before-the-save-dialog.md](../adr/0001-encode-and-verify-before-the-save-dialog.md)

> - If encoding outlasts the activation window (a slow device), `showSaveFilePicker` throws a `SecurityError`; the panel then keeps the verified file and offers "File ready — Save…", one extra click, which breaks AC-17's three steps on that device (sad.md §1 Decision override, §11)
>
> — `adr/0001 §Consequences, Negative bullet 2, verbatim` · full text: [adr/0001-encode-and-verify-before-the-save-dialog.md](../adr/0001-encode-and-verify-before-the-save-dialog.md)

> │   └── save-file.ts              hasSaveDialog(); pickSaveTarget(name, format); writeFile(handle, blob);
> │                                 discardEmptyTarget(handle); downloadFile(name, blob) (ADR-0001)
>
> — `sad.md §5, Internal decomposition (platform lines), verbatim` · full text: [sad.md](../sad.md)

> | State | Trigger / condition | Components (from the inventory) | Source-ref |
> |---|---|---|---|
> | default | SCR-03 confirmed and the file verified (ADR-0001), or "Save…" in File ready. Opened with the suggested name and only the chosen format's type (`.png`; `.jpg .jpeg .jpe .jfif`; `.webp`), with no "all files" choice (AC-01b) | platform dialog · SCR-01 `loading` behind it | — |
>
> — `screens.md §SCR-04, verbatim` · full text: [screens.md](../screens.md)

> - Dialog cancelled → no message, panel unchanged, Unsaved edits kept (AC-10).
> - After AC-01b or AC-14 the chosen file is empty, because the dialog emptied or created it (§2). The app removes it where `FileSystemHandle.remove()` exists. Either way the notice says that a file with that name may now be empty or missing (AC-13).
>
> — `sad.md §6, Failure branches 1 and 7, verbatim` · full text: [sad.md](../sad.md)

> A cancelled dialog is not an error: `pickSaveTarget` resolves `Cancelled`.
>
> — `sad.md §8, Error handling row (sentence), verbatim` · full text: [sad.md](../sad.md)

> a download's object URL is revoked 60 s after `click()`
>
> — `sad.md §8, Resource lifetime row (sentence), verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** | `src/infra/platform/`     | File open/save, clipboard, drag and drop, `launchQueue`                      | `core` (types and pure functions), `shared`                             |
>
> — `CLAUDE.md §Module boundaries, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Fixed by this breakdown:** `pickSaveTarget` resolves one of `{ kind: 'picked', handle, name }`, `{ kind: 'cancelled' }` (`AbortError`) or `{ kind: 'activationLapsed' }` (`SecurityError`); anything else is `EXPORT_FAILED`. `writeFile` maps `NotAllowedError`, `SecurityError` and `NoModificationAllowedError` to `EXPORT_NOT_PERMITTED` and aborts the writable. The extension check itself is the store's (T9, `matchesExtension` from T1).
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

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

### AC-10 — cross-context

> **Given** the open Work has Unsaved edits and the Editor has started an export
> **When** the Editor cancels the "Save as…" dialog, or the file cannot be written or handed off
> **Then** the Work keeps its Unsaved edits, so a later replace still asks for confirmation. Cancelling shows no message, and a failure shows its reason
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — authorization

> **Given** the Editor is saving through the "Save as…" dialog
> **When** the operating system or the browser does not allow the app to write to the chosen place (for example a read-only or protected folder)
> **Then** nothing is saved and a file the Editor chose to overwrite is left as it was (with the same exception and notice as AC-13), a notice says the app was not allowed to save there and suggests choosing another folder, and the Work keeps its Unsaved edits
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write `hasSaveDialog()` by feature detection (`'showSaveFilePicker' in window`) — `src/infra/platform/save-file.ts`
- [ ] Write `pickSaveTarget(suggestedName, format)` with `types` = only that format's MIME + extensions, `excludeAcceptAllOption: true`, and the three outcomes above — `save-file.ts`
- [ ] Write `writeFile(handle, blob): Promise<Result<void, AppError>>` via `createWritable()` → `write` → `close` (target replaced only on close), aborting on error — `save-file.ts`
- [ ] Write `discardEmptyTarget(handle): Promise<boolean>` (calls `handle.remove()` when present, swallows its errors, returns whether it removed) — `save-file.ts`
- [ ] Write `downloadFile(name, blob)`: object URL, `<a download>` `click()`, revoke after 60 s — `save-file.ts`
- [ ] Export from `src/infra/platform/index.ts`; Vitest on happy-dom with a fake `showSaveFilePicker` and fake handles — `save-file.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Editor cancels the dialog (`AbortError`) | `cancelled`, nothing written, no error |
| `showSaveFilePicker` throws `SecurityError` (activation lapsed) | `activationLapsed` |
| Write refused (read-only or protected folder) | `EXPORT_NOT_PERMITTED`, writable aborted, nothing reported as saved |
| `handle.remove` missing (older Chromium) | `discardEmptyTarget` returns `false`; the caller's notice still says the file may be empty |
| `handle.remove` rejects | returns `false`, never throws |
| Firefox / Safari | `hasSaveDialog()` false → `downloadFile` only |

## Definition of Done

- [ ] Vitest proves the picker is opened with only the chosen format's type and no "all files" option (AC-01b), and resolves cancelled / activationLapsed / picked from the matching platform outcomes (AC-10)
- [ ] Vitest proves a refused write returns `EXPORT_NOT_PERMITTED` and aborts the writable (AC-14), and `downloadFile` clicks a download link with the given name and revokes its URL after 60 s (AC-02)
- [ ] every Hard Rule inlined above still holds (infra imports only `core` and `shared`)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
