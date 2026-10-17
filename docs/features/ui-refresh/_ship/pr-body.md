## Summary

imgly now looks like one branded product. The imgly mark appears in the top bar, the tab, the
Installed app's icon and the home-screen icon. Every action button carries an icon from one set.
The start screen gets a large drop area lined up with the Gallery, and the Gallery shows each Work
as a raised card with an uncropped, blurred-backdrop thumbnail. In the Installed app, the title bar
takes the top bar's colour in both themes. Behaviour is unchanged, except that Install app now
comes before Export. This is roadmap step 11. See the [spec](docs/features/ui-refresh/spec.md) and
the [changelog](docs/features/ui-refresh/_ship/changelog.md).

## Acceptance criteria

- AC-01: the same mark in the top bar, the tab, the Installed app's icon and the home-screen icon, with no generic picture symbol left ✓
- AC-02: every action button has an icon from one set. The top bar has four groups split by dividers, with Export last ✓
- AC-03: names are unchanged and icons aren't announced. Icon-only buttons have tooltips, and keyboard order is unchanged except Install app before Export ✓
- AC-04: the start-screen drop area has an icon, heading, Open image and hint. Its edges line up with the Gallery, it adds no tab stop, and it is highlighted while dragging ✓
- AC-05: dropping an unsupported file ends the highlight, opens nothing and gives the same reason as before ✓
- AC-06: raised, same-shape cards with the whole image on a blurred backdrop. Hover lifts a card ≤ 4 px and shows Delete, and Delete is always visible on touch screens ✓
- AC-07: choosing a card or pressing Enter reopens the Work. Delete is visible whenever focus is in the card ✓
- AC-08: the open Work's Delete looks unavailable and refuses with the same reason ✓
- AC-09: the header shows "N of 20 places used" with a bar. A Damaged Work counts and shows a damaged symbol and border ✓
- AC-10: the Storage line is a highlighted note with an information icon and the same wording ✓
- AC-11: the Installed app's title bar matches the top bar, deep indigo in dark and pale lavender in light ✓
- AC-12: the Delete confirmation's button is destructive (danger and a bin icon), and Cancel keeps the initial focus ✓
- AC-13: contrast is ≥ 4.5:1 for text and ≥ 3:1 for icons and focus in both themes. Disabled controls look neutral ✓
- AC-14: under reduced motion nothing lifts, zooms or slides ✓
- AC-15: no Install app action when the browser doesn't offer it, and no empty space or extra divider ✓

## Design

- Spec: `docs/features/ui-refresh/spec.md`
- Architecture: `docs/features/ui-refresh/sad.md`
- Decisions: `docs/features/ui-refresh/adr/`
  - [ADR-0001](docs/features/ui-refresh/adr/0001-copy-lucide-paths-into-a-typed-shared-icon-registry-rendered-by-an-icon-primitive.md): Lucide paths are copied into a typed registry and rendered by an `Icon` primitive. Nothing is downloaded at runtime
  - [ADR-0002](docs/features/ui-refresh/adr/0002-declare-the-window-colour-with-two-media-scoped-theme-color-tags-matching-a-titlebar-token.md): two media-scoped `theme-color` tags match a `--color-titlebar` token
  - [ADR-0003](docs/features/ui-refresh/adr/0003-extend-basebutton-and-toast-with-optional-icon-size-and-danger-instead-of-new-button-primitives.md): `BaseButton` and `Toast` are extended (icon, size, busy, danger) instead of adding new button primitives
- UX: `docs/features/ui-refresh/ux-flows.md`, `docs/features/ui-refresh/screens.md` and `docs/features/ui-refresh/design-proposal.md`
- Design system: `docs/design-system.md` adds tokens v2 and the Icon, AppLogo and widened BaseButton and Toast rows
- Data model and migration: none (no IndexedDB step)
- API: none (client-only)

## Tasks

The task ids come from `docs/features/ui-refresh/tasks/tracker.md`. The branch's commits carry
`SDD-Task` / `SDD-AC` lines, but a blank line before `Co-Authored-By` keeps git from parsing them as
trailers (review R11). **Please squash-merge** with
[`docs/features/ui-refresh/_ship/squash-message.txt`](docs/features/ui-refresh/_ship/squash-message.txt).
Its single trailer block lists T1–T22 and AC-01–AC-15.

