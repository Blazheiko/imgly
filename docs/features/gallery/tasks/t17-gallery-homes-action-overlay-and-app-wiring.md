---
id: T17
title: "Mount the Gallery in both homes: GalleryStart on the start screen, GalleryAction and the modal GalleryOverlay with a Work open, and App.vue opening the database at start-up"
layer: "ui"
deps: ["T14", "T16"]
blocks: ["T19", "T20", "T21", "T22"]
acs: ["AC-03", "AC-04", "AC-05", "AC-12", "AC-15"]
files_hint: ["src/features/gallery/components/GalleryStart.vue", "src/features/gallery/components/GalleryAction.vue", "src/features/gallery/components/GalleryOverlay.vue", "src/features/gallery/components/GalleryOverlay.test.ts", "src/features/gallery/components/GalleryAction.test.ts", "src/features/gallery/index.ts", "src/app/App.vue", "src/app/App.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 93 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T17 — Mount the Gallery in both homes: GalleryStart on the start screen, GalleryAction and the modal GalleryOverlay with a Work open, and App.vue opening the database at start-up

## Place in the sequence

- **Blocked by:** T14 — Add EditorView's start-screen and overlay slots and EditorTopBar's leading-actions slot, arm beforeunload only while saving, and reword ReplaceDialog; T16 — Build GalleryEntry, GalleryList and DeleteWorkDialog.
- **Blocks:** T19 — e2e save and reopen; T20 — e2e manage and limits; T21 — e2e gate and lifecycle; T22 — @perf e2e.
- **Wave:** 8 — the last UI task; every e2e task waits on it.
- **Lane:** shares `src/features/gallery/index.ts` with T15 — serialized (T15 is already upstream).

## Why (user story)

> **US-07: See the Gallery work on a first visit**
>
> **As a** Portfolio reviewer  
> **I want** to find the Gallery on the start screen and see a Work I just edited come back after a reload  
> **So that** I can confirm on my first try that the app keeps work between sessions
>
> — `spec.md §4, US-07, verbatim` · full text: [spec.md](../spec.md)

It puts the Gallery where people find it: on the start screen with no Work open, and behind "Gallery" in the top bar with one open.

## Inlined context

> **UI architecture (web-frontend).** The existing single-view SPA stays, with no router. The Gallery has two homes, both mounted through new `EditorView` slots that `App.vue` fills with gallery components, as it already does for the tools. With no Work open, it sits on the start screen next to the "Open image" drop zone (SCR-01). With a Work open, the "Gallery" top-bar action shows it as a modal overlay over the canvas area (SCR-03), and Esc or "Close" returns to the Work unchanged.
>
> — `sad.md §4, UI architecture, abridged` · full text: [sad.md](../sad.md)

> UI->>S: open the Gallery store at start-up, next to the capability gate
> alt storage cannot be opened (blocked site data, refused, still blocked by an older tab) → S-->>UI: Gallery unavailable for this page load, with the reason
> Postcondition: nothing reopens on its own, and listing never changes the stored Works
>
> — `sad.md §6, Flow 3 start-up lines, abridged` · full text: [sad.md](../sad.md)

> - **Top bar** (`EditorTopBar`): with a Work open (SCR-02), "Gallery" is the **first** action, before "Open image". […] "Open image" is rendered by `EditorTopBar` itself, so it gains a `leading-actions` slot before it, which `EditorView` forwards and `App.vue` fills with `GalleryAction`. On SCR-01 the Gallery is already on screen, so "Gallery" is absent from the top bar, as "Open image" is.
> - **Unavailable actions** follow the `AdjustAction` precedent. While a tool is open, "Gallery" stays focusable (`aria-disabled`, 0.45 opacity) with its hint as its accessible description, and activating it shows the hint as a `Toast` `info`. During an export it is truly `disabled`. A waiting replacement is a modal `Dialog`, so the top bar can't be reached then. "Gallery" has no keyboard shortcut.
> - **Start screen** (SCR-01): `EditorView`'s new `start-screen` slot (`sad.md` §5) holds `GalleryStart` **under** open-and-view's `EmptyCanvas`. The drop zone becomes a band at the top of the canvas area, with `--space-8` padding above and below its "Open image" button and hint. The Gallery section follows below. The canvas area scrolls vertically when the entries don't fit.
> - **Overlay** (SCR-03): `EditorView`'s new `overlay` slot holds `GalleryOverlay`. It covers the canvas area and the status bar, under the top bar, with a `--color-surface` background. It is `role="dialog"`, `aria-modal="true"` and labelled by its "Gallery" heading. While it is open, everything outside it is `inert`, focus stays inside it, and drops are ignored (the window drop guard still stops navigation). The overlay sets `editor.activePanel` to `'gallery'` (`PanelId` widens to `'export' | 'gallery'`), so the existing "a panel is open" guards make every tool, Undo, Redo, Export and `Ctrl/Cmd+O` shortcut do nothing while it shows.
>
> — `screens.md §Source, Shell changes, abridged` · full text: [screens.md](../screens.md)

> | `Tab` / `Shift+Tab` | SCR-03 | Cycle inside the overlay only: "Close", then each entry and its "Delete" | AC-03 |
> | `Enter` / `Space` | An entry | Chooses that Work (reopens it, or closes the overlay for the open Work) | AC-04 |
> | `Esc` | SCR-03 | Closes the overlay, the Work unchanged. Focus returns to "Gallery" | AC-03 |
> | `Ctrl/Cmd+O`, tool keys, `Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`, zoom keys | SCR-03 | Do nothing (a panel is open) | AC-03 |
>
> When the overlay opens, focus moves to its first entry, or to "Close" when it has none. […] After a reopen, focus returns to "Gallery" in the top bar (or to the Preview's first focusable control on SCR-01's way to SCR-02, as after any open).
>
> — `screens.md §Keyboard, SCR-03 rows + focus paragraph, abridged` · full text: [screens.md](../screens.md)

> | SCR-01 reopening | An entry chosen (Critical flow 2). […] A `Spinner` overlay labelled "Opening {name}" is centred over the Gallery section, and the entries are inert until it ends. With no Work open, no replace gate applies |
> | SCR-01 reopen failed (damaged) | […] The start screen stays, the entry is marked damaged, and a failure notice names the Work with the action "Delete…" |
> | SCR-02 tool open | A tool is open (crop-rotate, adjust or draw). "Gallery" is `aria-disabled` with the hint as its description, and activating it shows the hint as a `Toast` `info` |
> | SCR-02 exporting | An export runs. "Gallery" is `disabled` |
> | SCR-02 Gallery unavailable | […] "Gallery" stays available and opens SCR-03 `unavailable`. |
> | SCR-03 default | "Gallery" chosen on SCR-02 (Flow 3, AC-03). The list as on SCR-01, with "Close". […] "Gallery" shows as pressed (`aria-pressed`) in the inert top bar |
> | SCR-03 closed | "Close" or `Esc` → SCR-02 with the Work and View unchanged, focus on "Gallery" |
> | SCR-03 open Work chosen | The "Open" entry chosen. It acts as "Close": nothing is read or replaced |
> | SCR-03 choose unavailable | An export runs, or a replacement waits for confirmation, when a Work is chosen (Critical flow 2, AC-15). The open Work doesn't change, and a `Toast` `info` hint says to wait or answer first. […] this guards the store's `reopenWork` |
> | SCR-03 reopening / waiting for save | Another entry chosen. As SCR-01 `reopening`, over the overlay's list. The `reopening` spinner stays until the save settles (AC-16) |
> | SCR-03 reopened | Readable and replaced (AC-04) → SCR-02 `reopened`, the overlay closed |
> | SCR-03 reopen failed (damaged) | As SCR-01 `reopen failed` (AC-08). The overlay stays open and the open Work stays exactly as it was |
> | SCR-03 empty | […] As SCR-01 `empty`, without its "Open image" button |
> | SCR-03 unavailable | As SCR-01 `unavailable`, for any of its reasons […]. "Close" still works |
>
> — `screens.md §Screens, SCR-01/SCR-02/SCR-03 state rows, abridged` · full text: [screens.md](../screens.md)

> | `GalleryAction` | `BaseButton` secondary "Gallery" with its pressed, `disabled`-during-export and unavailable (`aria-disabled` + hint) states, mounted in the top bar's new `leading-actions` slot, as `AdjustAction` |
> | `GalleryStart` | SCR-01's Gallery section under `EmptyCanvas`, in `EditorView`'s `start-screen` slot |
> | `GalleryOverlay` | SCR-03: a modal region over the canvas area and status bar under the top bar. `Dialog` is a centred `alertdialog` […] and `Popover` is non-modal and anchored, so neither fits |
>
> — `screens.md §New components, three rows, abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** Features never import each other. They coordinate through the `editor` store […] Import other modules only through their `index.ts`. `src/app/` may import `features` (through `index.ts` only).
>
> — `CLAUDE.md §Module boundaries, abridged` · full text: [CLAUDE.md](../../../../CLAUDE.md)

Texts ("Apply or cancel the open tool first.", the AC-15 hints, "Opening {name}", "Close (Esc)") come from `src/features/gallery/messages.ts` (T15); `GalleryList`/`GalleryEntry`/`DeleteWorkDialog` come from T16; `PanelId` already includes `'gallery'` (T12).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [ux-flows.md](../ux-flows.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-03 (US-03) — happy path

> **Given** the Gallery holds several Works, one of which is open
> **When** the Editor chooses "Gallery" in the top bar
> **Then** the Gallery lists every stored Work, most recently opened or changed first. Each entry shows a thumbnail of the Work with all its edits, its Source name ("Untitled" when the Work has none) and when it was last opened or changed: "Just now" under a minute, "N minutes ago" under an hour, "N hours ago" under a day, and otherwise the date in the browser's language. The open Work's entry is marked "Open", and the Gallery shows how many of the 20 places are used. The Gallery can be closed again without changing anything
>
> — `spec.md §5, AC-03, verbatim` · full text: [spec.md](../spec.md)

### AC-04 (US-02) — happy path

> **Given** a Work in the Gallery was stored with a Crop, a Straighten angle, all seven Adjustments away from neutral and a drawing
> **When** the Editor chooses it, after a reload or with another Work open and no Unsaved edits left unstored
> **Then** it replaces the open Work and shows exactly the stored Work: a full-size Export of it is identical to the Export of the same Work made before the reload. Its Source name and Source format still name and pick the default format of the next Export. Each part stays editable on its own: "Crop and rotate" shows the whole image with the stored frame, "Adjust" shows the stored slider values, and "Draw" shows the stored Drawing layer, which can be painted on and erased with the Brush and the Eraser as before the reload. The reopened Work starts with an empty Edit history and no Unsaved edits, and the Gallery closes
>
> — `spec.md §5, AC-04, verbatim` · full text: [spec.md](../spec.md)

### AC-05 (US-07) — happy path

> **Given** a first visit, so the Gallery is empty
> **When** the start screen appears
> **Then** next to the "Open image" drop zone, the Gallery shows plain text saying that Works the Editor opens will appear here, with the same "Open image" action. After the Portfolio reviewer opens an image, applies a change and reloads the page, the start screen lists that Work, and choosing it reopens it with the change. Nothing reopens on its own after a reload
>
> — `spec.md §5, AC-05, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-05) — authorization

