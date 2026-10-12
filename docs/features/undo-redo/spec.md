---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-12"
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

## Test plan

Size S on the quick route, so this plan sits inline here rather than in a separate `test-plan.md`. Inputs: §5 (AC-01 to AC-14) and §6 above; `sad.md` §6 (Critical flows 1 and 2, Flows 3 to 7) and §10; `ux-flows.md` (the e2e-through-UI scripts); `screens.md` SCR-01 to SCR-05 (the component states, the keyboard table and the message catalog); `tasks.json` (T1 to T13). `sad.md` declares `target_surfaces: [web-frontend]`, so the frontend tiers apply.

### Decisions taken in this plan

- **Levels (chosen by the owner, 2026-10-12).** Each AC fans out only to the chosen levels that have something to check:
  - History rules (AC-01, AC-02, AC-04, AC-05, AC-06, AC-11): unit, integration, component and e2e-through-UI.
  - Exactness and Geometry (AC-03, AC-12, AC-13): unit, integration and e2e-through-UI. No component level, because the simulated DOM has no WebGL2 or Canvas 2D, so pixels can only be checked in a real engine.
  - Refusals and the save point (AC-07 to AC-10): unit, integration, component and e2e-through-UI.
  - Discoverability (AC-14): unit, component and e2e-through-UI.
- **No visual-regression (chosen by the owner, as in adjust and draw).** Pixels are checked by comparing Exports, and button states and placement by component tests. No baseline images are kept.
- **Exactness tolerance is 0.** Every pixel row compares two full-size PNG Exports made by the same engine: the state after Undo or Redo against that same state exported before it. The required difference is 0 per channel on Chromium, Firefox and WebKit (§6). Unlike draw's 2/255 Preview-to-Export rows, no cross-path tolerance applies.
- **Integration means the real editor store.** The integration rows run the real `editor` store, the real `core` history and the real bitmap ledger together. The Edit history is never persisted (§6.1), so this feature adds no datastore. Where opening a Work needs IndexedDB, the tests use the in-memory IndexedDB engine the repo already uses, fresh for each test. Nothing is mocked: a store whose `record` is stubbed would pass while the Apply paths forget to call it.
- **Ledger at the end of every e2e flow that discards Steps.** Each such flow ends by asserting 0 retained layers through the test hooks (T9), so a missed release fails before the memory scenario would catch it.

### AC coverage

