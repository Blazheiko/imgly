# Changelog — ui-refresh

## ui-refresh — imgly looks like one branded product, and every action carries an icon

**What:** The app's behaviour is unchanged, but it looks finished now.

- **Brand.** The top bar opens with the imgly mark (two crop corners and an accent dot) and the
  name "imgly". The browser tab, the Installed app's icon and the home-screen icon show the same
  mark on the brand colour. The generic picture symbol is gone from all four places.
- **One icon on every action.** Every action button carries an icon from one set, drawn in one
  style and size. This covers the top bar, the Gallery and its cards, notices, tool panels, the
  export panel, confirmation dialogs and full-screen messages. The top bar has four groups split
  by thin dividers: Gallery and Open image; Undo and Redo; Crop and rotate, Adjust and Draw;
  Install app and Export. Export is last. Buttons keep their names, shortcuts, enabled rules and
  keyboard order. The one change is that Install app now comes before Export. Icons are not
  announced, and every icon-only button has a tooltip naming its action.
- **Start screen.** A large drop area with an image icon, a heading, a prominent **Open image**
  button and a drop hint. Its edges line up with the Gallery below. It lights up while a file is
  dragged over the window, and the light goes off when an unsupported file is refused.
- **Gallery.** Each Work is a raised card with rounded corners. The whole image shows on a blurred
  copy of itself, so nothing is cropped and there are no empty bars. Pointing at a card lifts it
  by 2 px and shows its Delete as a bin icon. On touch screens and under keyboard focus, Delete is
  always visible. The open Work shows an "Open" badge, and its Delete looks unavailable. The
  header shows "N of 20 places used" with a thin bar. The Storage line is a highlighted note with
  an information icon. The Delete confirmation's button is red with a bin icon, and Cancel keeps
  the initial focus.
- **Window colour.** In the Installed app the title bar takes the top bar's colour: deep indigo
  in the dark theme, pale lavender in the light theme. It follows the system theme as it changes.
- **Readable and calm.** Text meets 4.5:1 contrast in both themes, including white text on the
  gradient primary button. Disabled actions look neutral, not washed out. With reduced motion
  requested, nothing lifts, zooms or slides.

**Why:** Every editing step, the Gallery and installation had shipped, but the app still looked
like a scaffold. It had a plain-text "imgly", a generic icon, buttons with and without icons, bare
Gallery thumbnails, and a dark title bar above a light app. A Portfolio reviewer couldn't tell
whose app it was ([spec](../spec.md) §1–§2). This is roadmap step 11. Key decisions:

- Icons are Lucide path data copied into a typed registry in `src/shared/icons/` and rendered by
  one `Icon` primitive. No icon package is downloaded at runtime, and the Lucide licence ships
  next to the registry
  ([ADR-0001](../adr/0001-copy-lucide-paths-into-a-typed-shared-icon-registry-rendered-by-an-icon-primitive.md)).
- The window colour is declared by two `theme-color` tags scoped by `prefers-color-scheme`. They
  match a new `--color-titlebar` token, and one unit test keeps `index.html`, the manifest and
  `tokens.css` equal
  ([ADR-0002](../adr/0002-declare-the-window-colour-with-two-media-scoped-theme-color-tags-matching-a-titlebar-token.md)).
- `BaseButton` and `Toast` gain an optional icon, size, busy state and `danger` variant. No new
  button primitives were added
  ([ADR-0003](../adr/0003-extend-basebutton-and-toast-with-optional-icon-size-and-danger-instead-of-new-button-primitives.md)).

**How to use:** Nothing new to learn. Open the app in a tab or as an Installed app, in either
theme. To see the window colour, install the app in Chrome or Edge and switch the system theme
while it is open. To regenerate the PNG icons from the mark, run `pnpm icons`.

**Operational notes:**

- Migration: none. No IndexedDB step, and the schema stays at v2.
- Feature flag / config: none.
  - `index.html` now has two `theme-color` tags.
  - The manifest's `theme_color` and `background_color` change from `#16181d` to `#15122A`.
  - `favicon.svg` is new, and the PNG icons in `public/icons/` were re-rendered. The existing
    precache pattern already covers them.
- Installed copies: an Installed app picks up the new icon and manifest colours when the browser
  next refreshes the manifest. That can take a while, and on some systems it needs a reinstall.
  The title bar colour changes as soon as the new page loads.
- Bundle: the main JS and CSS grew by 4.1 KB gzip (target ≤ 15 KB). There are no new runtime
  packages. `@axe-core/playwright` is a dev dependency for the contrast e2e.
- Rollback: revert the merge and redeploy GitHub Pages. No stored data changes either way.
- Cross-feature changes, made on purpose:
  - pwa-install-update's top-bar order now puts Install app before Export. Its app-shell unit
    test and install e2e were updated.
  - The shared Toast's Dismiss is now a `BaseButton`, and its busy action uses `BaseButton busy`.
  - The Delete dialog's confirm uses `danger`.
  - The pins these changes touch are listed in spec §6 and sad §10 QG-2.
- Review: two rounds on 2026-10-17. The first returned R1–R12. The fixes became tasks T16–T22, and
  the re-review returned **PASS** (`_review/review-2026-10-17.md`). R11 is handled at merge. The
  commits' `SDD-Task` / `SDD-AC` lines sit apart from `Co-Authored-By`, so git can't parse them as
  trailers. Squash-merging with [`squash-message.txt`](squash-message.txt) gives one parseable
  trailer block.
- Known follow-ups:
  - The spec §7 KPI baseline ("action buttons with an icon" on main) is still TBD.
  - Drawing into the title bar area (Window Controls Overlay) stays a future option
    (design-proposal §10).

**Acceptance criteria delivered:** AC-01 – AC-15:

- One brand mark in the top bar, the tab, the Installed app's icon and the home-screen icon
  (AC-01).
- An icon on every action button. The top bar has four groups with Export last. Names, tooltips
  and keyboard order are kept, and Install app hides without leaving a gap (AC-02, AC-03, AC-15).
- A start-screen drop area aligned with the Gallery. It is highlighted while dragging, and that
  ends when a file is refused (AC-04, AC-05).
- Raised Work cards with uncropped, blurred-backdrop thumbnails. Delete shows on hover, on focus
  and on touch screens. The open Work can't be deleted, the Damaged state is kept, and the header
  has a places meter and the Storage note (AC-06 – AC-10).
- The title bar and the top bar are one strip in both themes (AC-11).
- A destructive Delete confirmation that keeps Cancel focused (AC-12).
- Contrast, a visible focus mark, neutral disabled controls and reduced motion are respected
  (AC-13, AC-14).