| Task | Commit | Subject |
|---|---|---|
| T1 | 424196d | feat(ui-refresh): tokens v2 — brand, titlebar, semantic colours, sizes, motion |
| T2 | 8b0edd6 | feat(ui-refresh): typed Lucide icon registry and the Icon primitive |
| T3 | bfa0203 | feat(ui-refresh): widen BaseButton with icon, size, busy and danger |
| T5 | 0e9f59e | feat(ui-refresh): AppLogo and brand icons from the approved mark |
| T4 | e6ad417 | feat(ui-refresh): icons on notice actions and Dismiss |
| T6 | ebd9e03 | feat(ui-refresh): window colour per system theme matches the titlebar token |
| T3 | e73cbec | fix(ui-refresh): BaseButton animates only on hover and press |
| T7 | 9563b23 | feat(ui-refresh): top bar with the brand mark and four action groups |
| T8 | 60f1c57 | feat(ui-refresh): registry icons on every top-bar action |
| T9 | c0638b8 | feat(ui-refresh): icons on the tool panels' actions |
| T10 | cd0487c | feat(ui-refresh): icons on the export panel, dialogs, zoom bar and Reload page |
| T11 | a27a03d | feat(ui-refresh): start-screen drop area lined up with the Gallery |
| T12 | 0f29349 | feat(ui-refresh): Gallery header meter, Storage note and destructive delete |
| T13 | 178d917 | feat(ui-refresh): premium Work cards in the Gallery |
| T15 | bbc0096 | docs(ui-refresh): record tokens v2, Icon, AppLogo and the widened primitives |
| T14 | 4ec282c | test(ui-refresh): e2e for contrast, reduced motion, brand and top bar |
| T16 | 554f2e8 | fix(ui-refresh): card Delete shows on touch screens and is icon-only |
| T17 | ad1f681 | refactor(ui-refresh): notice Dismiss is BaseButton ghost sm icon-only |
| T18 | f77eb7d | refactor(ui-refresh): both Export buttons use BaseButton busy |
| T19 | 5881a3d | test(ui-refresh): measure the gradient-backed primary text for contrast |
| T20 | 946206b | test(ui-refresh): a refused drop ends the drop area's highlight |
| T21 | b98f946 | test(ui-refresh): drop area lines up with the Gallery; app icons are the mark |
| T22 | daa42e1 | docs(ui-refresh): patch spec, sad and screens for the review's drift |
| T17, T18, T21 | e8bf1ac | refactor(ui-refresh): notice busy action uses BaseButton busy; tests keep QG-2 |

## Verification

Verified at `bae97d5` on 2026-10-17 (Apple M1 Pro, latest Playwright browsers).

- Unit: `pnpm test` passes 2735 of 2735 (128 files).
- Lint and vet: `pnpm lint` and `pnpm typecheck` are clean.
- Build: `pnpm build` is clean. Main JS and CSS gzip grows by 4.1 KB over `origin/main` (95.3 KB vs 91.2 KB; the target is ≤ 15 KB). There are no new runtime packages, and `@axe-core/playwright` is a dev dependency.
- e2e: `pnpm test:e2e` on Chromium, Firefox and WebKit has 1158 passing, 42 skipped and 0 failing (10.1 min, exit 0), including every `e2e/ui-refresh` spec and the updated install pin. The skips are conditional: `@perf` without `PERF=1`, WebKit offline by design, and the earlier features' engine-specific skips.
- Ran the feature: the production `dist/` was served with `vite preview` and driven in Chromium in both themes. Observed:
  - AC-01: the top bar starts with the SVG mark and "imgly". The tab icon is `/imgly/icons/favicon.svg`, and the manifest icons are the re-rendered `icon-192/512` and maskable PNGs.
  - AC-02 / AC-15: the top bar's DOM order with a Work open is Gallery, Open image | Undo, Redo | Crop and rotate, Adjust, Draw | Export. Every button has an `aria-hidden` icon. Chromium headless offers no install, so there is no Install app and no extra divider.
  - AC-04: the drop area and the Gallery both span x = 112–1168 px at 1280 px wide.
  - AC-05: dropping `notes.txt` sets `empty-canvas--highlighted` while dragging and clears it after the drop. No Work opens, and the notice reads "Only image files can be opened."
  - AC-06: an idle card's Delete has opacity 0, and on hover it has opacity 1 and the card lifts by `translateY(-2px)`. Thumbnails use `object-fit: contain`.
  - AC-08: the open Work's Delete is `aria-disabled`. Clicking it gives "The open Work can't be deleted. Open another image first." and both cards stay.
  - AC-09: the header reads "2 of 20 places used".
  - AC-11: the top bar is `rgb(244, 242, 255)` in light and `rgb(21, 18, 42)` in dark. The matching `theme-color` tag (`#F4F2FF` or `#15122A`) is the one whose media query matches.
  - AC-12: the confirmation's focus is on Cancel, and the confirm is `base-button--danger`. Confirming leaves one card.
  - Not checked by hand: a real Installed-app title bar (it needs an install on a desktop OS). AC-11 rests on the meta tags above, the ADR-0002 unit test and the e2e.

## Operational notes

- Migration: none.
- Feature flag / config: none. The manifest's `theme_color` and `background_color` change to `#15122A`, and the app icons were re-rendered. Already Installed copies pick up the new icon when the browser refreshes the manifest, and some systems need a reinstall.
- Rollback: revert the merge and redeploy GitHub Pages. No stored data changes.
- Cross-feature pins, changed on purpose (spec §6, sad QG-2):
  - pwa-install-update's top-bar order, with Install app before Export
  - Toast Dismiss and busy as `BaseButton`
  - the Delete dialog's confirm as `danger`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
