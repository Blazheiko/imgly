---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-16"
feature_size: "S"
---

# Spec — ui-refresh

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root; no new terms, since this feature changes how existing things look, not what they are)
> **Reference module / docs / channels used:** `docs/features/ui-refresh/design-proposal.md` (the agreed plan and decisions D1–D5), `docs/design-system.md` (token source, component inventory, conventions), `src/shared/styles/tokens.css`, `src/shared/ui/BaseButton.vue`, `src/features/editor/components/EditorTopBar.vue` and `EmptyCanvas.vue`, `src/features/gallery/components/GalleryEntry.vue` and `GalleryList.vue`, `index.html` and `vite.config.ts` (window colour and app icons), and a screenshot of the installed app's start screen taken on 2026-10-16. No other channels.

## 1. Context

Every editing step, the Gallery and the install and update experience have shipped, but the app still looks like a scaffold. The top bar shows the word "imgly" in plain text, and the installed app's icon is a generic picture-with-a-mountain symbol, so nothing tells a Portfolio reviewer whose app this is. Action buttons are inconsistent: Crop and rotate, Adjust, Draw, Undo and Redo carry an icon, while Open image, Gallery, Export, Install app, Delete and Close do not. The Gallery shows each Work as a bare thumbnail with two lines of text and a loose "Delete" word under it, and the start screen stacks a centred "Open image" button above a left-aligned Gallery with a large empty area below. In the Installed app, the window's title bar stays near-black even when the system uses the light theme, so a dark strip sits above a light app.

Why now: the roadmap's functional steps 2 to 9 are done, and the app is meant to be shown to Portfolio reviewers, whose first impression is the start screen and the top bar. Polishing the look before OS integration (step 10) means step 10's new actions are built in the new style from the start rather than restyled later.

