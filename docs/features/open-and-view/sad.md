---
status: Draft
owner: "Blazheiko"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-03"
feature_size: "M"
target_surfaces: [web-frontend]  # filled in §4 — subset of: backend-service | web-frontend | mobile-app | desktop-app | cli | worker | library-sdk. Read (never re-derived) by api/sequences/tasks/plan-tests/review → _shared/surfaces.md
---

# Software Architecture Document — open-and-view

<!-- 12 Arc42 sections. Empty section → <!-- N/A: <one-line reason> -->. -->
<!-- C4 Context (L1) lives inline in §3. C4 Container (L2) lives inline in §5. -->
<!-- Numbers in §10 come VERBATIM from spec.md §6 NFR — no inventing, no rounding. -->

## 1. Introduction and goals

**Intent.** open-and-view lets the Editor bring one photo from disk into the app, through the "Open image" action or by dropping it anywhere on the window, and see it as an upright, ready-to-edit Preview within seconds, with no dialogs on the happy path. The new file is read completely before it can replace the open Work. Anything larger than the Downscale limit (4096 px) becomes an Original at that limit, announced in one line, and every refusal comes with a plain-language reason. The feature also fixes the View (Fit, 100%, zoom, pan) and the replace rule that every later editing feature inherits, and it gives the Portfolio reviewer an honest first impression even when their browser cannot render (spec §1, §2).

**Top-3 quality goals (1-liners; full scenarios in §10):**

1. **Open responsiveness**: the fitted Preview appears fast and the interface never freezes while a file is read.
2. **Work integrity under untrusted input**: the open Work is never lost or replaced by something unreadable, no hostile, oversize or mis-named file can exhaust the tab, and every open ends in a correct Preview or a plain reason.
3. **Smooth, stable View**: zoom and pan stay fluid on a 4096 px Original, and memory stays flat across repeated opens.

**Stakeholders.**

| Role | Interest | Sign-off owner? |
|---|---|---|
| Editor | Opens images by dialog or drop, inspects them with Fit, 100%, zoom and pan, keeps Unsaved edits safe | No |
| Portfolio reviewer | A first open that works first time, and an honest message when the browser can't render | No |
| Tech Lead | SAD approval; the View and the replace rule are inherited by every later tool | Yes |
| Security Lead | Mandatory security review (spec §6.1): this is the app's only intake of untrusted files | Yes |

<!-- Decision overrides (¶4) — populated by the critic resolution loop, empty otherwise. -->

## 2. Constraints

**Technical.**
- TypeScript 5 (`strict`), Node 24 toolchain, pnpm — repo ADR [0001](../../adr/0001-build-a-client-only-vue-pwa.md)
- Vue 3 (Composition API, `<script setup>`) + Pinia + Vite + vite-plugin-pwa; a client-only static app with no server, accounts or sync — repo ADR 0001
- Static hosting on GitHub Pages under `/imgly/` with no custom response headers, so no COOP/COEP and no `SharedArrayBuffer`: data crosses threads only by structured clone or transfer — repo ADR 0001 (Consequences)
- WebGL2 is required for the Preview, with no CPU fallback; Canvas 2D is reserved for the drawing layer — repo ADR [0004](../../adr/0004-render-adjustments-on-webgl2-and-drawing-on-canvas2d.md)
- Functional core with feature folders: `src/core/` is pure TypeScript with no Vue, Pinia or DOM; imports flow `features → core | render | infra | shared`; features never import each other and coordinate through the `editor` store — repo ADR [0002](../../adr/0002-organize-code-as-functional-core-with-feature-folders.md)
- Images are decoded only by the browser's own decoders; no bundled codecs or WASM decoders. HEIC/HEIF opens only where the current browser decodes it itself (CONTEXT "Supported image", spec AC-07)
- No persistence in this feature: IndexedDB is not touched and the Work lives only in the current session (spec §3)
- Targets: the latest desktop Chromium, Firefox and Safari; on mobile the app only has to not break (`docs/architecture-map.md` §Constraints, `docs/design-system.md` §Platform posture)

