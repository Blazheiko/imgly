# Tracker — ui-refresh

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | [Tokens v2](./t01-shared-tokens-v2.md) | ui | Blazheiko | S | — | done |
| T2 | [Icon registry + Icon](./t02-shared-icon-registry.md) | ui | Blazheiko | S | — | done |
| T3 | [Widen BaseButton](./t03-shared-basebutton-icon-size-danger.md) | ui | Blazheiko | M | T1, T2 | done |
| T4 | [Notices icons](./t04-shared-toast-icons.md) | ui | Blazheiko | S | T3 | done |
| T5 | [AppLogo + brand icons](./t05-shared-applogo-brand-icons.md) | ui | Blazheiko | S | T1, T2 | done |
| T6 | [Window colour](./t06-wiring-window-colour.md) | wiring | Blazheiko | S | T1, T5 | done |
| T7 | [Top bar frame + groups](./t07-editor-top-bar-groups.md) | ui | Blazheiko | M | T3, T5, T6 | done |
| T8 | [Top-bar action icons](./t08-features-top-bar-action-icons.md) | ui | Blazheiko | S | T3 | done |
| T9 | [Tool panel icons](./t09-features-tool-panel-icons.md) | ui | Blazheiko | S | T3 | done |
| T10 | [Panels, dialogs, messages icons](./t10-features-panels-dialogs-messages-icons.md) | ui | Blazheiko | S | T3 | done |
| T11 | [Start screen drop area](./t11-editor-start-screen-drop-area.md) | ui | Blazheiko | S | T3 | done |
| T12 | [Gallery header + delete dialog](./t12-gallery-header-note-delete-dialog.md) | ui | Blazheiko | S | T3 | todo |
| T13 | [Work card](./t13-gallery-work-card.md) | ui | Blazheiko | M | T3, T12 | todo |
| T14 | [e2e a11y, motion, brand](./t14-tests-e2e-accessibility-motion-brand.md) | tests | Blazheiko | M | T4, T6–T11, T13 | todo |
| T15 | [design-system record](./t15-docs-design-system.md) | docs | Blazheiko | S | T1–T5 | todo |

**Total:** 15 tasks, ~7 person-days (S ≈ 0.4 d, M ≈ 0.75 d).
