---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-03"
feature_size: "M"
---

# Spec — open-and-view

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root)
> **Reference module / docs / channels used:** `docs/idea-brief.md`, `docs/architecture-map.md`, `docs/roadmap.md` (step 2), `docs/design-system.md`. No other channels.

## 1. Context

The Editor needs to bring a photo from their phone or desktop into the app and see it, ready to edit, without answering dialogs or being surprised. The Portfolio reviewer needs the same thing to work on the first try, because the first open of the first image is their first impression of the app. Every later tool (crop, adjustments, drawing, export, gallery) starts from an open Work. That makes this the foundation step of the roadmap (`docs/roadmap.md` step 2).

Why now: it is the first unblocked step after the project skeleton, and the brief's 4–6 week MVP budget depends on the rest of the roadmap building on it.

Committed approach: **an open that needs no dialogs and holds no surprises.** The new file is read completely before it replaces the current Work. Phone orientation is applied. Any downscale to the Downscale limit is announced in one line with the original and new dimensions, and every failure comes with a plain-language reason. Rationale: the comparable browser editors either stop the user with a blocking resize dialog (Pixlr) or surface raw technical decode errors (Squoosh). The sharpest failure vector found is losing the open Work during a replace. The deep-dive's headline success signal is a fast first Preview with smooth zoom and pan.

Traceability: downscale limit 4096 px resolves roadmap decision D1 (`docs/roadmap.md` §Open decisions). The replace rule set here (read first, confirm only for Unsaved edits) is inherited by every later editing feature.

- Decision override: drag-and-drop moved from roadmap step 10 into this feature — rationale: the design canon's empty state is a drop zone (`docs/design-system.md` §Interaction & writing conventions), and drag-and-drop works in every target browser, unlike the Chromium-only "Open with…". Roadmap step 10 shrinks to paste, copy to the clipboard and "Open with…".
- Decision override: AC-15 is verified in this feature against a test-prepared Work that has Unsaved edits, because no editing tool exists yet — rationale: the replace rule must be fixed before the tools that inherit it. The first feature that adds an editing tool (roadmap step 4, crop and rotate) must re-verify AC-15 with real edits.

## 2. Goals

- Any common phone or desktop image opens into a ready-to-edit Preview within seconds, with no dialogs on the happy path.
- The open Work is never lost, and an image is never degraded without the Editor being told how.
- The View (fit, 100%, zoom, pan) feels smooth on a laptop trackpad and mouse, so later tools can build on it unchanged.

## 3. Non-goals

- Pasting from the clipboard, copying to the clipboard, and acting as the operating system's "Open with…" image handler. These stay in roadmap step 10. This feature covers only the "Open image" action and drag-and-drop.
- Keeping the full resolution of images larger than the Downscale limit. The brief accepts the downscale to keep memory and storage manageable.
- Keeping the Work between sessions. Persistence is the gallery step (roadmap step 8), so an open Work lives only in the current session.
- Opening several images at once, batch processing or comparing images. The editor holds exactly one Work.
- Touch-optimised gestures. The app is desktop-first and only has to not break on mobile (`docs/design-system.md` §Platform posture).

## 4. User stories

### US-01: Open an image from disk

**As a** Editor
**I want** to choose an image file from my computer with an "Open image" action
**So that** I can start editing it

### US-02: Drop an image onto the app

**As a** Editor
**I want** to drop an image file anywhere on the app window
**So that** I can open it without going through a file dialog

### US-03: Know when an image was reduced

**As a** Editor
**I want** to be told when my image was reduced to the Downscale limit, and from what size to what size
**So that** I know what resolution I am editing and exporting

### US-04: Understand why an image won't open

**As a** Editor
**I want** a plain-language reason whenever a file can't be opened or opens differently from how I expect
**So that** I know what to do next instead of facing an empty canvas

### US-05: Inspect the image closely

**As a** Editor
**I want** to fit the image to the window, see it at 100%, zoom and pan
**So that** I can check details before and while editing

### US-06: Keep my work when opening another image

**As a** Editor
**I want** the app to protect the open Work when I open a different image
**So that** I never lose Unsaved edits by accident

### US-07: Understand the app on first visit

**As a** Portfolio reviewer
**I want** the empty app to show me clearly how to open an image
**So that** I can try it within seconds, without instructions

