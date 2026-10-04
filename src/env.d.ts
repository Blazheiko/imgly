/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'true' only in the Playwright build: exposes window.__imglyTest (src/app/test-hooks.ts). */
  readonly VITE_E2E_HOOKS?: string
}
