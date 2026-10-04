# imgly editor

A client-only image editor that runs in the browser and works offline. It is built with Vue 3,
Pinia, Vite and WebGL2, and is served as a PWA from GitHub Pages. No server is involved: images
never leave your machine.

## Run

Requires Node 24 and pnpm 10.

```sh
pnpm install
pnpm dev        # http://localhost:5173/imgly/
```

To check a production build locally, run `pnpm build && pnpm preview` and open
http://localhost:4173/imgly/. The service worker is only active in the production build.

## Test

```sh
pnpm lint        # ESLint
pnpm typecheck   # vue-tsc
pnpm test        # Vitest unit tests
pnpm test:e2e    # Playwright (Chromium); first time: pnpm exec playwright install chromium
```

## Deploy

Every push and pull request runs `.github/workflows/ci.yml`: lint, typecheck, unit tests, build and
e2e. A push to `main` also publishes `dist/` to GitHub Pages. To enable that, open the repository
settings, go to **Pages**, and set **Source** to **GitHub Actions** (one time). The app is served at
`https://<user>.github.io/imgly/`. If the repository is renamed, update `BASE` in `vite.config.ts`.

## Docs

- `docs/architecture-map.md` covers the stack, modules and conventions.
- `docs/adr/` holds the architecture decisions.
- `CONTEXT.md` is the domain glossary.
- `docs/features/<slug>/` holds feature specs, designs and task breakdowns.