**Organisational.**
- Solo, spare-time project; owner Blazheiko. No per-feature effort budget: the only limit is the 4–6 week MVP budget for the whole roadmap (spec §1). No hard deadline
- TDD is on (`.claude/sdd.local.md`): unit tests with Vitest, e2e with Playwright
- The spec §6 targets bind to the reference machine: Apple M1 MacBook Air with the latest Chrome (spec §8 open question, due before `sdd:plan-tests`)

**Conventions.**
- `docs/architecture-map.md` §Conventions: `core` and `infra` return `Result<T, AppError>` with a typed `code` and throw only for programmer errors; UUIDv7 IDs from `newId()`; unit tests co-located as `*.test.ts`; e2e in `e2e/*.spec.ts`; features expose `index.ts` and are mounted from `src/app/App.vue`; plain CSS with tokens from `src/shared/styles/tokens.css`
- `docs/design-system.md` §Interaction & writing conventions: one toast boundary, where informational notices dismiss themselves and failure reasons stay until dismissed; a blocking condition (no WebGL2) gets a full-canvas message instead of a toast; an indeterminate spinner overlay on the canvas while decoding; every action reachable by keyboard; short, plain microcopy
- New UI primitives are added to `src/shared/ui/` and registered in the `docs/design-system.md` inventory (screens may only use inventory names or a justified `NEW:`)

**Regulatory / external.**
- Data classification: confidential (spec §6.1). Image pixels and embedded metadata never leave the device: the feature makes no network request carrying image data and ships no telemetry or analytics
- No accounts, so no AuthN/AuthZ; the only access check is the OS or browser permission to read the chosen file (AC-10)
- Security review: required (spec §6.1). This feature is the app's only intake of untrusted files
- No other compliance regime applies: no personal data is processed off the device or stored

## 3. Context and scope

imgly-editor is an offline, client-only image editor that runs entirely in the browser tab. open-and-view is its intake: the only place where untrusted files from the Editor's computer enter the app, and the first thing a Portfolio reviewer tries. Nothing in this feature talks to a server: GitHub Pages serves the static app shell once, and every image stays on the device.

<!-- brownfield: N/A — greenfield repo. No source exists yet; the target foundation is docs/architecture-map.md (mode: greenfield-bootstrap) + repo ADRs 0001–0004, materialized by /sdd:scaffold. -->

**Trust boundary.** Every byte that arrives from the operating system (a chosen or dropped file) is untrusted until the app has judged it by content and checked its declared size (spec §6.1). The browser's own decoders and GPU are trusted to be memory-safe, but their format support and their availability (WebGL2, context loss) vary per browser and are treated as capabilities to detect, not assumptions.

**External systems (in / out):**

| Actor or system | Type | Interaction |
|---|---|---|
| Editor | Person | Opens an image with "Open image" or by dropping it; fits, zooms and pans the Preview; confirms or cancels a replace |
| Portfolio reviewer | Person | Opens the deployed app for the first time and tries the same open, usually on a desktop browser |
| Operating system | System (external) | Shows the file dialog, supplies dropped files, and allows or refuses reading them (permissions, cloud placeholders, AC-10) |
| Browser platform | System (external) | Decodes the Supported image formats with its built-in decoders and provides WebGL2 on the GPU, which it may interrupt (AC-18, AC-19) |
| GitHub Pages | System (external) | Serves the static app shell over HTTPS on first load and updates; never sees an image |

**External: no third-party service** — deliberate. No upload, no telemetry, no remote decoder (§2 Regulatory).

**C4 Context (L1):**

