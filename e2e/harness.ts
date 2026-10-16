import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base, type BrowserContext } from '@playwright/test'

export * from '@playwright/test'

/**
 * `test` for every e2e spec: import it from here, never from `@playwright/test`.
 *
 * Playwright's WebKit gives each context an ephemeral (private browsing) data store, and WebKit
 * refuses to store a Blob in IndexedDB there: the put aborts with "UnknownError: Error preparing
 * Blob/File data to be stored in object store" (strings and ArrayBuffers store fine; a persistent
 * context stores Blobs). Every Autosave would fail and raise the Gallery's failure notice over
 * whatever the spec checks. WebKit therefore runs each test in a fresh, throw-away persistent
 * context, which keeps the "fresh browser context per test" rule.
 */
export const test = base.extend<{ offlineReadyNotice: boolean }>({
  /**
   * Whether the one-time "ready to work offline" notice (pwa-install-update AC-05) shows. Every
   * spec runs under the service worker as production does; only the specs about this notice see
   * it, so it never sits over what the others check.
   */
  offlineReadyNotice: [false, { option: true }],
  context: async (
    {
      offlineReadyNotice,
      context,
      playwright,
      browserName,
      headless,
      launchOptions,
      baseURL,
      viewport,
      userAgent,
      deviceScaleFactor,
      hasTouch,
      isMobile,
      locale,
      timezoneId,
      permissions,
      colorScheme,
      serviceWorkers,
    },
    use,
  ) => {
    const quiet = (target: BrowserContext) =>
      offlineReadyNotice
        ? Promise.resolve()
        : target.addInitScript(() => {
            ;(window as { __e2eQuietOfflineReady?: boolean }).__e2eQuietOfflineReady = true
          })
    if (browserName !== 'webkit') {
      await quiet(context)
      await use(context)
      return
    }
    const dir = mkdtempSync(join(tmpdir(), 'imgly-e2e-webkit-'))
    const persistent = await playwright.webkit.launchPersistentContext(dir, {
      ...launchOptions,
      headless,
      baseURL,
      viewport,
      userAgent,
      deviceScaleFactor,
      hasTouch,
      isMobile,
      locale,
      timezoneId,
      permissions,
      colorScheme,
      serviceWorkers,
      acceptDownloads: true,
    })
    await quiet(persistent)
    await use(persistent)
    await persistent.close()
    rmSync(dir, { recursive: true, force: true })
  },
})
