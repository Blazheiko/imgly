---
id: T10
title: "Add the notice queue and the shared UI primitives Spinner, Toast, ToastStack, Dialog and CanvasMessage"
layer: "ui"
deps: []
blocks: ["T12", "T13", "T16", "T17"]
acs: ["AC-11b"]
files_hint: ["src/shared/notices/", "src/shared/ui/", "docs/design-system.md"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 49 inlined lines
status: "done"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T10 — Add the notice queue and the shared UI primitives Spinner, Toast, ToastStack, Dialog and CanvasMessage

## Place in the sequence

- **Blocked by:** nothing — can start immediately.
- **Blocks:** T12 — Add drop sequencing, the messages catalog and the notices raised by each open, T13 — Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary, T16 — Build SCR-03, the replace confirmation dialog, on the store's confirming phase, T17 — Add the start-up capability gate and the blocking screens SCR-04, SCR-05 plus SCR-02's restoring state.
- **Wave:** 1 — no deps, starts in the first wave.
- **Lane:** own lane.

## Why (user story)

> **US-04: Understand why an image won't open**
>
> **As a** Editor  
> **I want** a plain-language reason whenever a file can't be opened or opens differently from how I expect  
> **So that** I know what to do next instead of facing an empty canvas
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

It gives every screen one notice boundary where informational notices dismiss themselves and failures stay, plus the modal and full-canvas message primitives the screens need.

## Inlined context

> **Hard rule:** Every `AppError` code maps to exactly one plain-language message in one catalog, `src/features/editor/messages.ts`; no raw browser error text ever reaches the Editor. Notices go through one queue in `src/shared/notices/`: informational ones (downscale, first frame only, files ignored) dismiss themselves, failure reasons stay until dismissed, and all notices of one open are shown together without hiding each other (AC-11b). Blocking conditions (SCR-04, SCR-05) replace the canvas area instead of using a notice
>
> — `sad.md §8, User messages row, verbatim` · full text: [sad.md](../sad.md)

> **Errors:** one toast boundary (bottom-right, auto-dismiss except for errors) shows every `AppError` from `core`/`infra` […]. A blocking condition such as "WebGL2 unavailable" gets a full-canvas message instead of a toast.
> **Loading:** an indeterminate spinner overlay on the canvas while decoding, downscaling or exporting.
> **Keyboard:** every tool and action is reachable by keyboard. […] Focus is always visible through `--color-focus-ring`.
>
> — `design-system.md §Interaction & writing conventions, abridged` · full text: [design-system.md](../../../design-system.md)

> | `Spinner` (shared primitive) | The canon's loading convention is an indeterminate spinner overlay […] |
> | `Toast` (shared primitive) | One notice with `info` (dismisses itself) and `failure` (stays, with a dismiss button) variants. […] |
> | `ToastStack` (shared primitive) | The canon's single bottom-right notice boundary, bound to the `src/shared/notices/` queue. It stacks several notices without one hiding another (AC-11b) |
> | `Dialog` (shared primitive) | A modal with a focus trap, focus return, `Esc` and a backdrop for SCR-03. No modal exists yet |
> | `CanvasMessage` (shared primitive) | The canon's full-canvas message for blocking conditions (SCR-04, SCR-05): title, body and an optional action. […] |
>
> — `screens.md §New components, shared-primitive rows, abridged` · full text: [screens.md](../screens.md)

> For accessibility, `ToastStack` announces info notices politely and failure reasons assertively (`role="alert"`). Every `Toast` has a dismiss button with a visible focus ring (`--color-focus-ring`).
>
> — `screens.md §Message catalog, closing paragraph, verbatim` · full text: [screens.md](../screens.md)

> **Shared primitives** go to `src/shared/ui/`, and `implement` registers each one in `docs/design-system.md` §Component inventory.
>
> — `screens.md §New components, abridged` · full text: [screens.md](../screens.md)

> **Fixed by this breakdown:** an informational notice dismisses itself after `6000 ms`.
>
> — `tasks/_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

> **Hard rule (reuse):** All tokens are CSS custom properties in one file. A component or screen never hard-codes a colour, spacing value or font inline. It references `var(--…)`.
>
> — `design-system.md §Token source, verbatim` · full text: [design-system.md](../../../design-system.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-11b — cross-context

> **Given** one open produces several notices (for example an animated image that is also downscaled, dropped together with other files)
> **When** the open finishes
> **Then** every notice is shown and none hides another. Informational notices (downscale, first frame only, files ignored) go away by themselves, and reasons an open failed stay until the Editor dismisses them
>
> — `spec.md §5, AC-11b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Notice queue as a Pinia setup store `useNotices`: `pushAll(notices)` adds every notice of one open in one step, `dismiss(id)`; `info` auto-dismisses after `INFO_NOTICE_MS = 6000`, `failure` stays — `src/shared/notices/`
- [ ] `Spinner.vue` — indeterminate, `role="status"` with a visually hidden label prop — `src/shared/ui/`
- [ ] `Toast.vue` (`info` | `failure`, dismiss button) and `ToastStack.vue` (bottom-right, bound to `useNotices`, polite live region for info, `role="alert"` for failures) — `src/shared/ui/`
- [ ] `Dialog.vue` — `role="alertdialog"`, backdrop, focus trap, initial-focus prop, `Esc` and backdrop click emit `cancel`, focus returns to the opener on close — `src/shared/ui/`
- [ ] `CanvasMessage.vue` — title, body, optional action slot, `role` prop (`status` | `alert`) — `src/shared/ui/`
- [ ] Register the five primitives in `docs/design-system.md` §Component inventory (source path + states)
- [ ] Vitest + `@vue/test-utils`: queue timing with fake timers, stacking, focus trap/return, `Esc` — co-located `*.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Three notices pushed by one open | all three visible at once, stacked, none replaced (AC-11b) |
| Info + failure together | info disappears after 6000 ms, failure stays until dismissed |
| Failure dismissed by keyboard | dismiss button is focusable with a visible ring |
| Dialog closed with `Esc` | emits `cancel`, focus returns to the opener |
| Tab past the last dialog button | focus wraps inside the dialog |

## Definition of Done

- [ ] Vitest proves info auto-dismiss at 6000 ms, failures persisting, stacking without replacement, Dialog focus trap/return/`Esc`
- [ ] The five primitives are listed in `docs/design-system.md` §Component inventory
- [ ] every Hard Rule inlined above still holds (tokens only); lint + typecheck clean
