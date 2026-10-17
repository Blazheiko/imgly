---
id: T14
title: "Add ui-refresh e2e: contrast and focus check in both themes, reduced-motion, top-bar order, brand icons and theme-color tags"
layer: "tests"
deps: ["T4", "T6", "T7", "T8", "T9", "T10", "T11", "T13"]
blocks: []
acs: ["AC-01", "AC-02", "AC-11", "AC-13", "AC-14", "AC-15"]
files_hint: ["e2e/ui-refresh/", "package.json", "pnpm-lock.yaml"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 64 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T14 — Add the ui-refresh e2e checks

## Place in the sequence

- **Blocked by:** T4, T6, T7, T8, T9, T10, T11, T13 (every visible change) · **Blocks:** — · **Wave:** 5, last.
- **Lane:** own lane.

## Why (user story)

> **As an** Editor
> **I want** the restyled interface to keep visible focus, readable contrast and calm motion
> **So that** the new look does not make the app harder to use
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

This task verifies in real browsers what happy-dom can't: computed contrast, reduced motion, the head tags and the rendered top bar.

## Inlined context

> | Text contrast against its background | ≥ 4.5:1 for all text except the labels of disabled controls, in both themes and on the top bar | automated accessibility check of the start screen, the Gallery, each tool panel and the export panel, in both themes |
> | Icons, control borders and the focus mark against their background | ≥ 3:1 in both themes | the same automated check, plus a manual check of the focus mark |
> | Accessible names and keyboard order of existing actions | 100% unchanged, except that Install app now comes before Export in the top bar | the full unit and end-to-end suites on Chromium, Firefox and WebKit |
> | Hover and open motion | ≤ 200 ms per transition; 0 ms of movement when reduced motion is requested | unit test of the motion values; e2e with reduced motion emulated |
>
> — `spec.md §6, NFR rows 1–3 and 6, verbatim` · full text: [spec.md](../spec.md)

> **QG-1 How verify:** an automated accessibility check run by Playwright over those screens in both themes; a manual check of the focus mark; a unit test that the motion tokens resolve to 0 under reduced motion, plus an e2e run with reduced motion emulated.
> **QG-2 How verify:** a review of the diff over `src/**/*.test.ts` and `e2e/` shows no existing test case edited or deleted except those pins: `src/app/App.test.ts`'s Install-app order test, `e2e/pwa-install-update/install.spec.ts`'s top-bar order, `src/features/gallery/components/DeleteWorkDialog.test.ts`'s `.base-button--danger` selector, `src/features/gallery/components/GalleryList.test.ts`'s Delete-name case and `src/shared/ui/primitives.test.ts`'s no-action Toast case; added test files and added cases are allowed.
>
> — `sad.md §10, QG-1 + QG-2, abridged` · full text: [sad.md](../sad.md)

> e2e tests go in `e2e/<feature>/*.spec.ts` (fixtures in `e2e/fixtures/`), but only for what happy-dom can't do. `pnpm test:e2e` runs against `vite preview` of its own hooks-enabled build in `dist-e2e/`.
>
> — `CLAUDE.md §Commands + §Conventions, abridged`

No accessibility checker is installed today. `@axe-core/playwright` as a **devDependency** is allowed (spec §6 counts only packages downloaded at runtime). Use `page.emulateMedia({ colorScheme, reducedMotion })`. The Installed-app title bar itself can't be driven by Playwright: assert the two `theme-color` tags and that the top bar's computed background equals the matching tag; the window check stays manual (T6).

**Fallback:** insufficient or contradicted by the code → read [sad.md](../sad.md) §10 and the existing helpers in `e2e/harness.ts`, `e2e/fixtures/`. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-01 — happy path

> **Given** the app is open in a browser tab or as an Installed app, in either theme
> **When** the Portfolio reviewer looks at the top bar, the browser tab and the system's list of apps
> **Then** the top bar's left end shows the imgly mark followed by the name "imgly", the tab shows the same mark, and the Installed app's icon shows the same mark on the brand colour, with no generic picture symbol left in any of those four places (the top bar, the tab, the Installed app's icon and the icon used when the app is added to a home screen); an image icon inside the interface, such as on the drop area, is not a brand mark
>
> — `spec.md §5, AC-01, verbatim` · full text: [spec.md](../spec.md)

### AC-02 — happy path

> **Given** the Editor is on any screen of the app
> **When** they look at any action button, that is, any button that performs an action anywhere in the app: the top bar, the Gallery and its cards, the notices (Dismiss, Reload, "Delete…"), every tool panel (such as Apply, Cancel, Auto, Compare and Clear), the export panel, every confirmation dialog (both its cancel and its confirming button) and the full-screen messages (such as "Reload page"); choice controls such as a colour swatch, a format option or a proportion option are not action buttons
> **Then** each one shows an icon from one set drawn in one style and size, and the top bar shows, left to right and in the same keyboard order, four groups separated by thin dividers: Gallery and Open image; Undo and Redo; Crop and rotate, Adjust and Draw; Install app and Export, with Export last
>
> — `spec.md §5, AC-02, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — cross-context

> **Given** the Editor runs the Installed app in a Chromium-based desktop browser (in Safari's installed app the same holds as far as Safari allows)
> **When** the system's theme is dark, or is light, or changes between them while the app is open
> **Then** the window's title bar takes the top bar's brand-tinted colour for that theme, deep indigo in dark and pale lavender in light, and the top bar itself uses that same colour, so the title bar and the top bar read as one strip with no contrasting band between them; while the app is still starting, before the page has loaded, the window may show the dark colour
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

### AC-13 — domain invariant

> **Given** the restyled interface in either theme, including the brand-tinted top bar
> **When** the Editor reads any text or looks at any control and its focus
> **Then** every text and icon is readable against its background at the contrast stated in §6, keyboard focus is always visibly marked, and a disabled action such as Export with no image looks unavailable through a neutral background and muted text, never a pale, washed-out brand colour; disabled controls are exempt from the text contrast target, as in the accessibility guidelines
>
> — `spec.md §5, AC-13, verbatim` · full text: [spec.md](../spec.md)

### AC-14 — cross-context

> **Given** the system asks apps to reduce motion
> **When** the Editor points at a card or a button, or a panel opens
> **Then** nothing lifts, zooms or slides; only colours change, and every action still works as without the setting
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — authorization

> **Given** the Editor's browser does not offer to install the app, or the app already runs as an Installed app
> **When** the Editor looks at the restyled top bar
> **Then** no Install app action is shown, and no empty space or extra divider is left where it would be, so the top bar never offers an action that does nothing
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `@axe-core/playwright` as a devDependency — `package.json`
- [ ] `e2e/ui-refresh/accessibility.spec.ts`: axe `color-contrast` (+ wcag2aa) on the start screen, Gallery overlay, each tool panel and the export panel, for `colorScheme` dark and light
- [ ] `e2e/ui-refresh/motion.spec.ts`: with `reducedMotion: 'reduce'`, hovering a card leaves `transform: none`; transitions computed 0s
- [ ] `e2e/ui-refresh/brand-and-top-bar.spec.ts`: `link[rel=icon]` points at `favicon.svg`; two `theme-color` tags with the right media; top bar background equals the tag per scheme; top-bar button names left-to-right end "…, Export"; without an install offer no "Install app" and exactly 3 dividers with a Work open; every visible top-bar button has one `svg[aria-hidden]`

## Edge cases

| Case | Behaviour |
|---|---|
| Disabled control text below 4.5:1 | Exempt — exclude disabled elements from the contrast rule, not the whole page |
| WebKit / Firefox | Same specs run on all three projects; no project-specific skips without a written reason |
| Install offer can't be faked in a project | Assert the no-offer case there; the offer case is covered by the unit test in T7 |

## Definition of Done

- [ ] `pnpm test:e2e` passes on Chromium, Firefox and WebKit with the new specs and every existing spec unedited
- [ ] Manual focus-mark check recorded in the PR, plus the compressed `dist/` size delta vs `main` (≤ 15 KB, spec §6)
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
