---
id: T9
title: "Extend Toast and useNotices with an optional action and returned ids, add the --gallery-tile-size token, and register both in the design system"
layer: "ui"
deps: []
blocks: ["T11", "T15", "T16"]
acs: ["AC-08", "AC-11"]
files_hint: ["src/shared/notices/store.ts", "src/shared/notices/notices.test.ts", "src/shared/ui/Toast.vue", "src/shared/ui/ToastStack.vue", "src/shared/ui/primitives.test.ts", "src/shared/styles/tokens.css", "docs/design-system.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 44 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Extend Toast and useNotices with an optional action and returned ids, add the --gallery-tile-size token, and register both in the design system

## Place in the sequence

- **Blocked by:** — (none).
- **Blocks:** T11 — Compose autosave.ts (needs `pushAll` ids to withdraw the save-failed notice) · T15 — Add the gallery feature's store and messages (raises the damaged notice with its "Delete…" action) · T16 — Build GalleryEntry, GalleryList and DeleteWorkDialog (uses `--gallery-tile-size`).
- **Wave:** 1 — a shared primitive change with no upstream dependency, so it starts with the core and migration tasks.
- **Lane:** own lane.

## Why (user story)

> **As an** Editor
> **I want** the app to tell me plainly where my Works are kept, whether the browser may clear them, and when a Work was removed or could not be saved
> **So that** I export what I must not lose and am never surprised by a missing Work
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It gives the notice boundary the two abilities the Gallery's notices need: an action button ("Delete…") and a way to withdraw one notice by id.

## Inlined context

> | `Toast` (extended: `action`) + `useNotices` | AC-08 asks the damaged-Work notice to offer Delete, and `Toast` has only its text and dismiss button. An optional `action: { label, run }` on `NoticeInput` renders a `BaseButton` ghost before the dismiss button, and running it dismisses the notice. `pushAll` returns the new ids so the editor store can withdraw the save-failed notice (AC-11) through the existing `dismiss(id)`. A separate dialog would add a third blocking dialog against ux-flows | pending |
> | `--gallery-tile-size` token (160px) | The entry and thumbnail box width. Every size must come from `tokens.css`, and no existing token is 160px | pending (token source) |
>
> — `screens.md §New components, rows Toast + --gallery-tile-size, verbatim` · full text: [screens.md](../screens.md)

> **Notices** stay in `ToastStack` at the bottom right, above the overlay and under a `Dialog`'s backdrop. `Toast` gains an optional action (§New components).
>
> — `screens.md §Shell changes, Notices bullet, verbatim` · full text: [screens.md](../screens.md)

> **info** notices dismiss themselves after 6000 ms. **failure** notices stay until dismissed, except the save-failed one, which is also withdrawn when a save succeeds.
>
> — `screens.md §Message catalog, intro, abridged` · full text: [screens.md](../screens.md)

> | Notices | One `useNotices` boundary. […] The failed-save notice is a `failure` notice that stays until it is dismissed. It is raised once per run of failures and withdrawn when a save succeeds (AC-11). The damaged-Work notice offers Delete, […] A new primitive is registered in `docs/design-system.md` | `src/shared/notices/store.ts`, here |
>
> — `sad.md §8, Notices row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/shared/` — Design tokens, UI primitives (`src/shared/ui/`), `ids.ts` — May import: `core` (types) only — never `features`, `infra`, `render`. […] Every colour, spacing value and font comes from `var(--…)` in `src/shared/styles/tokens.css`. […] Reuse `src/shared/ui/` primitives, and register any new primitive in `docs/design-system.md`.
>
> — `CLAUDE.md §Module boundaries + §Conventions Styling, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. The shared TS surface this task adds for T11 and T15:

- `NoticeInput` gains `action?: { label: string; run: () => void }` (`screens.md` §New components, verbatim shape).
- `pushAll(notices: NoticeInput[]): string[]` — the new ids, in input order (`screens.md` §New components); `dismiss(id)` is unchanged.

## Acceptance criteria

### AC-08 (US-02) — error

> **Given** a Work in the Gallery can no longer be read back, because its stored data is damaged or incomplete
> **When** the Editor chooses it, or the Gallery tries to show its thumbnail
> **Then** the open Work stays exactly as it was. Listing the Gallery checks only what the entry shows (its thumbnail and details), and choosing a Work checks all of it. The entry is marked as damaged instead of failing silently, and choosing it shows a notice that names the Work, says it cannot be opened and offers to delete it. Every other Work in the Gallery lists, opens and deletes normally. A damaged Work still counts toward the 20 places and is the first to be evicted when room is needed, with the usual notice naming it
>
> — `spec.md §5, AC-08, verbatim` · full text: [spec.md](../spec.md)

### AC-11 (US-05) — error

> **Given** the Gallery was available when the page loaded, and an Autosave later fails for a reason other than full storage
> **When** the failure happens
> **Then** one notice says the Work could not be saved to the Gallery and to export it to keep a copy, and editing continues. The next Step, Undo or Redo tries again without a new notice. Once a save succeeds, the notice is withdrawn, and a later failure shows it again. While the latest applied state is not stored, replacing the Work follows AC-17
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `action?: { label; run }` to `NoticeInput`; make `pushAll` return the added ids — `src/shared/notices/store.ts`
- [ ] Render the action as a `BaseButton` ghost before the dismiss button; clicking it calls `run()` then emits `dismiss` — `src/shared/ui/Toast.vue`
- [ ] Pass `action` through from the notice item — `src/shared/ui/ToastStack.vue`
- [ ] Add `--gallery-tile-size: 160px` (one value; it is a size, so no dark-theme override) — `src/shared/styles/tokens.css`
- [ ] Tests: ids returned in order, `dismiss(id)` withdraws a `failure`, `info` still auto-dismisses at 6000 ms — `src/shared/notices/notices.test.ts`; Toast with/without action, action order, run + dismiss — `src/shared/ui/primitives.test.ts`
- [ ] Register the Toast `action` option and the token in `docs/design-system.md` §Component inventory (status from `pending` to registered)

## Edge cases

| Case | Behaviour |
|---|---|
| a notice with no `action` | renders exactly as today (text + dismiss) |
| `dismiss(id)` for an id already gone (auto-dismissed or dismissed by hand) | no-op, no error |
| `pushAll([])` | returns `[]`, adds nothing |
| the action is on an `info` notice that auto-dismisses | the timer still dismisses it; `run` is not called |
| action label text | rendered as text only, never as HTML |

## Definition of Done

- [ ] notices tests prove `pushAll` returns the new ids in order and `dismiss(id)` withdraws a failure notice
- [ ] primitives tests prove a Toast with an action renders a ghost `BaseButton` before dismiss, and running it calls `run` and dismisses the notice
- [ ] `tokens.css` has `--gallery-tile-size: 160px`; `docs/design-system.md` lists the Toast action and the token
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
