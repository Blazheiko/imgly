---
id: T23
title: "Align spec AC-10, AC-12 and §6.1 with the design, record the narrowed replace confirmation in open-and-view, add the design terms to CONTEXT, and update the architecture map"
layer: "docs"
deps: []
blocks: []
acs: ["AC-10", "AC-12", "AC-17"]
files_hint: ["docs/features/gallery/spec.md", "docs/features/open-and-view/spec.md", "CONTEXT.md", "docs/architecture-map.md"]
owner: "Blazheiko"
estimate: "S"
context_budget: "M"   # measured: 56 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T23 — Align spec AC-10, AC-12 and §6.1 with the design, record the narrowed replace confirmation in open-and-view, add the design terms to CONTEXT, and update the architecture map

## Place in the sequence

- **Blocked by:** — (nothing; docs only).
- **Blocks:** — (nothing waits on it; it must be done before `/sdd:ship`).
- **Wave:** 1 — starts with the core and migration tasks.
- **Lane:** own lane (docs only; no code task touches these files).

## Why (user story)

> **US-05: Know how safe my Works are**
>
> **As an** Editor  
> **I want** the app to tell me plainly where my Works are kept, whether the browser may clear them, and when a Work was removed or could not be saved  
> **So that** I export what I must not lose and am never surprised by a missing Work
>
> — `spec.md §4, US-05, verbatim` · full text: [spec.md](../spec.md)

It brings the written promises (spec, CONTEXT, architecture map, open-and-view) in line with what the Gallery actually does.

## Inlined context

> - Decision override: spec AC-10 — when the open Work does not fit even once every other Work would be evicted, nothing is evicted, the earlier stored state of the open Work stays, and the "could not save, export to keep a copy" notice is shown — rationale: removing Works that cannot make room helps no one, and keeping the save as one transaction keeps quality goal 1 (owner, 2026-10-13, ADR-0004). AC-10's wording is to be updated (§11).
> - Decision override: spec §6.1 abuse case and AC-12 example ("private windows store nothing") — where a private window can open IndexedDB, the Gallery works for that window's life with the non-persistent storage line, and the browser discards it when the window closes. Browsers expose no reliable private-mode signal, so the app does not try to detect it — rationale: honest to how current engines behave, no fragile detection; needs Security Lead sign-off in the §6.1 security review (§11).
>
> — `sad.md §1, Decision overrides 1 and 2, verbatim` · full text: [sad.md](../sad.md)

> | AC-10's wording implies that every other Work is already evicted when the open Work still doesn't fit. The design evicts nothing in that case and keeps the earlier stored state, as the owner chose on 2026-10-13 (ADR-0004) | Low | Update AC-10's wording in `spec.md` to match before `sdd:tasks`. The e2e test follows the design | Blazheiko |
> | Spec §6.1 and AC-12 give a private window as an example of storage that can't be opened. Current Chromium, Firefox and WebKit private windows usually can open IndexedDB, keep it in memory, and clear it when the window closes | Medium | The Gallery works for that window's life, and its storage line shows the non-persistent wording (AC-13). Correct the example in spec §6.1 and AC-12 before `sdd:tasks`. Plan-tests checks the "storage blocked" case with blocked site data instead | Blazheiko |
>
> — `sad.md §11, AC-10 wording row + private-window row, verbatim` · full text: [sad.md](../sad.md)

> - Cross-feature change: replacing the Work, whether by opening a file, dropping one or reopening a Work from the Gallery, asks for confirmation only when the open Work has Unsaved edits that Autosave has not stored (AC-16, AC-17). This narrows open-and-view AC-15, whose dialog said the edits "will be lost", which stops being true once they are stored. The root CONTEXT invariant and the Unsaved edits entry are refined to match.
>
> — `spec.md §1, Traceability bullet 2, abridged` · full text: [spec.md](../spec.md)

> | Stored state | *Design term.* The last state of a Work whose save transaction committed. "Stored" means it can be read back after a reload (spec §6) |
> | Damaged Work | *Design term.* A Gallery entry whose record, thumbnail, Original or layer can't be read or fails validation. It never replaces the open Work, still counts toward the 20 places, and is evicted first (AC-08) |
> | Touched time (`touchedAt`) | *Design term.* When a Work was last opened, reopened or changed. It orders the Gallery and decides eviction (AC-03, AC-09) |
> | Replace gate | *Design term.* The shared decision every replacement of the Work passes: wait for a running save, then ask only when Unsaved edits are not stored (ux-flows, ADR-0001) |
> | Storage line | *Design term.* The one line in the Gallery that says where Works are kept and whether the browser may clear them, following the browser's current answer (AC-13) |
>
> — `sad.md §12, design-term rows, verbatim` · full text: [sad.md](../sad.md)

