---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-16"
feature_size: "S"
ticket: "roadmap step 11 — ui-refresh"
---

# 0001 — Copy Lucide paths into a typed shared icon registry rendered by an Icon primitive

- **Status:** Accepted
- **Date:** 2026-10-16
- **Deciders:** Blazheiko, with Claude during the design pass

## Context

Spec AC-02 gives every action button in the app an icon from one set drawn in one style, about 30 icons across 9 features. Today five files carry hand-drawn 16×16 inline SVGs sized through a spacing token, and no shared icon module exists (SAD §2). The owner already chose, in `design-proposal.md` D3, to take the paths from Lucide and add no runtime package. What remained was where the paths live and how features render them, which every feature then depends on.

## Decision drivers

- One style and one size scale for every icon (spec AC-02, §2 goal 2)
- 0 new third-party packages downloaded at runtime and ≤ 15 KB compressed growth (spec §6)
- Works offline with nothing extra to fetch or precache (repo ADR 0001)
- Icons must not change any button's accessible name (spec AC-03, §6)
- `src/shared/` may import only `core` types (CLAUDE.md module boundaries)

## Considered options

1. **Typed registry plus an `Icon` primitive** — `src/shared/icons/index.ts` exports a typed `name → path data` map with `LICENSE-lucide` beside it; `src/shared/ui/Icon.vue` renders `<svg aria-hidden focusable="false">` in `currentColor`, sized by `--icon-size-*`.
2. **An SVG sprite in `public/`** — one `icons.svg` of `<symbol>`s, referenced with `<use href>` from each button.

## Decision outcome

**Chosen:** Option 1. Icon names are checked by TypeScript, so a missing icon fails `pnpm typecheck` instead of rendering blank; only the ~30 paths in use enter the bundle, inside chunks the service worker already precaches; and the rendered `<svg>` is real DOM, so component tests on happy-dom can assert that each button has its icon and that the icon is hidden from assistive technology. The sprite would add a request, depend on the `/imgly/` base path in every `href`, need its own precache entry, and leave names unchecked.

## Consequences

**Positive**
- One source for every icon; the five inline SVGs are removed
- No runtime dependency, no request, nothing new to precache
- Typos in icon names are compile errors

**Negative**
- Adding an icon means copying its path data by hand from Lucide
- Path strings are inlined into the JavaScript, a few KB in total

**Neutral**
- Switching to a sprite or to the Lucide package later is a change inside `Icon.vue` and the registry; call sites pass only a name

## Links

- Spec: [[../spec.md]] AC-02, AC-03, §6
- SAD: [[../sad.md]] §4, §5, §8
- Related ADR: [[0003-extend-basebutton-and-toast-with-optional-icon-size-and-danger-instead-of-new-button-primitives]]
