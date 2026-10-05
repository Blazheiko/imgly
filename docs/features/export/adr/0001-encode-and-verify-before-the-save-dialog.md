---
status: Accepted
owner: "Blazheiko"
reviewers: ["Tech Lead"]
updated_at: "2026-10-05"
feature_size: "S"
ticket: "roadmap step 3 — export"
---

# 0001 — Encode and verify the file before opening the "Save as…" dialog

- **Status:** Accepted
- **Date:** 2026-10-05
- **Deciders:** Blazheiko (owner), design Socratic walk

## Context

In Chromium the export saves through the File System Access API's `showSaveFilePicker`. Its specification (step 7) empties the chosen file, or creates a new empty one, before the call returns; Chromium follows it, and the issue asking to change that is still open ([WICG/file-system-access#360](https://github.com/WICG/file-system-access/issues/360)). Any refusal after the dialog therefore leaves an empty file, and when the Editor chose to overwrite a file, that file's content is already gone. The spec asked design to order the export so that such a refusal is as rare as possible (spec §1, AC-13). The dialog also needs a fresh user activation, the few seconds after a real click in which Chromium lets a page open it (about 5 s), so the app cannot postpone it indefinitely.

## Decision drivers

- spec §2 Goals: an exported file always matches what the Editor saw, and the Editor is never told a file was saved when the app knows it was not
- spec AC-13, AC-14, AC-01b: no blank, black or partial file; an overwritten file is left as it was where the app can manage it
- spec AC-12: a file whose content is not the chosen format is never saved
- spec §6: export time excludes the time the dialog is open, so either order meets the time targets
- spec AC-17: at most three steps; the dialog's save completes the confirm step

## Considered options

1. **Encode and verify first, then open the dialog** — confirm renders, encodes and checks the file by content; only a verified file opens `showSaveFilePicker`, and `createWritable()` writes it, replacing the target only on `close()`.
2. **Open the dialog first, then encode** — confirm opens the dialog at once; the render, encode, check and write follow the Editor's choice.

## Decision outcome

**Chosen:** Option 1. Every render and format failure (AC-12, AC-13) happens before the disk is touched, so only two refusals remain after the dialog: an extension that doesn't match (AC-01b) and a refused write (AC-14). With option 2 every one of those rarer but real failures would also cost the Editor a file. On the reference machine encoding takes 1–2 s (spec §6), well inside the activation window.

## Consequences

**Positive**
- A render failure, a lost graphics context or a format mismatch can never empty or create a file on disk
- The dialog opens only when a file is ready, so the Editor never waits after choosing a name, and the write itself is a single short step

**Negative**
- The dialog appears up to about 2 s after confirm, behind a progress indicator, not instantly
- If encoding outlasts the activation window (a slow device), `showSaveFilePicker` throws a `SecurityError`; the panel then keeps the verified file and offers "File ready — Save…", one extra click, which breaks AC-17's three steps on that device (sad.md §1 Decision override, §11)
- AC-01b and AC-14 still leave an empty file; the app removes it where `FileSystemHandle.remove()` exists, and the notice says the file may now be empty or missing (AC-13)

**Neutral**
- The download path (Firefox, Safari) has no dialog and is unaffected: it hands off the file once it is verified, as AC-02 requires
- Should the API stop emptying the file at the dialog, the order can stay as it is; nothing here depends on that behaviour

## Links

- Spec: [[../spec.md]] AC-01, AC-01b, AC-12, AC-13, AC-14, AC-17, §1 design input
- SAD: [[../sad.md]] §4 (choice 1), §6, §11
- Related ADR: [[0002-render-and-encode-exports-in-a-dedicated-web-worker]]
