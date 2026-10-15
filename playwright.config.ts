import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // The @perf suite runs by hand on the reference machine before release (sad.md §1, §10).
  grepInvert: process.env.PERF ? undefined : /@perf/,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/imgly/`,
    trace: 'on-first-retry',
    // The service worker shows a one-time "ready to work offline" notice on first load
    // (pwa-install-update AC-05); specs that are not about it run without one, and the PWA specs
    // opt in with `test.use({ serviceWorkers: 'allow' })`.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Headless Firefox finds no GL driver on a GPU-less runner (FEATURE_FAILURE_WEBGL_EXHAUSTED_
        // DRIVERS): CI runs it headed under xvfb-run, where it uses Mesa's software GL.
        headless: !process.env.CI,
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // Its own build with the e2e test hooks, kept out of dist/ so they never reach Pages.
    // The update e2e also needs a second build, B, which e2e/pwa-install-update serves itself.
    command: `VITE_E2E_HOOKS=true pnpm exec vite build --outDir dist-e2e && VITE_E2E_HOOKS=true VITE_E2E_BUILD=B pnpm exec vite build --outDir dist-e2e-b && pnpm exec vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/imgly/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