### US-08: Get an honest message when the browser can't render

**As a** Portfolio reviewer
**I want** to be told clearly when my browser can't display the editor, and to have the Preview come back by itself after a temporary graphics interruption
**So that** I don't judge the app on a blank or black canvas

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** the Editor has no image open
**When** the Editor chooses a supported image file through the "Open image" action
**Then** the image is shown fitted to the window, upright the same way the operating system's photo viewer shows it, and the editor is ready for editing

### AC-02 (US-02) — happy path

**Given** the app is open, with or without an image
**When** the Editor drops a supported image file anywhere on the app window
**Then** the image opens exactly as in AC-01 (subject to AC-15 and AC-16 when a Work is open), and the app never navigates away or shows the file in place of itself

### AC-03 (US-02) — error

**Given** the app is open
**When** the Editor drops several files at once
**Then** the first file that is an image opens, and a short notice says the editor works with one image at a time and the other files were ignored

### AC-04 (US-02) — error

**Given** the app is open
**When** the Editor drops something that is not an image file, such as a folder, a document or a link dragged from another browser tab
**Then** nothing is opened or replaced, and a notice says that only image files can be opened

### AC-05 (US-03) — domain invariant

**Given** an image whose long side, once upright, is larger than the Downscale limit
**When** the Editor opens it
**Then** the Original's long side equals the Downscale limit with proportions kept, and a one-line notice states the original and the new dimensions

### AC-06 (US-03) — happy path

**Given** an image whose long side is at or below the Downscale limit
**When** the Editor opens it
**Then** the Original keeps the image's own dimensions and no downscale notice is shown

### AC-07 (US-04) — error

**Given** an image in a format this browser cannot read (for example an iPhone HEIC photo in a browser without support for it)
**When** the Editor tries to open it
**Then** nothing is replaced, and a notice names the format, says this browser cannot open it and suggests converting it or using a browser that can

### AC-08 (US-04) — error

**Given** a file that is damaged, truncated or not really the image type its name claims
**When** the Editor tries to open it
**Then** the file is judged by its content rather than its name, nothing is replaced if it can't be read, and a notice says the file could not be read as an image

### AC-09 (US-04) — domain invariant

**Given** an image whose pixel count exceeds the size ceiling the editor can safely handle
**When** the Editor tries to open it
**Then** the editor refuses it before reading it fully, nothing is replaced, and a notice states the image's size and the largest size the editor accepts

### AC-10 (US-04) — authorization

**Given** the operating system or the browser does not allow the app to read the chosen file (for example missing file permissions, or a cloud-drive file that has not been downloaded)
**When** the Editor tries to open it
**Then** nothing is replaced, and a notice says the app was not allowed to read the file and suggests making it available on this computer first

### AC-11 (US-04) — error

**Given** an animated image
**When** the Editor opens it
**Then** its first frame opens as the Original, and a notice says only the first frame is kept

### AC-12 (US-05) — happy path

**Given** an image is open
**When** the Editor pinches on the trackpad, scrolls with Ctrl/Cmd held, or uses the zoom-in and zoom-out controls, "Fit" or "100%"
**Then** the Preview zooms toward the pointer (or the centre for the controls), the current zoom level is visible, "100%" shows one image pixel per physical screen pixel, and the rest of the app interface never changes size

### AC-13 (US-05) — happy path

**Given** an image is open and zoomed in beyond the window
**When** the Editor scrolls with two fingers, drags while holding Space, or drags while no editing tool is active
**Then** the Preview pans in that direction and the Work does not change

### AC-14 (US-05) — domain invariant

**Given** the Editor has only zoomed or panned the open Work
**When** the Editor opens another image
**Then** no confirmation is asked, because View changes never count as Unsaved edits

### AC-15 (US-06) — cross-context

**Given** the open Work has Unsaved edits made with an editing tool
**When** the Editor opens another image that has been read successfully
**Then** the app asks for confirmation and says the current edits will be lost; choosing to cancel keeps the current Work exactly as it was

*Verification note:* until an editing tool exists, this is verified with a Work prepared to have Unsaved edits; the first editing feature (roadmap step 4) re-verifies it with real edits.

### AC-16 (US-06) — domain invariant

