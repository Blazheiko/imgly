---
id: T4
title: "Give notices icons: NoticeAction.icon replaced by the Spinner while busy, icon-only Dismiss, edge-coloured Toast; set icons on Delete… and Reload"
layer: "ui"
deps: ["T3"]
blocks: ["T14", "T15"]
acs: ["AC-02", "AC-03"]
files_hint: ["src/shared/notices/store.ts", "src/shared/notices/notices.test.ts", "src/shared/ui/Toast.vue", "src/shared/ui/primitives.test.ts", "src/features/gallery/store.ts", "src/features/pwa-install-update/store.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 42 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Give notices icons

## Place in the sequence

- **Blocked by:** T3 — BaseButton · **Blocks:** T14 — e2e checks, T15 — design-system record · **Wave:** 3, in parallel with T7–T12.
- **Lane:** own lane (the two feature stores are touched by no other task).

## Why (user story)

> **As an** Editor
> **I want** every action button to carry an icon in one consistent style
> **So that** I find the action I need quickly and the top bar reads as one toolbar
>
> — `spec.md §4, US-02, verbatim` · full text: [spec.md](../spec.md)

This task covers the notices' action and Dismiss buttons.

## Inlined context

> Cross-feature change: the notice's action and Dismiss buttons gain icons, so the shared notice element, whose action label is text only today, changes too; while a notice's action is busy, its spinner takes the icon's place, so the action still shows one symbol.
>
> — `spec.md §1, Traceability bullet 4, verbatim` · full text: [spec.md](../spec.md)

> The shared `Toast` in `ToastStack`, bottom-right as today, with its kinds, wording, roles, timing and slots unchanged. The look: `--color-surface-raised`, `--radius-lg`, `--shadow-md`, a 1 px `--color-border-subtle` border whose 3 px left edge (as today) is `--color-accent-text` (`info`, `lasting`) or `--color-danger` (`failure`). The optional action is `BaseButton` ghost `sm` with its icon and label, then Dismiss is `BaseButton` ghost `sm` icon-only `x` (`aria-label="Dismiss"`, `title="Dismiss"`).
>
> | with action | The damaged-Work notice's "Delete…" (`trash-2`), or the update notice's "Reload" (`refresh-cw`, pwa SCR-05 `lasting`) |
> | action busy | The update notice's action while waiting or reloading (pwa SCR-05). It reads "Reloading…", and a `Spinner` takes the icon's place, so there is still one symbol. It stays `aria-disabled` and focusable |
> | reduced motion | Notices appear and go with no slide (AC-14) |
>
> Notices gain icons on their action and Dismiss buttons only. No leading icon marks a notice's kind, because no AC asks for one.
>
> — `screens.md §SCR-06 + §Source Decisions, abridged` · full text: [screens.md](../screens.md)

Today: `NoticeAction { label; run; busy?; busyLabel? }` in `src/shared/notices/store.ts`; `Toast.vue:26` renders the action as a ghost `BaseButton` with a busy `Spinner`; `Toast.vue:42` is a native button "×" with `aria-label="Dismiss"`. Producers: `src/features/gallery/store.ts:207` (`damagedNoticeAction()`), `src/features/pwa-install-update/store.ts:94` (`action()`).

> **Hard rule:** notice wording, roles, timing and `aria-label`s unchanged; existing notices tests pass unedited.
>
> — `spec.md §6, NFR row «Accessible names», abridged` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read [screens.md](../screens.md) SCR-06 and [ADR-0003](../adr/0003-extend-basebutton-and-toast-with-optional-icon-size-and-danger-instead-of-new-button-primitives.md). Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. `NoticeAction` gains optional `icon?: IconName` (additive).

## Acceptance criteria

### AC-02 — happy path

> **Given** the Editor is on any screen of the app
> **When** they look at any action button, that is, any button that performs an action anywhere in the app: the top bar, the Gallery and its cards, the notices (Dismiss, Reload, "Delete…"), every tool panel (such as Apply, Cancel, Auto, Compare and Clear), the export panel, every confirmation dialog (both its cancel and its confirming button) and the full-screen messages (such as "Reload page"); choice controls such as a colour swatch, a format option or a proportion option are not action buttons
> **Then** each one shows an icon from one set drawn in one style and size, and the top bar shows, left to right and in the same keyboard order, four groups separated by thin dividers: Gallery and Open image; Undo and Redo; Crop and rotate, Adjust and Draw; Install app and Export, with Export last
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-03 — domain invariant

> **Given** an action button shows an icon; only Undo, Redo, a card's Delete and the buttons that already have no visible label today (Rotate left, Rotate right, Flip horizontal and Flip vertical in Crop and rotate, and Zoom out and Zoom in, whose "−" and "+" become icons) show an icon without a visible label, and every other action button shows its icon next to its label (patched by `screens` on 2026-10-16)
> **When** a screen reader or the keyboard reaches the button
> **Then** the button is announced by the same name as before this feature, the icon itself is not announced, each icon-only button has a tooltip naming its action (Undo and Redo also name their shortcut), and the keyboard order of the top bar is unchanged except that Install app now comes before Export
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `icon?: IconName` to `NoticeAction` — `src/shared/notices/store.ts`
- [ ] Toast: action `BaseButton` ghost `sm` with `:icon` and `:busy`; Dismiss `BaseButton` ghost `sm` `icon="x"` with `aria-label="Dismiss"` `title="Dismiss"`; edge-coloured look from tokens; slide duration from motion tokens — `src/shared/ui/Toast.vue`
- [ ] `icon: 'trash-2'` on the damaged notice's "Delete…" — `src/features/gallery/store.ts`
- [ ] `icon: 'refresh-cw'` on the update notice's "Reload" — `src/features/pwa-install-update/store.ts`
- [ ] Tests (added cases only): action shows its icon; busy action shows a Spinner and no icon; Dismiss is named "Dismiss", has `title`, shows the `x` svg — `src/shared/ui/primitives.test.ts`, `src/shared/notices/notices.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Action without `icon` | Renders label only, as before |
| Busy action | Label = `busyLabel`, Spinner in the icon's place, `aria-disabled`, focusable |
| `failure` kind | Left edge `--color-danger` |

## Definition of Done

- [ ] Added Vitest cases prove icon, busy-spinner swap and the icon-only Dismiss with its unchanged name
- [ ] Existing notices and Toast tests pass unedited
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
