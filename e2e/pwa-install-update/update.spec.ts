import type { Page } from '@playwright/test'
import {
  applyAdjustments,
  exportPixels,
  expectReopened,
  holdNextEncode,
  instrumentEncodes,
  maxDifference,
  NEUTRAL_ADJUSTMENTS,
  notice,
  NUMBERED,
  numberedName,
  openNumbered,
  releaseEncodes,
  replaceDialog,
  waitForCommittedSave,
  work,
} from '../gallery/helpers'
import { exportAction, panel } from '../export/helpers'
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
import { afterRender, startupSettled } from './signals'

/**
 * The update flows of one window against two real builds (pwa-install-update T13, sad.md §10 QG-1).
 * Every flow proves the app never reloaded before the Editor chose "Reload" (spec §6).
 */

const AVAILABLE = 'A new version of imgly is available.'
const TOOL_OPEN = 'Apply or cancel the open tool first.'
const EXPORTING = 'Wait for the export to finish, then reload.'
const EDIT_A = { ...NEUTRAL_ADJUSTMENTS, brightness: 30 }
const EDIT_B = { ...NEUTRAL_ADJUSTMENTS, brightness: 30, contrast: -20 }

test.beforeEach(() => {
  test.setTimeout(120_000)
})

/** Chooses "Reload" and waits for the page to come back on build B. */
async function reloadIntoB(page: Page, choose: () => Promise<unknown>) {
  await Promise.all([page.waitForEvent('load', { timeout: 30_000 }), choose()])
  await expect(page.getByTestId('editor-view')).toBeVisible()
  await expect.poll(() => buildOf(page), { timeout: 15_000 }).toBe('B')
}

test('AC-06: a downloaded version shows a lasting notice with Reload, and editing goes on', async ({
  page,
  builds,
}) => {
  await gotoControlled(page)
  await markPage(page)
  await publishUpdate(builds, page)

  await expect(notice(page, AVAILABLE)).toHaveCount(1)
  await expect(reloadButton(page)).toHaveText('Reload')
  // Longer than an information notice lives: it stays.
  await page.waitForTimeout(7_000)
  await expect(notice(page, AVAILABLE)).toHaveCount(1)

  await openNumbered(page, 1)
  await applyAdjustments(page, EDIT_A)
  await waitForCommittedSave(page)
  expect(await buildOf(page)).toBe('A')
  expect(await stillSamePage(page), 'no reload the Editor did not choose').toBe(true)
})

test('AC-09: a dismissal holds for this page; a reload shows it again; the version takes over once every window closed', async ({
  page,
  context,
  builds,
}) => {
  await gotoControlled(page)
  await markPage(page)
  await publishUpdate(builds, page)

  await updateNotice(page).getByRole('button', { name: 'Dismiss' }).click()
  await expect(updateNotice(page)).toHaveCount(0)
  // The check has resolved and found the same waiting version: nothing new can arrive.
  await checkForUpdate(page)
  await afterRender(page)
  await expect(updateNotice(page)).toHaveCount(0)
  expect(await stillSamePage(page)).toBe(true)

  // A browser reload keeps the current version and shows the notice again.
  await page.reload()
  await expect(notice(page, AVAILABLE)).toHaveCount(1, { timeout: 30_000 })
  expect(await buildOf(page)).toBe('A')

  // Once every window has closed, the next start runs build B, with no notice and no Work.
  await page.close()
  let next = await context.newPage()
  for (let attempt = 0; attempt < 10; attempt++) {
    await next.goto('./')
    await expect(next.getByTestId('editor-view')).toBeVisible()
    if ((await buildOf(next)) === 'B') break
    await next.close()
    await new Promise((r) => setTimeout(r, 500))
    next = await context.newPage()
  }
  expect(await buildOf(next)).toBe('B')
  await startupSettled(next)
  await expect(updateNotice(next)).toHaveCount(0)
  expect(await work(next)).toBeNull()
})

