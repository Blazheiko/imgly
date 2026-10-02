---
status: Accepted
owner: "Blazheiko"
reviewers: []
updated_at: "2026-10-02"
feature_size: "foundation"
ticket: ""
---

# 0002 — Organize code as a pure-TS functional core with feature folders and an infra shell

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** Blazheiko (owner), survey foundation session

## Context

The editor's hardest logic is the work document, the fixed pipeline (crop → adjust → draw), keeping
the drawing aligned when a crop is re-edited, and undo/redo. That logic must stay testable without a
browser. The brief also warns about scope creep: each tool must be addable and cuttable on its own.

## Decision drivers

- Unit-testable editing logic (TDD is on in `.claude/sdd.local.md`).
- Features are independently addable and cuttable (scope is the main risk in the brief).
- Browser APIs (WebGL, IndexedDB, clipboard) are hard to test, so they are isolated behind a thin shell.

## Considered options

1. **Functional core / imperative shell + feature folders**: `src/core/` (pure TS), `src/render/`, `src/infra/`, `src/shared/`, `src/features/<f>/`.
2. **Layer-first** (`components/`, `stores/`, `utils/`): the Vue default, which scatters each tool across folders.
3. **Full hexagonal** with ports and adapters per feature: too much ceremony for a single-client app.

## Decision outcome

**Chosen:** Option 1. Import direction: `features → core | render | infra | shared`; `infra → core
(types) | shared`; `core` imports nothing app-specific and no Vue or DOM. Features never import each
other and coordinate through the `editor` store. An ESLint `no-restricted-imports` rule enforces the
`core` boundary.

## Consequences

**Positive**
- The document, the command stack and the crop/layer math are tested with plain Vitest.
- A feature cut before deployment means deleting one folder.

**Negative**
- Some indirection: a tool touches `core/<tool>`, `features/<tool>` and sometimes `render/`.

**Neutral**
- Moving to full ports and adapters later is a refactor of `infra/` only.

## Links

- Map: [[../architecture-map.md]] §Module inventory, §Conventions
- Related ADR: [[0001-build-a-client-only-vue-pwa]], [[0004-render-adjustments-on-webgl2-and-drawing-on-canvas2d]]
