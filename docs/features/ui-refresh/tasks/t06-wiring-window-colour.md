---
id: T6
title: "Declare the window colour: two media-scoped theme-color tags, manifest #15122A, and a guard test pinning them to --color-titlebar"
layer: "wiring"
deps: ["T1", "T5"]
blocks: ["T7", "T14"]
acs: ["AC-11"]
files_hint: ["index.html", "vite.config.ts", "src/app/window-colour.test.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 34 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T6 — Declare the window colour per theme

## Place in the sequence

- **Blocked by:** T1 — tokens v2 (`--color-titlebar`), T5 — brand icons (shares `index.html`, `vite.config.ts`) · **Blocks:** T7 — top bar, T14 — e2e checks · **Wave:** 3.
- **Lane:** shares `index.html` and `vite.config.ts` with T5 — serialized after it.

## Why (user story)

> **As an** Editor
> **I want** the Installed app's title bar to match the top bar's colour in my system's theme
> **So that** the window looks like one native-feeling app rather than a web page in a frame
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

This task delivers the window side of the strip; T7 paints the top bar from the same token.

## Inlined context

> **Chosen:** Two `<meta name="theme-color">` tags with `media="(prefers-color-scheme: dark|light)"`, plus a `--color-titlebar` token set in both blocks of `tokens.css` for the top bar; the manifest's `theme_color` and `background_color` become the dark value `#15122A`. The cost is the window colours written in `index.html` and in the manifest in `vite.config.ts` as well as in `tokens.css`; one unit test reads the three files and fails if they drift.
>
> — `adr/0002, Option 1 + Decision outcome, abridged` · full text: [ADR-0002](../adr/0002-declare-the-window-colour-with-two-media-scoped-theme-color-tags-matching-a-titlebar-token.md)

> `--color-titlebar`: dark `#15122A`, light `#F4F2FF`.
>
> — `screens.md §Token values, row --color-titlebar, abridged` · full text: [screens.md](../screens.md)

> | starting | The Installed app opens, before the page has loaded (AC-11). The window shows the manifest's `theme_color` and `background_color` `#15122A`, in both themes |
> | Safari installed app | Best effort (AC-11, `sad.md` §11). Whatever Safari applies of the `theme-color` tags, checked once by hand. No fallback is drawn |
>
> — `screens.md §SCR-04, rows starting + Safari, verbatim` · full text: [screens.md](../screens.md)

Today: `index.html:6` `<meta name="theme-color" content="#16181d" />`; `vite.config.ts:32-33` `background_color: '#16181d'`, `theme_color: '#16181d'`.

> **Hard rule:** 0 hard-coded colours outside the design-token file and the two window-colour values the page header must state; no JavaScript on the start-up path for the window colour.
>
> — `spec.md §6, NFR row «Hard-coded colours»` + `adr/0002, Decision drivers, abridged`

**Fallback:** insufficient or contradicted by the code → read [ADR-0002](../adr/0002-declare-the-window-colour-with-two-media-scoped-theme-color-tags-matching-a-titlebar-token.md) and `sad.md §6` Critical flow 2. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-11 — cross-context

> **Given** the Editor runs the Installed app in a Chromium-based desktop browser (in Safari's installed app the same holds as far as Safari allows)
> **When** the system's theme is dark, or is light, or changes between them while the app is open
> **Then** the window's title bar takes the top bar's brand-tinted colour for that theme, deep indigo in dark and pale lavender in light, and the top bar itself uses that same colour, so the title bar and the top bar read as one strip with no contrasting band between them; while the app is still starting, before the page has loaded, the window may show the dark colour
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Replace the single tag with `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#15122A">` and `… light) content="#F4F2FF">` — `index.html`
- [ ] Manifest `theme_color` and `background_color` → `#15122A` — `vite.config.ts`
- [ ] Guard test: read `tokens.css`, `index.html` and `vite.config.ts` as text; the dark `--color-titlebar` equals the dark tag and both manifest colours, the light value equals the light tag (case-insensitive) — `src/app/window-colour.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Token value changed, tags not | Guard test fails naming the drifted file |
| Before the page loads, light theme | Window shows `#15122A` (accepted by AC-11) |
| Safari | Best effort, one manual check |

## Definition of Done

- [ ] `window-colour.test.ts` passes and fails when any one of the three values is edited
- [ ] Manual: Installed app in Chrome, switch the system theme — title bar follows (recorded in the PR)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
