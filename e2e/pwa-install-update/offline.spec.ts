import { notice } from '../gallery/helpers'
import {
  buildOf,
  expect,
  gotoControlled,
  publishUpdate,
  reloadButton,
  test,
  updateNotice,
} from './two-builds'

/** The offline-ready notice and the offline start (pwa-install-update T14, AC-05, spec §6). */

const OFFLINE_READY = 'imgly is ready to work offline.'

test.beforeEach(() => {
  test.setTimeout(120_000)
})

test('AC-05: the first time the app is stored for offline use, one notice says so, and never again', async ({
  page,
  builds,
}) => {
  await gotoControlled(page)
  await expect(notice(page, OFFLINE_READY)).toHaveCount(1)

  await page.reload()
  await expect(page.getByTestId('editor-view')).toBeVisible()
  await page.waitForTimeout(2_000)
  await expect(notice(page, OFFLINE_READY)).toHaveCount(0)

  // Not after an App update either.
  await publishUpdate(builds, page)
  await Promise.all([page.waitForEvent('load'), reloadButton(page).click()])
  await expect.poll(() => buildOf(page), { timeout: 15_000 }).toBe('B')
  await page.waitForTimeout(2_000)
  await expect(notice(page, OFFLINE_READY)).toHaveCount(0)
  await expect(updateNotice(page)).toHaveCount(0)
})

test('spec §6: after its first load the app starts offline', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot reload a page while offline')
  await gotoControlled(page)
  await context.setOffline(true)
  await page.reload()

  await expect(
    page.getByTestId('empty-canvas').getByRole('button', { name: 'Open image' }),
  ).toBeVisible()
  expect(await buildOf(page)).toBe('A')
})
