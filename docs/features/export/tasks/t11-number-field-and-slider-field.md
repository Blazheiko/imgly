---
id: T11
title: "Add the NumberField and SliderField shared primitives (apply on blur and Enter, apply-now) and register them"
layer: "ui"
deps: []
blocks: ["T12"]
acs: ["AC-04", "AC-05", "AC-17"]
files_hint: ["src/shared/ui/NumberField.vue", "src/shared/ui/SliderField.vue", "src/shared/ui/index.ts", "src/shared/ui/primitives.test.ts", "docs/design-system.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 58 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Add the NumberField and SliderField shared primitives (apply on blur and Enter, apply-now) and register them

## Place in the sequence

- **Blocked by:** nothing — can start immediately.
- **Blocks:** T12 — Build the export panel (SCR-03) in every state on the export store and the new primitives.
- **Wave:** 1 — no deps, starts in the first wave.
- **Lane:** shares `docs/design-system.md`, `src/shared/ui/index.ts`, `src/shared/ui/primitives.test.ts` with T10, T13 — serialized.

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

It gives the quality and long-side inputs the "applied when you leave the field" behaviour the spec requires, including from a confirm or close.

## Inlined context

> | Component | Why no existing primitive fits | Registered in design-system |
> |---|---|---|
> | `NumberField` (shared primitive) | An integer input with an optional unit that applies its value on blur and `Enter` through a caller's normalize function (snap, round or revert), and exposes "apply now" for confirm and close (AC-04, AC-05, AC-17). Nothing in the inventory accepts input | pending |
> | `SliderField` (shared primitive) | The canon's "clamped slider paired with a number field" (§Validation): a range input bound to a `NumberField`. Quality here, brush width later | pending |
>
> — `screens.md §New components, verbatim` · full text: [screens.md](../screens.md)

> | Key | Where | Action | AC |
> |---|---|---|---|
> | `Enter` | Quality or size field | Applies the value as if leaving the field. Does not export | AC-04, AC-05, AC-17 |
>
> — `screens.md §Keyboard, verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** **Styling:** plain CSS with `<style scoped>`. Every colour, spacing value and font comes from
>
> — `CLAUDE.md §Conventions, Styling, verbatim` · full text: [CLAUDE.md](../../../../CLAUDE.md)

> **Fixed by this breakdown:** `NumberField` takes `normalize(raw: string, previous: number) => number` (T2's `normalizeQuality` / `normalizeLongSide` are passed in by the panel) and exposes `apply()` through `defineExpose`. It shares the lane with T10 (`index.ts`, `primitives.test.ts`, `docs/design-system.md`).
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

### AC-17 — happy path

> **Given** a Portfolio reviewer has opened an image for the first time
> **When** they look for a way to save it
> **Then** an "Export" action is visible next to the canvas and reachable by keyboard: it can be reached with Tab and activated with Enter or Space, and Ctrl+S (Cmd+S on a Mac) opens the export panel instead of the browser's "Save page". The export completes in at most three steps: Export, choose a format (no step when the default fits), confirm. Where the browser has a "Save as…" dialog, the confirm in the panel opens the dialog and saving there completes the same step. With no image open, Export is unavailable and its hint says to open an image first; Ctrl/Cmd+S then shows the same hint and never opens the browser's "Save page". While the export panel is open and no export is running, Ctrl/Cmd+S confirms it, like the confirm button. During an export (AC-11), Ctrl/Cmd+S does nothing. Enter in the quality or size field only applies the value as if the Editor had left the field and does not start the export; Enter or Space on the confirm button confirms. Confirming, by the confirm button or Ctrl/Cmd+S, first applies a value still being typed in the quality or size field as if the Editor had left the field (AC-04, AC-05), so the file always has the values the panel shows. The panel stays open during an export, showing the progress with its controls disabled, and closes when the export succeeds. After a cancelled dialog or a refusal (AC-01b, AC-10, AC-12, AC-13, AC-14) it stays open with the same choices, except that a format refused by AC-12 is replaced by PNG, so trying again is one confirm. Escape or a click outside closes the panel only when no export is running
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write `NumberField.vue`: label, optional unit, `modelValue: number`, raw text while typing, `normalize` on blur and on Enter (Enter does not submit or bubble a confirm), `apply()` exposed, `disabled` — `src/shared/ui/NumberField.vue`
- [ ] Write `SliderField.vue`: `<input type="range">` (min/max) bound to a `NumberField`, both emitting the same normalized value — `src/shared/ui/SliderField.vue`
- [ ] Export from `src/shared/ui/index.ts`; register both in `docs/design-system.md` §Component inventory
- [ ] Component tests on happy-dom — `src/shared/ui/primitives.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Typing `150` then Tab | `normalize` runs once; the field shows the corrected value |
| Typing then Enter | value applied; no form submit, no export |
| `apply()` called while text is pending | same result as a blur |
| `apply()` with nothing pending | no emit |
| Slider dragged | number field shows the same value |

## Definition of Done

- [ ] Component tests prove NumberField applies through `normalize` on blur, on Enter (without submitting) and on `apply()`, and SliderField keeps range and number in step
- [ ] both primitives are listed in `docs/design-system.md`; every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
