---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-16"
feature_size: "S"
ticket: "roadmap step 11 — ui-refresh"
---

# 0003 — Extend BaseButton and Toast with optional icon, size and danger instead of new button primitives

- **Status:** Accepted
- **Date:** 2026-10-16
- **Deciders:** Blazheiko, with Claude during the design pass

## Context

Every action button needs an icon (spec AC-02), three buttons become icon-only with a tooltip (Undo, Redo, a card's Delete; AC-03), the delete confirmation needs a destructive style (AC-12), and the notice's action and Dismiss need icons with the busy spinner taking the action icon's place (spec §1). `BaseButton` has about 40 uses in 9 features, and e2e tests find buttons by accessible name ("Apply", "Auto", `/^Export/`), so an icon must never change a name (SAD §2).

## Decision drivers

- Accessible names and keyboard order unchanged; existing tests pass without edits apart from the one order test (spec §6, AC-03)
- One look for hover, focus, disabled and pressed across every button (spec §2, AC-13)
- Size S: additive changes to existing primitives, no breaking API (spec §1 override)

## Considered options

1. **Extend `BaseButton`** with optional `icon` (a registry name), `size` (`sm` | `md` | `lg`, default `md`) and a `danger` variant; an icon-only button is a `BaseButton` with `icon`, no label, an `aria-label` and a `title`. `Toast`'s action gains an optional `icon` replaced by the `Spinner` while busy, and Dismiss renders the `x` icon with its existing `aria-label`.
2. **Add an `IconButton` primitive** for the icon-only cases with a required label, and add only `icon` and `danger` to `BaseButton`.

## Decision outcome

**Chosen:** Option 1. Every existing call compiles and renders as before, the icon is `aria-hidden` so names cannot change, and one component keeps one set of states. Option 2 makes a nameless icon button a type error, but duplicates every state and style and forces Undo and Redo onto a new component; the same protection is obtained in Option 1 by a component test that every icon-only `BaseButton` has an `aria-label`.

## Consequences

**Positive**
- Additive and backward compatible; features adopt icons one call at a time
- One button implementation for every state, variant and size

**Negative**
- `BaseButton`'s prop surface grows; a nameless icon-only button is caught by a test, not by the type checker

**Neutral**
- `docs/design-system.md` records the new props and the `danger` variant on the BaseButton and Toast rows

## Links

- Spec: [[../spec.md]] AC-02, AC-03, AC-12, AC-13, §1
- SAD: [[../sad.md]] §4, §5, §6 flow 1
- Related ADR: [[0001-copy-lucide-paths-into-a-typed-shared-icon-registry-rendered-by-an-icon-primitive]]
