# imgly-editor

A client-only image editor: a Vue 3 PWA with no backend, deployed to GitHub Pages under `/imgly/`.
The architecture is defined in `docs/architecture-map.md`, the domain vocabulary is in `CONTEXT.md`
(use its Glossary terms: Work, Original, View, Preview, Unsaved edits…), and feature specs live
in `docs/features/<slug>/`.

## Commands

- `pnpm dev` runs the Vite dev server.
- `pnpm build` runs `vue-tsc -b && vite build` and writes to `dist/`.
- `pnpm test` runs `vitest run` (unit tests with happy-dom and fake-indexeddb).
- `pnpm test:e2e` runs `playwright test` (Chromium, Firefox, WebKit) against `vite preview` of its own
  hooks-enabled build in `dist-e2e/`. `@perf` tests run only with `PERF=1`.
- `pnpm lint` runs `eslint .`, and `pnpm format` runs Prettier.
- `pnpm typecheck` runs `vue-tsc -b --noEmit`, the "vet" gate.

Before a commit, `pnpm lint && pnpm typecheck && pnpm test` must pass.

## Module boundaries

The architecture is a functional core with feature folders ([ADR 0002](docs/adr/0002-organize-code-as-functional-core-with-feature-folders.md)).

| Path                  | What lives there                                                             | May import                                                              |
| --------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/core/`           | Pure TS domain: Work document, command stack, `Result` and error codes       | nothing outside `core`. No Vue, no Pinia, no DOM (ESLint enforces this) |
| `src/render/`         | WebGL2 adjustments, Canvas 2D compositor, export encoder                     | `core`, `shared`                                                        |
| `src/infra/db/`       | IndexedDB (`openDb`, migrations, repositories)                               | `core` (types), `shared`                                                |
| `src/infra/platform/` | File open/save, clipboard, drag and drop, `launchQueue`                      | `core` (types), `shared`                                                |
| `src/shared/`         | Design tokens, UI primitives (`src/shared/ui/`), `ids.ts`                    | `core` (types) only — never `features`, `infra`, `render`               |
| `src/features/<f>/`   | One feature: components, a Pinia setup store `store.ts`, a public `index.ts` | `core`, `infra`, `render`, `shared`                                     |
| `src/app/`            | App shell, Pinia install, service-worker registration                        | `features` (through `index.ts` only)                                    |

Features never import each other. They coordinate through the `editor` store
(`src/features/editor/store.ts`) or `core` commands, and there is no event bus. Import other modules
only through their `index.ts`.

## Conventions

- **Errors:** `core` and `infra` return `Result<T, AppError>` from `src/core/result.ts`
  (`ok()` / `err()` / `appError(code, details)`). `AppError.code` is a typed union, and new codes are
  added there. Throw only for programmer errors. The UI shows errors through the single toast boundary.
- **IDs:** use `newId()` from `src/shared/ids.ts`, which returns a time-sortable UUIDv7. Never use
  `Math.random` or `crypto.randomUUID` for entity IDs.
- **Persistence:** only `src/infra/db/*` touches IndexedDB, through repository functions that return
  `Result`. Store images as `Blob`s, never as data URLs.
- **Migrations:** add forward-only steps as `src/infra/db/migrations/NNNN-<name>.ts`, each exporting
  `{ version, upgrade(db, tx) }`, and append them to `migrations` in `migrations/index.ts`. Never edit
  a released step. A "down" is a new forward step. Cover each step with a `fake-indexeddb/auto` test.
- **Tests:** co-locate Vitest unit tests as `*.test.ts`. Component tests use `@vue/test-utils`
  on happy-dom. e2e tests go in `e2e/*.spec.ts`, but only for what happy-dom can't do (WebGL, the
  service worker and offline reload, downloads).
- **Styling:** plain CSS with `<style scoped>`. Every colour, spacing value and font comes from
  `var(--…)` in `src/shared/styles/tokens.css`. Don't add a UI kit or CSS framework. Reuse
  `src/shared/ui/` primitives, and register any new primitive in `docs/design-system.md`.
- **Formatting:** Prettier (single quotes, no semicolons, width 100) plus the ESLint flat config.
- **Base path:** Vite `base`, the manifest `scope` and `start_url`, and the SW scope are all `/imgly/`.

## Decisions

- [0001 Build a client-only Vue PWA](docs/adr/0001-build-a-client-only-vue-pwa.md)
- [0002 Functional core with feature folders](docs/adr/0002-organize-code-as-functional-core-with-feature-folders.md)
- [0003 Persist works in IndexedDB as original + params + layer](docs/adr/0003-persist-works-in-indexeddb-as-original-plus-params-plus-layer.md)
- [0004 WebGL2 for adjustments, Canvas 2D for drawing](docs/adr/0004-render-adjustments-on-webgl2-and-drawing-on-canvas2d.md)
