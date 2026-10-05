---
id: T8
title: "Create the export store: panel state, defaults, session memory, format availability and the messages catalog"
layer: "app"
deps: ["T2", "T3", "T6"]
blocks: ["T9"]
acs: ["AC-04", "AC-05", "AC-06", "AC-12", "AC-15", "AC-19"]
files_hint: ["src/features/export/store.ts", "src/features/export/store.test.ts", "src/features/export/messages.ts", "src/features/export/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 107 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T8 — Create the export store: panel state, defaults, session memory, format availability and the messages catalog

## Place in the sequence

- **Blocked by:** T2 — Add the pure size, quality and default-format rules (presets, long side, half-up rounding, snapping), T3 — Carry Source name, Source format and the transparency fact on the Work from every open, T6 — Add the once-per-session format check and the main-thread export client (worker spawn, transfer, terminate).
- **Blocks:** T9 — Orchestrate the export in the export store: snapshot, encode, Save as… or download, refusals, File ready, save point.
- **Wave:** 4 — after T2, T3, T6.
- **Lane:** shares `src/features/export/index.ts`, `src/features/export/store.test.ts`, `src/features/export/store.ts` with T9, T12, T13 — serialized.

## Why (user story)

> **US-02: Balance quality against file size**
>
> **As a** Editor  
> **I want** to set the quality when I export to JPEG or WebP  
> **So that** I can trade image quality for a smaller file
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

> **US-03: Export a smaller image**
>
> **As a** Editor  
> **I want** to export the Work at a smaller size than its full size  
> **So that** the file is small enough to send or upload
>
> — `spec.md §4, US-03, verbatim` · full text: [spec.md](../spec.md)

> **US-04: Recognise the exported file**
>
> **As a** Editor  
> **I want** the exported file to be named after the image I opened  
> **So that** I can find it and tell it apart from the original photo
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It holds everything the panel shows — format, quality, size, suggested name, hints — and remembers it for the session exactly as the spec says.

## Inlined context

> export is a **new feature folder**, `src/features/export/`: the Export action, the panel, the Ctrl/Cmd+S shortcut and the panel's session memory. Its only cross-feature import is `useEditorStore` from `@/features/editor` (the folder's `index.ts`) … it never imports the editor's components or internals.
> `store.ts` — `export` store: panel state, format availability, session memory (AC-19), runExport()
>
> — `sad.md §5, Building block view, abridged` · full text: [sad.md](../sad.md)

> | Concept | Convention | Where defined |
> |---|---|---|
> | Session memory | The `export` store keeps, in memory only: the quality for every Work; the format and the size (preset as a percentage, typed long side in pixels) per Work id; the format check results. A new Work starts from its Source format and full size. Nothing is written to storage (AC-19) | here |
>
> — `sad.md §8, verbatim` · full text: [sad.md](../sad.md)

> UI->>S: reports the first successful open → S->>R: starts the format check
> Note over S: while it runs, JPEG and WebP are not selectable, PNG always is
> Note over UI,S: Postcondition: the check never runs again this session, and an already open panel never changes its selected format by itself
>
> — `sad.md §6, «Session format check», abridged` · full text: [sad.md](../sad.md)

> | State | Trigger / condition | Components (from the inventory) | Source-ref |
> |---|---|---|---|
> | default | Panel opened for this Work (`sad.md` §6 "Open the export panel"). Format: remembered for this Work, else the Source format if the check confirmed it, else PNG. Quality: remembered this session, else 90. Size: remembered for this Work, else 100%. Name: cleaned Source name + `-edited` + extension (AC-07, AC-19) | `Popover` · `SegmentedControl` (format) · `SliderField` (quality) · `SegmentedControl` (size presets) · `NumberField` (long side, unit "px") · size readout · name text · path line · `BaseButton` primary "Export" | wireframe 03-a |
> | format checking | The session's format check has not finished (AC-12). JPEG and WebP are not selectable, PNG is selected and stays selected when the check ends: the panel never switches by itself | `SegmentedControl` with JPEG and WebP disabled + hint "Checking this browser…" | wireframe 03-b |
> | format unavailable | The check found that this browser can't produce the format, or failed, or an export produced another format (AC-12) | `SegmentedControl` option disabled + hint "{Format} isn't available in this browser." | wireframe 03-b |
> | JPEG transparency hint | JPEG is selected (chosen, preset or remembered) and the Work has a pixel that is not fully opaque (AC-15). A Work with no such pixel shows no hint | as `default` + one-line hint under Format (`--color-text-muted`) | wireframe 03-a |
>
> — `screens.md §SCR-03 (state rows), verbatim` · full text: [screens.md](../screens.md)

