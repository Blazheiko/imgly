---
id: T2
title: "Widen useNotices and Toast: kind 'lasting', a replacing slot, a keep-open action and a busy action"
layer: "ui"
deps: []
blocks: ["T8"]
acs: ["AC-06", "AC-10", "AC-14"]
files_hint: ["src/shared/notices/store.ts", "src/shared/notices/notices.test.ts", "src/shared/ui/Toast.vue", "src/shared/ui/ToastStack.vue", "src/shared/ui/primitives.test.ts", "docs/design-system.md"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 50 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T2 — Widen useNotices and Toast: kind 'lasting', a replacing slot, a keep-open action and a busy action

## Place in the sequence

- **Blocked by:** — · **Blocks:** T8 — Add the pwa-install-update feature store's update lifecycle · **Wave:** 1, a shared primitive with no feature dependencies.
- **Lane:** own lane.

## Why (user story)

> **As an** Editor
> **I want** to be told when a new version is available and pick the moment to switch to it
> **So that** an update never reloads the page under me
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task gives the shared notice boundary the lasting, slotted notice that the update notice needs.

## Inlined context

> Cross-feature change: the update notice must stay until the Editor acts on it, and stay after a refused or cancelled "Reload" (AC-06, AC-10, AC-12, AC-13). Today an information notice closes itself after six seconds and its action always closes it (`docs/design-system.md`, Toast and ToastStack), so the shared notice primitive gains a lasting notice whose action can leave it open, and the design system records it.
>
> — `spec.md §1, traceability bullet 4, verbatim` · full text: [spec.md](../spec.md)

> `NoticeKind` gains `'lasting'` (the `info` look, no timeout), `NoticeInput` gains `slot?: string` (a push into an occupied slot replaces that notice in place, keeping its id's position), `action.run` may return `'keep-open'`, and `action.busy?: boolean` renders the action as an `aria-disabled` `BaseButton` with a `Spinner` and its busy label. Existing callers keep their behaviour.
>
> The `lasting` look is the `info` look (a `--color-accent` left border, `role="status"`, polite). It differs only in that it never times out.
>
> — `screens.md §New components, Toast row + §SCR-05 note, abridged` · full text: [screens.md](../screens.md)

> | `Tab` | Update notice | Reaches "Reload", then the notice's Dismiss, in the order of `ToastStack` | AC-06 |
> | `Enter` / `Space` | "Reload" | Runs the Reload checks. Focus stays on "Reload" when the reload is refused or while it waits for a save | AC-07, AC-10, AC-11, AC-13 |
>
> A newer wording replaces it **in place** (same slot, same position), so the stack doesn't jump.
>
> — `screens.md §Keyboard + §Shell changes (Notices), abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** `src/shared/` may import `core` (types) only — never `features`, `infra`, `render`. Every colour, spacing value and font comes from `var(--…)` in `tokens.css`. Register any new or widened primitive in `docs/design-system.md`.
>
> — `CLAUDE.md §Module boundaries + §Conventions, abridged`

> Widening the shared notice primitive touches every feature that pushes notices — Low — The change is additive (`info` and `failure` unchanged), covered by the existing `primitives.test.ts` plus new cases, and recorded in `docs/design-system.md`.
>
> — `sad.md §11, risk row 7, verbatim` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) §SCR-05, §New components and [sad.md](../sad.md) §5 tactical decisions, and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. The widened TypeScript surface of `useNotices` (`NoticeKind`, `NoticeInput.slot`, `action.run(): void | 'keep-open'`, `action.busy`, `action.busyLabel`) is the contract T8–T9 consume.

## Acceptance criteria

### AC-06 — happy path

> **Given** the app is open, in a tab or as the Installed app, and a newer version has been published
> **When** the browser has finished downloading the App update
> **Then** a notice says that a new version of imgly is available and offers "Reload". The notice does not disappear by itself, the app keeps running its current version, and editing, Autosave and Export work as before
>
> — `spec.md §5, AC-06, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — domain invariant

> **Given** the update notice is shown and a tool is open with its Draft
> **When** the Editor chooses "Reload"
> **Then** the app does not reload and says "Apply or cancel the open tool first." The update notice stays, so the Editor can choose "Reload" again after closing the tool
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context (the slot part only)

> **Then** … A window shows at most one update notice at a time, and the newest replaces the one before.
>
> — `spec.md §5, AC-14, abridged` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `NoticeKind = 'info' | 'failure' | 'lasting'`; `NoticeInput` gains `slot?: string`; `action` gains `run(): void | 'keep-open'`, `busy?: boolean`, `busyLabel?: string` — `src/shared/notices/store.ts`.
- [ ] `pushAll`: a notice with a `slot` already occupied replaces that item **at the same index** (new text/action, same position); `lasting` never schedules a timeout. Add an `update(id, patch)` (or equivalent) so the caller can flip `busy` without re-pushing — `store.ts`.
- [ ] `Toast.vue`: `lasting` renders like `info` (`role="status"`, accent border); clicking the action calls `run()` and emits `dismiss` **unless** it returned `'keep-open'`; `busy` renders an `aria-disabled` ghost `BaseButton` with `Spinner` and `busyLabel`, and clicks are ignored while busy; focus stays on the action after keep-open.
- [ ] `ToastStack.vue` passes the new fields through.
- [ ] Tests: lasting never auto-dismisses (fake timers past 6000 ms); slot replace keeps index and count; keep-open; busy is `aria-disabled` and inert; existing `info`/`failure` cases unchanged — `notices.test.ts`, `primitives.test.ts`.
- [ ] Update the Toast and ToastStack rows in `docs/design-system.md` §Component inventory.

## Edge cases

| Case | Behaviour |
|---|---|
| Push into a slot whose notice was dismissed | Appended as a new notice (the slot is free) |
| Two notices with the same slot in one `pushAll` | The later one wins; only one item with that slot exists afterwards |
| `run()` returns `undefined` | Old behaviour: the notice is dismissed |
| `info` / `failure` with a `slot` | Slot replacement applies to any kind; timeouts follow the kind of the new notice |
| Replaced `info` notice's pending timeout | Must not dismiss the replacement (timeout keyed to the old id is a no-op) |

## Definition of Done

- [ ] New and existing cases in `notices.test.ts` and `primitives.test.ts` pass; no existing caller changed.
- [ ] `docs/design-system.md` Toast / ToastStack rows describe `lasting`, `slot`, keep-open and busy.
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