> **Given** storage cannot be opened for this app when the page loads, for example in a private window or with site data blocked for the site
> **When** the Editor opens an image and edits it
> **Then** opening, editing and exporting work as before. The Gallery shows that it is unavailable in this browser window and why in plain words, nothing is stored, and the app does not try to store anything again until the page is next loaded. Replacing the Work asks for confirmation whenever the open Work has Unsaved edits, as open-and-view AC-15 always did
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-15 (US-02) — cross-context

> **Given** an export is running, or a replacement of the Work is waiting for the Editor's confirmation
> **When** the Editor chooses a Work in the Gallery
> **Then** choosing a Work is unavailable, with a hint to wait for the export or to answer the confirmation first, and the open Work does not change
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `GalleryAction`: `BaseButton` secondary "Gallery"; `aria-pressed` while the overlay shows; `aria-disabled` + hint description + `Toast` `info` on activate while a tool is open; `disabled` while exporting; toggles the gallery store's overlay state — `src/features/gallery/components/GalleryAction.vue`
- [ ] `GalleryOverlay`: `role="dialog"`, `aria-modal="true"`, labelled by the "Gallery" heading; renders `GalleryList` with "Close"; sets `editor.setActivePanel('gallery')` on open and `null` on close; makes everything outside `inert`; traps focus; Esc/Close return focus to "Gallery"; reopening/waiting spinner "Opening {name}" over the list with entries inert; choosing the "Open" entry just closes; closes on a `replaced` outcome, stays on `damaged` — `src/features/gallery/components/GalleryOverlay.vue`
- [ ] `GalleryStart`: the Gallery section under `EmptyCanvas`, `GalleryList` with the empty-state "Open image", the reopening spinner, no gate — `src/features/gallery/components/GalleryStart.vue`
- [ ] Export the three from `src/features/gallery/index.ts`
- [ ] `App.vue`: open the Gallery database at start-up next to the capability gate and hand the result to the editor store (unavailable with its reason on failure); fill EditorView's `start-screen`, `overlay` and `top-bar-leading-actions` slots (T14's forwarded name for `EditorTopBar`'s `leading-actions`); load no Work at start — `src/app/App.vue`
- [ ] Tests — `GalleryAction.test.ts`, `GalleryOverlay.test.ts`, `src/app/App.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| "Gallery" activated while a tool is open | no overlay; info toast "Apply or cancel the open tool first." |
| Export running | "Gallery" `disabled`; a forced `reopenWork` from the overlay gives the AC-15 export hint, Work unchanged |
| Overlay open, user presses `Ctrl/Cmd+O`, a tool key, Undo or a zoom key | nothing happens (`activePanel === 'gallery'`) |
| Overlay open, a file is dropped | ignored; window drop guard still prevents navigation |
| The "Open" entry chosen | overlay closes; nothing read or replaced |
| A chosen Work is damaged | overlay stays open; entry marked damaged; failure toast with "Delete…" |
| Close the overlay while a reopen is reading | the reopen still completes or fails cleanly, never half replaces |
| Database unavailable at start-up | start screen shows the unavailable text under the drop zone; "Gallery" still opens SCR-03 `unavailable` with "Close" |
| Stored Works at start-up | listed; no record, Original or layer read beyond the list; no Work loaded |

## Definition of Done

- [ ] `GalleryAction.test.ts` covers default, pressed, aria-disabled-with-hint (tool open) and disabled (exporting)
- [ ] `GalleryOverlay.test.ts` covers role/aria-modal/label, `activePanel === 'gallery'`, inert outside, focus trap, Close and Esc with focus back on "Gallery" and the Work, revision and View unchanged, the reopening spinner, choosing the Open entry closes, damaged keeps it open, choose-unavailable hints
- [ ] `App.test.ts` proves the database opens at start-up next to the capability gate, no Work loads at start, `GalleryStart` sits under `EmptyCanvas`, and `GalleryAction` is the first top-bar action
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