```mermaid
C4Context
    title open-and-view — System Context

    Person(editor, "Editor", "Opens an image and inspects it before editing")
    Person(reviewer, "Portfolio reviewer", "Judges the app on a first open")
    System(app, "imgly-editor", "Client-only image editor PWA running in the browser tab")
    System_Ext(os, "Operating system", "File dialog, drag source and file read permissions")
    System_Ext(browser, "Browser platform", "Built-in image decoders, WebGL2 and the GPU")
    System_Ext(pages, "GitHub Pages", "Serves the static app shell over HTTPS")

    Rel(editor, app, "Opens, drops, zooms and pans images", "mouse, trackpad, keyboard")
    Rel(reviewer, app, "Tries a first open", "desktop browser")
    Rel(app, os, "Asks for a file and reads its bytes", "file input, drag and drop")
    Rel(app, browser, "Decodes images and renders the Preview", "image decoding, WebGL2")
    Rel(app, pages, "Loads the app shell once, then runs offline", "HTTPS")
```

## 4. Solution strategy

**Target surface.** `target_surfaces: [web-frontend]` (frontmatter). The feature owns one runnable surface, the Editor SPA in the browser tab. The decode worker, the editing core and the render pipeline are internal containers of that surface (§5), not surfaces of their own: there is no server (repo ADR 0001), no event-consumer `worker` surface, and no published library. Decided inline: the only alternative surfaces are excluded by §2.

**UI architecture (web-frontend).** A client-rendered SPA with one editor view and no router; the empty editor, the editor with a Work, and the unsupported-browser and display-lost messages are alternative contents of the same canvas area (ux-flows.md §Platform decisions). State lives in the `editor` Pinia setup store; components are built from `src/shared/ui/` primitives and `tokens.css`. Inherited from repo ADR 0001 and `docs/architecture-map.md` §Frontend; no new ADR, because server rendering is excluded by §2 (no server).

**Top strategic choices (the seeds for ADRs):**

1. **A two-phase open, decoded off the main thread** — [ADR-0001](adr/0001-decode-and-downscale-in-a-dedicated-web-worker.md). Every open reads, checks, decodes, orients and downscales the file in a dedicated Web Worker and hands back a finished bitmap; only then does the `editor` store decide (no Unsaved edits → replace; Unsaved edits → confirm) and swap the Work in one step. A newer open terminates the older worker. Serves quality goal 1 (no freeze above 200 ms) and quality goal 2 (the Work is only ever replaced by an image read successfully).
2. **Judge by content before decoding** — [ADR-0002](adr/0002-parse-image-headers-in-core-before-decoding.md). A pure-TypeScript header parser in `src/core/image-header/` names the format, reads the declared dimensions, animation and orientation from a bounded byte window, and the open policy refuses oversize images before any pixel is decoded. Serves quality goal 2 and is the single point of the security review.
3. **One WebGL2 Preview with the View as a transform** — [ADR-0003](adr/0003-render-the-preview-in-one-webgl2-canvas-with-a-view-transform.md). The Original becomes a mipmapped texture in one canvas at physical-pixel resolution; zoom and pan are a shader uniform computed by pure View maths in `src/core/view/`. Serves quality goal 3 and is the surface later tools (adjust, crop, draw) extend unchanged.
4. **One colour space: sRGB** — [ADR-0004](adr/0004-convert-every-original-to-srgb-on-open.md). Every Original is converted to sRGB while decoding, so Preview, adjustments and export agree in every browser. Resolves the spec §8 wide-gamut question.

Each tactical decision in later sections should trace to one of these seeds. Tactical decisions that *contradict* a strategic choice are red flags — surface them in §11.

## 5. Building block view

The feature follows the repo's functional core with feature folders (repo ADR 0002), which works like a small hexagonal layout: `src/core/` holds every rule as pure TypeScript (header judging, the open policy, View maths, the Work and its Unsaved-edits rule) and is unit-tested without a browser; `src/infra/` and `src/render/` are the adapters to the browser (file intake, the decode worker, WebGL2); `src/features/editor/` is the only UI and the `editor` store is the one place that decides whether a decoded image replaces the Work. open-and-view extends the existing `editor` feature instead of adding a new feature folder, because the open, the replace rule and the View are the editor's own baseline, and every later intake (paste, "Open with…", gallery re-open) calls the same store action. No datastore is touched (§2).

