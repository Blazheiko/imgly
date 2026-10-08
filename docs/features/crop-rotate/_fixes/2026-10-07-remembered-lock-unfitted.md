---
slug: crop-rotate
date: 2026-10-07
triage: spec-bug
acs: [AC-08, AC-12]
commit: the commit with trailer SDD-Fix: 2026-10-07-remembered-lock-unfitted
recurrence_of: none
---

# Fix: reopening with a remembered proportion shows it locked over an unfitted frame

## Symptom

Choosing a proportion (e.g. 1:1), then Cancel, then reopening the tool on a 4096×3072 Work: the
expected frame was 3072×3072, centred and matching the lock. Instead, 1:1 was shown as selected over
the whole 4096×3072 frame. Choosing 1:1 again did nothing. Every Editor hits this for the same
Work, and it has happened since T13 (the remembered proportion).

## Root cause

`open()` (`src/features/crop-rotate/store.ts`) copied the Work's Geometry as the Draft and restored
the remembered proportion, but never fitted the frame to it. Re-choosing it was a no-op because
`SegmentedControl` (`src/shared/ui/SegmentedControl.vue:31`) emits only when the selection changes,
which is correct for radio buttons. The spec permitted this state. AC-08 remembers a proportion
"even if the tool is then cancelled", and AC-12 reopens "with the crop frame where the Crop is".
Together they produce a lock that the frame does not have, and neither AC said what to do then.
Review findings R5 and N3 saw the mismatch. A test at `store.test.ts:116` pinned the unfitted
frame as intended behaviour.

## The pinning test

Unit test (store with a real editor store):
`crop-rotate store › editing the Draft › reopens with the frame fitted to a remembered lock the
Crop does not have (AC-08, AC-12)`. It replaces the test that pinned the old behaviour. It also
checks that the Preview gets the fitted Draft, that a later Straighten keeps 1:1, and that a Crop
which already has the lock reopens exactly where it is. Before the fix, the first run failed with:

> `AssertionError: expected { x: +0, y: +0, width: 4096, …(1) } to deeply equal { x: 512, y: +0, width: 3072, …(1) }` (`store.test.ts:124`)

## Spec patch

AC-12, *Then*, user-confirmed on 2026-10-07:

- **Before:** "… and the crop frame where the Crop is, so the Editor can widen it. Widening the
  frame back …"
- **After:** "… and the crop frame where the Crop is, so the Editor can widen it. With a
  remembered proportion (AC-08) the Crop does not have, the frame opens as the largest frame of
  that proportion inside the Crop, centred on it, as if it had just been chosen. Widening the
  frame back …"

The lock and the frame now always agree when the tool opens, so re-choosing the selected
proportion is correctly a no-op. The shared `SegmentedControl` is unchanged.

## Follow-ups

- `straightenAnchor`'s "keep the frame's own proportion unless it matches the lock" branch (fix
  389b0a4, review N3) can no longer be reached through reopen. Check whether any path still
  reaches it, and remove it if none does.
- Opening and then pressing Apply now crops a Work whose remembered lock was cancelled earlier.
  This is intended (the frame shows exactly what Apply keeps), but `test-plan.md` has no AC-12 row
  for it. Add one on the next `plan-tests` pass.