test('AC-10: with a tool open, Reload refuses once and keeps the notice and the Draft', async ({
  page,
  builds,
}) => {
  await gotoControlled(page)
  await openNumbered(page, 1)
  await markPage(page)
  await publishUpdate(builds, page)
  await page.getByTestId('adjust-action').click()
  await expect(page.getByTestId('adjust-tool')).toBeVisible()

  await reloadButton(page).click()
  await expect(notice(page, TOOL_OPEN)).toHaveCount(1)
  await reloadButton(page).click()
  await expect(notice(page, TOOL_OPEN)).toHaveCount(1)

  await expect(notice(page, AVAILABLE)).toHaveCount(1)
  await expect(reloadButton(page)).toHaveText('Reload')
  await expect(page.getByTestId('adjust-tool')).toBeVisible()
  // The refusal shown means the gate answered: no reload can follow from this Reload.
  expect(await stillSamePage(page)).toBe(true)
})

test('AC-13: while an Export runs, Reload refuses and the Export is not interrupted', async ({
  page,
  builds,
}) => {
  await gotoControlled(page)
  await openNumbered(page, 1)
  await markPage(page)
  await publishUpdate(builds, page)
  // The system's save window stays open: the Export is running.
  await page.evaluate(() => {
    ;(window as unknown as { showSaveFilePicker: () => Promise<never> }).showSaveFilePicker = () =>
      new Promise<never>(() => {})
  })
  await exportAction(page).click()
  await panel(page).getByRole('button', { name: 'Export', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__imglyTest!.exportStatus())).toBe('exporting')

  await reloadButton(page).click()
  await expect(notice(page, EXPORTING)).toHaveCount(1)
  await expect(notice(page, AVAILABLE)).toHaveCount(1)
  expect(await page.evaluate(() => window.__imglyTest!.exportStatus())).toBe('exporting')
  // The refusal shown means the gate answered: no reload can follow from this Reload.
  expect(await stillSamePage(page)).toBe(true)
})

test('AC-11: Reload waits for a running save while editing goes on, then reloads and reopens the stored Work', async ({
  page,
  builds,
}) => {
  await instrumentEncodes(page)
  await gotoControlled(page)
  await openNumbered(page, 1)
  await waitForCommittedSave(page)
  await markPage(page)
  await publishUpdate(builds, page)

  await holdNextEncode(page)
  await applyAdjustments(page, EDIT_A)
  await reloadButton(page).click()
  // The busy action is named "Reloading…" once: its Spinner is hidden from assistive tech.
  await expect(reloadButton(page)).toHaveAccessibleName('Reloading…')
  await expect(reloadButton(page)).toHaveAttribute('aria-disabled', 'true')
  // The Editor keeps working during the wait.
  await applyAdjustments(page, EDIT_B)
  // The held encode keeps the save running, so the Reload must still be waiting on it.
  expect(await page.evaluate(() => window.__imglyTest!.gallerySaving())).toBe(true)
  await expect(reloadButton(page)).toHaveAttribute('aria-disabled', 'true')
  expect(await stillSamePage(page), 'still waiting for the save').toBe(true)

  await reloadIntoB(page, () => releaseEncodes(page))
  await expectReopened(page, `${numberedName(1)}.png`, NUMBERED)
  expect((await work(page))!.adjustments).toMatchObject(EDIT_B)
})