The Work knows it has Unsaved edits through a revision counter ([ADR-0005](adr/0005-track-unsaved-edits-with-a-revision-counter-on-the-work.md)): every edit, undo and redo raises `revision`, and `hasUnsavedEdits(work)` compares it with the revision at open (later, at save). The View lives next to the Work in the `editor` store, never inside it, so zoom and pan can never count as edits (AC-14).

**Internal decomposition:**

```
src/
├── core/                         pure TypeScript: no Vue, Pinia, DOM or browser APIs
│   ├── result.ts                 Result<T, AppError>; new open error codes (§8)
│   ├── document.ts               Work = Original + revision counters; hasUnsavedEdits(work) (ADR-0005)
│   ├── image-header/             sniffImageHeader(bytes) → format, size, animated, orientation (ADR-0002)
│   ├── open/                     checkOpenPolicy (size ceiling), targetSize (Downscale limit), pickFromDrop order
│   └── view/                     View maths: fit, zoom steps, clamp, zoom-at-point, pan clamp, auto-fit flag
├── infra/
│   ├── image-decode/             decodeImage(blob) on the main thread + decode.worker.ts (ADR-0001, ADR-0004)
│   └── platform/                 file picker, window-level drop guard, files from a DataTransfer
├── render/
│   ├── capabilities.ts           start-up capability gate (WebGL2, texture size, worker canvas)
│   └── preview-renderer.ts       one WebGL2 canvas, mipmapped Original texture, View uniform, context loss (ADR-0003)
├── shared/
│   ├── ui/                       BaseButton + the new primitives this feature registers (Toast, Spinner, Dialog…)
│   └── notices/                  notice queue: informational notices self-dismiss, failure reasons stay (AC-11b)
└── features/editor/
    ├── store.ts                  `editor` store: Work, View, open state; openImage(blob) and replace confirmation
    ├── EditorView.vue            canvas area: SCR-01 empty, SCR-02 Work, SCR-04 unsupported, SCR-05 display lost
    ├── components/               open action, drop overlay, zoom controls, dimensions readout, replace dialog (SCR-03)
    └── index.ts                  public surface: EditorView + useEditorStore
```

Dependency direction stays as repo ADR 0002 sets it: `features/editor → core | infra | render | shared`, `infra → core (types and pure functions) | shared`, and `core` imports nothing. The decode worker runs the same `core/image-header` and `core/open` code the unit tests cover, so the security review reads one parser in one place.

**C4 Container (L2):**

```mermaid
C4Container
    title open-and-view — Containers

    Person(editor, "Editor", "Opens an image and inspects it")
    Person(reviewer, "Portfolio reviewer", "Judges the app on a first open")

    System_Ext(os, "Operating system", "File dialog, drag source, read permissions")
    System_Ext(browser, "Browser platform", "Built-in image decoders, WebGL2 and the GPU")
    System_Ext(pages, "GitHub Pages", "Serves the static app shell over HTTPS")

    Container_Boundary(app, "imgly-editor (browser tab)") {
        Container(spa, "Editor SPA", "Vue 3, Pinia, TypeScript", "Editor view, open action, drop guard, View controls, notices; the editor store decides every replace")
        Container(core, "Editing core", "Pure TypeScript", "Header judging, open policy, View maths, Work and Unsaved-edits rule")
        Container(worker, "Decode worker", "Web Worker, OffscreenCanvas", "Reads, checks, decodes, orients and downscales one file into an sRGB bitmap")
        Container(gpu, "Render pipeline", "WebGL2", "Draws the Preview at the current View and survives context loss")
        Container(sw, "Service worker", "Workbox via vite-plugin-pwa", "Precaches the app shell and the worker script for offline opens")
    }

    Rel(editor, spa, "Opens, drops, zooms and pans", "mouse, trackpad, keyboard")
    Rel(reviewer, spa, "Tries a first open", "desktop browser")
    Rel(spa, os, "Asks for a file, receives dropped files", "file input, drag and drop")
    Rel(spa, worker, "Sends the chosen file, receives a bitmap and its facts", "postMessage with transfer")
    Rel(spa, core, "Applies the replace rule and View maths", "function calls")
    Rel(worker, core, "Judges the header and computes the target size", "function calls")
    Rel(worker, browser, "Decodes to sRGB", "createImageBitmap")
    Rel(spa, gpu, "Uploads the Original, sets the View", "function calls")
    Rel(gpu, browser, "Draws on the GPU", "WebGL2")
    Rel(sw, pages, "Fetches the app shell on install and update", "HTTPS")
```