| AC (spec.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 | undo returns the state before the last Step | unit | the history gives back the previous state, the cursor moves back by one, and Redo becomes possible |
| AC-01 | undo and redo labels name the tool of the next Step | unit | after Crop then Adjust, the labels read "Undo Adjust" and, after one Undo, "Redo Adjust" and "Undo Crop and rotate" |
| AC-01 | store undo restores only what the last Step changed | integration | the part the Step changed returns to its earlier value, and the other two parts are the very same objects as before |
| AC-01 | undo button hint names the tool and the shortcut, and clicking it undoes | component | the hint shows "Undo Adjust" with its shortcut, and a click calls the store's undo once |
| AC-01 | undo by the button and by Ctrl/Cmd+Z takes back an Apply | e2e-through-UI | the Preview shows the Work before the Step, and Redo is available with its hint |
| AC-02 | redo re-applies the most recently undone Step | unit | the history gives back the undone state, and Redo stays possible while undone Steps remain |
| AC-02 | store redo after two undos restores each state in order | integration | each Redo restores the very objects of that state, and Redo becomes unavailable after the last one |
| AC-02 | redo button calls the store and shows the next tool | component | a click calls the store's redo once, and the hint names the tool of the Step it would restore |
| AC-02 | redo by the button, Shift+Ctrl/Cmd+Z and Ctrl+Y | e2e-through-UI | each of the three restores the undone Step in the Preview |
| AC-03 | restoring a state returns the very Geometry, Adjustments and Drawing layer | unit | the restored parts are the same objects as in the recorded state, and the Work's identity, Original and save revision are kept |
| AC-03 | three undos then three redos return each state's objects | integration | after three Undos the Work equals the opened Work, and after three Redos it equals the Work after the drawing |
| AC-03 | export after undo and redo is identical to the export made before | e2e-through-UI | at the opened state and after the drawing, the full-size PNG differs by 0 per channel, on all three engines, for Steps of each tool (a Straighten angle, all seven Adjustments away from neutral, a drawing) |
| AC-04 | recording after an undo discards the redoable entries | unit | the new Step becomes the last, the discarded entries are returned as evicted, and Redo is impossible |
| AC-04 | layers of discarded Steps are released | integration | the bitmap ledger shows 0 retained layers that no kept Step, the Work or an open Draft refers to |
| AC-04 | a new Apply after an undo makes Redo unavailable | component | the Redo button is unavailable with the hint "Nothing to redo" |
| AC-04 | a new Apply after undos discards them and releases their layers | e2e-through-UI | Redo is unavailable, and the test hooks report 0 retained layers after 10 drawing Steps are discarded |
| AC-05 | undo and redo at the ends of the history change nothing | unit | with nothing kept, Undo gives nothing back, and with nothing undone, Redo gives nothing back |
| AC-05 | shortcuts on an empty history do nothing | unit | the shortcut handler calls neither Undo nor Redo and shows no notice; it still takes the key from the browser (`preventDefault`), as for every handled key (screens.md §Keyboard) |
| AC-05 | buttons are unavailable with their "nothing" hints | component | on a fresh Work both buttons are unavailable with "Nothing to undo" and "Nothing to redo", and with no Work (SCR-02) both are unavailable |
| AC-05 | Ctrl/Cmd+Z on a freshly opened image leaves it unchanged | e2e-through-UI | the Preview and the Work are unchanged, and no notice appears |
| AC-06 | only an Apply that counts as an edit records a Step | integration | zoom, pan, a cancelled tool, an Apply with no change and an Export add no Step, and Undo still takes back the last real change |
| AC-06 | undo after view changes, a cancel, an empty Apply and an export | e2e-through-UI | Undo takes back the last applied change, and the View stays where the Editor left it |
| AC-07 | shortcuts during an export show the export notice | unit | the handler returns the "export in progress" notice and no Undo or Redo |
| AC-07 | store refuses undo and redo while an export runs | integration | the Work is unchanged, nothing is queued, and after the export ends the Edit history is the same |
| AC-07 | buttons are disabled during an export | component | in SCR-04 both buttons are truly disabled with the export hint |
| AC-07 | Ctrl/Cmd+Z during an export does not change the file | e2e-through-UI | the saved file matches the Work as it was when the export was confirmed, and Undo works again after it ends |
| AC-08 | shortcuts with a tool open show the apply-or-cancel notice | unit | the handler returns the "apply or cancel the open tool first" notice and no Undo or Redo |
| AC-08 | shortcuts in a focused text or number field are left to the field | unit | the handler returns no action, and the key keeps its usual meaning in the field |
| AC-08 | store refuses undo while a tool is open | integration | the Work and the tool's Draft are unchanged, and after Apply the tool's Step is the last one in the Edit history |
| AC-08 | buttons with a tool open show the notice when activated | component | in SCR-03 both buttons are unavailable to assistive technology, and activating one shows the info notice |
| AC-08 | Ctrl/Cmd+Z inside an open Draw tool keeps its strokes | e2e-through-UI | the unapplied strokes stay and the notice shows; after Apply, Undo takes them all back as one Step |
| AC-09 | the save point follows the last successful export | unit | for the Undo, Undo, Redo sequence of AC-09 the Unsaved edits flag reads none, set, none, and a revision reused after an Undo never matches the save point by accident |
| AC-09 | a cancelled or failed export does not move the save point | integration | after a cancelled or failed export, undoing to that state still leaves Unsaved edits |
| AC-09 | never-exported Work: undoing every Step clears Unsaved edits | integration | at the opened state there are no Unsaved edits, and after an Export, undoing past it to the opened state sets them again |
| AC-09 | opening another image at the save point skips the confirmation | e2e-through-UI | after Export, a new Step and one Undo, opening another image replaces the Work without the dialog |
| AC-10 | replacing the Work starts an empty history and releases every old layer | integration | Undo and Redo are impossible, and the bitmap ledger shows 0 retained layers from the previous Work |
| AC-10 | cancelling the replacement keeps the Work and its history | integration | the Work, the Edit history and the cursor are exactly as before |
| AC-10 | shortcuts do nothing while the replace dialog is open | unit | the handler returns no action |
| AC-10 | after replacing, both buttons show nothing to undo or redo | component | both buttons are unavailable with their "nothing" hints |
| AC-10 | replacing the Work through the dialog clears the history | e2e-through-UI | both buttons are unavailable, and the test hooks report 0 retained layers |
| AC-11 | 10 full-image drawing Steps fit the budget and an 11th drops the oldest | unit | on the reference Work, 10 layers (503 316 480 B) stay within 512 000 000 B, and the 11th drops the oldest entry, with no message |
| AC-11 | 50 Crop or Adjust Steps are kept and a 51st drops the oldest | unit | the count limit drops the oldest first, and the newest 50 stay |
| AC-11 | a shared layer counts once and the Work's own layer is not counted | unit | the budget counts each held layer once, so a 4096 × 4096 Work keeps 7 drawing Steps |
| AC-11 | dropped oldest Steps release their layers | integration | the bitmap ledger shows 0 retained layers that no kept Step refers to |
| AC-11 | undo stops at the oldest kept Step | component | the Undo button is unavailable with "Nothing to undo" once the cursor reaches the oldest kept entry |
| AC-11 | 100 full-image drawing Applies stay within the budget | e2e-through-UI | on Chromium, the held bytes stay at most 512 000 000 after every Apply, and at least 10 Undos are available |
| AC-12 | a Step changes the image size only when the output size differs | unit | Crop and Rotation steps that change the output size are flagged, while Adjustments, drawings and same-size Crops are not |
| AC-12 | a size-changing undo fits the View and a same-size undo keeps it | integration | after a zoom, Undo of a size-changing Crop fits the restored image, and Undo of Adjustments keeps the zoom and pan, while the export size field shows the restored size |
| AC-12 | undoing a Crop after zooming fits the restored image | e2e-through-UI | the whole restored image is visible, and an Undo of a drawing keeps the zoom |
| AC-13 | restoring a state returns the Drawing layer together with its Geometry | unit | the layer and the Geometry come from the same recorded state, never mixed |
| AC-13 | marks return with the Geometry they were applied under | integration | through draw, Crop, Rotation, Clear and draw again, each Undo restores a matching layer and Geometry pair |
| AC-13 | marks follow the image back through an undo of a Rotation | e2e-through-UI | the Export after each Undo differs by 0 per channel from the Export of that state made before, with marks neither shifted nor stretched |
| AC-14 | text and number fields are recognised as text targets | unit | text, number, textarea, select and contenteditable count as text targets, while checkboxes and sliders do not |
| AC-14 | Ctrl+Z and Cmd+Z undo, and Cmd+Y is never handled | unit | the handler maps the documented keys, ignores key repeats, and stops the browser's default only for keys it handles |
| AC-14 | undo and redo sit after Open image and work by keyboard | component | the two buttons come right after "Open image" in the top bar, Tab reaches them, Enter and Space activate them, and each hint names the action and its shortcut |
| AC-14 | shortcuts act on each engine | e2e-through-UI | on Chromium, Firefox and WebKit, Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z and Ctrl+Y redo, and Cmd+Y is left to the browser |

### Edge cases / error paths

- Key held down (repeated keydown events) → expected: one Undo per key press, never a run of Undos.
- Undo pressed at the oldest kept Step after a trim → expected: unavailable as in AC-05. No message says Steps were dropped.
- An Apply with no change right after an Undo → expected: not a Step, so the redoable Steps survive and Redo stays available.
- A Work larger than the reference (4096 × 4096) → expected: the budget, not the count, decides, and 7 full-image drawing Steps are kept.
- A revision number reached again after an Undo and a new edit → expected: Unsaved edits are not cleared by accident; only the exported state is the save point.
- An export that fails or is cancelled → expected: the save point does not move, and Undo and Redo become available again with the same history.
- The replace dialog is open → expected: the shortcuts do nothing, and the dialog owns the keys.
- Ctrl/Cmd+Z in a focused number field in the Export panel or Adjust → expected: the field's own undo happens, and the Edit history is untouched.
- No image open → expected: both buttons are unavailable, and the shortcuts do nothing.

### Test data

- Seed strategy: unit rows build Work states with the `core` document functions, and layers are small stand-ins with a stated width and height, so the budget arithmetic uses real sizes without allocating them. Integration and component rows open a small fixture image through the real store. e2e rows use the 4096 × 3072 reference fixture already in `e2e/fixtures/`, and a full-image drawing is applied through the Draw tool by the existing draw helpers.
- Integration dependency: the real editor store, `core` history and bitmap ledger, with a fresh in-memory IndexedDB engine per test where opening a Work needs one. Nothing is a mocked store.
- Cleanup boundary: per test. Each unit, integration and component test builds a fresh store; each e2e test opens a fresh page, and every flow that discards Steps ends with the 0-retained-layers ledger check.

### NFR validation (load)

The tool is the performance suite already in the repo (the opt-in performance e2e tests run on the reference machine). Each scenario quotes a §6 row.

- Undo and Redo latency p95 ≤ 150 ms → scenario: on the reference Work with a full-image drawing, run 2 warm-ups and then 20 timed runs of Undo and of Redo for a Step of each tool. Measure from the shortcut's key press to the next presented Preview frame, and assert p95 ≤ 150 ms for each tool and direction.
- Edit history memory ≤ 512 MB → scenario: 100 consecutive Applies of a new full-image drawing on the reference Work in Chromium. After every Apply, assert held bytes ≤ 512 000 000.
- No hidden growth → scenario: the same 100 Applies. Assert whole-page memory after the 100th ≤ whole-page memory after the 10th + 10%, measured as export §6 measures it.
- Steps kept → scenario: after the 100 Applies, count the available Undos and assert at least 10.
- Memory released → scenario: for each of replacing the Work, a new Step discarding redoable Steps, and the oldest Steps being dropped, apply 10 drawing Steps, trigger the case, and assert 0 retained layers.

### CI placement

- On every PR: unit, integration and component. They are the fast suites in the pre-commit gate.
- On every PR, or at least before release: the e2e-through-UI exactness, View and shortcut flows on all three engines, because exactness is the feature's first quality goal.
- On schedule or before release: the latency scenario, which is opt-in and runs on the reference machine, and the 100-Apply memory scenario on Chromium.
