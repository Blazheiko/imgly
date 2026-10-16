---
id: T5
title: "Add AppLogo and the brand icon files: favicon.svg, the PNG app icons rendered by scripts/render-icons.ts, tab and touch-icon links"
layer: "ui"
deps: ["T1", "T2"]
blocks: ["T6", "T7", "T15"]
acs: ["AC-01"]
files_hint: ["src/shared/ui/AppLogo.vue", "src/shared/ui/AppLogo.test.ts", "src/shared/ui/index.ts", "public/icons/", "scripts/render-icons.ts", "package.json", "index.html", "vite.config.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 38 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T5 — Add AppLogo and the brand icon files

## Place in the sequence

- **Blocked by:** T1 — tokens v2, T2 — icon registry (shares `src/shared/ui/index.ts`) · **Blocks:** T6 — window colour (shares `index.html`, `vite.config.ts`), T7 — top bar, T15 — design-system record · **Wave:** 2.
- **Lane:** shares `src/shared/ui/index.ts` with T2 and `index.html` / `vite.config.ts` with T6 — serialized T2 → T5 → T6.

## Why (user story)

> **As a** Portfolio reviewer
> **I want** to see imgly's own logo in the top bar, the browser tab and the Installed app's icon
> **So that** I immediately know which product I am looking at and that it was designed with care
>
> — `spec.md §4, US-01, verbatim` · full text: [spec.md](../spec.md)

This task draws the mark once and produces every file the browser and the system show it from; T7 places `AppLogo` in the top bar.

## Inlined context

> The approved artwork, on a 32 × 32 grid (`brand/logo-concept.svg`, symbol `mark`): a top-left crop corner `M5 14V8a3 3 0 0 1 3-3h6`, a bottom-right crop corner `M27 18v6a3 3 0 0 1-3 3h-6`, both stroke 3.25 with round caps and joins, and an accent dot `circle(21, 11, r 3)`.
>
> - **In the page:** stroked and filled with `--color-brand-gradient`, at 24 px in the top bar, followed by the wordmark "imgly" (`--font-size-xl`, `--font-weight-bold`, `--tracking-tight`, `--color-on-titlebar`). `AppLogo` is decoration (`aria-hidden`) next to the visible text "imgly", which is not a heading and adds no keyboard stop.
> - **Outside the page** (SCR-04): `favicon.svg` is the gradient mark on a transparent background. `icon-192.png` and `icon-512.png` are the white mark at 60% of the side on a gradient rounded square (radius 22% of the side). `icon-maskable-512.png` is a full-bleed gradient with the white mark inside the central 80% safe circle at 46% of the side. `apple-touch-icon-180.png` is the full-bleed version (iOS rounds the corners). All are rendered by `scripts/render-icons.ts` (`sad.md` §5).
>
> — `screens.md §Brand mark, verbatim` · full text: [screens.md](../screens.md)

> | default (browser tab) | `favicon.svg` (the gradient mark) is the tab icon. `icon-192.png` stays the fallback | `index.html` `<link rel="icon">` |
> | app list icon | `icon-192.png` and `icon-512.png`: white mark on the gradient rounded square | web manifest `icons` |
> | home-screen icon | `icon-maskable-512.png` where maskable icons are used, `apple-touch-icon-180.png` on iOS | manifest `purpose: maskable` · `<link rel="apple-touch-icon">` |
>
> — `screens.md §SCR-04, rows 1–3, abridged` · full text: [screens.md](../screens.md)

> `scripts/render-icons.ts` NEW (dev only): renders the PNG icons from the SVG with Playwright's Chromium. Accepted debt: the PNG icons are rendered once by a dev script and committed, not generated on every build.
>
> — `sad.md §5 tree + §11 Accepted debt, abridged` · full text: [sad.md](../sad.md)

Today: `index.html:7` `<link rel="icon" type="image/png" href="/icons/icon-192.png">`, `:8` apple-touch-icon; `vite.config.ts:24` `includeAssets`; `public/icons/` has four PNGs. The service-worker precache pattern already covers `svg` and `png` (`sad.md` §7).

> **Hard rule:** the gradient stops are the only hex values allowed inside the brand SVG files (they are assets, not component styles); `AppLogo.vue` takes its gradient from `--color-brand-gradient` stops via tokens.
>
> — `sad.md §8, Design tokens` + `spec.md §6, NFR row «Hard-coded colours», abridged`

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) §Brand mark, SCR-04 and `brand/logo-concept.svg`. Do not redraw the mark from memory.

## Data delta

No DB changes.

## API contract

Internal — no API surface. `AppLogo` props: `wordmark?: boolean` (default `true`); exported from `@/shared`.

## Acceptance criteria

### AC-01 — happy path

> **Given** the app is open in a browser tab or as an Installed app, in either theme
> **When** the Portfolio reviewer looks at the top bar, the browser tab and the system's list of apps
> **Then** the top bar's left end shows the imgly mark followed by the name "imgly", the tab shows the same mark, and the Installed app's icon shows the same mark on the brand colour, with no generic picture symbol left in any of those four places (the top bar, the tab, the Installed app's icon and the icon used when the app is added to a home screen); an image icon inside the interface, such as on the drop area, is not a brand mark
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `AppLogo.vue`: inline 24 px svg of the mark (`aria-hidden`, gradient via a `<linearGradient>` whose stops read token values) + optional wordmark span — `src/shared/ui/AppLogo.vue`, export in `src/shared/ui/index.ts`
- [ ] `public/icons/favicon.svg` from the `mark` symbol
- [ ] `scripts/render-icons.ts` (Playwright Chromium screenshot of inline SVG pages) + a `pnpm icons` script; re-render and commit the four PNGs — `scripts/`, `package.json`, `public/icons/`
- [ ] `<link rel="icon" type="image/svg+xml" href="/icons/favicon.svg">` (same base-relative form as the existing links) with the PNG fallback kept; `includeAssets` gains `icons/favicon.svg` — `index.html`, `vite.config.ts`
- [ ] Test: `AppLogo` renders an `aria-hidden` svg and the text "imgly", no focusable element — `src/shared/ui/AppLogo.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Browser without SVG favicon support | Falls back to `icon-192.png`, now the brand mark |
| Maskable crop on Android | The mark stays inside the 80% safe circle |
| `wordmark=false` | Mark only, still `aria-hidden` |

## Definition of Done

- [ ] `AppLogo.test.ts` passes; the five icon files exist and show the mark (checked by eye against `brand/logo-concept.png`)
- [ ] `pnpm build` precaches `favicon.svg`
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
