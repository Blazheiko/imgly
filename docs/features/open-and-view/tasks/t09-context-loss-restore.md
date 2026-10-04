---
id: T9
title: "Handle WebGL context loss: restore from the kept bitmap within the deadline, else report DISPLAY_LOST"
layer: "infra"
deps: ["T1", "T8"]
blocks: ["T17"]
acs: ["AC-19", "AC-19b"]
files_hint: ["src/render/preview-renderer.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 45 inlined lines
status: "done"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T9 — Handle WebGL context loss: restore from the kept bitmap within the deadline, else report DISPLAY_LOST

## Place in the sequence

- **Blocked by:** T1 — Add the open error codes and the header parser for JPEG, PNG/APNG, GIF and the refused formats, T8 — Build the WebGL2 preview renderer: mipmapped Original texture, View transform uniform, DPR sizing, draw-on-change.
- **Blocks:** T17 — Add the start-up capability gate and the blocking screens SCR-04, SCR-05 plus SCR-02's restoring state.
- **Wave:** 3 — after T1, T8 (wave 2).
- **Lane:** shares `src/render/preview-renderer.ts` with T8 — serialized.

## Why (user story)

> **US-08: Get an honest message when the browser can't render**
>
> **As a** Portfolio reviewer  
> **I want** to be told clearly when my browser can't display the editor, and to have the Preview come back by itself after a temporary graphics interruption  
> **So that** I don't judge the app on a blank or black canvas
>
> — `spec.md §4, US-08, verbatim` · full text: [spec.md](../spec.md)

It brings the Preview back by itself after sleep/wake or a graphics switch, and turns an unrecoverable loss into an honest status instead of a black canvas.

## Inlined context

> **Context loss**: `webglcontextlost` is `preventDefault()`ed; on `webglcontextrestored` the renderer rebuilds its program and re-uploads the texture from the Original `ImageBitmap`, which is retained for this reason, with the Work and View untouched (AC-19). If the context is not restored within a restore deadline, or recreating it fails, the renderer reports `DISPLAY_LOST` and the editor shows SCR-05 (AC-19b). The deadline is a tactical value set in `tasks`.
>
> — `adr/0003 §Decision outcome, How it works bullet 4, verbatim` · full text: [adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md](../adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md)

> R->>R: blocks the default so a restore is allowed, Work and View untouched
> alt the context comes back before the restore deadline → rebuilds the program and re-uploads the Original from the kept bitmap → draws at the unchanged View
> else not restored in time, or rebuilding fails → R->>ED: display lost
>
> — `sad.md §6, Flow 7, abridged` · full text: [sad.md](../sad.md)

> restoring | The graphics context was lost and a restore is pending before the deadline (AC-19, `sad.md` flow 7). The canvas area never shows black: it is filled with `--color-canvas-surround` and a `Spinner`.
>
> — `screens.md §SCR-02, restoring row, abridged` · full text: [screens.md](../screens.md)

> The WebGL context-restore deadline (ADR-0003) is not fixed yet; too short shows SCR-05 needlessly, too long leaves a black canvas | Low | Fix the value in `tasks` and cover it with a `WEBGL_lose_context` e2e for both AC-19 and AC-19b
>
> — `sad.md §11, risk row 8, verbatim` · full text: [sad.md](../sad.md)

> **Fixed by this breakdown:** restore deadline = `5000 ms` (`RESTORE_DEADLINE_MS`).
>
> — `tasks/_epic.md §Tactical values, verbatim` · full text: [_epic.md](./_epic.md)

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [screens.md](../screens.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-19 — cross-context

> **Given** an image is open
> **When** the device's graphics are interrupted temporarily, for example by sleep and wake or a graphics switch
> **Then** the Preview comes back by itself without reopening the file, and the Work and View are unchanged
>
> — `spec.md §5, AC-19, verbatim` · full text: [spec.md](../spec.md)

### AC-19b — error

> **Given** an image is open
> **When** the device's graphics are interrupted and the browser does not let the editor restore them
> **Then** the canvas area shows a full message in plain language instead of a blank or black canvas. The message says the display could not recover, suggests reloading the page, and says plainly that the open Work will be lost on reload
>
> — `spec.md §5, AC-19b, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] `RESTORE_DEADLINE_MS = 5000` — `src/render/preview-renderer.ts`
- [ ] Renderer status `'ready' | 'restoring' | 'lost'` exposed via an `onStatus(cb)` subscription
- [ ] `webglcontextlost` → `preventDefault()`, status `restoring`, start the deadline timer
- [ ] `webglcontextrestored` before the deadline → rebuild program + quad, re-upload from the retained bitmap, redraw at the current View, status `ready`
- [ ] Deadline passed, or rebuild throws → status `lost` (the store maps it to `DISPLAY_LOST`, T17); later `restored` events are ignored
- [ ] Vitest with a fake canvas event target and fake timers for all three transitions — `src/render/preview-renderer.test.ts`

## Edge cases

| Case | Behaviour |
|---|---|
| Restored after 1 s | status `ready`, same View, nothing reopened (AC-19) |
| Not restored within 5000 ms | status `lost` (AC-19b) |
| Restored after the deadline already fired | ignored — stays `lost` |
| Program rebuild throws on restore | status `lost` |
| Context lost again while restoring | timer restarts from the new loss |

## Definition of Done

- [ ] Vitest proves ready → restoring → ready, restoring → lost by deadline, and restoring → lost on rebuild failure
- [ ] `WEBGL_lose_context` e2e for AC-19 and AC-19b runs in T17
- [ ] lint + typecheck clean
