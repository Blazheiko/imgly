---
status: Accepted
owner: "Blazheiko"
reviewers: []
updated_at: "2026-10-02"
feature_size: "foundation"
ticket: ""
---

# 0001 — Build a client-only Vue 3 + TypeScript PWA with Vite, hosted on GitHub Pages

- **Status:** Accepted
- **Date:** 2026-10-02
- **Deciders:** Blazheiko (owner), survey foundation session

## Context

imgly-editor is a lightweight, installable, offline image editor. It is a personal learning and
portfolio project with a 4–6 week MVP budget (`docs/idea-brief.md`). Accounts, cloud sync and a
server are explicitly out of scope, so the stack only has to produce a static single-page app with a
service worker.

## Decision drivers

- Offline + installable (PWA) is a core promise of the brief.
- "Lightweight" and no backend: accounts and sync are out of scope.
- 4–6 week spare-time budget. A mainstream toolchain with mature PWA tooling beats novelty.
- The owner's existing JS/Vue toolset.

## Considered options

1. **Vue 3 + Pinia + TypeScript + Vite + vite-plugin-pwa**: light SFCs, first-class Vite PWA plugin.
2. **React 19 + Zustand + TypeScript + Vite**: equally viable, with a larger ecosystem and more boilerplate.
3. **Canvas-only vanilla TS** (no framework): the smallest bundle, but every panel and slider is hand-built.

## Decision outcome

**Chosen:** Option 1. It meets the offline/PWA driver with `vite-plugin-pwa`, keeps the bundle light
and matches the owner's toolset. Deploy is a static `dist/` to **GitHub Pages** via GitHub Actions.

## Consequences

**Positive**
- No server to run, secure or pay for. HTTPS (a PWA requirement) comes from GitHub Pages.
- One toolchain (Vite) covers dev, build, unit tests (Vitest) and PWA generation.

**Negative**
- GitHub Pages serves under `/imgly/`, so Vite `base`, manifest `scope`/`start_url` and the SW scope must all agree.
- No server-side headers: COOP/COEP-dependent APIs such as `SharedArrayBuffer` are unavailable.

**Neutral**
- Moving the host to Cloudflare Pages or Netlify later only changes the deploy job and `base`.

## Links

- Brief: [[../idea-brief.md]] §7
- Map: [[../architecture-map.md]] §Stack
- Related ADR: [[0002-organize-code-as-functional-core-with-feature-folders]]
