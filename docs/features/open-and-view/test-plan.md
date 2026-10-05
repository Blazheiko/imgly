---
status: Draft
owner: "Blazheiko"
reviewers: ["Blazheiko (implementing engineer)", "Tech Lead"]
updated_at: "2026-10-04"
feature_size: "M"
---

# Test plan — open-and-view

open-and-view must open one image from disk or a drop into an upright, fitted Preview. It may replace the open Work only with an image that was read successfully, it must explain every downscale and refusal in plain words, and it must give a smooth View (Fit, 100%, zoom, pan) that survives graphics interruptions. The feature is client-only and declares `target_surfaces: [web-frontend]`, so the frontend tiers apply.

## Levels

| Level | Scope | Strategy (generic — no tool names) |
|---|---|---|
| Unit | Pure logic in `src/core/`: header judging (`sniffImageHeader`), the open policy (`checkOpenPolicy`, `targetSize`, `pickFromDrop`), View maths, `hasUnsavedEdits`. Also the notice queue rules, the error-to-code mapping, and the `editor` store's replace rule with the browser adapter (`decodeImage`) faked at the port. | In-memory with no I/O. Timers are faked where notices self-dismiss. The store is real, and only the browser-facing adapter is replaced. |
| Integration | The browser-facing adapters against the real browser dependencies they own: the decode worker (built-in decoders, OffscreenCanvas, worker lifecycle), the capability probes, and the WebGL2 preview renderer (texture upload, View uniform, context loss). | A real browser engine (Chromium, Firefox and WebKit) in a fresh, isolated browser context per test that is thrown away afterwards. This is this feature's ephemeral real dependency. The decoder, worker and WebGL are never mocked. |
| Contract | The boundary between the Editor SPA and the Decode worker: the success message (Original bitmap + facts: source and Original dimensions, animated, format), the error message `{ code, details }` for every open error code, and the `Superseded` outcome of `decodeImage`. The messages catalog must cover every code. | Messages produced by the real worker are validated against the one shared message type/schema. Every `AppError` open code must have exactly one catalog entry. No hand-rolled stubs. |
| E2E | N/A as a separate API-level tier. The app has no server API, so every end-to-end flow is driven through the UI (see E2E-through-UI). | — |
| Load | The numeric spec §6 NFRs: time to first Preview p95, longest main-thread freeze, zoom/pan frame rate, and memory after repeated opens. | Single-user, in-browser measurements on the reference machine (Apple M1 MacBook Air, latest Chrome). The tooling is described in NFR validation (load). |
| Component | UI components in isolation, covering the states from `screens.md`: `EmptyCanvas`, `DropOverlay`, the window drop guard, `PreviewCanvas` gestures, `ZoomBar`, `DimensionsReadout`, `ToastStack`/`Toast`, `ReplaceDialog`, `CanvasMessage` for SCR-04 and SCR-05. | Rendered in the repo's component harness on a DOM emulator, with the real `editor` store and the GPU renderer replaced at its port. Each test asserts the rendered output, the store actions called, focus and roles. |
| Visual-regression | The DOM screens SCR-01, SCR-03, SCR-04 and SCR-05, the toast stack, and the Preview pixel checks. | Snapshots in light and dark themes are diffed against approved baselines. Chromium only, because WebGL pixel checks are pinned to Chromium (sad §7). Baselines are updated deliberately, never auto-accepted. |
| E2E-through-UI | Each user-story flow from `ux-flows.md` (US-01 to US-08), driven through the real UI. | The built app is served as in production with the service worker on. Each test gets a fresh browser context and runs on Chromium, Firefox and WebKit. Files are supplied through the real file input or a dispatched drop. |

## AC coverage

