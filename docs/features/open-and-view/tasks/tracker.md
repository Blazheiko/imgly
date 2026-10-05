# Tracker — open-and-view

> Status of every task in the epic. `implement` updates `done` as it commits each task.
> States: `todo` · `in_progress` · `blocked` · `review` · `done`.

| # | Task | Layer | Owner | Estimate | Blocked by | Status |
|---|---|---|---|---|---|---|
| T1 | [Add the open error codes and the header parser for JPEG, PNG/APNG, GIF and the refused formats](./t01-header-parser-jpeg-png-gif.md) | domain | Blazheiko | M | — | done |
| T2 | [Extend the header parser to WebP, AVIF and HEIC/HEIF and add the property/fuzz test](./t02-header-parser-webp-avif-heic.md) | domain | Blazheiko | M | T1 | done |
| T3 | [Implement the open policy: size ceiling, Downscale-limit target size, reduction steps and drop-candidate order](./t03-open-policy.md) | domain | Blazheiko | S | T1 | done |
| T4 | [Implement the pure View model (Fit, zoom steps, clamp, zoom-at-point, pan clamp, auto-fit) and the Work revision rule](./t04-view-model-and-work-revision.md) | domain | Blazheiko | M | — | done |
| T5 | [Build the decode worker pipeline and the main-thread decodeImage client with supersede and error mapping](./t05-decode-worker-pipeline.md) | infra | Blazheiko | L | T2, T3 | done |
| T6 | [Add the worker's orientation and HEIC capability probes and the EXIF-orientation fallback](./t06-decode-capability-probes.md) | infra | Blazheiko | M | T5 | done |
| T7 | [Add the platform intake: window drop guard, files from a DataTransfer, and the single-file picker](./t07-platform-intake.md) | infra | Blazheiko | S | — | done |
| T8 | [Build the WebGL2 preview renderer: mipmapped Original texture, View transform uniform, DPR sizing, draw-on-change](./t08-preview-renderer.md) | infra | Blazheiko | M | T4 | done |
| T9 | [Handle WebGL context loss: restore from the kept bitmap within the deadline, else report DISPLAY_LOST](./t09-context-loss-restore.md) | infra | Blazheiko | S | T1, T8 | done |
| T10 | [Add the notice queue and the shared UI primitives Spinner, Toast, ToastStack, Dialog and CanvasMessage](./t10-notices-and-ui-primitives.md) | ui | Blazheiko | M | — | done |
| T11 | [Implement the editor store's open and replace rule: latest-open-wins, confirm on Unsaved edits, cancel, and View actions](./t11-editor-store-open-replace.md) | app | Blazheiko | M | T4, T5 | done |
| T12 | [Add drop sequencing, the messages catalog and the notices raised by each open](./t12-drop-sequencing-and-messages.md) | app | Blazheiko | M | T3, T10, T11 | done |
| T13 | [Build the editor shell and SCR-01: top bar, empty canvas with Open image, drop overlay, loading spinner and toast boundary](./t13-editor-shell-empty-canvas.md) | ui | Blazheiko | M | T7, T10, T12 | done |
| T14 | [Build SCR-02's PreviewCanvas with the renderer, Fit on open, and the zoom and pan gestures](./t14-preview-canvas-gestures.md) | ui | Blazheiko | M | T8, T11, T13 | done |
| T15 | [Build the status bar: Original dimensions readout, zoom controls with the live zoom level, and the zoom shortcuts](./t15-status-bar-zoom-controls.md) | ui | Blazheiko | S | T11, T13 | done |
| T16 | [Build SCR-03, the replace confirmation dialog, on the store's confirming phase](./t16-replace-dialog.md) | ui | Blazheiko | S | T10, T11, T13 | done |
| T17 | [Add the start-up capability gate and the blocking screens SCR-04, SCR-05 plus SCR-02's restoring state](./t17-capability-gate-blocking-screens.md) | ui | Blazheiko | M | T7, T9, T10, T13 | done |
| T18 | [Precache the decode worker for offline opens, run e2e on three engines in CI, and record the widened rules](./t18-offline-precache-and-ci.md) | wiring | Blazheiko | S | T5, T14 | done |
| T19 | [Add the cross-engine reference-set e2e: honest outcome per file, 8 of 8 orientations, Work integrity on every refusal](./t19-e2e-reference-set.md) | tests | Blazheiko | M | T6, T14, T15, T16, T17, T18 | done |
| T20 | [Add the @perf suite: time to first Preview, long tasks, zoom/pan frame rate and memory after 10 opens](./t20-perf-suite.md) | tests | Blazheiko | M | T15, T18, T19 | done |
| T21 | Parse a simple-format WebP whose first chunk is larger than the header window (review S1) | domain | Blazheiko | S | — | done |
| T22 | Declare a GIF's size from its screen and first frame, and refuse an over-ceiling bitmap after decoding (review S2) | infra | Blazheiko | S | — | done |
| T23 | Refuse files above a byte-size cap as TOO_LARGE before decoding (review Q5) | infra | Blazheiko | S | T22 | done |
| T24 | Land 100% and stepped zoom on the exact target and always leave auto-fit (review S6, Q2) | domain | Blazheiko | S | — | done |
| T25 | Block page zoom everywhere in the editor and turn Safari pinch gestures into View zoom (review S3) | ui | Blazheiko | S | T24 | done |
| T26 | Add Space+drag pan mode that never presses the focused button (review S4) | ui | Blazheiko | S | — | done |
| T27 | Report a renderer that fails at mount as display lost, and never show the replace dialog over SCR-05 (review S5, Q3) | ui | Blazheiko | S | — | done |
| T28 | Give a dropped image-typed file that is not an image the unreadable reason (review S7, Q6) | app | Blazheiko | S | — | done |
| T29 | Settle every decode as DECODE_FAILED when the worker rejects or cannot start (review Q1) | infra | Blazheiko | S | — | done |
| T30 | Round refused sizes up and capitalise Camera RAW in the messages (review Q4) | domain | Blazheiko | S | — | done |
| T31 | Tokenise the hard-coded primitive widths and document image-decode and the widened infra rule (review Q7, Q10) | wiring | Blazheiko | S | — | done |
| T32 | Make the never-navigates checks falsifiable, strengthen the fuzz invariants, and cover the PreviewCanvas renderer seam (review Q8, Q9) | tests | Blazheiko | S | T27 | done |
| T33 | Add the missing UI-level AC tests and mark the visual baselines deferred (review S8) | tests | Blazheiko | S | T28 | done |
| T34 | Refuse a GIF whose first image descriptor is not inside the header window as unreadable (review N1) | domain | Blazheiko | S | — | done |
| T35 | Count a byte-ceiling or not-permitted refusal as an image reason only for a file that looks like an image (review F1) | app | Blazheiko | S | — | done |
| T36 | Bring the spec in line with the resolved ceiling and Display P3 decisions and the byte ceiling message (review F2) | wiring | Blazheiko | S | — | done |
| T37 | Recognise an SVG that starts with a comment or a DOCTYPE and has no XML prolog (review F3) | domain | Blazheiko | S | — | done |
| T38 | Add the Reload, low-clamp and fitted-no-pan e2e tests and mark the engine-limited test-plan rows (review F4) | tests | Blazheiko | S | — | done |
| T39 | Show the grab cursor in Space pan mode only when the image is pannable (review F5) | ui | Blazheiko | S | — | done |
| T40 | Detect an animated GIF whose second frame lies past the header window by walking block lengths over bounded further reads (review R1) | infra | Blazheiko | S | — | done |
| T41 | Check the upright orientation pixels on all three engines through a 2D-canvas readback hook (review R2) | tests | Blazheiko | S | — | done |
| T42 | Carry the AC-09 byte ceiling into the sad.md flow, the US-04 ux-flow and the test plan (review R3) | wiring | Blazheiko | S | — | done |
| T43 | Treat Canon CRW and Sigma X3F names as image files when judging a drop (review R4) | domain | Blazheiko | S | — | done |
| T44 | Point the stage-record, worker-count and ledger test-plan rows and QG-2 at the unit tests that prove them (review R5) | wiring | Blazheiko | S | — | done |
| T45 | Mark the reference machine, size ceiling and restore deadline notes as resolved (review R6) | wiring | Blazheiko | S | T42, T44 | done |
| T46 | Cite the SCR-02 screen state on the UI tasks T15, T25, T26 and T39 (review R7) | wiring | Blazheiko | S | — | done |

**Total:** 46 tasks (T21–T33 are the review-2026-10-04 follow-ups, T34–T39 the review-2026-10-04-2 follow-ups, T40–T46 the review-2026-10-05 follow-ups), ~29.5 person-days (S = ½ day, M/L = 1 day).