## 6. Runtime view

Two flows are seeded here: the open itself, including the replace confirmation, and the failure and supersede paths that protect the Work. The `sequences` stage expands them to cover every spec §5 AC. Participants are the §5 containers; the Browser platform from §3 appears where the worker decodes.

**Critical flow 1: open an image and replace the Work** (AC-01, AC-02, AC-05, AC-06, AC-11, AC-14, AC-15)

```mermaid
sequenceDiagram
    actor Editor
    participant SPA as Editor SPA
    participant Core as Editing core
    participant Worker as Decode worker
    participant Browser as Browser platform
    participant GPU as Render pipeline

    Editor->>SPA: chooses a file in the dialog or drops it on the window
    SPA->>SPA: shows the spinner, the current Work stays visible and pannable
    SPA->>Worker: starts a new worker for this open and posts the file
    Worker->>Core: judges the header window and the size ceiling
    Core-->>Worker: Supported image, declared size within the ceiling
    Worker->>Browser: decodes upright to sRGB
    Browser-->>Worker: decoded bitmap
    Worker->>Core: asks for the target size under the Downscale limit
    Core-->>Worker: target width and height
    Worker->>Worker: reduces stepwise and closes every intermediate bitmap
    Worker-->>SPA: transfers the Original bitmap with its facts
    SPA->>Worker: terminates the worker
    SPA->>Core: asks whether the current Work has Unsaved edits
    alt no Work open, or no Unsaved edits
        Core-->>SPA: no
    else Unsaved edits
        Core-->>SPA: yes
        SPA->>Editor: asks to confirm that the current edits will be lost
        alt Editor cancels
            Editor-->>SPA: cancel
            SPA->>SPA: closes the new bitmap, Work and View stay as they were
        else Editor confirms
            Editor-->>SPA: replace
        end
    end
    SPA->>SPA: swaps in the new Work and sets the View to Fit
    SPA->>GPU: uploads the new Original and releases the old one
    GPU-->>Editor: fitted Preview
    SPA-->>Editor: notices for this open, such as downscale or first frame only
```

The Work changes in one step, inside the `editor` store, and only after the worker has returned a finished bitmap. On cancel nothing after the confirmation runs, and the new bitmap is closed at once so its memory is freed. The old Original's bitmap and texture are released after the new texture is uploaded, so the Preview never shows an empty frame.

**Critical flow 2: a superseded open and a refused file leave the Work untouched** (AC-08, AC-09, AC-10, AC-16, AC-16b)