> **Then** the app asks for confirmation and says the current edits will be lost. Choosing to cancel keeps the current Work and View exactly as they were and discards the image that was read. […]
>
> — `open-and-view/spec.md §5, AC-15 Then, abridged` · full text: [open-and-view spec](../../open-and-view/spec.md)

New modules for the architecture map come from `sad.md` §5 (`src/core/gallery/`, `src/infra/work-codec/`, `src/infra/platform/storage-persistence.ts`, `src/features/gallery/`, `src/features/editor/autosave.ts`) and `data-model.md` (schema v2: `works`, `originals`, `layers`, `meta`).

**Fallback:** insufficient or contradicted by the code → read the named file in full ([spec.md](../spec.md) · [sad.md](../sad.md) · [data-model.md](../data-model.md) · [adr/](../adr/)) and follow it. Do not guess.

## Data delta

No DB changes. Docs only.

## API contract

Internal — no API surface. (`target_surfaces: [web-frontend]`; no `contracts/` folder for this feature.)

## Acceptance criteria

### AC-10 (US-05) — error

> **Given** the browser reports that the app's storage space is full when Autosave stores the open Work
> **When** Autosave runs after an image opens or after a Step, Undo or Redo
> **Then** the app evicts the least recently opened or changed Works that are not open in this tab, one at a time, until the open Work fits, and one notice names every Work it removed. If the open Work still does not fit once it is the only Work left, a notice says it could not be saved to the Gallery and to export it to keep a copy. The Work stays open and editable either way, and the Gallery keeps the earlier stored state of the open Work if there was one
>
> — `spec.md §5, AC-10, verbatim` · full text: [spec.md](../spec.md)

### AC-12 (US-05) — authorization

> **Given** storage cannot be opened for this app when the page loads, for example in a private window or with site data blocked for the site
> **When** the Editor opens an image and edits it
> **Then** opening, editing and exporting work as before. The Gallery shows that it is unavailable in this browser window and why in plain words, nothing is stored, and the app does not try to store anything again until the page is next loaded. Replacing the Work asks for confirmation whenever the open Work has Unsaved edits, as open-and-view AC-15 always did
>
> — `spec.md §5, AC-12, verbatim` · full text: [spec.md](../spec.md)

### AC-17 (US-06) — cross-context

> **Given** the open Work has Unsaved edits that are not stored in the Gallery, because Autosave failed, including a save that was still running when the Editor chose and then failed, or because the Gallery is unavailable
> **When** the Editor opens another image or chooses a Work in the Gallery
> **Then** the app asks for confirmation before replacing it, saying the latest edits are not saved in the Gallery and would be lost. Cancelling keeps the Work exactly as it was. Choosing a Work that cannot be read never replaces the open Work and never asks (open-and-view AC-16)
>
> — `spec.md §5, AC-17, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] AC-10 Then: say that when the open Work does not fit even with every other Work evicted, nothing is evicted, the earlier stored state stays, and the could-not-save notice shows; add a one-line "(clarified by design, ADR-0004, 2026-10-13)" note — `docs/features/gallery/spec.md`
- [ ] AC-12 Given and §6.1 (AuthZ bullet and the shared-computer abuse case): replace the private-window example with blocked site data; add that a private window that opens IndexedDB keeps the Gallery for its life with the non-persistent line — `docs/features/gallery/spec.md`
- [ ] Bump `updated_at` in the spec frontmatter
- [ ] AC-15: add a note "Narrowed by gallery AC-16/AC-17: asks only when the Unsaved edits are not stored in the Gallery; the dialog now says the latest edits aren't saved in the Gallery" — `docs/features/open-and-view/spec.md`
- [ ] Add Stored state, Damaged Work, Touched time, Replace gate and Storage line to `## Glossary`, each with a NOT-reference, without changing existing entries — `CONTEXT.md`
- [ ] Module inventory, Datastores (schema v2, four stores, `touchedAt` index), Where things live: add the new modules — `docs/architecture-map.md`
- [ ] Flag in the PR description that the private-window override needs Security Lead sign-off (sad §1 ¶4)

## Edge cases

| Case | Behaviour |
|---|---|
| Spec wording drifts from ADR-0004 | ADR-0004 wins; the spec text follows it |
| A CONTEXT term already exists with a different meaning | keep both definitions visible and raise it with the owner instead of overwriting |
| open-and-view AC-15 text | annotated, never rewritten (a released spec's history stays readable) |

## Definition of Done

- [ ] spec AC-10 says nothing is evicted when the open Work does not fit alone and the earlier stored state stays
- [ ] spec AC-12 and §6.1 use blocked site data, not a private window, as the example
- [ ] open-and-view spec AC-15 carries the narrowed-by-gallery note
- [ ] `CONTEXT.md` defines Stored state, Damaged Work, Touched time, Replace gate and Storage line
- [ ] `docs/architecture-map.md` lists `core/gallery`, `infra/work-codec`, `storage-persistence`, the gallery feature and schema v2
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint` clean (Prettier over the edited markdown)
