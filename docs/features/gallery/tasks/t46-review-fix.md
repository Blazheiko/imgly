---
id: T46
title: "Closing the standby delete dialog puts focus on a real control, not the page body"
layer: "ui"
deps: []
acs: ["AC-06"]
files_hint: ["src/shared/ui/Dialog.vue", "src/shared/ui/primitives.test.ts", "src/app/App.vue", "src/app/App.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-14-r3 R3-5"
---

# T46 — Closing the standby delete dialog puts focus on a real control, not the page body

Finding R3-5 of [review-2026-10-14-r3.md](../_review/review-2026-10-14-r3.md).

## Definition of done

When the element that opened a Dialog is gone, focus returns to a fallback the host names (the standby dialog names the Gallery button or the open tool's panel); a test shows focus is not body after Cancel, Esc and Delete.