test('AC-12: edits the Gallery does not hold ask first; Cancel keeps everything, Reload reopens the last Stored state', async ({
  page,
  builds,
}) => {
  await gotoControlled(page)
  await openNumbered(page, 1)
  await applyAdjustments(page, EDIT_A)
  await waitForCommittedSave(page)
  await markPage(page)
  await publishUpdate(builds, page)

  await page.evaluate(() => window.__imglyTest!.galleryFailNextSave())
  await applyAdjustments(page, EDIT_B)
  await expect(
    notice(page, "This Work couldn't be saved to the Gallery. Export it to keep a copy."),
  ).toHaveCount(1)
  const before = await work(page)

  await reloadButton(page).click()
  await expect(replaceDialog(page)).toContainText('Reload and lose your latest edits?')
  await expect(replaceDialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused()
  await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()
  await expect(replaceDialog(page)).toHaveCount(0)
  await expect(reloadButton(page)).toBeFocused()
  expect(await work(page)).toEqual(before)
  await expect(notice(page, AVAILABLE)).toHaveCount(1)
  await expect(reloadButton(page)).toHaveText('Reload')
  expect(await stillSamePage(page)).toBe(true)

  await reloadButton(page).click()
  await expect(replaceDialog(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(replaceDialog(page)).toHaveCount(0)
  await expect(reloadButton(page)).toBeFocused()

  await reloadButton(page).click()
  await reloadIntoB(page, () => replaceDialog(page).getByRole('button', { name: 'Reload' }).click())
  await expectReopened(page, `${numberedName(1)}.png`, NUMBERED)
  expect((await work(page))!.adjustments).toMatchObject(EDIT_A)
  expect((await work(page))!.adjustments.contrast).toBe(0)
})

test('AC-07, AC-08: Reload switches to the new version and the reopened Work exports exactly as before', async ({
  page,
  builds,
  browserName,
}) => {
  await gotoControlled(page)
  await openNumbered(page, 1)
  await applyAdjustments(page, EDIT_B)
  await waitForCommittedSave(page)
  const beforePixels = await exportPixels(page, browserName)
  await markPage(page)
  await publishUpdate(builds, page)

  await reloadIntoB(page, () => reloadButton(page).click())
  await expectReopened(page, `${numberedName(1)}.png`, NUMBERED)
  await expect(updateNotice(page)).toHaveCount(0)
  const reopened = (await work(page))!
  expect(reopened.adjustments).toMatchObject(EDIT_B)
  expect(reopened.hasUnsavedEdits).toBe(false)
  expect(maxDifference(await exportPixels(page, browserName), beforePixels)).toBe(0)
  expect(
    await page.evaluate(() => window.__imglyTest!.historyStats().steps),
    'the Edit history starts empty',
  ).toBe(0)
})

test('AC-08: a Work damaged before the reload is not reopened; the Gallery says why and offers Delete…', async ({
  page,
  builds,
}) => {
  await gotoControlled(page)
  const id = await openNumbered(page, 1)
  await waitForCommittedSave(page)
  await publishUpdate(builds, page)
  await page.evaluate((workId) => window.__imglyTest!.galleryDamage(workId, 'original'), id)

  await reloadIntoB(page, () => reloadButton(page).click())
  const damaged = page.locator('.toast', {
    hasText: "can't be opened: its stored data is damaged.",
  })
  await expect(damaged).toHaveCount(1, { timeout: 15_000 })
  await expect(damaged.getByRole('button', { name: 'Delete…' })).toBeVisible()
  expect(await work(page)).toBeNull()
})

test('AC-08: an ordinary start after the update opens no Work', async ({ page, builds }) => {
  await gotoControlled(page)
  await openNumbered(page, 1)
  await waitForCommittedSave(page)
  await publishUpdate(builds, page)
  await reloadIntoB(page, () => reloadButton(page).click())
  await expectReopened(page, `${numberedName(1)}.png`, NUMBERED)

  // The marker was taken: a reload by the browser now opens no Work, as gallery AC-05 says.
  await page.reload()
  await expect(page.getByTestId('editor-view')).toBeVisible()
  await startupSettled(page)
  expect(await work(page)).toBeNull()
})

test('AC-15: a check that fails finds nothing and says nothing', async ({ page, builds }) => {
  await gotoControlled(page)
  await markPage(page)
  // The network drops every request (Playwright's offline mode does not reach the service
  // worker's own update fetch).
  builds.failNetwork(true)
  builds.publish('B')
  // The check's fetch failed and resolved: no download follows it.
  await checkForUpdate(page)
  await afterRender(page)

  await expect(updateNotice(page)).toHaveCount(0)
  await expect(page.locator('.toast--failure')).toHaveCount(0)
  expect(await buildOf(page)).toBe('A')
  expect(await stillSamePage(page)).toBe(true)

  // With the network back, the next check finds the new version.
  builds.failNetwork(false)
  await checkForUpdate(page)
  await expect(notice(page, AVAILABLE)).toHaveCount(1, { timeout: 30_000 })
})
