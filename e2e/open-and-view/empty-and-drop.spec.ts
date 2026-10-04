import { expect, test, type Page } from '@playwright/test'
import { gotoReady } from './helpers'

/** Dispatches a real drag-and-drop of in-memory files onto the page body. */
async function dropFiles(page: Page, files: { name: string; type: string; text: string }[]) {
  await page.evaluate((specs) => {
    const dt = new DataTransfer()
    for (const s of specs) dt.items.add(new File([s.text], s.name, { type: s.type }))
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    }
  }, files)
}

test.describe('SCR-01 — empty editor', () => {
  test('shows one primary Open image action and the drop hint (AC-17)', async ({ page }) => {
    await gotoReady(page)

    await expect(page.getByRole('button', { name: 'Open image' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Open image' })).toBeVisible()
    await expect(page.getByText('or drop an image anywhere in this window')).toBeVisible()
  })

  test('a dropped non-image shows the AC-04 notice and never navigates (AC-02, AC-04)', async ({
    page,
  }) => {
    await gotoReady(page)
    const url = page.url()

    await dropFiles(page, [{ name: 'notes.txt', type: 'text/plain', text: 'hello' }])

    await expect(page.getByRole('alert')).toHaveText(/Only image files can be opened\./)
    expect(page.url()).toBe(url)
    await expect(page.getByRole('button', { name: 'Open image' })).toBeVisible()
  })

  test('a dropped file named as an image but holding text gets the unreadable reason (AC-08)', async ({
    page,
  }) => {
    await gotoReady(page)
    await dropFiles(page, [{ name: 'text-named.png', type: 'image/png', text: 'not an image' }])
    await expect(page.getByRole('alert')).toHaveText(/This file couldn't be read as an image\./)
  })

  test('the drop overlay appears on drag-enter and goes on drag-leave', async ({ page }) => {
    await gotoReady(page)

    await page.evaluate(() =>
      document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true })),
    )
    await expect(page.getByText('Drop an image to open it')).toBeVisible()

    await page.evaluate(() =>
      document.body.dispatchEvent(new DragEvent('dragleave', { bubbles: true, cancelable: true })),
    )
    await expect(page.getByText('Drop an image to open it')).toBeHidden()
  })

  test('exposes the e2e test hooks in the Playwright build', async ({ page }) => {
    await gotoReady(page)
    await expect.poll(() => page.evaluate(() => typeof window.__imglyTest)).toBe('object')
    expect(await page.evaluate(() => window.__imglyTest!.work())).toBeNull()
  })
})