> The **path line** under the file name says where the file will go, so the Editor is never surprised (AC-02): "You'll choose where to save it." where the browser has a "Save as…" dialog, "It goes to your browser's downloads." elsewhere.
>
> — `screens.md §SCR-03, path line, verbatim` · full text: [screens.md](../screens.md)

> info: Saved {file}. · {file} is in your browser's downloads. · Open an image first to export it.
> failure: EXPORT_FAILED → The export failed. Try again, or choose a smaller size.
> failure: EXPORT_FORMAT_MISMATCH → This browser didn't make a real {Format} file, so nothing was saved. {Format} is turned off for now; PNG is selected.
> failure: EXPORT_EXTENSION_MISMATCH → "{name}" doesn't end in {ext}, so nothing was written. Save again with a {ext} name.
> failure: EXPORT_NOT_PERMITTED → The app wasn't allowed to save there. Choose another folder.
> failure suffix (after EXTENSION_MISMATCH / NOT_PERMITTED): A file named "{name}" there may now be empty or missing.
> hints: {Format} isn't available in this browser. · Checking this browser… · JPEG has no transparency: transparent areas become white. PNG or WebP keep them.
> lines: You'll choose where to save it. · It goes to your browser's downloads. · Your file is ready.
>
> — `screens.md §Message catalog — the seed for `messages.ts` (every row), abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** Functional core with feature folders: `core` is pure TypeScript; features never import each other and coordinate through the `editor` store; `infra` may call pure `core` functions
>
> — `sad.md §2, Technical constraints, verbatim` · full text: [sad.md](../sad.md)

> **Fixed by this breakdown:** the store takes its collaborators through setters (`setFormatChecker`, `setSaveDialogProbe`), as the editor store does with `setDecoder`, so tests inject fakes. The panel registers its fields' "apply now" with `registerFlush(fn)`; `confirm()` (T9) and `closePanel()` call `flushPending()` first, so Ctrl/Cmd+S (T13) and Escape apply a value still being typed (AC-17, AC-19).
>
> — `_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-04 — happy path

> **Given** the export panel is open
> **When** the Editor chooses JPEG or WebP
> **Then** a quality setting from 1 to 100 appears, set to 90 by default, and a higher value gives a larger file with fewer compression artefacts: for the reference photo in the e2e fixtures, the file at quality 10 is smaller than at 50, which is smaller than at 90. JPEG and WebP share one quality value, so switching between them keeps it. When the Editor chooses PNG, the quality setting is hidden, because PNG is lossless. A typed value outside 1 to 100 snaps to the nearest bound, a fractional value rounds to the nearest whole number, and an empty or non-numeric value returns to the previous value when the Editor leaves the field
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 — happy path

> **Given** the export panel is open for a Work of a known size
> **When** the Editor chooses a smaller export size
> **Then** the panel shows the resulting width and height in pixels before the export, the proportions of the Work are kept, and the exported file has exactly those dimensions. The Editor picks a preset (100%, 75%, 50%, 25%) or types the long side in pixels. The long side is the input: a preset sets it to that percentage of the Work's long side, rounded to the nearest whole pixel. The short side is the long side times the Work's proportions, rounded to the nearest whole pixel. An exact half pixel always rounds up (2047.5 becomes 2048, 1536.5 becomes 1537). Proportions count as kept when the short side is within 0.5 px of the exact value, and this holds for every export size, including the smallest (AC-06). The long-side field follows the input rules of AC-04: a fractional value rounds to the nearest whole number, an empty or non-numeric value returns to the previous value, and zero or a negative value counts as too small (AC-06); values are checked and snapped when the Editor leaves the field, not while typing
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-06 — domain invariant

> **Given** the export panel is open
> **When** the Editor enters a size larger than the Work, or so small that the short side, rounded by the AC-05 rule, would be less than 1 pixel
> **Then** the size snaps to the Work's full size, or to the smallest long side whose short side, rounded by the AC-05 rule, is 1 pixel (for a 4096×10 Work, 205×1), because an Export is never larger than the Work and never empty
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-12 — error

