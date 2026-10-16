---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-16"
feature_size: "S"
ticket: "roadmap step 9 — pwa-install-update"
---

# 0003 — Keep the Work to reopen as a take-once id in this tab's sessionStorage

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Blazheiko (owner), design Socratic walk (easy depth)

## Context

After an update reload, the new version must reopen the Work that was open, exactly as the Gallery reopens it (AC-08). A reload discards the page's memory, so the id of that Work has to survive it somewhere. The Gallery deliberately reopens nothing on start (gallery AC-05). Spec §6.1 requires a security review that confirms the marker holds only the Work's id, lives only in that window, is gone once the Work reopens or the window closes, and that no other start reopens a Work. That rule covers the shared-computer abuse case.

## Decision drivers

- spec §6.1: only the id, only this window, gone after use or when the window closes, no other start reopens a Work
- spec AC-08: only a reload chosen through the update notice in this window reopens a Work
- spec AC-12: after a confirmed reload, the last Stored state reopens, or no Work opens when there is none
- sad.md §2: per-tab `sessionStorage` survives a reload of that tab and is cleared when it closes

## Considered options

1. **`sessionStorage`, take-once.** Write the id just before the reload, then read and delete it at start before reopening.
2. **A URL parameter** (`/imgly/?reopen=<id>`), removed with `history.replaceState` after start.
3. **A record in the Gallery's IndexedDB `meta` store.**

## Decision outcome

**Chosen:** Option 1. It meets every point of §6.1 through the browser's own scoping, with no window ids. Option 2 puts the id into the browser's history, bookmarks and reopened-tab list, so a later start from any of them would reopen the Work, which breaks "only a reload the Editor chose". Option 3 is shared by every window and survives closing it, so another window or a later start could reopen someone's Work.

How it works:

- `src/infra/platform/reload-marker.ts` exposes `markReopen(id)` and `takeReopen()`. It uses one fixed key and stores the Work id as a plain string.
- `markReopen` runs only from the update reload path, after `requestReload()` passes, and only when the open Work has a Stored state (when it runs: see the 2026-10-16 amendment). A confirmed reload with no Stored state writes nothing (AC-12).
- At start, the app shell calls `takeReopen()` first (2026-10-16 amendment), which reads and deletes the marker in one step, then `editor.reopenWork(id)` once the Gallery connects. A failed reopen, for a Damaged or evicted Work, shows a notice saying why and opens no Work (AC-08).
- Every start takes the marker, but only the update reload path writes it, so a start with no marker opens no Work. No other code path reads the key. A storage failure (`sessionStorage` blocked) makes the reload open no Work, which is the safe default.

## Amendment 2026-10-16

The decision stands. The 2026-10-15 review (R3) and the 2026-10-16 re-review (N1, N3) moved when the marker is written and taken, which narrows the time it exists:

- **Written at the switch, not before it.** `markReopen` runs on this window's `controllerchange`, just before the reload, not when "Reload" is chosen. With no worker waiting, it runs just before the plain reload. If the waiting worker does not take control within 10 s, the window stays, and nothing is written.
- **One switch.** The first `controllerchange` after "Reload" writes the marker and reloads once. A later one is treated as another window's switch and writes nothing.
- **Taken first at start.** `takeReopen()` runs synchronously in the app shell's setup, before the Gallery connects or anything can fail, so a failed start or an early F5 cannot leave the marker behind. The reopen itself still waits for the Gallery.
- **Nothing can change the Work while leaving.** From "Reload" until the reload, the editor refuses tools, Undo/Redo, opens and reopens, so the Work the marker names is the one the Reload gate checked.

The "Duplicate tab" window in the Consequences below is now only the moment between `controllerchange` and the reload.

## Consequences

**Positive**
- The privacy rule is structural: the browser itself drops the marker with the tab, and the marker is deleted before it is acted on, so a crash during reopen cannot loop.
- Nothing new is stored in IndexedDB, and the Gallery schema is unchanged.

**Negative**
- "Duplicate tab" copies `sessionStorage`. The marker exists only between the click on "Reload" and the new version's start, so a duplicate made in that moment could also reopen the Work. The Security Lead reviews this window (§11).

**Neutral**
- The marker key is part of no contract outside this feature, so changing its storage later touches one infra file.

## Links

- Spec: [[../spec.md]] AC-08, AC-12, §6.1
- SAD: [[../sad.md]] §4, §6, §8, §11
- Related ADR: [[0004-own-the-reload-gate-in-the-editor-store-and-the-install-and-update-ui-in-a-new-feature]]; gallery ADR-0001 (`reopenWork`)
