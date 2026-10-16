---
id: T15
title: "Record tokens v2, Icon, AppLogo and the widened BaseButton and Toast in docs/design-system.md"
layer: "docs"
deps: ["T1", "T2", "T3", "T4", "T5"]
blocks: []
acs: []
files_hint: ["docs/design-system.md", "docs/features/ui-refresh/screens.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 30 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T15 — Record the design-system changes

## Place in the sequence

- **Blocked by:** T1 — tokens, T2 — Icon, T3 — BaseButton, T4 — Toast, T5 — AppLogo · **Blocks:** — · **Wave:** 4, alongside T7 and T13.
- **Lane:** own lane (only task touching `docs/design-system.md`).

## Why (user story)

> **As an** Editor
> **I want** every action button to carry an icon in one consistent style
> **So that** I find the action I need quickly and the top bar reads as one toolbar
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

Consistency survives the next feature only if the canon records the new primitives; this task writes them down.

## Inlined context

> | Component | Why no existing primitive fits | Registered in design-system |
> |---|---|---|
> | `NEW: Icon` (`src/shared/ui/Icon.vue`) | No primitive renders an icon. It renders a typed registry name as a decorative `<svg>` (ADR-0001) | pending |
> | `NEW: AppLogo` (`src/shared/ui/AppLogo.vue`) | No primitive draws the brand. It draws §Brand mark, with an optional wordmark | pending |
>
> Widened, not new (ADR-0003), and also re-registered in `docs/design-system.md` §Component inventory:
> - **BaseButton** gains `icon`, `size` `sm` | `md` | `lg`, the `danger` variant, the neutral disabled and unavailable look, the busy icon slot and the focus offset (§Buttons).
> - **Toast** gains `action.icon`, which the `Spinner` replaces while busy, the icon-only `x` Dismiss and the edge-coloured look (SCR-06).
>
> Restyled feature components are not primitives and are not registered. The tokens of §Token values are recorded in `docs/design-system.md` §Token source.
>
> — `screens.md §New components, abridged` · full text: [screens.md](../screens.md)

> Reuse `src/shared/ui/` primitives, and register any new primitive in `docs/design-system.md`.
>
> — `CLAUDE.md §Conventions, Styling, verbatim`

**Fallback:** insufficient → read [screens.md](../screens.md) §Look decisions and the current `docs/design-system.md`. Record what the code actually ships, not the plan.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

No spec §5 AC of its own: it documents the primitives that serve AC-02, AC-03, AC-12 and AC-13 (delivered by T2–T5). Done when the canon matches the code.

## Checklist

- [ ] §Token source: the v2 colour, size and motion tokens with dark/light values and the reduced-motion rule — `docs/design-system.md`
- [ ] §Component inventory: add `Icon`, `AppLogo`; update `BaseButton` (props, `danger`, sizes, unavailable look, busy) and `Toast` (action icon, icon-only Dismiss) rows; note the icon map's rule "choice controls get no icon" — `docs/design-system.md`
- [ ] Flip `screens.md` §New components «pending» to «registered» — `docs/features/ui-refresh/screens.md`

## Edge cases

| Case | Behaviour |
|---|---|
| A token name in code differs from screens.md | Document the code's name and note the difference |

## Definition of Done

- [ ] Every new or widened primitive and every v2 token appears in `docs/design-system.md` with the name used in code
- [ ] `pnpm lint` (Prettier on markdown, if configured) clean