> **Given** the browser cannot produce one of the formats (for example WebP in Safari)
> **When** the Editor opens the export panel
> **Then** that format is shown but cannot be chosen, and a one-line hint next to it says it is not available in this browser. Whether a browser can produce a format, and whether a produced file is in the chosen format, is decided by the content the browser actually produces, never by the browser's name or version. If a produced file ever turns out not to be in the chosen format, it is not saved, the Editor is told why, and the Work keeps its Unsaved edits; that format then becomes not selectable, with the same hint, for the rest of the browser session, and the default falls back to PNG (AC-19). The panel then selects PNG straight away, and PNG becomes the remembered format for this Work. The check of every format starts when the first image of the session is opened and runs once per browser session; a check that fails or errors counts as the browser not being able to produce that format. Until the check of a format has finished, that format cannot be chosen; PNG is always available. If the panel opens before the check of the Work's Source format has finished, the format is preset to PNG and stays PNG: the panel never changes the selected format by itself when a check finishes
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — error

> **Given** the Work has transparent areas, meaning at least one pixel is not fully opaque, whatever format the Work was opened from
> **When** JPEG is selected in the export panel, whether the Editor chose it or it was preset or remembered (AC-19)
> **Then** the panel says in one line that JPEG has no transparency and transparent areas will become white, and suggests PNG or WebP to keep them. In the exported JPEG every pixel looks as it would on a white background: its colour is opacity × the pixel's colour + (1 − opacity) × white, computed on the stored sRGB values (as the Preview would show it on white), so a fully transparent pixel becomes white. A Work with no transparent pixels shows no such hint
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — happy path

> **Given** an image is open and the Editor opens the export panel for the first time for this Work
> **When** the panel appears
> **Then** the format is preset to the Work's Source format when it is PNG, JPEG or WebP and the check has already confirmed that this browser can produce it (AC-12), and to PNG otherwise (for example HEIC, AVIF, GIF, or WebP in Safari). Within the browser session (until the page is reloaded) the panel remembers the quality for every Work, and the format and size for the same Work. Choices are remembered as soon as they are changed, even if the export is then cancelled. Closing the panel (Escape or a click outside) first applies a value still being typed as if the Editor had left the field, so that value is remembered too, and the size is remembered in the form it was chosen: a preset as a percentage, a typed long side in pixels (snapped by AC-06 if the Work has become smaller); a newly opened Work starts again from its Source format and full size. Nothing is remembered across sessions
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Create `useExportStore` (Pinia setup store) with `panelOpen`, `availability` (`png: true`, `jpeg`/`webp`: `'checking' | boolean`) and `openPanel()` / `closePanel()` — `src/features/export/store.ts`
- [ ] Start `checkExportFormats()` once, on the session's first open (watch the editor store's Work); a selected format never changes when the check ends — `store.ts`
- [ ] Session memory: `quality` for every Work; per Work id the `format` and the `SizeChoice`; remembered on every change; a new Work starts from `defaultFormat(sourceFormat, availability)` and 100% — `store.ts`
- [ ] Setters `selectFormat` (refuses unavailable), `applyQuality(raw)`, `selectPreset(p)`, `applyLongSide(raw)` using the T2 rules; getters `dimensions`, `suggestedName` (`exportFileName`), `showsQuality`, `transparencyHint`, `pathLine` — `store.ts`
- [ ] `disableFormat(f)` for a mismatch: availability false; if selected → PNG, remembered for this Work — `store.ts`
- [ ] `registerFlush` / `flushPending`; seed the copy catalog from screens.md — `src/features/export/messages.ts`; export `useExportStore` from `src/features/export/index.ts`
- [ ] Vitest with a fake checker and an editor store test Work — `src/features/export/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Panel opened before the check finishes on a JPEG Work | PNG selected; JPEG/WebP not selectable with "Checking this browser…"; stays PNG when the check confirms JPEG |
| Check fails or errors | format shown unavailable for the session |
| Same Work reopened in the panel after a cancelled export | remembered format and size; quality from the session |
| New Work opened | format from its Source format (if confirmed) else PNG, size 100%, quality kept |
| Remembered typed long side larger than the Work | snapped by AC-06 |
| JPEG selected on a Work with `hasTransparency` | `transparencyHint` true; false for PNG/WebP or an opaque Work |
| Page reload | everything starts fresh (nothing persisted) |

## Definition of Done

- [ ] Vitest proves the AC-19 defaults and memory rules (quality per session, format and size per Work, remembered on change, new Work resets), including the "panel never switches format by itself" rule of AC-12
- [ ] Vitest proves `disableFormat` falls back to PNG and remembers it, `transparencyHint` follows AC-15, and the size/quality setters apply the AC-04/05/06 rules
- [ ] every Hard Rule inlined above still holds (the only cross-feature import is `@/features/editor`)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
