import {
  applyAdjustments,
  NEUTRAL_ADJUSTMENTS,
  notice,
  numberedImage,
  openNumbered,
  rawAdjustments,
  replaceDialog,
  waitForCommittedSave,
  work,
} from '../gallery/helpers'
import { openFile } from '../export/helpers'
import {
  buildOf,
  checkForUpdate,
  expect,
  gotoControlled,
  markPage,
  publishUpdate,
  reloadButton,
  stillSamePage,
  test,
  updateNotice,
} from './two-builds'

/**
 * Two windows on one version, one of them switching (pwa-install-update T14, AC-14, KPI 4: 0 windows
 * left on an outdated version without a notice).
 */

const AVAILABLE = 'A new version of imgly is available.'
const UPDATED_ELSEWHERE = 'imgly was updated in another window. Reload to use the new version.'
const RELOAD_TO_SAVE =
  'imgly was updated in another window. Reload this window to keep saving to the Gallery.'
const PART_UNAVAILABLE = 'imgly was updated in another window. Reload this window to continue.'

test.beforeEach(() => {
  test.setTimeout(120_000)
})

test('AC-14: when one window switches, the other says so even after a dismissal, and a part it can no longer load changes nothing', async ({
  page,
  context,
  builds,
}) => {
  await gotoControlled(page)
  const other = await context.newPage()
  await gotoControlled(other)
  await markPage(other)

  await publishUpdate(builds, page)
  await checkForUpdate(other)
  await expect(notice(other, AVAILABLE)).toHaveCount(1, { timeout: 30_000 })
  await updateNotice(other).getByRole('button', { name: 'Dismiss' }).click()
  await expect(updateNotice(other)).toHaveCount(0)

  await Promise.all([page.waitForEvent('load'), reloadButton(page).click()])
  await expect.poll(() => buildOf(page), { timeout: 15_000 }).toBe('B')

  // The other window: one update notice, the "updated elsewhere" wording, no reload.
  await expect(notice(other, UPDATED_ELSEWHERE)).toHaveCount(1, { timeout: 15_000 })
  await expect(updateNotice(other)).toHaveCount(1)
  expect(await stillSamePage(other)).toBe(true)
  expect(await buildOf(other)).toBe('A')

  // Build A's decode worker is gone from the network: opening an image changes nothing.
  await openFile(other, 'img-01.png', await numberedImage(other, 1), 'image/png')
  await expect(notice(other, PART_UNAVAILABLE)).toHaveCount(1, { timeout: 15_000 })
  expect(await work(other)).toBeNull()
  expect(await stillSamePage(other)).toBe(true)
})

test('AC-14: a newer version that changes the Gallery storage stops saving here; this window says to reload, and Reload asks', async ({
  page,
  context,
}) => {
  await gotoControlled(page)
  const id = await openNumbered(page, 1)
  await applyAdjustments(page, { ...NEUTRAL_ADJUSTMENTS, brightness: 20 })
  await waitForCommittedSave(page)
  await markPage(page)

  // Another window of a newer version upgrades the Gallery's database.
  const other = await context.newPage()
  await gotoControlled(other)
  await other.evaluate(() => window.__imglyTest!.galleryOpenNextVersion())

  await expect(notice(page, RELOAD_TO_SAVE)).toHaveCount(1, { timeout: 15_000 })
  await expect(updateNotice(page)).toHaveCount(1)

  // Editing goes on, but nothing reaches the Gallery any more.
  await applyAdjustments(page, { ...NEUTRAL_ADJUSTMENTS, brightness: 60 })
  await page.waitForTimeout(1_500)
  expect((await rawAdjustments(other, id))?.brightness).toBe(20)

  await reloadButton(page).click()
  await expect(replaceDialog(page)).toContainText('Reload and lose your latest edits?')
  await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()
  expect((await work(page))!.adjustments.brightness).toBe(60)
  expect(await stillSamePage(page)).toBe(true)
})
