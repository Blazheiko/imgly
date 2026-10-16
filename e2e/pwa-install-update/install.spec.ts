import type { Page } from '@playwright/test'
import { notice, toasts } from '../gallery/helpers'
import { expect, test } from '../harness'
import { gotoReady } from '../open-and-view/helpers'
import { afterRender, installAnswered, startupSettled } from './signals'

/**
 * "Install app" (pwa-install-update T14, AC-01 to AC-04). Playwright cannot make a browser raise a
 * real install offer, so these run on the e2e build's synthetic `beforeinstallprompt`, which goes
 * through the same install-prompt client as the real one.
 */

const INSTALL_FAILED =
  "imgly couldn't be installed. Try installing it from the browser's menu instead."

const installAction = (page: Page) =>
  page.getByTestId('editor-top-bar').getByRole('button', { name: 'Install app' })

const offer = (page: Page, choice: 'accepted' | 'dismissed' | 'fail', installs = true) =>
  page.evaluate(
    ({ choice, installs }) => window.__imglyTest!.pwaOfferInstall(choice, { installs }),
    { choice, installs },
  )

test('AC-02: without an offer there is no "Install app" and nothing else changes', async ({
  page,
}) => {
  await gotoReady(page)
  await startupSettled(page)
  await expect(installAction(page)).toHaveCount(0)
  await expect(toasts(page)).toHaveCount(0)
})

test('AC-01, AC-02: an offer shows a quiet "Install app" last in the top bar', async ({ page }) => {
  await gotoReady(page)
  await offer(page, 'accepted')

  await expect(installAction(page)).toBeVisible()
  await expect(installAction(page)).toHaveAttribute(
    'title',
    'Install imgly as an app on this computer',
  )
  const labels = await page
    .getByTestId('editor-top-bar')
    .locator('.editor-top-bar__actions button')
    .allTextContents()
  // ui-refresh AC-02: Install app comes right before Export, which ends the top bar.
  expect(labels.map((l) => l.trim()).at(-2)).toBe('Install app')
  expect(labels.map((l) => l.trim()).at(-1)).toMatch(/^Export/)
  await expect(toasts(page)).toHaveCount(0)
})

test('AC-01: accepted and installed, the action is gone and nothing is said', async ({ page }) => {
  await gotoReady(page)
  await offer(page, 'accepted')
  await installAction(page).click()

  await expect(installAction(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__imglyTest!.pwaInstallPrompts())).toBe(1)
  await installAnswered(page)
  await afterRender(page)
  await expect(toasts(page)).toHaveCount(0)
})

test('AC-03: a dismissed confirmation hides the action with no notice, until the browser offers again', async ({
  page,
}) => {
  await gotoReady(page)
  await offer(page, 'dismissed')
  await installAction(page).click()

  await expect(installAction(page)).toHaveCount(0)
  await installAnswered(page)
  await afterRender(page)
  await expect(toasts(page)).toHaveCount(0)

  await offer(page, 'dismissed')
  await expect(installAction(page)).toBeVisible()
})

test('AC-03: a confirmation that fails says the app could not be installed', async ({ page }) => {
  await gotoReady(page)
  await offer(page, 'fail')
  await installAction(page).click()

  await expect(notice(page, INSTALL_FAILED)).toHaveCount(1)
  await expect(installAction(page)).toHaveCount(0)
})

test('AC-03: accepted but never installed within 10 s says the app could not be installed', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await gotoReady(page)
  await offer(page, 'accepted', false)
  await installAction(page).click()

  await page.waitForTimeout(9_000)
  await expect(notice(page, INSTALL_FAILED)).toHaveCount(0)
  await expect(notice(page, INSTALL_FAILED)).toHaveCount(1, { timeout: 5_000 })
})

test('AC-04: the Installed app never offers to install itself', async ({ page }) => {
  await page.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window)
    window.matchMedia = (query: string) =>
      query === '(display-mode: standalone)'
        ? ({ ...matchMedia(query), matches: true, media: query } as MediaQueryList)
        : matchMedia(query)
  })
  await gotoReady(page)
  await offer(page, 'accepted')
  await afterRender(page)

  await expect(installAction(page)).toHaveCount(0)
  expect(await page.evaluate(() => window.__imglyTest!.pwaCanInstall())).toBe(false)
})
