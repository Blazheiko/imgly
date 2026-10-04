---
id: T16
title: "Build SCR-03, the replace confirmation dialog, on the store's confirming phase"
layer: "ui"
deps: ["T10", "T11", "T13"]
blocks: ["T19"]
acs: ["AC-15"]
files_hint: ["src/features/editor/components/ReplaceDialog.vue", "src/features/editor/EditorView.vue"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 36 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T16 — Build SCR-03, the replace confirmation dialog, on the store's confirming phase

## Place in the sequence

- **Blocked by:** T10 — Add the notice queue and the shared UI primitives Spinner, Toast, ToastStack, Dialog and CanvasMessage, T11 — Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions, T13 — Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary.
- **Blocks:** T19 — Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal.
- **Wave:** 7 — after T10, T11, T13 (wave 6).
- **Lane:** shares `src/features/editor/EditorView.vue` with T13, T14, T15, T17 — serialized.

## Why (user story)

> **US-06: Keep my work when opening another image**
>
> **As a** Editor  
> **I want** the app to protect the open Work when I open a different image  
> **So that** I never lose Unsaved edits by accident
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It is the one moment the Editor is asked anything: replace and lose the edits, or cancel and keep the Work exactly as it was.

## Inlined context

> default | A new image was read successfully while the Work has Unsaved edits (AC-15, `sad.md` flow 1 `else` branch). It is modal over the dimmed SCR-02, with the Work still visible behind it. Focus is trapped and goes to **Cancel** first; on close it returns to the element that had it | `ReplaceDialog` (`Dialog`, role `alertdialog`): title "Replace the current image?", body "Your edits to the current image will be lost.", `BaseButton` secondary "Cancel" + `BaseButton` primary "Replace"
> replace | "Replace" pressed | → SCR-02 `success`: the new Work at Fit, **then** its notices
> cancel | "Cancel", `Esc`, or a click on the backdrop | → SCR-02 with the Work and View exactly as before. The read image is discarded and no notices appear (AC-15)
> drop while open | Files dropped while the dialog is open | Ignored: the modal blocks until it is answered. The window drop guard still stops navigation (AC-02). No `DropOverlay` is shown
>
> — `screens.md §SCR-03, state rows, verbatim (N/A rows dropped)` · full text: [screens.md](../screens.md)

> **Hard rule:** Every control (Open image, zoom in and out, Fit, 100%, the replace dialog, notice dismiss) is a focusable button with a visible focus ring; the replace dialog traps focus and returns it on close.
>
> — `sad.md §8, Keyboard and focus row, abridged` · full text: [sad.md](../sad.md)

> **Hard rule (reuse):** All tokens are CSS custom properties in one file. A component or screen never hard-codes a colour, spacing value or font inline. It references `var(--…)`.
>
> — `design-system.md §Token source, verbatim` · full text: [design-system.md](../../../design-system.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-15 — cross-context

> **Given** the open Work has Unsaved edits made with an editing tool
> **When** the Editor opens another image that has been read successfully
> **Then** the app asks for confirmation and says the current edits will be lost. Choosing to cancel keeps the current Work and View exactly as they were and discards the image that was read. Notices about the new image (downscale, first frame only) appear only after it has actually replaced the Work
>
> *Verification note:* until an editing tool exists, this is verified with a Work prepared to have Unsaved edits; the first editing feature (roadmap step 4) re-verifies it with real edits.
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Reuse: `Dialog` (T10), `BaseButton` secondary + primary — no new primitive
- [ ] `ReplaceDialog.vue` — copy exactly as SCR-03; initial focus on Cancel; `cancel` (button/`Esc`/backdrop) → `store.cancelReplace()`; Replace → `store.confirmReplace()` — `src/features/editor/components/ReplaceDialog.vue`
- [ ] `EditorView.vue`: render it when `phase === 'confirming'`; hide `DropOverlay` and ignore drops/shortcuts while it is open
- [ ] E2E `e2e/open-and-view/replace.spec.ts`: open A → `__imglyTest.applyEdit()` → open B → dialog; Cancel keeps A's `work().id`, `revision` and the zoom readout; Replace shows B at Fit then its notices

## Edge cases

| Case | Behaviour |
|---|---|
| `Esc` or backdrop click | same as Cancel |
| Files dropped while the dialog is open | ignored; no overlay; no navigation |
| Work with only View changes | no dialog at all (AC-14, T11) |
| Replace of a downscaled animated image | notices appear only after the dialog closes on Replace |
| Cancel | no notices; the read bitmap was closed (T11) |

## Definition of Done

- [ ] Playwright e2e on three engines proves AC-15 (both branches) with a test-prepared Work, focus on Cancel first and focus return
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
