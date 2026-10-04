---
id: T11
title: "Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions"
layer: "app"
deps: ["T4", "T5"]
blocks: ["T12", "T14", "T15", "T16"]
acs: ["AC-14", "AC-15", "AC-16", "AC-16b"]
files_hint: ["src/features/editor/store.ts"]
owner: "Blazheiko"
estimate: "M"
context_budget: "M"   # measured: 74 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T11 — Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions

## Place in the sequence

- **Blocked by:** T4 — Implement the pure View model (Fit, zoom steps, clamp, zoom-at-point, pan clamp, auto-fit) and the Work revision rule, T5 — Build the decode worker pipeline and the main-thread decodeImage client with supersede and error mapping.
- **Blocks:** T12 — Add drop sequencing, the messages catalog and the notices raised by each open, T14 — Build SCR-02's PreviewCanvas with the renderer, Fit on open, and the zoom and pan gestures, T15 — Build the status bar: Original dimensions readout, zoom controls with the live zoom level, and the zoom shortcuts, T16 — Build SCR-03, the replace confirmation dialog, on the store's confirming phase.
- **Wave:** 4 — after T4, T5 (wave 3).
- **Lane:** shares `src/features/editor/store.ts` with T12, T17, T20 — serialized.

## Why (user story)

> **US-06: Keep my work when opening another image**
>
> **As a** Editor  
> **I want** the app to protect the open Work when I open a different image  
> **So that** I never lose Unsaved edits by accident
>
> — `spec.md §4, US-06, verbatim` · full text: [spec.md](../spec.md)

It is the one place that decides whether a decoded image replaces the Work, so the Work is never lost and is only ever replaced by an image read successfully.

## Inlined context

> the `editor` store is the one place that decides whether a decoded image replaces the Work. […] every later intake (paste, "Open with…", gallery re-open) calls the same store action.
>
> — `sad.md §5, Building block view intro, abridged` · full text: [sad.md](../sad.md)

> SPA->>Core: asks whether the current Work has Unsaved edits
> alt no Work open, or no Unsaved edits → swaps in the new Work and sets the View to Fit
> else Unsaved edits → asks to confirm […] alt Editor confirms → swaps in the new Work and sets the View to Fit; else Editor cancels → closes the new bitmap, Work and View stay as they were, no notices
>
> — `sad.md §6, Flow 1, abridged` · full text: [sad.md](../sad.md)

> Every refusal ends the same way: the worker reports a typed reason, the `editor` store changes nothing, and the reason goes to the notice queue as a failure that stays until dismissed. A late answer from a terminated worker can never arrive, and the store also ignores any result whose open is no longer the latest.
>
> — `sad.md §6, Flow 2 note, verbatim` · full text: [sad.md](../sad.md)

> The `editor` store reads only `hasUnsavedEdits(work)` when deciding between replace and confirm; it never inspects which edits exist.
>
> — `adr/0005 §Decision outcome, How it works bullet 4, verbatim` · full text: [adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md](../adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md)

> Edits go through the `editor` store's edit entry point, which raises the revision (ADR-0005)
>
> — `sad.md §11, risk row 5, abridged` · full text: [sad.md](../sad.md)

> Decision override: AC-15 is verified in this feature against a test-prepared Work that has Unsaved edits, because no editing tool exists yet
>
> — `spec.md §1, Decision override 2, abridged` · full text: [spec.md](../spec.md)

> drop while open | Files dropped while the dialog is open | Ignored: the modal blocks until it is answered.
>
> — `screens.md §SCR-03, drop-while-open row, abridged` · full text: [screens.md](../screens.md)

