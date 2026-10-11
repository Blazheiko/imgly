---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-11"
feature_size: "S"
---

# Spec — undo-redo

> **Glossary:** [CONTEXT](../../../CONTEXT.md) (repo root; Edit history and Step added for this feature, Unsaved edits refined)
> **Reference module / docs / channels used:** `docs/idea-brief.md` (§5, §6, §7), `docs/roadmap.md` (step 7), `docs/architecture-map.md`, `docs/features/draw/adr/0005-make-one-apply-of-the-draw-tool-one-undo-step.md`, `docs/features/draw/sad.md` (§11), the §8 open questions of `docs/features/export/spec.md`, `docs/features/crop-rotate/spec.md` and `docs/features/draw/spec.md`, `src/core/document.ts`, `src/features/editor/store.ts`. No other channels.

## 1. Context

The Editor crops, adjusts and draws on a photo through three tools, and each tool's Apply changes the Work at once. Once a change is applied, the only way back is to redo it by hand: widen the Crop again, drag seven sliders back to the values they remember, or erase marks one by one. A wrong Apply, such as a Crop that cut off too much or a drawing applied by mistake, can cost the whole session's work, and the Editor learns to apply carefully instead of trying things. The Portfolio reviewer presses Ctrl/Cmd+Z in any editor and judges the app when nothing happens.

Why now: undo and redo are roadmap step 7. All three editing tools ("Crop and rotate", "Adjust", "Draw") have shipped, and each of their specs defers undo and redo to this step. Three open questions wait on it: export §8 (does undoing back to the exported state clear Unsaved edits?), crop-rotate §8 (the same question, moved here) and draw §8 (one Stroke or one Apply per undo step, answered by draw ADR-0005). The Gallery (step 8) comes next and must not confuse its saved Works with this in-session history (idea-brief §6, "History means two different things").

Committed approach: **a linear Edit history of applied Steps, for the open Work only.** Every Apply of "Crop and rotate", "Adjust" or "Draw" that counts as an edit is one Step. Undo takes back the last Step and Redo restores it, from two buttons in the top bar or with Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z (also Ctrl+Y on Windows and Linux). Undo and redo are exact: the Work returns to precisely the state it had, so the Preview and every Export match it pixel for pixel. A new Step after an Undo discards the Steps that could have been redone. The Edit history lasts only while the Work is open: replacing the Work clears it, and it is never saved. It keeps up to 50 Steps within a fixed memory budget and drops the oldest first. A successful Export marks a save point, and undoing or redoing back to it clears Unsaved edits. This approach was chosen at easy interview depth (2026-10-11). The owner chose the history bound explicitly; the unit of a Step comes from draw ADR-0005, and the rest comes from the accepted assumptions ledger. The ideation analyses did not run at that depth.

Traceability and deliberate compromises:

