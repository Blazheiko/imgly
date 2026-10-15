---
id: T47
title: "The standby-dialog test presses Ctrl+O and drops a file"
layer: "tests"
deps: ["T46"]
acs: ["AC-06"]
files_hint: ["src/app/App.test.ts"]
owner: "Blazheiko"
estimate: "S"
status: "todo"
source: "review-2026-10-14-r3 R3-6"
---

# T47 — The standby-dialog test presses Ctrl+O and drops a file

Finding R3-6 of [review-2026-10-14-r3.md](../_review/review-2026-10-14-r3.md).

## Definition of done

The R2-4 App test also presses Ctrl+O (picker not called) and dispatches a file drop (openDrop not called) with the standby dialog open; checked against a deliberately removed gate.
