---
id: T1
title: "Add the pure update-check schedule nextCheckDue in src/core/app-update"
layer: "domain"
deps: []
blocks: ["T8"]
acs: ["AC-15"]
files_hint: ["src/core/app-update/", "src/core/index.ts"]
owner: "Blazheiko"
estimate: "S"
context_budget: "S"   # measured: 31 inlined lines
status: "todo"
---
<!-- Self-contained task. Every inlined chunk carries a provenance signature; the source always wins.
To the executing agent: work from what is inlined here. If a slice is insufficient, ambiguous, or
contradicts the code in front of you, open the named file for the full text and follow that.
Do not invent the missing part. -->

# T1 — Add the pure update-check schedule nextCheckDue in src/core/app-update

## Place in the sequence

- **Blocked by:** — · **Blocks:** T8 — Add the pwa-install-update feature store's update lifecycle · **Wave:** 1, a pure function with no dependencies.
- **Lane:** own lane.

## Why (user story)

> **As an** Editor
> **I want** to be told when a new version is available and pick the moment to switch to it
> **So that** an update never reloads the page under me
>
> — `spec.md §4, US-04, verbatim` · full text: [spec.md](../spec.md)

This task decides *when* a window looks for a new version, as a pure, fake-clock-testable rule.

## Inlined context

> | From a newer version being published to an open, online window showing the update notice | ≤ 60 minutes plus the download time. Each window checks on start and at most once every 60 minutes while it is visible; a hidden window does not check, and checks on becoming visible again when 60 minutes have passed | unit test of the check schedule with a fake clock; e2e that publishes a second build and triggers a check |
>
> — `spec.md §6, NFR row 1, verbatim` · full text: [spec.md](../spec.md)

> `core/app-update/  NEW  nextCheckDue(lastCheck, now, visible): on start, ≤ 1 per 60 min while visible, on becoming visible after 60 min`
>
> The check schedule is a pure `core` function of the last check time, the current time and the window's visibility, driven by a timer and `visibilitychange` in the feature store.
>
> — `sad.md §5 decomposition + §8 Timing, abridged` · full text: [sad.md](../sad.md)

> **Hard rule:** `src/core/` imports nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this).
>
> — `CLAUDE.md §Module boundaries, verbatim`

**Fallback:** insufficient or contradicted by the code → read [spec.md](../spec.md) §6 and [sad.md](../sad.md) §5, §8 and follow them. Do not guess.

## Data delta

No DB changes.

## API contract

Internal — no API surface.

## Acceptance criteria

### AC-15 — error

> **Given** the app is open without a connection, or the check for a new version fails
> **When** the app would look for a new version
> **Then** no notice and no error appear, the app keeps working on its current version, and it looks again at the next check
>
> — `spec.md §5, AC-15, verbatim` · full text: [spec.md](../spec.md)

## Checklist

- [ ] Define `UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000` and `nextCheckDue(lastCheck: number | null, now: number, visible: boolean): boolean` — `src/core/app-update/schedule.ts`.
- [ ] Rules: `lastCheck === null` (start) → due when visible; hidden → never due; visible and `now - lastCheck >= 60 min` → due; otherwise not due. Also expose the delay until the next check (for the feature store's timer) — `schedule.ts`.
- [ ] `index.ts` barrel, re-exported from `src/core/index.ts`.
- [ ] Fake-clock unit tests — `src/core/app-update/schedule.test.ts`.

## Edge cases

| Case | Behaviour |
|---|---|
| Hidden window at start | Not due. It becomes due when it becomes visible (`lastCheck === null`) |
| Window hidden for 2 h, then visible | Due at once on becoming visible |
| Visible again after 10 min | Not due, so a tab switch never makes a burst of checks |
| A failed check (AC-15) | Counts as a check: the caller records `lastCheck`, and the next try is ≥ 60 min later, never a retry burst (`sad.md §6`, flow 6) |
| Clock moved backwards (`now < lastCheck`) | Not due until 60 min after `lastCheck`. Never throws |

## Definition of Done

- [ ] `schedule.test.ts` covers start, the 60-min boundary (59:59 not due, 60:00 due), hidden, visible-after-hidden, and backwards clock.
- [ ] No import outside `src/core/` (ESLint boundary rule green).
- [ ] every Hard Rule inlined above still holds
- [ ] `pnpm lint && pnpm typecheck && pnpm test` clean
