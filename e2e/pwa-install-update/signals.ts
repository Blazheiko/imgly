import type { Page } from '@playwright/test'
import { expect } from '../harness'

/**
 * Positive signals a negative check waits for first, so "nothing showed" proves something instead
 * of passing because the thing had not happened yet (review R13).
 */

/** Start-up has finished, including the reopen after an update reload (AC-08). */
export async function startupSettled(page: Page) {
  await expect
    .poll(() => page.evaluate(() => window.__imglyTest!.pwaStartupSettled()), { timeout: 15_000 })
    .toBe(true)
}

/** The service worker controls the page and its registration is done: no install event follows. */
export async function workerSettled(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.waitForFunction(() => navigator.serviceWorker.controller != null)
}

/** The browser's (synthetic) install confirmation has answered (AC-01 to AC-03). */
export async function installAnswered(page: Page) {
  await expect.poll(() => page.evaluate(() => window.__imglyTest!.pwaInstalling())).toBe(false)
}

/** A rendered frame has passed, so state set synchronously before it is on screen. */
export async function afterRender(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}
