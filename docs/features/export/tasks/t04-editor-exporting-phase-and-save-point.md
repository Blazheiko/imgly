---
id: T4
title: "Add the editor store's exclusive exporting phase, beginExport/finishExport and the save point"
layer: "app"
deps: ["T3"]
blocks: ["T9"]
acs: ["AC-09", "AC-10", "AC-11"]
files_hint: ["src/features/editor/store.ts", "src/features/editor/messages.ts", "src/features/editor/index.ts", "src/features/editor/store.test.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 57 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T4 — Add the editor store's exclusive exporting phase, beginExport/finishExport and the save point

## Place in the sequence

- **Blocked by:** T3 — Carry Source name, Source format and the transparency fact on the Work from every open.
- **Blocks:** T9 — Orchestrate the export in the export store: snapshot, encode, Save as… or download, refusals, File ready, save point.
- **Wave:** 3 — after T3.
- **Lane:** shares `src/features/editor/store.ts` with T3 — serialized.

## Why (user story)

> **US-05: Know that my work is saved**
>
> **As a** Editor  
> **I want** a successful export to count as saving my Work  
> **So that** I am not asked to confirm replacing a Work whose edits I have already saved, and I am still asked when I have not
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It makes a finished export the only thing that marks the Work saved, and blocks every competing change while an export runs.

## Inlined context

> 4. **A save point on the Work, set only by a finished hand-off** — inline, extends open-and-view [ADR-0005](../open-and-view/adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md). The `editor` store enters an exclusive `exporting` phase at confirm, snapshots the Work's `revision`, and on success sets `cleanRevision` to it, which is the "later, at save" that ADR-0005 left open. Nothing else marks a Work saved, so a cancel, a refusal or a failure can never clear Unsaved edits (AC-09, AC-10).
>
> — `sad.md §4, Top strategic choice 4, verbatim` · full text: [sad.md](../sad.md)

> - The `editor` store gains the phase `exporting` and two actions. `beginExport()` refuses unless the phase is `idle` and a Work is open; otherwise it enters `exporting` and returns a snapshot `{ workId, revision, original, sourceName, sourceFormat }`. `finishExport(snapshot, saved)` returns to `idle` and, when `saved`, sets `cleanRevision = snapshot.revision`. While `exporting`, `openImage`, `openDrop` and `applyEdit` refuse, and a drop raises the "wait for the export to finish" notice (AC-11). View actions stay live.
>
> — `sad.md §5, Cross-feature changes bullet 2, verbatim` · full text: [sad.md](../sad.md)

> | Concept | Convention | Where defined |
> |---|---|---|
> | Concurrency | One export at a time. The `editor` store's `exporting` phase is exclusive: opens, drops, edits and a second export are refused, not queued, while zoom and pan stay live (AC-11). The export works on the snapshot taken at confirm. The panel cannot be closed and Ctrl/Cmd+S does nothing while exporting (AC-17), except that Escape or a click outside cancels the "File ready — Save…" state (§1 Decision override) | here; `src/features/editor/store.ts` |
> | Save point | Only `finishExport(snapshot, saved: true)` moves `cleanRevision`, and only to the revision at confirm (ADR-0005 extended). "Saved" means written and closed through `createWritable()`, or `click()` on the download link after the file was verified (AC-02, §1 spec override) | here; ADR-0001 |
>
> — `sad.md §8, verbatim` · full text: [sad.md](../sad.md)

> | Kind | Code / trigger | AC | Copy |
> |---|---|---|---|
> | info | file dropped during an export | AC-11 | Wait for the export to finish, then drop the image again. |
>
> — `screens.md §Message catalog (drop row), verbatim` · full text: [screens.md](../screens.md)

> **Hard rule:** Edits go through `applyEdit`, which refuses while exporting; the save point is the snapshot's revision, never the current one, so a stray edit stays unsaved
>
> — `sad.md §11, risk row 5, Mitigation, verbatim` · full text: [sad.md](../sad.md)

> - [ ] After an export, when an edit is undone back to the exported state, does the Work have Unsaved edits? Default now: the export sets a save point, so undoing back to it clears Unsaved edits and moving away from it sets them again. — owner: Blazheiko (owner), due: before the first editing feature (roadmap step 4) re-verifies AC-09
>
> — `spec.md §8, Open question 3 (out of scope here), verbatim` · full text: [spec.md](../spec.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. (IndexedDB is not touched by this feature — `sad.md` §2: "No persistence in this feature".)

## API contract

Internal — no API surface. (No server and no `contracts/` folder — `screens.md` §Source.)

## Acceptance criteria

### AC-09 — domain invariant

> **Given** the open Work has Unsaved edits
> **When** an export completes (the file is written in the "Save as…" dialog, or handed to the browser's downloads where there is no dialog)
> **Then** the Work no longer has Unsaved edits, and opening another image replaces it without asking for confirmation. Any edit made after that export makes the Work have Unsaved edits again
>
> — `spec.md §5, AC-09, verbatim` · full text: [spec.md](../spec.md)

### AC-10 — cross-context

> **Given** the open Work has Unsaved edits and the Editor has started an export
> **When** the Editor cancels the "Save as…" dialog, or the file cannot be written or handed off
> **Then** the Work keeps its Unsaved edits, so a later replace still asks for confirmation. Cancelling shows no message, and a failure shows its reason
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-11 — cross-context

> **Given** an export is in progress, from the moment the Editor confirms in the panel, including while the "Save as…" dialog is open
> **When** the Editor tries to edit the Work, open another image, or start a second export
> **Then** these actions are unavailable until the export has finished or failed, and they are refused, not queued: "Open image", Export and the editing controls are visibly disabled, and Export shows the progress. A file dropped during an export is not opened, and a notice asks the Editor to wait for the export to finish; only a drop shows this notice. A progress indicator is shown. Zooming and panning stay available. The file contains the Work exactly as it was at the moment the Editor confirmed in the panel
>
> — `spec.md §5, AC-11, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Add `'exporting'` to `EditorPhase`; add `ExportSnapshot` and `beginExport(): ExportSnapshot | null`, `finishExport(snapshot, saved: boolean)` — `src/features/editor/store.ts`
- [ ] Make `openImage`/`openFile` return without effect, `applyEdit` no-op, and `openDrop` raise the info notice while `exporting`; nothing is queued — `src/features/editor/store.ts`
- [ ] Add the drop-during-export copy to the editor's catalog — `src/features/editor/messages.ts`
- [ ] Export the `ExportSnapshot` type from `src/features/editor/index.ts` (the export feature's only import path)
- [ ] Vitest for begin/finish, the refusals, the save point and "edit after export → Unsaved again" — `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| `beginExport()` with no Work, while `reading` or `confirming`, or while already `exporting` | returns `null`, phase unchanged |
| `finishExport(s, false)` (cancel, refusal, failure) | phase `idle`, `cleanRevision` unchanged → replace still asks (AC-10) |
| `finishExport(s, true)` after `revision` moved during the export | `cleanRevision = s.revision`, so the Work still has Unsaved edits |
| `finishExport` with a snapshot whose `workId` is not the open Work | phase `idle`, no save point |
| Drop during an export | not opened, not queued, one info notice |
| Zoom / pan / fit during an export | work exactly as when idle |

## Definition of Done

- [ ] Vitest proves a successful finish clears Unsaved edits and a replace then needs no confirmation (AC-09), and that a failed/cancelled finish keeps them (AC-10)
- [ ] Vitest proves openFile, openDrop (with its notice) and applyEdit are refused, not queued, during `exporting`, while View actions still change the View (AC-11)
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
