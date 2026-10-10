---
id: T23
title: "Enter on the focused Custom colour input opens the picker instead of applying the tool"
layer: "ui"
deps: ["T22"]
acs: ["AC-19"]
files_hint: ["src/features/draw/shortcuts.ts", "src/features/draw/shortcuts.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-10 Q1"
---

# T23 — Enter on the focused Custom colour input opens the picker instead of applying the tool

A follow-up task from the review gate. The finding, its citations and the agreed fix are in
[review-2026-10-10.md](../_review/review-2026-10-10.md), finding Q1. The ACs are in [spec.md](../spec.md) §5.

## Definition of done

shortcuts.test asserts Enter on input[type=color] neither applies nor is prevented.