**Given** an image is open
**When** the Editor opens another file that turns out to be unreadable, unsupported, refused or not permitted
**Then** no confirmation is asked, the open Work stays exactly as it was, and the matching reason is shown — the open Work is only ever replaced by an image that has been read successfully

### AC-17 (US-07) — happy path

**Given** a Portfolio reviewer opens the app for the first time and no image is open
**When** the app finishes loading
**Then** the canvas area shows one primary "Open image" action and a one-line hint that an image can also be dropped onto the app

### AC-18 (US-08) — cross-context

**Given** the browser lacks the graphics capability the editor requires
**When** the Portfolio reviewer opens the app
**Then** the canvas area shows a full message explaining that this browser can't display the editor and naming browsers that can, and the "Open image" action is unavailable

### AC-19 (US-08) — cross-context

**Given** an image is open
**When** the device's graphics are interrupted temporarily, for example by sleep and wake or a graphics switch
**Then** the Preview comes back by itself without reopening the file, and the Work and View are unchanged

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air (or equivalent) with the latest Chrome (see §8).

| Aspect | Target | Measurement |
|---|---|---|
| Time to first Preview p95, 12 MP JPEG (4032×3024), within limit | ≤ 1.5 s | e2e performance test on the reference machine |
| Time to first Preview p95, 48 MP JPEG (8064×6048), downscale path | ≤ 3 s | e2e performance test on the reference machine |
| Longest interface freeze while opening any accepted image | ≤ 200 ms (loading indicator keeps animating) | long-task trace in the e2e performance test |
| Zoom and pan smoothness on a 4096 px Original | ≥ 50 fps | performance trace during a scripted zoom and pan |
| Memory after 10 consecutive opens of the 48 MP image | ≤ 110% of memory after the first open | memory snapshot in e2e |
| Opening with no network connection | 100% of runs succeed | e2e run in offline mode after first load |
| Size ceiling (largest accepted pixel count) | TBD, default 100 MP | see §8 |

## 6.1 Security / privacy

- **Data classification:** confidential. Users' photos can be personal, and they never leave the device.
- **Personal data touched:** image pixels and embedded metadata (for example capture location) of the opened file, held only in the current session's memory. No new stored fields. Persistence comes with the gallery step.
- **AuthZ/AuthN impact:** none. There are no accounts. The only access check is the operating system's or browser's permission to read the chosen file, and its refusal is handled by AC-10.
- **Abuse cases:**
  - Decompression bomb (small file declaring huge dimensions): refused by the size ceiling before full reading (AC-09), so the tab is never exhausted.
  - Malformed or hostile image file: handled by the browser's own image reading, and failures are reported plainly (AC-08) with the open Work untouched (AC-16).
  - Disguised file type (wrong extension): judged by content, not by name (AC-08).
  - Metadata leak: embedded metadata is not carried into the Original (see §8 on whether any of it should be kept).
- **Security review:** Required. The feature is size M and it is the app's only intake of untrusted files.

## 7. Metrics / KPIs

- **Time to first Preview of the 12 MP reference photo** — baseline: 0 (no feature yet), target: ≤ 1.5 s p95 on the reference machine by the time the feature ships.
- **Honest outcome rate on the reference test set** (JPEG, PNG, WebP, AVIF, animated GIF, HEIC, damaged, truncated, oversize, mis-named files) — baseline: 0, target: 100% of files end in either a correct Preview or a plain-language reason, with 0 blank canvases or tab crashes, by ship.
- **Orientation correctness** — baseline: 0, target: 8 of 8 EXIF orientation test images display upright by ship.

## 8. Open questions

- [ ] What is the size ceiling (largest accepted pixel count) that stays safe on the reference machine and on the mobile "must not break" tier? Default now: 100 MP. — owner: Blazheiko (owner), due: before `sdd:design` closes
- [ ] Which exact reference machine and browser do the §6 targets bind to? Default now: Apple M1 MacBook Air, latest Chrome. — owner: Blazheiko (owner), due: before `sdd:plan-tests`
- [ ] Are wide-gamut (Display P3) and colour-profiled images shown in their own colour space or converted to standard sRGB? Default now: converted to sRGB. — owner: Blazheiko (owner), due: before `sdd:design` closes
- [ ] Should any embedded metadata (capture date, location) be kept with the Work for later export? Default now: none is kept. — owner: Blazheiko (owner), due: before the export feature's `sdd:specify`
