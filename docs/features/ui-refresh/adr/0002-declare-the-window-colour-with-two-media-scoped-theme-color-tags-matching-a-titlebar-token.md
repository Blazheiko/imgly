---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-16"
feature_size: "S"
ticket: "roadmap step 11 — ui-refresh"
---

# 0002 — Declare the window colour with two media-scoped theme-color tags matching a titlebar token

- **Status:** Accepted
- **Date:** 2026-10-16
- **Deciders:** Blazheiko, with Claude during the design pass

## Context

Spec AC-11 needs the Installed app's title bar and the top bar to share one brand-tinted colour per system theme, `#15122A` in dark and `#F4F2FF` in light, and to follow a theme change while the app is open. Today `index.html` has one `theme-color` of `#16181d` and the manifest one `theme_color`, so a light-theme window shows a dark strip over a light app (SAD §2). The manifest accepts a single colour, which the window uses before the page has loaded.

## Decision drivers

- AC-11: one strip, per theme, following live theme changes, required on Chromium desktop
- Tokens are the single source of colour (CLAUDE.md, spec §6 "0 hard-coded colours … outside the design-token file and the two window-colour values the page header must state")
- No JavaScript on the start-up path for something the browser can do itself

## Considered options

1. **Two `<meta name="theme-color">` tags with `media="(prefers-color-scheme: dark|light)"`**, plus a `--color-titlebar` token set in both blocks of `tokens.css` for the top bar; the manifest keeps the dark value.
2. **One meta tag rewritten by JavaScript** in `src/app/` on `matchMedia('(prefers-color-scheme: dark)')` changes, reading the value from the token with `getComputedStyle`.

## Decision outcome

**Chosen:** Option 1. The browser picks and repaints the right tag by itself in Chromium and Safari, before any script runs and with nothing to subscribe to or clean up. The cost is two hex values written in `index.html` as well as in `tokens.css`, which the spec explicitly allows; a unit test reads both files and fails if they drift. Option 2 keeps one source but shows the wrong colour until the script runs, and adds a module with its own lifecycle and tests for no user-visible gain.

## Consequences

**Positive**
- Correct colour from the first paint of the page, in both themes, with live switching
- No new runtime code

**Negative**
- The two colours are written twice; the guard test is the only thing keeping them equal
- Before the page loads, the window shows the manifest's dark colour even in the light theme (accepted by spec AC-11)

**Neutral**
- Moving the colour into the title bar area itself (Window Controls Overlay) later builds on the same token and is independent of this choice (`design-proposal.md` §10)

## Links

- Spec: [[../spec.md]] AC-11, §6
- SAD: [[../sad.md]] §4, §6 flow 2, §8
