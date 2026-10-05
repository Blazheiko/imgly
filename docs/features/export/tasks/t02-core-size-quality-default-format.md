---
id: T2
title: "Add the pure size, quality and default-format rules (presets, long side, half-up rounding, snapping)"
layer: "domain"
deps: []
blocks: ["T8"]
acs: ["AC-04", "AC-05", "AC-06", "AC-19"]
files_hint: ["src/core/export/size.ts", "src/core/export/quality.ts", "src/core/export/format.ts", "src/core/export/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 62 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Add the pure size, quality and default-format rules (presets, long side, half-up rounding, snapping)

## Place in the sequence

- **Blocked by:** nothing — can start immediately.
- **Blocks:** T8 — Create the export store: panel state, defaults, session memory, format availability and the messages catalog.
- **Wave:** 1 — no deps, starts in the first wave.
- **Lane:** shares `src/core/export/index.ts` with T1 — serialized.

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

It turns every typed quality, preset and long side into the exact value the panel shows and the file gets, without a browser.

## Inlined context

> S->>S: picks the format: remembered for this Work, else the Source format if the check confirmed it, else PNG
> S->>S: picks the quality: remembered this session, else 90, and the size: remembered for this Work, else full size
> alt quality outside 1 to 100, fractional, or not a number → snaps to the nearest bound, rounds, or returns to the previous value
> else size larger than the Work or too small for a 1 px short side → snaps to full size or to the smallest valid long side
>
> — `sad.md §6, «Open the export panel and set the choices» steps 3–4 and the apply branch, abridged` · full text: [sad.md](../sad.md)

> - Upscaling or choosing a size larger than the Work. The Downscale limit already bounds the Work, and enlarging adds no detail.
>
> — `spec.md §3, Non-goals, verbatim` · full text: [spec.md](../spec.md)

> **Hard rule:** Functional core with feature folders: `core` is pure TypeScript; features never import each other and coordinate through the `editor` store; `infra` may call pure `core` functions
>
> — `sad.md §2, Technical constraints, verbatim` · full text: [sad.md](../sad.md)

> **Fixed by this breakdown:** round half up in integers, never in floats: for a Work with long side `W` and short side `H`, a long side `L` gives short side `floor((2·L·H + W) / (2·W))`; a preset `p` gives `L = floor((2·W·p + 100) / 200)`. The smallest valid long side is the least `L` whose short side is ≥ 1 (for 4096×10 that is 205). A size choice is `{ kind: 'preset', percent }` or `{ kind: 'longSide', px }`, so the session memory (T8) can keep it "in the form it was chosen".
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

### AC-19 — happy path

> **Given** an image is open and the Editor opens the export panel for the first time for this Work
> **When** the panel appears
> **Then** the format is preset to the Work's Source format when it is PNG, JPEG or WebP and the check has already confirmed that this browser can produce it (AC-12), and to PNG otherwise (for example HEIC, AVIF, GIF, or WebP in Safari). Within the browser session (until the page is reloaded) the panel remembers the quality for every Work, and the format and size for the same Work. Choices are remembered as soon as they are changed, even if the export is then cancelled. Closing the panel (Escape or a click outside) first applies a value still being typed as if the Editor had left the field, so that value is remembered too, and the size is remembered in the form it was chosen: a preset as a percentage, a typed long side in pixels (snapped by AC-06 if the Work has become smaller); a newly opened Work starts again from its Source format and full size. Nothing is remembered across sessions
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Write `normalizeQuality(raw: string, previous: number): number` — snap to 1…100, round fractions, empty/non-numeric → `previous` — `src/core/export/quality.ts`; `DEFAULT_QUALITY = 90`
- [ ] Write `SIZE_PRESETS = [100, 75, 50, 25]`, `SizeChoice`, `longSideFor(work, choice)`, `normalizeLongSide(raw, previous, work)` and `exportSize(work, choice): { width, height }` with the integer half-up rule — `src/core/export/size.ts`
- [ ] Write `minLongSide(work)` and the AC-06 snap (above the Work → full size; short side < 1 → `minLongSide`) — `src/core/export/size.ts`
- [ ] Write `defaultFormat(sourceFormat, available): ExportFormat` — the Source format when it is PNG/JPEG/WebP and `available[format] === true`, else `png` — `src/core/export/format.ts`
- [ ] Export from `src/core/export/index.ts`; Vitest per function — `src/core/export/*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Quality `0`, `150`, `42.5`, `""`, `abc` | `1`, `100`, `43`, previous, previous |
| 4096×3072 at 50% | `2048 × 1536` |
| Long side 2047.5 → 2048; short side 1536.5 | rounds up to `1537` |
| Typed long side `0` or negative | too small → `minLongSide` (AC-06) |
| Typed long side `5000` on a 4096 Work | full size |
| 4096×10 Work, long side `100` | snaps to `205 × 1` |
| Portrait Work (long side is the height) | the long side is the height; width is derived |
| Source format HEIC, AVIF, GIF, or WebP while the check is pending/false | `png` |

## Definition of Done

- [ ] Vitest proves the AC-04 input rules, the AC-05 rounding examples (2047.5→2048, 1536.5→1537), the 0.5 px proportion bound over a sweep of sizes, and the AC-06 4096×10 → 205×1 case
- [ ] `defaultFormat` returns PNG for every non-PNG/JPEG/WebP or unconfirmed Source format
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