```mermaid
sequenceDiagram
    actor Editor
    participant SPA as Editor SPA
    participant WorkerA as Decode worker A
    participant WorkerB as Decode worker B
    participant Core as Editing core

    Editor->>SPA: chooses file A
    SPA->>WorkerA: starts worker A and posts file A
    Editor->>SPA: drops file B before A has finished
    SPA->>WorkerA: terminates worker A, its memory is freed at once
    SPA->>SPA: marks open A as superseded, it can never replace the Work
    SPA->>WorkerB: starts worker B and posts file B
    WorkerB->>WorkerB: reads the header window
    alt the file cannot be read
        WorkerB-->>SPA: not permitted to read the file
    else the header is judged
        WorkerB->>Core: judges the header window and the size ceiling
        alt not an image, damaged or disguised
            Core-->>WorkerB: unreadable
        else declared size above the ceiling
            Core-->>WorkerB: too large, with both sizes in megapixels
        end
        WorkerB-->>SPA: the refusal reason
    end
    SPA->>WorkerB: terminates worker B
    SPA->>SPA: keeps the Work and View exactly as they were, no confirmation
    SPA-->>Editor: the reason, which stays until dismissed
```

Every refusal ends the same way: the worker reports a typed reason, the `editor` store changes nothing, and the reason goes to the notice queue as a failure that stays until dismissed. A late answer from a terminated worker can never arrive, and the store also ignores any result whose open is no longer the latest.

## 7. Deployment view

