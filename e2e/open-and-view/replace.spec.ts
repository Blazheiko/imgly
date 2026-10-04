import { expect, test, type Page } from '@playwright/test'
import { dropGeneratedImage, gotoReady, waitForWork } from './helpers'

const work = (page: Page) => page.evaluate(() => window.__imglyTest!.work())

/** Opens A, prepares Unsaved edits on it, focuses Open image, then drops B (6000×4000). */
async function openOverUnsavedEdits(page: Page) {
  await gotoReady(page)
  await dropGeneratedImage(page, { width: 4000, height: 3000 })
  await waitForWork(page, 4000, 3000)
  await page.evaluate(() => window.__imglyTest!.applyEdit())
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await page.getByRole('button', { name: 'Open image' }).focus()
  const before = {
    work: await work(page),
    view: await page.evaluate(() => window.__imglyTest!.view()),
    level: await page.getByTestId('zoom-level').textContent(),
  }

  await dropGeneratedImage(page, { width: 6000, height: 4000 })
  await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 15_000 })
  return before
}

test.describe('SCR-03 — replace confirmation (AC-15)', () => {
  test('asks before replacing a Work with Unsaved edits, focus on Cancel', async ({ page }) => {
    await openOverUnsavedEdits(page)

    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByRole('heading')).toHaveText('Replace the current image?')
    await expect(dialog).toContainText('Your edits to the current image will be lost.')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  })

  test('Cancel keeps the Work id, revision and View, shows no notices, returns focus', async ({
    page,
  }) => {
    const before = await openOverUnsavedEdits(page)

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    expect(await work(page)).toEqual(before.work)
    expect(before.work!.revision).toBe(1)
    expect(await page.evaluate(() => window.__imglyTest!.view())).toEqual(before.view)
    await expect(page.getByTestId('zoom-level')).toHaveText(before.level!)
    await expect(page.getByTestId('toast-stack')).toBeEmpty()
    await expect(page.getByRole('button', { name: 'Open image' })).toBeFocused()
  })

  test('Esc cancels the same way', async ({ page }) => {
    const before = await openOverUnsavedEdits(page)
    await page.keyboard.press('Escape')

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    expect(await work(page)).toEqual(before.work)
  })

  test('Replace shows the new image at Fit, then its notices', async ({ page }) => {
    const before = await openOverUnsavedEdits(page)
    await expect(page.getByText(/Reduced to the 4096 px limit/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Replace' }).click()

    await waitForWork(page, 4096, 2731)
    const after = await work(page)
    expect(after!.id).not.toBe(before.work!.id)
    expect(after!.revision).toBe(0)
    expect((await page.evaluate(() => window.__imglyTest!.view())).autoFit).toBe(true)
    await expect(
      page.getByText('Reduced to the 4096 px limit: 6000×4000 → 4096×2731.'),
    ).toBeVisible()
  })

  test('opens without asking when only the View changed (AC-14)', async ({ page }) => {
    await gotoReady(page)
    await dropGeneratedImage(page, { width: 4000, height: 3000 })
    await waitForWork(page, 4000, 3000)
    await page.getByRole('button', { name: 'Zoom in' }).click()

    await dropGeneratedImage(page, { width: 3000, height: 2000 })
    await waitForWork(page, 3000, 2000)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })
})