- Decision: one Step is one Apply of a tool that counts as an edit, never a Stroke or a slider move inside an open tool (draw ADR-0005, which closes draw §8's question). Inside an open tool, Cancel, Reset, the Eraser and Clear stay the ways back.
- Decision: the save point is the last successful Export, and undoing or redoing back to it clears Unsaved edits (AC-09). This closes export §8's open question with its stated default, and crop-rotate §8's question that moved its due date to this step. Their checkboxes are left for the owner to tick.
- Decision: the history bound (AC-11, §6) is up to 50 Steps and at most 512 MB of memory for the Edit history, with at least the last 10 Steps always kept on the reference Work even when each one is a drawing over the whole image. The budget counts the image data the Edit history holds, not whole-page memory, so ten full layers of the reference Work (about 503 MB) fit it; whole-page memory is checked separately for hidden growth. draw `sad.md` §11 asks for a bound by memory, not only by count, because a kept Drawing layer can take up to 64 MB.
- Cross-feature change: draw §6's row "memory after 50 Applies ≤ 110% of memory after the first Apply" can no longer hold, because the Edit history now keeps earlier Drawing layers on purpose. It is replaced by this spec's §6 rows on history memory, hidden growth and memory release, which together keep its role as the backstop against layers that are never released (draw `sad.md` §11).
- Cross-feature change: while "Crop and rotate", "Adjust" or "Draw" is open, Undo and Redo are unavailable and their shortcuts show a hint to apply or cancel the open tool first (AC-08). This extends the one-tool rule of draw AC-16 and the Export rule of draw AC-15 to Undo and Redo.
- Cross-feature change: replacing the Work asks for confirmation only when there are Unsaved edits (open-and-view). After undoing back to the save point there are none, so opening another image replaces the Work without asking, and its Edit history is lost with it (AC-09, AC-10).

## 2. Goals

- The Editor can take back any applied change and bring it back again, exactly, so they can try a Crop, an Adjustment or a drawing without fear of losing what they had.
- What the app says about saving stays honest through undo and redo: the Work has no Unsaved edits only at its save point, which is the last successful Export, or the state at open when nothing was exported. A change taken back by hand rather than by Undo still counts as an edit (crop-rotate AC-13, draw AC-12).
- A long editing session stays within a fixed memory budget, so keeping the Edit history never makes the tab slow or lets it crash.

## 3. Non-goals

- Undoing a single Stroke or slider move inside an open tool. One Step is one Apply (draw ADR-0005); inside a tool, Cancel, Reset, the Eraser and Clear are the ways back.
- Keeping the Edit history across a reload, or restoring it when the Gallery (step 8) reopens a Work. The idea brief keeps the Work's editable state between sessions, not its step-by-step history (idea-brief §5).
- A history panel, jumping to an arbitrary Step or branching history. The linear Undo and Redo of desktop editors is enough for the MVP, and a panel needs its own screen and design.
- Undoing the opening of an image or an Export. Opening replaces the Work behind a confirmation, and an Export is a file the app has already handed over; neither is a change to the Work.

## 4. User stories

### US-01: Take back the last change

**As an** Editor
**I want** to undo the last change I applied with a tool
**So that** a wrong Crop, Adjustment or drawing costs me one keystroke instead of redoing it by hand

### US-02: Bring back what I undid

**As an** Editor
**I want** to redo a change I just undid
**So that** I can compare before and after, and change my mind again without losing work

### US-03: Step back through several changes

**As an** Editor
**I want** to undo several changes in a row, across all three tools
**So that** I can return to how the image looked several steps ago

### US-04: Know whether my work is saved after undoing

**As an** Editor
**I want** the app to know when undoing has brought the image back to what I last exported or opened
**So that** I am asked to confirm replacing the image only when I would really lose something

### US-05: Keep a long session safe

**As an** Editor
**I want** undo to stay reliable while a tool is open, while an export runs, and through a long session
**So that** undoing never mixes with an unapplied tool, never changes a file being saved and never makes the app run out of memory

### US-06: Find undo on the first try

**As a** Portfolio reviewer
**I want** undo and redo where every desktop editor has them, with the usual shortcuts
**So that** I find them without looking for them and judge the app a complete editor

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** an image is open and the Editor has applied at least one Step with "Crop and rotate", "Adjust" or "Draw"
**When** the Editor chooses Undo, by its button in the top bar or by Ctrl+Z (Cmd+Z on a Mac)
**Then** the Preview shows the Work as it was before the last Step: the Geometry, the Adjustments or the Drawing layer that Step changed returns to its earlier value, and nothing else changes. Redo becomes available, and the Undo and Redo buttons' hints name the tool of the Step each would take back or restore next, for example "Undo Adjust" and "Redo Crop and rotate"

### AC-02 (US-02) — happy path

**Given** the Editor has undone one or more Steps and has applied nothing since
**When** the Editor chooses Redo, by its button or by Shift+Ctrl+Z (Shift+Cmd+Z on a Mac), or Ctrl+Y on Windows and Linux
**Then** the Preview shows the Work with the most recently undone Step applied again, exactly as it was before that Undo, and Redo stays available while undone Steps remain

### AC-03 (US-03) — domain invariant

**Given** the Editor has opened an image, then applied a Crop, Adjustments and a drawing in that order
**When** the Editor chooses Undo three times, and then Redo three times
**Then** after the three Undos the Work is exactly the Work as it was opened, and after the three Redos it is exactly the Work as it was after the drawing: a full-size Export at each point is identical, pixel for pixel, to an Export of that same state made before any Undo. Undo and redo never approximate a state; they restore it

### AC-04 (US-02) — domain invariant

**Given** the Editor has undone one or more Steps
**When** the Editor applies a new change with any of the three tools
**Then** the new change becomes the last Step, the Steps that could have been redone are discarded, and Redo becomes unavailable with a hint that there is nothing to redo. The Edit history is one line: there is never more than one way forward

### AC-05 (US-01) — error

**Given** an image has just been opened, or the Editor has undone every kept Step
**When** the Editor chooses Undo, by its button or its shortcut
**Then** nothing changes: the Undo button is visibly unavailable with a hint that there is nothing to undo, and the shortcut does nothing. In the same way, when nothing has been undone, Redo is unavailable with a hint that there is nothing to redo. With no image open, both buttons are unavailable

### AC-06 (US-01) — domain invariant

**Given** an image is open and the Editor has applied at least one Step
**When** the Editor zooms or pans the View, opens a tool and cancels it, applies a tool without changing anything, or exports the image, and then chooses Undo
**Then** none of those actions was a Step: Undo takes back the last applied change to the Work, and the View stays as the Editor left it unless that change altered the image's size (AC-12). Only an Apply that counts as an edit makes a Step, the same rule that decides Unsaved edits

### AC-07 (US-05) — authorization

**Given** an export is in progress (export AC-11)
**When** the Editor tries to Undo or Redo, by the buttons or by the shortcuts
**Then** the request is refused, not queued: both buttons are visibly unavailable and the shortcuts only show a hint that an export is in progress, because the file being saved must contain the Work exactly as it was when the Editor confirmed the export. When the export ends, Undo and Redo become available again with the same Edit history

### AC-08 (US-05) — cross-context

**Given** "Crop and rotate", "Adjust" or "Draw" is open
**When** the Editor tries to Undo or Redo, by the buttons or by the shortcuts
**Then** the Work does not change and the open tool keeps its unapplied changes: Undo and Redo are unavailable with a hint to apply or cancel the open tool first, and the shortcuts show the same hint. While a text or number field has focus, the shortcuts keep their usual meaning inside that field and do not touch the Edit history. After Apply or Cancel, Undo and Redo work on the Edit history, which now includes that tool's Step if its Apply counted as an edit

### AC-09 (US-04) — cross-context

**Given** the Editor has applied two Steps, exported the image successfully, and then applied a third Step, so the Work has Unsaved edits
**When** the Editor undoes the third Step, then undoes once more, then redoes once
**Then** after the first Undo the Work is back at the exported state and has no Unsaved edits, so opening another image replaces the Work without asking for confirmation; after the second Undo it has Unsaved edits again; after the Redo it has none. Likewise, undoing every Step of a Work that was never exported brings it back to the state it was opened in, with no Unsaved edits. After an Export, undoing past the save point back to the opened state leaves Unsaved edits, because the save point is now the Export. A cancelled or failed export never sets the save point (export AC-09, AC-10)

### AC-10 (US-05) — cross-context

**Given** the Editor has an Edit history for the open Work
**When** another image replaces the Work, after the confirmation when there are Unsaved edits
**Then** the new Work starts with an empty Edit history: Undo and Redo are unavailable, and no Step of the previous Work can be undone or redone any more. If the Editor cancels the replacement, the Work and its Edit history stay exactly as they were

### AC-11 (US-05) — domain invariant

**Given** the Editor keeps applying Steps on the 4096 × 3072 px reference Work, each one a drawing over the whole image or a Crop or Adjustment
**When** the Edit history reaches its limit of 50 Steps, or its memory budget
**Then** the oldest Steps are dropped first, without a message, and the newest are kept: the Editor can always undo at least the last 10 Steps, and up to the last 50 when they take less memory. Undoing past the oldest kept Step is not possible; Undo becomes unavailable there as in AC-05. The memory the Edit history takes never exceeds its budget (§6)

### AC-12 (US-03) — cross-context

**Given** the Editor has applied a Crop or a Rotation that changed the image's size, and then zoomed in
**When** the Editor undoes that Step
**Then** the View fits the restored image, as it does after an Apply in "Crop and rotate" that changes the image's size. Undoing or redoing a Step that keeps the image's size, such as Adjustments, a drawing or a Crop of the same size, keeps the View as it was

### AC-13 (US-03) — cross-context

**Given** the Editor has drawn marks and applied them, then applied a Crop and a Rotation, and then applied "Draw" again after Clear
**When** the Editor undoes the last Step, and then undoes the Rotation
**Then** after the first Undo every mark is back on the same image content it was drawn on (draw AC-08), and after the second Undo the marks follow the image back to its earlier orientation. The Drawing layer always returns together with the Geometry it was applied under, never shifted or stretched

### AC-14 (US-06) — happy path

**Given** a Portfolio reviewer has opened an image and applied one change with any tool
**When** they look for a way to take it back
**Then** Undo and Redo are two buttons in the top bar, in the place desktop editors use, each with a hint that names the action and its shortcut. They can be reached and used by keyboard alone, and Ctrl/Cmd+Z works from anywhere in the editor except a focused text or number field, so the change is taken back in at most one action

## 6. Non-functional requirements

Reference machine: Apple M1 MacBook Air with the latest stable Chrome, as in open-and-view, export, crop-rotate, adjust and draw. The reference Work is 4096 × 3072 px. Each p95 is taken over 20 runs after 2 warm-up runs. "A drawing over the whole image" means a Drawing layer covered by marks over the whole image, as draw §6 defines it.

| Aspect | Target | Measurement |
|---|---|---|
| From choosing Undo or Redo to the updated Preview, for a Step of each tool, with a drawing over the whole image | p95 ≤ 150 ms (the same target as an Apply in draw §6) | e2e performance test on the reference machine |
| Memory the Edit history takes | ≤ 512 MB of image data held by the Edit history (kept layers or their differences, counted as width × height × 4 bytes), whatever the number and kind of Steps | the DEV resource ledger, asserted in a unit test and in e2e after 100 Applies of a new drawing over the whole image |
| No hidden growth beyond the budget | whole-page memory after 100 Applies of a new drawing over the whole image ≤ whole-page memory after the 10th such Apply + 10% | whole-page memory as export §6 measures it, Chromium e2e |
| Steps kept | at most 50; at least the last 10 when each is a drawing over the whole image on the reference Work; all 50 when they are Crops or Adjustments | unit test of the history bound, and the memory e2e above counting the Undos available |
| Exactness of undo and redo | difference 0 per channel between a full-size PNG Export after Undo (or Redo) and the Export of the same state made before it | e2e pixel comparison on Chromium, Firefox and WebKit, for Steps of each tool, with all seven Adjustments away from neutral and a Straighten angle |
| Memory released when Steps leave the Edit history | 0 retained layers that no kept Step, the Work or an open Draft refers to, after each of: replacing the Work, a new Step discarding redoable Steps (AC-04), and the oldest Steps being dropped (AC-11) | the DEV resource ledger, asserted in e2e for each of the three cases with 10 drawing Steps |

## 6.1 Security / privacy

- **Data classification:** confidential. The photos can be personal, and the Edit history keeps earlier states of the Work, including marks the Editor later removed.
- **Personal data touched:** none new. The Edit history holds earlier Geometries, Adjustments and Drawing layers of the open Work, in session memory only. It is never saved, never leaves the device and is discarded when the Work is replaced or the page is closed.
- **AuthZ/AuthN impact:** none. There are no accounts. The only refusals are the app's own rules: no Undo or Redo during an export (AC-07) or while a tool is open (AC-08).
- **Abuse cases:**
  - An Export that does not match what the Editor sees (an Undo landing in the middle of an export): Undo and Redo are refused while an export runs (AC-07), and an Export only ever contains the Work's current state.
  - A mark used to hide something, then removed by Undo: Undo only changes the Work in this session, and only what the Editor exports leaves the device. The Original already keeps the covered pixels until the Work is replaced (draw §6.1), so the Edit history reveals nothing new.
  - Resource exhaustion by applying many large drawings: the Edit history is bounded to 50 Steps and 512 MB, and drops the oldest first (AC-11, §6).
- **Security review:** N/A — no new input from outside the app, no new trust boundary and no new personal data; state stays in session memory.

## 7. Metrics / KPIs

- **Undo exactness on the reference set** (Steps of each tool, on Chromium, Firefox and WebKit) — baseline: 0 (no feature yet), target: 100% of undone and redone states identical to the original state's Export, by ship.
- **Actions to recover from a wrong Apply** — baseline: no way back except redoing the edit by hand (several actions, and impossible to restore exactly for a drawing that was cleared), target: 1 action (Undo), by ship.
- **Steps reachable on the reference Work** — baseline: 0, target: at least 10 Steps of drawings over the whole image and 50 Steps of Crops or Adjustments, within the 512 MB budget, by ship.

## 8. Open questions

_None open._ Every decision this spec needed was taken in the interview or the accepted assumptions ledger (2026-10-11). It closes three questions from earlier specs: export §8 and crop-rotate §8 (the save point, AC-09) and draw §8 (the unit of a Step, draw ADR-0005).
