---
id: T12
title: "Build the export panel (SCR-03) in every state on the export store and the new primitives"
layer: "ui"
deps: ["T9", "T10", "T11"]
blocks: ["T13"]
acs: ["AC-04", "AC-05", "AC-12", "AC-15", "AC-17", "AC-19"]
files_hint: ["src/features/export/ExportPanel.vue", "src/features/export/ExportPanel.test.ts", "src/features/export/index.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 96 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T12 — Build the export panel (SCR-03) in every state on the export store and the new primitives

## Place in the sequence

- **Blocked by:** T9 — Orchestrate the export in the export store: snapshot, encode, Save as… or download, refusals, File ready, save point, T10 — Add the Popover and SegmentedControl shared primitives and register them in the design system, T11 — Add the NumberField and SliderField shared primitives (apply on blur and Enter, apply-now) and register them.
- **Blocks:** T13 — Mount the Export action in the editor top bar with its states, the Ctrl/Cmd+S shortcut and the exporting lock.
- **Wave:** 6 — after T9, T10, T11.
- **Lane:** shares `src/features/export/index.ts` with T8, T13 — serialized.

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

> **US-08: Export on the first try**
>
> **As a** Portfolio reviewer  
> **I want** to find and complete the export without instructions  
> **So that** I can judge the open, edit and save flow end to end
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It is the one panel where the Editor sees and changes every choice and confirms, and it shows every outcome of the export without leaving the editor.

## Inlined context

> Layout, top to bottom: **Format** (`SegmentedControl`: PNG · JPEG · WebP, each option with an optional one-line hint under the control), **Quality** (`SliderField` 1–100, only for JPEG and WebP), **Size** (`SegmentedControl` presets 100% · 75% · 50% · 25%, then a `NumberField` "Long side" in px, then the read-only result "4096 × 3072 px" in `--font-mono`), **File name** (read-only text: the suggested name with the extension of the selected format; the Editor renames it in SCR-04 where there is one), the **path line** (`--color-text-muted`), and the confirm button.
>
> — `screens.md §SCR-03, layout, verbatim` · full text: [screens.md](../screens.md)

> default: Popover · SegmentedControl (format) · SliderField (quality) · SegmentedControl (size presets) · NumberField (long side, unit "px") · size readout · name text · path line · BaseButton primary "Export"
> PNG selected: no SliderField (hidden, not disabled)
> format checking / unavailable: option disabled + hint "Checking this browser…" / "{Format} isn't available in this browser."
> JPEG transparency hint: one-line hint under Format (--color-text-muted)
> validation: no inline error; the field shows the corrected value and the readout updates. A preset is highlighted only while the long side equals it
> loading (exporting): all controls disabled · BaseButton primary disabled "Exporting…" + Spinner; not closable by Esc or a click outside
> file ready: controls disabled · "Your file is ready." · BaseButton primary "Save…" (focused); Esc or a click outside ends the export as cancelled
> error: as default, controls enabled again, a refused format replaced by PNG and shown unavailable; retrying is one confirm
> success: panel closed
>
> — `screens.md §SCR-03 states (components column), abridged` · full text: [screens.md](../screens.md)

> | Key | Where | Action | AC |
> |---|---|---|---|
> | `Enter` / `Space` | Confirm button | Confirms | AC-17 |
> | `Esc` / click outside | SCR-03 idle or File ready | Applies a value still being typed, then closes. In File ready this ends the export as cancelled | AC-17, AC-19, `sad.md` §1 |
> | `Esc` / click outside | During an export (not File ready) | Does nothing | AC-17 |
>
> — `screens.md §Keyboard, verbatim` · full text: [screens.md](../screens.md)

> Format [ PNG ][#JPEG#][ WebP ] / hint · Quality |----o--| [ 90 ] · Size [#100%#][ 75% ][ 50% ][ 25% ] / Long side [ 4096 ] px / 4096 × 3072 px · File name IMG_4021-edited.jpg / You'll choose where to save it. · [ Export ]
>
> — `screens.md §SCR-03, wireframe 03-a, abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** **Styling:** plain CSS with `<style scoped>`. Every colour, spacing value and font comes from
>
> — `CLAUDE.md §Conventions, Styling, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Fixed by this breakdown:** the panel registers `() => { qualityField.apply(); longSideField.apply() }` with `store.registerFlush` on mount; the confirm button calls `store.confirm()`, Escape / outside close call `store.closePanel()` (or `cancelReady()` in File ready). `Popover` gets `locked` while `status === 'exporting'`.
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

### AC-17 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to save it
> **Then** an "Export" action is visible next to the canvas and reachable by keyboard: it can be reached with Tab and activated with Enter or Space, and Ctrl+S (Cmd+S on a Mac) opens the export panel instead of the browser's "Save page". The export completes in at most three steps: Export, choose a format (no step when the default fits), confirm. Where the browser has a "Save as…" dialog, the confirm in the panel opens the dialog and saving there completes the same step. With no image open, Export is unavailable and its hint says to open an image first; Ctrl/Cmd+S then shows the same hint and never opens the browser's "Save page". While the export panel is open and no export is running, Ctrl/Cmd+S confirms it, like the confirm button. During an export (AC-11), Ctrl/Cmd+S does nothing. Enter in the quality or size field only applies the value as if the Editor had left the field and does not start the export; Enter or Space on the confirm button confirms. Confirming, by the confirm button or Ctrl/Cmd+S, first applies a value still being typed in the quality or size field as if the Editor had left the field (AC-04, AC-05), so the file always has the values the panel shows. The panel stays open during an export, showing the progress with its controls disabled, and closes when the export succeeds. After a cancelled dialog or a refusal (AC-01b, AC-10, AC-12, AC-13, AC-14) it stays open with the same choices, except that a format refused by AC-12 is replaced by PNG, so trying again is one confirm. Escape or a click outside closes the panel only when no export is running
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

### AC-19 — happy path

> **Given** an image is open and the Editor opens the export panel for the first time for this Work
> **When** the panel appears
> **Then** the format is preset to the Work's Source format when it is PNG, JPEG or WebP and the check has already confirmed that this browser can produce it (AC-12), and to PNG otherwise (for example HEIC, AVIF, GIF, or WebP in Safari). Within the browser session (until the page is reloaded) the panel remembers the quality for every Work, and the format and size for the same Work. Choices are remembered as soon as they are changed, even if the export is then cancelled. Closing the panel (Escape or a click outside) first applies a value still being typed as if the Editor had left the field, so that value is remembered too, and the size is remembered in the form it was chosen: a preset as a percentage, a typed long side in pixels (snapped by AC-06 if the Work has become smaller); a newly opened Work starts again from its Source format and full size. Nothing is remembered across sessions
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Compose `ExportPanel.vue` from `Popover`, `SegmentedControl` (format, presets), `SliderField`, `NumberField`, `BaseButton`, `Spinner`, bound to `useExportStore` — `src/features/export/ExportPanel.vue`
- [ ] Render the per-format hints, the transparency hint, the size readout (`--font-mono`), the suggested name and the path line from store getters
- [ ] Exporting state: every control disabled, button "Exporting…" + `Spinner`, Popover locked; File ready: "Your file is ready." + focused "Save…" → `saveFromReady()`
- [ ] Register the fields' flush; Enter in a field only applies; confirm button (click, Enter, Space) → `confirm()`
- [ ] Export `ExportPanel` from `src/features/export/index.ts`
- [ ] Component tests on happy-dom with a real Pinia and a fake export client / save functions — `src/features/export/ExportPanel.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| PNG selected | Quality is not rendered at all |
| Long side typed as 2048 on a 4096 Work | 50% preset highlighted; typing 2000 → no preset highlighted |
| Value typed in Quality, then the confirm button | the typed value is applied first, then the export starts with it |
| Value typed, then Escape | applied and remembered, then the panel closes |
| Escape during an export (not File ready) | nothing happens |
| After an `EXPORT_FORMAT_MISMATCH` for WebP | PNG selected, WebP disabled with its hint, controls enabled |

## Definition of Done

- [ ] Component tests prove each SCR-03 state in screens.md renders its listed components (default, PNG selected, format checking, format unavailable, JPEG transparency hint, validation, loading, file ready, error)
- [ ] Component tests prove Enter in a field never exports, confirm and Escape apply a pending value first, and Escape / outside click do nothing during an export
- [ ] every Hard Rule inlined above still holds (tokens only, no new UI kit)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
