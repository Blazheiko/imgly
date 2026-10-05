---
id: T1
title: "Add the export error codes and the pure file-name rules (Source name, suggested name, extension match)"
layer: "domain"
deps: []
blocks: ["T3", "T5", "T7"]
acs: ["AC-07", "AC-01b"]
files_hint: ["src/core/result.ts", "src/core/export/naming.ts", "src/core/export/index.ts", "src/core/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 60 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Add the export error codes and the pure file-name rules (Source name, suggested name, extension match)

## Place in the sequence

- **Blocked by:** nothing — can start immediately.
- **Blocks:** T3 — Carry Source name, Source format and the transparency fact on the Work from every open, T5 — Extract the shared shader module and build the export worker that renders, flattens, encodes and verifies one export, T7 — Add the platform save path: Save as… dialog, verified write, empty-target removal and the download hand-off.
- **Wave:** 1 — no deps, starts in the first wave.
- **Lane:** shares `src/core/export/index.ts` with T2 — serialized.

## Why (user story)

> **US-04: Recognise the exported file**
>
> **As a** Editor  
> **I want** the exported file to be named after the image I opened  
> **So that** I can find it and tell it apart from the original photo
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

> **US-01: Save the Work as an image file**
>
> **As a** Editor  
> **I want** to export the open Work as a PNG, JPEG or WebP file  
> **So that** I keep a copy of my edited image outside the app
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

It gives every later layer one pure, tested answer to "what is this file called and does its returned name fit the format", plus the four typed error codes the rest of the export raises.

## Inlined context

> │   ├── result.ts                 new codes EXPORT_FAILED, EXPORT_FORMAT_MISMATCH, EXPORT_NOT_PERMITTED, EXPORT_EXTENSION_MISMATCH
> │   └── export/                   pure rules: sourceNameOf, exportFileName (AC-07), exportSize + snap (AC-05/06),
> │                                 normalizeQuality (AC-04), matchesExtension (AC-01b), defaultFormat (AC-19)
>
> — `sad.md §5, Internal decomposition (core lines), verbatim` · full text: [sad.md](../sad.md)

> | Concept | Convention | Where defined |
> |---|---|---|
> | Error handling | `core`, `infra` and the export client return `Result<T, AppError>`. New codes: `EXPORT_FAILED` (render, encode, size or graphics failure, AC-13), `EXPORT_FORMAT_MISMATCH` with the asked and produced format (AC-12), `EXPORT_NOT_PERMITTED` (AC-14), `EXPORT_EXTENSION_MISMATCH` with the returned name (AC-01b). A cancelled dialog is not an error: `pickSaveTarget` resolves `Cancelled`. The worker posts errors as plain `{ code, details }` objects, as the decode worker does | repo `CLAUDE.md` §Conventions; codes in `src/core/result.ts` |
>
> — `sad.md §8, Error handling row, verbatim` · full text: [sad.md](../sad.md)

> A plain `Blob` with no name gives an empty Source name, which AC-07 turns into `image`.
>
> — `sad.md §5, Cross-feature changes bullet 1 (last sentence), verbatim` · full text: [sad.md](../sad.md)

>   - File-name injection (a Source name with path separators, reserved device names, leading dots or extreme length): replaced characters and a fallback name (AC-07), so the app never suggests a path or a hidden file.
>
> — `spec.md §6.1, Abuse cases, verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:** Functional core with feature folders: `core` is pure TypeScript; features never import each other and coordinate through the `editor` store; `infra` may call pure `core` functions
>
> — `sad.md §2, Technical constraints, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** `core` and `infra` return `Result<T, AppError>` from `src/core/result.ts`
>
> — `CLAUDE.md §Conventions, Errors, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Fixed by this breakdown:** `sourceNameOf(fileName)` lives in `src/core/export/naming.ts` next to `exportFileName`; T3 calls it from the editor store at open. `matchesExtension(name, format)` judges the name the dialog returned (T9 calls it). This task owns all four new `AppErrorCode`s so T5, T7 and T9 can raise them without touching `result.ts`.
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-07 — happy path

> **Given** the Work was opened from a file named, for example, `IMG_4021.HEIC`
> **When** the Editor exports it as JPEG
> **Then** the suggested file name is `IMG_4021-edited.jpg`, with an extension that always matches the chosen format. The cleanup uses the strictest rules of Windows, macOS and Linux together, applied to the Source name in this order: (1) the characters `< > : " / \ | ? *` and the control characters U+0000–U+001F and U+007F–U+009F become `_`; (2) leading and trailing dots and spaces are removed; (3) the name is cut to at most 200 bytes in UTF-8 without splitting a character; (4) leading and trailing dots and spaces are removed again; (5) if the part before the first dot, with trailing spaces removed, is a Windows reserved name in any letter case, `_` is added after that part. The reserved names are exactly `CON`, `PRN`, `AUX`, `NUL`, `CONIN$`, `CONOUT$`, `COM0`–`COM9`, `LPT0`–`LPT9`, `COM¹`, `COM²`, `COM³`, `LPT¹`, `LPT²` and `LPT³`; (6) if nothing usable is left (the name is empty or only `_`, dots and spaces), `image` is used. Then `-edited` and the matching extension are added, so the fallback name is `image-edited` with the matching extension. Non-ASCII letters are kept. The Source name is the opened file's name with its last extension removed, but only when that extension is one of `jpg`, `jpeg`, `jpe`, `jfif`, `png`, `webp`, `avif`, `gif`, `heic` or `heif` in any letter case: `IMG_4021.HEIC` gives `IMG_4021`, and `scan.v2` stays `scan.v2`
>
> — `spec.md §5, AC-07, verbatim` · full text: [spec.md](../spec.md)

### AC-01b — error

> **Given** the Editor is saving through the "Save as…" dialog
> **When** they change the suggested name in the dialog
> **Then** the dialog offers only the chosen format. The check below applies to the name the dialog returns, not the name typed, so when the dialog adds the extension itself (`photo` becomes `photo.jpg`) the file is saved. Any other name with a matching extension is accepted, and the notice names the file as saved. An extension matches when it is one of `.jpg`, `.jpeg`, `.jpe` or `.jfif` for JPEG, `.png` for PNG, or `.webp` for WebP, in any letter case. If the name has no extension or an extension that does not match the chosen format (for example `photo.png` for JPEG), nothing is written, a notice explains why and suggests saving again with the matching extension, and the Work keeps its Unsaved edits
>
> — `spec.md §5, AC-01b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `EXPORT_FAILED`, `EXPORT_FORMAT_MISMATCH`, `EXPORT_NOT_PERMITTED`, `EXPORT_EXTENSION_MISMATCH` to `AppErrorCode` and `APP_ERROR_CODES`, each with a one-line doc comment naming its AC — `src/core/result.ts`
- [ ] Write `sourceNameOf(fileName: string): string` (drop the last extension only when it is one of the ten listed in AC-07, any case) — `src/core/export/naming.ts`
- [ ] Write `exportFileName(sourceName: string, format: ExportFormat): string` applying the six AC-07 steps in order, then `-edited` + the main extension (`.png` / `.jpg` / `.webp`) — `src/core/export/naming.ts`
- [ ] Write `EXPORT_EXTENSIONS` (per format, the AC-01b list) and `matchesExtension(name, format)` (case-insensitive) — `src/core/export/naming.ts`
- [ ] Export `ExportFormat = Extract<ImageFormat, 'png' | 'jpeg' | 'webp'>` and the functions from `src/core/export/index.ts` and `src/core/index.ts`
- [ ] Table-driven Vitest for every AC-07 step and every AC-01b extension — `src/core/export/naming.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `IMG_4021.HEIC` → Source name | `IMG_4021`; as JPEG → `IMG_4021-edited.jpg` |
| `scan.v2` | stays `scan.v2` (unknown extension kept) → `scan.v2-edited.png` |
| Empty Source name (a `Blob` with no name), or only `_`, dots and spaces | `image` → `image-edited.<ext>` |
| `con.backup`, `Lpt¹`, `CONIN$` | `_` added after the part before the first dot: `con_.backup` |
| `a/b:c` or U+0085 in the name | each becomes `_` |
| Name longer than 200 UTF-8 bytes ending in a multi-byte letter | cut at ≤ 200 bytes on a character boundary, then dots/spaces trimmed again |
| Returned `photo.JPEG` / `photo.jfif` for JPEG | matches |
| Returned `photo` or `photo.png` for JPEG | does not match |

## Definition of Done

- [ ] Vitest covers each AC-07 step, the reserved-name list, the 200-byte cut and every AC-01b extension in mixed case
- [ ] `isAppErrorCode` accepts the four new codes
- [ ] every Hard Rule inlined above still holds (no DOM, no Vue in `src/core/export/`)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