| AC (spec.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 | fit zoom is the largest zoom that shows the whole image, never above 100% | unit | Large images get a Fit below 100%. An image smaller than the canvas area gets exactly 100% and is centred. |
| AC-01 | each of the 8 EXIF orientation images decodes upright in every engine | integration | The worker's Original has the upright width and height and the upright pixel layout on Chromium, Firefox and WebKit. The layout is read from the Original through a 2D canvas (the `originalPixel` test hook), so it needs no WebGL and runs on all three engines (`e2e/open-and-view/reference-set.spec.ts`, review 2026-10-05 R2). The Preview's on-screen corners are checked on Chromium only, where WebGL pixel checks are pinned (sad §7). |
| AC-01 | opening an image with "Open image" shows it upright at Fit, ready to edit | e2e-through-UI | The Preview appears at Fit, the zoom readout shows the Fit level, the dimensions readout is visible, and the editor is in its ready state. |
| AC-01 | fitted Preview matches its approved baseline | visual-regression | The rendered Preview of the reference photo at Fit matches the baseline, with no rotation, offset or enlargement. **Deferred** (review 2026-10-04 S8): no baseline yet. Owner Blazheiko, due before roadmap step 4 `sdd:implement`. |
| AC-02 | window drop guard stops the browser from opening a dropped file | component | Dragover and drop on the window are cancelled, the drop overlay shows while dragging and hides on leave, and the dropped file is handed to the open action. |
| AC-02 | dropped item list is classified as image files, other files, or no files | unit | Image files, non-image files, folders and links are each classified correctly. |
| AC-02 | dropping an image anywhere on the window opens it like a chosen file | e2e-through-UI | The image opens at Fit as in AC-01. The page address is unchanged and the app is never replaced by the file. |
| AC-03 | first readable file of a multi-file drop is the one that opens | unit | Files are tried in drop order, judged by content, and the first successful read wins. If none succeeds, the reason is the first image file's reason. If there are no image files, the AC-04 notice is chosen. |
| AC-03 | multi-file drop shows the one-image-at-a-time notice | component | One informational notice says the editor works with one image at a time and that the other files were ignored. It goes away by itself. |
| AC-03 | dropping a document, a damaged image and a valid image opens the valid one | e2e-through-UI | The valid image opens and the ignored-files notice is shown. In a second run where every file is unreadable, nothing is replaced and the first image file's reason stays on screen. |
| AC-04 | non-image drop opens nothing and asks for an image file | component | For a folder, a document or a link, the store's open action is never called and the "only image files can be opened" notice is shown. |
| AC-04 | dropping a document or a link from another tab replaces nothing | e2e-through-UI | The Work (or the empty canvas) is unchanged, the "only image files" notice is shown, and the page address is unchanged. |
| AC-05 | target size keeps proportions with the long side at the Downscale limit | unit | 6000×4000 becomes 4096×2731. A very elongated image keeps a short side of at least 1 px. A long side of exactly 4096 is not reduced. |
| AC-05 | worker reduces a 48 MP photo to the Downscale limit and frees every intermediate | integration | 8064×6048 becomes a 4096×3072 Original. No intermediate canvas side exceeds 16 384 px, and the bitmap counter returns to the one retained Original. **Level change** (review 2026-10-05 R5): proven at unit level with a fake bitmap environment. The pipeline closes every intermediate (`src/infra/image-decode/pipeline.test.ts`, the Downscale-limit case), and no reduction step exceeds 16 384 px (`src/core/open/policy.test.ts`, the elongated-image case). In a real engine, only the `@perf` suite (`e2e/open-and-view/perf.spec.ts`) checks that the ledger returns to one retained Original. |
| AC-05 | worker reports source and Original dimensions in the agreed shape | contract | The success message carries both dimension pairs with the agreed field names and types. |
| AC-05 | oversize image shows the downscale notice and the new dimensions | e2e-through-UI | A one-line notice reads "6000×4000 → 4096×2731", and the dimensions readout shows 4096 × 2731 px for as long as the Work is open. |
| AC-06 | image at or below the limit keeps its own size | unit | The target size equals the source size, and no downscale fact is produced. |
| AC-06 | worker passes a within-limit image through at its own size | integration | 4032×3024 becomes a 4032×3024 Original, and the downscale fact is absent. |
| AC-06 | within-limit success message carries equal source and Original dimensions | contract | Both dimension pairs are present and equal, and the downscale flag is false. |
| AC-06 | within-limit image opens with no downscale notice | e2e-through-UI | No downscale notice appears, and the dimensions readout shows 4032 × 3024 px for as long as the Work is open. |
| AC-07 | header judging names each unsupported format by content | unit | SVG, BMP, ICO, TIFF (including TIFF-based RAW/DNG) and PSD are recognised whatever their file name and are refused as unsupported with the format named. |
| AC-07 | HEIC capability probe decides HEIC support per browser, not by browser name | integration | In engines whose decoder cannot read HEIC, the probe reports no support and a HEIC file is refused as unsupported with the format named. |
| AC-07 | unsupported-format error carries the format name in the agreed shape | contract | The error message has the unsupported-format code and a format name, and the catalog has its message. |
| AC-07 | opening an unsupported format shows a named, actionable reason | e2e-through-UI | Nothing is replaced. The notice names the format, says it can't be opened here and suggests JPEG or PNG. For HEIC it also suggests a browser that can open it. The notice stays until dismissed. |
| AC-08 | damaged, truncated and mis-named files are judged unreadable by content | unit | Each fixture gets the not-an-image or unreadable result regardless of its extension. |
| AC-08 | header parser never throws or over-allocates on hostile bytes | unit | Across generated truncated and mutated samples, the parser always returns a result, never throws, never hangs, and never allocates in proportion to a declared size. |
| AC-08 | file with a valid header but a corrupt body fails decoding with one plain reason | integration | The real decoder's failure is reported as the decode-failed code, and no raw browser error text escapes. |
| AC-08 | unreadable file over an open Work shows one reason and leaves the Work as it was | e2e-through-UI | For a damaged, a truncated and a renamed file, the notice says the file could not be read as an image, and the Work's id and revision are unchanged. |
| AC-09 | declared pixel count above the size ceiling is refused, the ceiling itself accepted | unit | 100 MP exactly is accepted. One pixel more is refused as too large, with both sizes in megapixels. An undeclared size is treated as unreadable. |
| AC-09 | file above the 500 MB byte ceiling is refused from its size, the ceiling itself accepted | unit | 500 MB exactly is accepted. One byte more is refused as too large, with the file's size rounded up to whole MB and the 500 MB ceiling (`src/core/open/policy.test.ts`). The notice reads "This file is too large: {N} MB. The largest file the editor opens is 500 MB." (`src/features/editor/messages.test.ts`). Added by review 2026-10-05 R3. |
| AC-09 | file above the byte ceiling is never read or decoded | integration | The worker pipeline reports too large, and the file is never sliced or decoded (`src/infra/image-decode/pipeline.test.ts`). A dropped image file over the ceiling shows the byte-ceiling notice, while a non-image over it gets the AC-04 notice (`src/features/editor/drop.test.ts`). Added by review 2026-10-05 R3. |
| AC-09 | byte-ceiling refusal reaches the rendered toast | component | A dropped file the decoder refuses as too large by bytes shows "This file is too large: 612 MB. The largest file the editor opens is 500 MB." in the `role="alert"` toast, and the editor stays on SCR-01 (`src/features/editor/EditorView.test.ts`). Added by review 2026-10-05-2 V4. |
| AC-09 | decompression bomb is refused before any pixel is decoded | integration | The worker pipeline reports too large, and `createImageBitmap` is never called (`src/infra/image-decode/pipeline.test.ts`). **Level change** (review 2026-10-05 R5): there is no worker stage record. The real-engine reference set asserts the too-large notice for the bomb, which a refusal after decoding would also produce, so "never decoded" is proven at unit level. |
| AC-09 | too-large error carries width, height and both megapixel figures in the agreed shape | contract | All four detail fields are present and numeric, so the notice can never show a missing number. |
| AC-09 | opening the bomb or a 120 MP image shows its size and the accepted maximum | e2e-through-UI | Nothing is replaced. The notice states width × height, its megapixels and the largest accepted megapixels. The tab stays responsive. |
| AC-10 | file-read refusals map to the not-permitted code | unit | Each browser read-refusal error kind maps to the not-permitted code. |
| AC-10 | worker given a file whose read is refused reports not permitted and finishes | integration | The worker answers with the not-permitted code and does not hang. |
| AC-10 | not-permitted error is part of the agreed code set and the catalog | contract | The code is in the shared code set and has exactly one catalog message. |
| AC-10 | file the app may not read is refused with a make-it-available hint | e2e-through-UI | Nothing is replaced. The notice says the app was not allowed to read the file and suggests making it available on this computer first. |
| AC-11 | header judging flags animated GIF, APNG and WebP but not static ones | unit | Animated files are flagged as animated. Static GIF, PNG and WebP are not. |
| AC-11 | GIF block walk resumes past the header window by length fields only | unit | Cut at every offset and resumed in chunks of at least `GIF_WALK_MIN_CHUNK` bytes, a 2-frame GIF is always found to have 2 frames. A still GIF ends at the trailer with 1. A file that ends inside a block makes no progress and claims no frame (`src/core/image-header/gif-walk.test.ts`). Added by review 2026-10-05 R1. |
| AC-11 | worker detects a second GIF frame that starts past 1 MiB | integration | A GIF whose first frame is about 1.5 MB is reported animated, every read is at most 1 MiB, and the decode runs once. A still or truncated large GIF is not animated (`src/infra/image-decode/pipeline.test.ts`). Added by review 2026-10-05 R1. |
| AC-11 | worker keeps the first frame of an animated image | integration | On every engine, the Original's pixels match the first frame's colour, not any later frame. The reference set reads the Original's centre pixel through a 2D canvas (`originalPixel`) for the animated GIF and the GIF whose second frame is past 1 MiB, on Chromium, Firefox and WebKit, with and without a Work open (`e2e/open-and-view/reference-set.spec.ts`; review 2026-10-05-2 V2). The Preview's on-screen pixel stays a Chromium-only WebGL check (`e2e/open-and-view/open-flows.spec.ts`, sad §7). |
| AC-11 | animated image opens with the first-frame-only notice | e2e-through-UI | The Preview is static, and an informational notice says only the first frame is kept. That includes a GIF whose second frame starts past the 1 MiB header window (reference set, review 2026-10-05 R1). |
| AC-11b | notice queue keeps every notice of one open and applies the dismissal rules | unit | All notices of one open are queued together. Informational ones expire by themselves and failure reasons persist until dismissed. |
| AC-11b | toast stack shows several notices without hiding any | component | Three notices are all visible. A failure toast has a keyboard-reachable dismiss button, and informational toasts leave by themselves. |
| AC-11b | animated, oversize image dropped with other files shows all three notices | e2e-through-UI | The downscale, first-frame-only and files-ignored notices are visible at the same time and all go away by themselves. |
| AC-11b | stacked toasts match their approved baseline | visual-regression | No toast overlaps or covers another. (Non-overlap is already checked by bounding boxes in `e2e/open-and-view/open-flows.spec.ts`.) **Deferred** (review 2026-10-04 S8): no baseline yet. Owner Blazheiko, due before roadmap step 4 `sdd:implement`. |
| AC-12 | zoom at a point keeps that image point under the pointer | unit | After zooming, the image point under the pointer is in the same device-pixel position. Pointer positions are converted from CSS pixels by the device pixel ratio. 100% equals one image pixel per device pixel. |
| AC-12 | pinch, Ctrl/Cmd+wheel and the zoom controls drive the View, not the page | component | Each input calls the matching store action, the browser's page zoom is prevented, the zoom readout shows the live level, and the rest of the interface does not change size. |
| AC-12 | renderer draws the Original at the requested View | integration | For a given View the WebGL2 output has the expected pixels at known positions. At 100%, one texel maps to one device pixel. |
| AC-12 | 100% shows one image pixel per physical screen pixel | e2e-through-UI | With a fixed device pixel ratio, a 1 px checkerboard read back from the canvas at 100% alternates every device pixel (pixel check on Chromium). Zooming with the controls centres the zoom, and the zoom level is shown. |
| AC-12b | zoom stays within the smaller of Fit and 10%, and 800% | unit | Zooming past either end clamps. The controls step through the fixed levels. A manual zoom or pan turns auto-fit off, and "Fit" turns it back on. |
| AC-12b | canvas area resize re-fits only while auto-fit is on | component | With auto-fit on, a resize recomputes Fit. After a manual zoom, a resize keeps the zoom level. |
| AC-12b | window resize and zooming past the limits behave as specified | e2e-through-UI | Resizing before any zoom keeps Fit. Resizing after a zoom keeps the level. Zoom-in stops at 800% and zoom-out stops at the low limit. |
| AC-13 | pan is clamped to the image edge, and an image that fits stays centred | unit | The pan offset can never push the image out of the canvas area. An image that fits has zero pan and is centred. |
| AC-13 | wheel, Shift+wheel, Space+drag and tool-free drag pan the View | component | Each gesture calls pan in the right direction and leaves the Work untouched. The grab cursor appears only when the image is larger than the canvas area. |
| AC-13 | panning a zoomed image stops at its edge | e2e-through-UI | After zooming in, a pan past the edge leaves the image edge at the canvas edge. A fitted image does not move. |
| AC-14 | View changes never raise the Work's revision | unit | After any sequence of zoom, pan, Fit and 100%, the Work has no Unsaved edits. |
| AC-14 | opening another image after only zooming and panning asks nothing | e2e-through-UI | No confirmation dialog appears, and the new image replaces the Work at Fit. |
| AC-15 | Work with Unsaved edits waits for confirmation, and cancel restores everything | unit | The store enters the confirming phase. Cancel closes the new bitmap and leaves the Work, View and notices exactly as before. Confirm swaps the Work and only then queues the new image's notices. |
| AC-15 | replace dialog is an accessible, focus-trapping alert | component | The dialog has the alert-dialog role and focus starts on Cancel and stays inside the dialog. Esc and a backdrop click cancel, and focus returns to its origin on close. A drop while the dialog is open is ignored. |
| AC-15 | replacing a Work with Unsaved edits asks first, and cancel keeps it untouched | e2e-through-UI | On a test-prepared Work with Unsaved edits, opening an oversize image shows the dialog. Cancel keeps the Work, zoom and pan identical with no downscale notice. Replace shows the new Work at Fit, then its notice. |
| AC-15 | replace dialog matches its approved baseline | visual-regression | The dialog over the dimmed Work matches the wireframe-derived baseline. **Deferred** (review 2026-10-04 S8): no baseline yet. Owner Blazheiko, due before roadmap step 4 `sdd:implement`. |
| AC-16 | every refusal leaves the Work and View untouched and asks nothing | unit | For each refusal code, the Work's id and revision and the View are unchanged, there is no confirming phase, and one failure notice is queued. |
| AC-16 | whole reference set opened over a Work with Unsaved edits never touches it | e2e-through-UI | For every refused file the Work's id and revision are unchanged, no confirmation appears, and the matching reason is shown. Each file ends in a correct Preview or a plain reason, with no blank canvas and no tab crash. |
| AC-16b | only the latest open can replace the Work | unit | When a second open starts before the first finishes, the first result is ignored even if it arrives later. Only the latest open's result is applied. |
| AC-16b | starting a new open terminates the previous worker | integration | The earlier decode resolves as superseded, its worker is terminated, and at most one decode worker is alive. **Level change** (review 2026-10-05 R5): proven at unit level with a fake Worker. A superseded worker is terminated at once and resolves as superseded, and a late message from it is ignored (`src/infra/image-decode/client.test.ts`). No real-engine test counts live workers. |
| AC-16b | superseded is a distinct outcome that never becomes a notice | contract | `decodeImage` returns superseded separately from every error code, and the store raises no notice for it. |
| AC-16b | choosing a new file while a large one is still reading opens only the new one | e2e-through-UI | The second file opens and the first never appears. During the read the current Work stays on screen and can be zoomed and panned. |
| AC-17 | empty editor shows one primary "Open image" action and the drop hint | component | Exactly one primary action, "Open image", and the one-line drop hint are rendered in the canvas area. |
| AC-17 | first visit shows the empty editor ready to open an image | e2e-through-UI | On first load in a fresh context, the canvas area shows the primary "Open image" action and the drop hint. |
| AC-17 | empty editor matches its approved baseline | visual-regression | SCR-01 matches its baseline in light and dark themes. **Deferred** (review 2026-10-04 S8): no baseline yet. Owner Blazheiko, due before roadmap step 4 `sdd:implement`. |
| AC-18 | unsupported-browser screen replaces the canvas and offers no open | component | The full-canvas message names browsers that can display the editor, and "Open image" is absent. |
| AC-18 | browser without WebGL2 shows the unsupported message and ignores drops | e2e-through-UI | With WebGL turned off, SCR-04 is shown. A dropped file opens nothing, the page address is unchanged, and the same message stays. |
| AC-18 | unsupported-browser screen matches its approved baseline | visual-regression | SCR-04 matches its baseline in light and dark themes. **Deferred** (review 2026-10-04 S8): no baseline yet. Owner Blazheiko, due before roadmap step 4 `sdd:implement`. |
| AC-19 | renderer restores the Preview from the kept bitmap after context loss | integration | After a simulated context loss and restore, the texture is rebuilt from the kept Original without rereading the file, and the redraw matches the image from before the loss. |
| AC-19 | temporary graphics interruption brings the Preview back unchanged | e2e-through-UI | After a simulated context loss restored before the deadline, the Preview reappears at the same zoom and pan, the Work's id and revision are unchanged, and no black frame shows (the restoring state shows surround + spinner). **Engine-limited** (review 2026-10-04-2 F4): runs on Chromium only, because the test drives WebGL through `WEBGL_lose_context` and stays with the other WebGL checks on Chromium (sad §7, T17). The component and integration rows cover the restore logic on every engine. |
| AC-19b | display-lost screen explains the loss and offers a reload | component | The full-canvas message has the alert role, says the display could not recover, says the open Work will be lost on reload, and moves focus to "Reload page". |
| AC-19b | renderer reports display lost when no restore arrives before the deadline | integration | When the context is lost without a restore, the renderer reports the display-lost code once the deadline passes. |
| AC-19b | unrecoverable graphics interruption shows the display-lost message, never a black canvas | e2e-through-UI | After a simulated loss with no restore, SCR-05 replaces the canvas area, and "Reload page" lands on the empty editor. **Engine-limited** (review 2026-10-04-2 F4): runs on Chromium only, for the same reason as the AC-19 e2e row. |
| AC-19b | display-lost screen matches its approved baseline | visual-regression | SCR-05 matches its baseline in light and dark themes. **Deferred** (review 2026-10-04 S8): no baseline yet. Owner Blazheiko, due before roadmap step 4 `sdd:implement`. |

## Edge cases / error paths

Each error and authorization AC (AC-03, AC-04, AC-07, AC-08, AC-09, AC-10, AC-11, AC-16, AC-19b) has its own dedicated rows above. The boundary and failure cases below come from the spec and are covered by named rows in the table:

- Long side of exactly 4096 px → expected: not reduced, and no downscale notice (AC-06 unit).
- Declared size of exactly 100 MP → expected: accepted. One pixel more → refused as too large before decoding (AC-09 unit).
- Very elongated image within the ceiling (for example 200000×10) → expected: a short side of at least 1 px. The worker reduces it in a larger first step instead of refusing it (AC-05 unit + integration).
- Declared dimensions missing from the first 1 MiB (the header window) → expected: treated as unreadable, the same reason as a damaged file (AC-08, AC-09 unit).
- Valid JPEG with more than 1 MiB of metadata before its frame header → expected: refused as unreadable. This is accepted debt (sad §11), and the sample is kept in the reference set so a change in behaviour is noticed (AC-08 e2e-through-UI).
- Image file renamed to a non-image extension, or a non-image renamed to `.jpg` → expected: judged by content, opens or is refused accordingly (AC-08).
- Static GIF, PNG or WebP → expected: no first-frame-only notice (AC-11 unit).
- Drop containing only a link or a folder → expected: nothing opened, "only image files" notice (AC-04).
- Multi-file drop where every file fails → expected: nothing replaced, the first image file's reason shown (AC-03).
- File the browser may not read (permissions or a cloud placeholder) → expected: refused with the make-it-available hint, Work untouched (AC-10).
- Second open started before the first finishes, including a late reply from the first → expected: ignored, and only the latest file can open (AC-16b).
- Cancel on the replace dialog → expected: the new image is discarded, its memory is freed, and no notice from it ever appears (AC-15).
- Drop while the replace dialog is open → expected: ignored, the page does not navigate, and no drop overlay appears (AC-15 component).
- Zoom past 800% or below min(Fit, 10%) → expected: clamped at the limit (AC-12b).
- Graphics restored after the deadline, or rebuilding fails → expected: the display-lost screen, never a black canvas (AC-19b).
- No network after the first load → expected: an open still succeeds, because the decode worker is served from the precache (NFR offline row, e2e-through-UI below).

## Test data

- **Seed strategy.** There is no datastore, and the test data is files. Small fixtures (tens of KB each) are committed beside the unit tests and in `e2e/fixtures/`:
  - one signature sample per Supported and unsupported format;
  - the 8 EXIF orientation images;
  - damaged, truncated and mis-named files, plus the >1 MiB-metadata JPEG;
  - static and animated GIF/APNG/WebP whose frames have different colours;
  - a few-KB decompression bomb declaring more than 100 MP;
  - a 1 px checkerboard;
  - a small set of real phone photos, including HEIC, that cannot be generated.
  
  Large inputs (the 12 MP 4032×3024 and 48 MP 8064×6048 JPEGs, 6000×4000, a 120 MP image, an elongated image) are generated by a script before the suites run and cached outside git. Generation is deterministic, so every run sees identical bytes. The Work with Unsaved edits that AC-15 needs is prepared through a test-only hook that raises the Work's revision. It exists only in development and test builds and is removed when roadmap step 4 brings a real edit (spec §1 Decision override).
- **Integration dependency.** A real browser engine (Chromium, Firefox and WebKit) in a fresh, isolated browser context per test. The browser's decoders, the decode worker, OffscreenCanvas and WebGL2 are never mocked. Graphics loss is simulated with the browser's own WebGL context-loss extension, and a browser without WebGL2 is a real engine launched with WebGL turned off. Only unit and component tests replace browser adapters, and only at their ports (`decodeImage`, the renderer).
- **Cleanup boundary.**
  - Per test: each integration and e2e-through-UI test gets its own browser context, which is closed afterwards and takes its workers, bitmaps, GPU context and service-worker state with it. Each unit and component test gets a fresh store and a reset fake clock.
  - Per suite: the generated large fixtures are reused across tests and are only ever read.
  - Leak check: the development-build bitmap and worker counters must return to their baseline (one retained Original, at most one worker) at the end of each open-and-replace test.

## NFR validation (load)

All scenarios run on the reference machine, Apple M1 MacBook Air with the latest stable Chrome (spec §8, resolved 2026-10-04). They use the load tool already in your repo, or e.g. k6 or Locust; in practice that is a single-user, in-browser measurement driven by the repo's browser e2e runner under a perf tag. CI runners are not the reference machine, so these are pre-release gates, not PR gates.

- **Time to first Preview p95, 12 MP JPEG (4032×3024), within the limit** → scenario: 20 sequential opens through the file input and 20 through a dispatched drop, from a fresh context, with no replace confirmation. Timing runs from the file-input change or the drop to the renderer's first-frame mark for the new Original. Assert p95 ≤ 1.5 s.
- **Time to first Preview p95, 48 MP JPEG (8064×6048), downscale path** → scenario: 20 sequential opens, measured the same way. Assert p95 ≤ 3 s.
- **Longest interface freeze while opening any accepted image** → scenario: open every accepted file of the reference set once while long main-thread tasks are recorded, and keep the loading indicator animating throughout. Assert the longest main-thread task is ≤ 200 ms.
- **Zoom and pan smoothness on a 4096 px Original** → scenario: a 10 s scripted sequence of pinch, Ctrl/Cmd+wheel and pan gestures over a 4096×4096 Original, recorded with a performance trace. Assert the frame rate from presented frames is ≥ 50 fps.
- **Memory after 10 consecutive opens of the 48 MP image** → scenario: open the 48 MP JPEG 10 times in a row. Force garbage collection after the 1st and the 10th open, then sum the OS-reported memory of the tab's renderer process and the GPU process. Assert the 10th-open total is ≤ 110% of the 1st-open total, and that the development-build bitmap counter is back at the one retained Original.
- **Opening with no network connection, 100% of runs** → a functional e2e-through-UI test rather than a load test. It runs in CI on Chromium and Firefox: load, wait for the service worker, go offline, reload, open the 12 MP JPEG. Assert the fitted Preview and the dimensions readout every run. **Engine-limited** (review 2026-10-04-2 F4): skipped on WebKit, because Playwright's WebKit cannot reload a page while offline. The precache manifest is the same build output on every engine; an offline open in real Safari is part of the manual pre-release checks below.
- **Size ceiling (100 MP)** → a limit, not a throughput target. It is covered by the AC-09 unit, integration and e2e-through-UI rows.

Spec §7 KPIs are covered by the e2e-through-UI reference-set run:
- honest outcome rate: 100% of files end in a correct Preview or a plain reason, with 0 blank canvases and 0 tab crashes (AC-16 row);
- orientation: 8 of 8 upright (AC-01 rows).

Manual pre-release checks (sad §7, §11): open the HEIC samples in real Safari (WebKit on Linux CI cannot decode HEIC), open an image in real Safari after going offline and reloading (the offline e2e skips WebKit), and open a 48 MP photo on a recent iPhone and an Android phone (the mobile "must not break" tier).

## CI placement

- **On every push and PR:**
  - unit;
  - component;
  - contract;
  - integration on Chromium, Firefox and WebKit;
  - e2e-through-UI on Chromium, Firefox and WebKit, including the reference set, the 8 orientations, offline open (not on WebKit), the capability gate and the context-loss flows (Chromium only);
  - visual-regression on Chromium only (the DOM screens, the toast stack and the Preview pixel checks).

  This matches the three-engine widening recorded in sad §7.
- **Before each release, on the reference machine:**
  - the load scenarios above;
  - the manual HEIC-in-Safari and phone checks.

  The `ship` checklist carries a "run the perf suite on the reference machine" item (sad §11).