Committed approach: **a brand identity and a premium, consistent interface, built on an extended design-token system rather than one-off styling.** The baseline idea, as captured: «Give imgly a recognisable brand and a premium, consistent UI: an app logo in the top bar, an icon on every action button, styled gallery controls and premium Work cards, and a PWA window title bar tinted with the brand colour, all built on an extended token-based design system.» The brand colour is Iris (#6D5BFF), with a gradient towards violet for the logo and the main call to action. The top bar and the Installed app's title bar share one brand-tinted colour per theme, a deep indigo in the dark theme and a pale lavender in the light theme, so they read as one strip. Icons come from one shared set drawn in one style. This approach was chosen at easy interview depth (2026-10-16), from the plan in `design-proposal.md`, whose decisions D1 to D5 the owner made explicitly; the rest comes from the accepted assumptions ledger. The ideation analyses did not run at that depth.

Traceability and deliberate compromises:

- Behaviour stays the same: every action keeps its name, shortcut, enabled and disabled rules, and place in the keyboard order. Only the look changes, and icons are decoration that assistive technology does not announce (AC-03, AC-13).
- Cross-feature change: the shared button gains an icon, three sizes and a "destructive" style, and the design system records it together with the new logo, icon, card and drop-zone elements (`docs/design-system.md`).
- Cross-feature change: the notice's action and Dismiss buttons gain icons, so the shared notice element, whose action label is text only today, changes too; while a notice's action is busy, its spinner takes the icon's place, so the action still shows one symbol (`docs/design-system.md`, Toast; AC-02).
- Decision override: size stays S although the plan's phases were sized M, S, S, M and the feature adds an icon set plus new options on the shared button — rationale: the icon set is the only new module, the button change only adds options and every existing use keeps working, there is no new interface and no stored-data change, and the work is four pull requests of about a week; re-run `sdd:classify-size` if `design` finds otherwise.
- Decision: drawing the app into the Installed app's title bar area, beside the window buttons, is deferred to a later step because only Chromium-based desktop browsers support it (design-proposal §10, D5).

## 2. Goals

- A Portfolio reviewer recognises imgly as one branded product: the same mark in the top bar, the browser tab and the Installed app's icon, in one brand colour.
- Every action is recognisable at a glance by a consistent icon, without losing its name, shortcut or keyboard access.
- The start screen and the Gallery look finished and premium: a clear place to open or drop an image, and each Work shown as a card that invites reopening.
- The Installed app's window and the app read as one surface in both the light and the dark theme.

## 3. Non-goals

- Drawing the app into the title bar area beside the window buttons. Only Chromium-based desktop browsers support it, so it is recorded as a future option (design-proposal §10).
- New behaviour or new actions. This feature restyles what exists; new capabilities belong to their own roadmap steps.
- A custom web font. The system font already reads well on the desktop target, and a downloaded font adds weight to every offline start.
- Mobile and touch layouts beyond "does not break". Desktop is the target (roadmap, Out of scope).
- A theme switch inside the app. The app follows the system's light or dark setting, as it does today.
- New information on the Work card, such as image size or format. The card shows the Work's name and when it was last touched, as today, so no new data has to be stored.

## 4. User stories

### US-01: Recognise the product

**As a** Portfolio reviewer
**I want** to see imgly's own logo in the top bar, the browser tab and the Installed app's icon
**So that** I immediately know which product I am looking at and that it was designed with care

### US-02: Understand actions at a glance

**As an** Editor
**I want** every action button to carry an icon in one consistent style
**So that** I find the action I need quickly and the top bar reads as one toolbar

### US-03: Start from a clear place to open an image

**As an** Editor
**I want** the start screen to offer one prominent place to open or drop an image
**So that** I know at once how to begin

### US-04: Browse my Works as cards

**As an** Editor
**I want** each Work in the Gallery shown as a card with its thumbnail, name, last-touched time and its own controls
**So that** I can find a Work and reopen or delete it confidently

### US-05: See the Gallery's state honestly

**As an** Editor
**I want** the Gallery to show how many of its places are used and which Works are open or damaged
**So that** I understand what is kept and what may be evicted

### US-06: One surface in the Installed app

**As an** Editor
**I want** the Installed app's title bar to match the top bar's colour in my system's theme
**So that** the window looks like one native-feeling app rather than a web page in a frame

### US-07: Recognise destructive actions

**As an** Editor
**I want** deleting a Work to look clearly destructive
**So that** I never delete a Work by mistake

### US-08: Use the new look with the keyboard and assistive technology

**As an** Editor
**I want** the restyled interface to keep visible focus, readable contrast and calm motion
**So that** the new look does not make the app harder to use

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** the app is open in a browser tab or as an Installed app, in either theme
**When** the Portfolio reviewer looks at the top bar, the browser tab and the system's list of apps
**Then** the top bar's left end shows the imgly mark followed by the name "imgly", the tab shows the same mark, and the Installed app's icon shows the same mark on the brand colour, with no generic picture symbol left anywhere

### AC-02 (US-02) — happy path

**Given** the Editor is on any screen of the app
**When** they look at any action button: Open image, Gallery, Close, Undo, Redo, Crop and rotate, Adjust, Draw, Export, Install app, Delete, Dismiss and Reload, and every tool panel's action buttons such as Apply, Cancel, Auto, Compare and Clear (choice controls such as a colour swatch or a format option are not action buttons)
**Then** each one shows an icon from one set drawn in one style and size, and the top bar groups its actions as Gallery, then Undo and Redo, then the three tools, then Install app and Export, separated by thin dividers

### AC-03 (US-02, US-08) — domain invariant

**Given** an action button shows an icon, including Undo and Redo, which show only an icon
**When** a screen reader or the keyboard reaches the button
**Then** the button is announced by the same name as before this feature, the icon itself is not announced, Undo and Redo still name their shortcut in their tooltip, and the keyboard order of the top bar is unchanged

### AC-04 (US-03) — happy path

**Given** no Work is open
**When** the Editor looks at the start screen
**Then** a large drop area shows an image icon, a short heading, a prominent "Open image" button and a hint that an image can be dropped anywhere in the window, laid out on the same grid as the Gallery below it

### AC-05 (US-03) — error

**Given** no Work is open and the Editor drags a file over the window
**When** they drop a file that is not a Supported image
**Then** the drop area's highlight ends, no Work opens, and the app names the reason in plain language exactly as it does today

### AC-06 (US-04) — happy path

**Given** the Gallery lists at least one Work
**When** the Editor looks at the Gallery
**Then** each Work is a raised card with rounded corners showing its thumbnail without empty bars around it, its name (shortened with an ellipsis when too long) and when it was last touched, and pointing at a card lifts it slightly and reveals its Delete control as an icon on the thumbnail; on a touch screen, where nothing can point, the Delete control is always visible

### AC-07 (US-04) — happy path

**Given** the Gallery lists a Work that is not open
**When** the Editor chooses the card, or moves keyboard focus onto it and presses Enter
**Then** the Work reopens exactly as it does today, and while the card has keyboard focus its Delete control is visible without pointing at it

### AC-08 (US-04, US-07) — domain invariant

**Given** the Gallery lists the Work that is open in this tab, marked with an "Open" badge
**When** the Editor tries to delete it from its card
**Then** the card's Delete control looks unavailable, the Work is not deleted, and the app tells the Editor that the open Work cannot be deleted, as it does today

### AC-09 (US-05) — domain invariant

**Given** the Gallery holds some Works, one of which is a Damaged Work
**When** the Editor looks at the Gallery's header and cards
**Then** the header shows how many of the 20 places are used as a count and a thin bar, the Damaged Work still counts toward those places, and its card shows a "damaged" symbol and border instead of a thumbnail

### AC-10 (US-05) — happy path

**Given** the Gallery is shown
**When** the Editor reads the Storage line
**Then** it appears as a highlighted note with an information icon and keeps its current wording, so the Editor still learns that Works are kept only in this browser and that only an Export is a durable copy

### AC-11 (US-06) — cross-context

**Given** the Editor runs the Installed app
**When** the system's theme is dark, or is light, or changes between them while the app is open
**Then** the window's title bar takes the top bar's brand-tinted colour for that theme, deep indigo in dark and pale lavender in light, so the title bar and the top bar read as one strip with no contrasting band between them

### AC-12 (US-07) — happy path

**Given** the Editor has asked to delete a Work that is not open
**When** the confirmation appears
**Then** the button that deletes is styled as destructive, in the danger colour with a bin icon, the safe choice to cancel keeps the initial focus, and confirming deletes the Work as it does today

### AC-13 (US-08) — domain invariant

**Given** the restyled interface in either theme, including the brand-tinted top bar
**When** the Editor reads any text or looks at any control and its focus
**Then** every text and icon is readable against its background at the contrast stated in §6, keyboard focus is always visibly marked, and a disabled action such as Export with no image looks unavailable without turning into a pale, washed-out brand colour

### AC-14 (US-08) — cross-context

**Given** the system asks apps to reduce motion
**When** the Editor points at a card or a button, or a panel opens
**Then** nothing lifts, zooms or slides; only colours change, and every action still works as without the setting

### AC-15 (US-02) — authorization

**Given** the Editor's browser does not offer to install the app, or the app already runs as an Installed app
**When** the Editor looks at the restyled top bar
**Then** no Install app action is shown, and no empty space or extra divider is left where it would be, so the top bar never offers an action that does nothing

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in the earlier specs. Visual checks run in Chromium, Firefox and WebKit, in both the light and the dark theme.

| Aspect | Target | Measurement |
|---|---|---|
| Text contrast against its background | ≥ 4.5:1 for all text, in both themes and on the top bar | automated accessibility check of the start screen, the Gallery, each tool panel and the export panel, in both themes |
| Icons, control borders and the focus mark against their background | ≥ 3:1 in both themes | the same automated check, plus a manual check of the focus mark |
| Accessible names and keyboard order of existing actions | 100% unchanged; every existing unit and end-to-end test passes without any edit | the full unit and end-to-end suites on Chromium, Firefox and WebKit |
| Growth of the app's downloaded code and styles | ≤ 15 KB compressed over the size before this feature | build size report compared with the main branch |
| New third-party code downloaded at runtime | 0 packages | dependency list diff |
| Hover and open motion | ≤ 200 ms per transition; 0 ms of movement when reduced motion is requested | unit test of the motion values; e2e with reduced motion emulated |
| Gallery with 20 Works stays responsive while pointing across the cards | longest interface freeze ≤ 200 ms (the open-and-view target) | long-task trace on the reference machine |
| Hard-coded colours, spacing or fonts in components | 0 outside the design-token file and the two window-colour values the page header must state | lint or search check in the review |

## 6.1 Security / privacy

- **Data classification:** internal. The feature changes only the app's look, its icons and its window colour; Works are shown as before.
- **Personal data touched:** none. The Work cards show the same name, thumbnail and time as today, and no new data is stored.
- **AuthZ/AuthN impact:** none. The app has no accounts, and every action keeps its current rules for when it is available.
- **Abuse cases:**
  - A Work is deleted by an accidental click on a hover control: the card's Delete only opens the existing confirmation, whose cancel choice has the initial focus (AC-12).
  - The open Work is deleted from its card: refused with the reason, as today (AC-08).
  - A thumbnail that fails to load hides that its Work is damaged: the card shows the damaged state (AC-09).
- **Security review:** N/A. No new data, permission, storage or network access is added.

## 7. Metrics / KPIs

- **Action buttons with an icon** — baseline: 5 of the 13 top-bar, Gallery and notice actions named in AC-02 (Undo, Redo and the three tools), with the tool panels' buttons counted before phase 1; target: 100% of the action buttons in AC-02 when the feature ships.
- **Accessibility contrast violations on the start screen, the Gallery and the tool panels** — baseline: TBD, measured with the automated accessibility check on the main branch before phase 1 starts; target: 0 in both themes when the feature ships.
- **Hard-coded colours, spacing and fonts in components** — baseline: TBD, counted by a search on the main branch before phase 1; target: 0 when the feature ships.
- **Places where a generic or missing brand mark appears** (top bar, tab, installed app icon, apple touch icon) — baseline: 4, target: 0 when the feature ships.

## 8. Open questions

- [ ] Does the owner approve the final logo artwork (two crop corners and an accent dot, with the "imgly" wordmark)? Default now: that concept, drawn during `screens`. — owner: Blazheiko, due: before sdd:tasks