open-and-view reuses the existing deployment unit: one static bundle built by `.github/workflows/ci.yml` and served by GitHub Pages under `/imgly/` (repo ADR 0001). There are no servers or replicas; every visitor's browser tab is its own runtime, with one decode worker alive per open at most. The only deployment change is a new build asset: Vite emits the decode worker as a separate hashed module script (`new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' })`), and the Workbox precache must list it, so an open works with no network after the first load (spec §6, offline row). The capability probes' sample images are embedded in the worker script, so the probes never fetch anything.

**Monitoring:**
- No runtime metrics, logs or traces leave the device, by design (§2 Regulatory). The feature's health is measured before release, not in production
- Every push: CI runs lint, typecheck, Vitest units (header parser, open policy, View maths, `hasUnsavedEdits`, the fuzz test of ADR-0002) and the functional Playwright e2e suite on Chromium, Firefox and WebKit, including an offline open after the first load. This widens the repo's Chromium-only e2e (`docs/architecture-map.md` §Conventions) for this feature, because orientation, the capability probes and drop behave differently per engine. WebGL pixel checks stay on Chromium only
- Before each release: the `@perf` Playwright suite (time to first Preview, long tasks, frame rate, memory after 10 opens) runs on the reference machine, because CI runners are not the machine the spec §6 targets bind to. The same pre-release pass opens the HEIC samples in real Safari, since WebKit on Linux does not decode HEIC (§11)
- In the tab: failures surface only as notices to the Editor; in development builds the decode worker also logs its stage timings to the console

**Scaling thresholds** (per tab, on the reference machine):
- Peak memory of one open is the decoded size inside the worker: at most the size ceiling × 4 bytes (§8), plus the reduced Original
- While a Work is open the tab holds the Original twice, as a bitmap for context restore and as a mipmapped texture (ADR-0003): about 150 MB at 4096 × 4096, and about twice that for a moment during a replace, until the old Original is released (§6, flow 1)
- An open whose declared size is above the size ceiling never reaches the decoder (AC-09)

## 8. Crosscutting concepts

<!-- 🎯 Why: CROSS-CUTTING PATTERNS spanning several modules: logging, errors, authorization, ID
     strategy, events, caching. ⭐ The second-densest section. A pattern inside one module is NOT
     here; a project-wide convention belongs in the convention file.
     📋 Write: a table — concept / convention / where defined. One row per concept.
     📌 e.g. «sortable time-based IDs generated in the app layer» as a default from the convention file. -->

| Concept | Convention | Where defined |
|---|---|---|
| Logging | <e.g. structured, fields `module=<name>`> | <convention file §X or here> |
| Authentication | <e.g. token-based via middleware> | <convention file §X> |
| Error handling | <e.g. domain sentinel → ports error mapping → JSON> | <convention file §X> |
| ID strategy | <e.g. sortable time-based ID in the app layer> | <convention file §X> |
| Internationalisation | <e.g. N/A, single language> | — |
| Observability | <e.g. tracing on the request boundary> | — |
| Events | <module-specific patterns, if any> | <here> |

## 9. Architecture decisions

<!-- 🎯 Why: the REVERSE INDEX onto the adr/ folder. `ls adr/` gives the files; §9 gives the
     semantics — why they exist, which SAD section they attach to, what status.
     📋 Write: a 4-column table, one row per ADR. Mixed status is fine.
     📌 e.g. «0001 | Store content as a table of typed blocks | Accepted | §4». -->

| # | Title | Status | Section |
|---|---|---|---|
| <NNNN> | <imperative — e.g. "Use a sliding-window counter for rate limiting"> | Accepted | §<N> |
| <NNNN> | <imperative — e.g. "Co-locate the worker in the API process"> | Accepted | §<N> |

ADR files live under `docs/features/<slug>/adr/NNNN-<title>.md`.

## 10. Quality requirements

<!-- 🎯 Why: the QUALITY TREE — take a goal from §1 and break it into concrete leaves: tests,
     metrics, configs, drills. ⭐ Without §10, §1 is a manifesto. With §10 each declaration maps
     to something PROVABLE.
     📋 Write: per §1 goal — When / Then / How-verify. Numbers from spec §6 NFR VERBATIM (don't
     round ≤250ms to ≤300ms — that's a critic F6 hit).
     📌 e.g. «p95 ≤ 500 ms on a block update, verified by a 100 req/s load test». -->

Each top-3 goal from §1 expanded into a full scenario:

**QG-1. <quality attribute>**
- **When:** <trigger condition>
- **Then:** <expected behaviour with numbers from spec §6 NFR>
- **How verify:** <test / chaos drill / load test / metric>

**QG-2. <quality attribute>**
- **When:** <trigger>
- **Then:** <expected>
- **How verify:** <how>

**QG-3. <quality attribute>**
- **When:** <trigger>
- **Then:** <expected>
- **How verify:** <how>

## 11. Risks and technical debt

<!-- 🎯 Why: ⭐ collects EVERYTHING that can break — not only the technical. Without §11 risks get
     discussed at standups and lost; debt lives only in the head of whoever accepted it.
     📋 Write: a risk/debt table — severity — mitigation — owner. Accepted debt in its own block.
     📌 The first risk is often a product risk, not a technical one. That's normal. -->

<!-- Severity literals: Low / Medium / High for regular risks; "Open question" for rows created by
     a Save-as-OQ resolution during the Socratic walk (see references/socratic.md). -->

| Risk / debt | Severity | Mitigation | Owner |
|---|---|---|---|
| <e.g. Worker lag may reach hours during a downstream outage> | Medium | <alert >10 min, on-call playbook, retry backoff> | <DevOps> |
| <e.g. No event-schema versioning in v1> | Medium | <ADR-NNNN planned for v2, tolerate unknown fields> | <Backend> |
| Open architectural decision: <decision-headline> | Open question | Resolve before <stage trigger or YYYY-MM-DD>; <inline rationale from the Save-as-OQ> | <owner> |

**Accepted debt (acceptable in v1, plan to fix later):**
- <e.g. the entity is immutable / unversioned — OK for v1, may need audit versioning in v2>

## 12. Glossary

<!-- 🎯 Why: ⭐ the DOMAIN GLOSSARY that ends arguments a year later («checkpoint — weekly or
     biweekly? quarter — calendar or fiscal?»).
     📋 Write: a term / meaning table. Business + technical terms mixed.
     📌 e.g. «Lesson | a unit inside a course made of blocks (text, video)». -->

| Term | Meaning |
|---|---|
| <e.g. domain object A> | <its meaning in this domain> |
| <e.g. domain object B> | <its meaning> |
| <e.g. domain invariant name> | <the rule, in plain language> |
