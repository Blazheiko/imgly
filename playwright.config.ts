import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/imgly/`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // CI builds in its own step; locally build first so the preview is never stale.
    command: `${process.env.CI ? '' : 'pnpm build && '}pnpm preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/imgly/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