> **Hard rule:** Latest open wins: the store gives every open an increasing id and accepts a result only if its id is still the latest; the previous worker is terminated at once (AC-16b). The View stays live during an open; the Work is swapped in one synchronous store action
>
> — `sad.md §8, Concurrency row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Every `ImageBitmap` is `close()`d as soon as it is no longer needed: intermediates in the worker, the new bitmap on a cancelled replace, the old Original after a replace. The old texture is deleted after the new one is uploaded (§6, flow 1). Each open's worker is terminated when its result arrives or when a newer open starts. Exactly one Original (bitmap + texture) is retained while a Work is open
>
> — `sad.md §8, Resource lifetime row, verbatim` · full text: [sad.md](../sad.md)

> **Hard rule:** Functional core with feature folders: `src/core/` is pure TypeScript with no Vue, Pinia or DOM; imports flow `features → core | render | infra | shared`; features never import each other and coordinate through the `editor` store — repo ADR 0002
>
> — `sad.md §2, Technical constraints, verbatim (link dropped)` · full text: [sad.md](../sad.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-14 — domain invariant

> **Given** the Editor has only zoomed or panned the open Work
> **When** the Editor opens another image
> **Then** no confirmation is asked, because View changes never count as Unsaved edits
>
> — `spec.md §5, AC-14, verbatim` · full text: [spec.md](../spec.md)

### AC-15 — cross-context

> **Given** the open Work has Unsaved edits made with an editing tool
> **When** the Editor opens another image that has been read successfully
> **Then** the app asks for confirmation and says the current edits will be lost. Choosing to cancel keeps the current Work and View exactly as they were and discards the image that was read. Notices about the new image (downscale, first frame only) appear only after it has actually replaced the Work
>
> *Verification note:* until an editing tool exists, this is verified with a Work prepared to have Unsaved edits; the first editing feature (roadmap step 4) re-verifies it with real edits.
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

### AC-16 — domain invariant

> **Given** an image is open
> **When** the Editor opens another file that turns out to be unreadable, unsupported, refused or not permitted
> **Then** no confirmation is asked, the open Work stays exactly as it was, and the matching reason is shown — the open Work is only ever replaced by an image that has been read successfully
>
> — `spec.md §5, AC-16, verbatim` · full text: [spec.md](../spec.md)

### AC-16b — cross-context

> **Given** an image is still being read after the Editor chose or dropped it
> **When** the Editor chooses or drops another file before that read finishes
> **Then** the earlier open is abandoned and never replaces the Work. Only the most recently chosen file can open. While a read is in progress, the current Work stays on screen and can still be zoomed and panned
>
> — `spec.md §5, AC-16b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] State: `work: Work | null`, `view: View`, `canvasSize`, `phase: 'idle' | 'reading' | 'confirming'`, `latestOpenId`, `pending: DecodedImage | null` — `src/features/editor/store.ts`
- [ ] Inject the decoder (`decodeImage` by default, a fake in tests) so the store is testable in Vitest
- [ ] `openImage(blob): Promise<OpenOutcome>` — `{ kind: 'replaced' | 'confirming' | 'refused' | 'superseded' | 'ignored', … }`; increments `latestOpenId`; drops any result whose id is not the latest (closing its bitmap); ignored while `phase === 'confirming'`
- [ ] No Work or `!hasUnsavedEdits(work)` → swap in one synchronous action: `createWork(original, newId())`, View = Fit with `autoFit: true`; old bitmap closed after the renderer took the new one
- [ ] `confirmReplace()` / `cancelReplace()` — cancel closes `pending.bitmap` and leaves Work + View identical
- [ ] `applyEdit()` — the edit entry point (`withEdit`), used by the e2e test hook to prepare Unsaved edits
- [ ] View actions delegating to `src/core/view`: `zoomAt`, `stepZoom`, `panBy`, `fit`, `actualSize`, `setCanvasSize`
- [ ] Vitest with a fake decoder (deferred promises) — `src/features/editor/store.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Refused file while a Work is open | Work and View identical, `phase: 'idle'`, no confirmation (AC-16) |
| Second open while the first is reading | first result ignored even if it arrives; only the latest can replace (AC-16b) |
| Zoom/pan during `reading` | View updates; Work untouched (AC-16b) |
| Work with only View changes | replaced without confirmation (AC-14) |
| Cancel in the confirmation | pending bitmap closed; Work, View and revision unchanged; outcome carries no notices (AC-15) |
| Open requested while `confirming` | `ignored` (SCR-03 blocks until answered) |

## Definition of Done

- [ ] Vitest proves AC-14, AC-15 (with `applyEdit` preparing Unsaved edits), AC-16 and AC-16b against a fake decoder, including bitmap `close()` on cancel and on stale results
- [ ] every Hard Rule inlined above still holds; lint + typecheck clean
