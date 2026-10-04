import { expect, test, type Page } from '@playwright/test'
import { dropGeneratedImage, gotoReady, view, waitForWork } from './helpers'

/** Runs WEBGL_lose_context on the Preview's own context. */
async function loseContext(page: Page, restoreAfterMs?: number) {
  await page.evaluate((restoreAfter) => {
    const canvas = document.querySelector('[data-testid="preview-canvas"]') as HTMLCanvasElement
    const ext = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!
    ext.loseContext()
    if (restoreAfter !== undefined) setTimeout(() => ext.restoreContext(), restoreAfter)
  }, restoreAfterMs)
}

test.describe('SCR-04 — unsupported browser (AC-18)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type === 'webgl2') return null
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest)
      } as typeof original
      delete (window as { WebGL2RenderingContext?: unknown }).WebGL2RenderingContext
    })
    await page.goto('./')
    await expect(
      page.getByRole('heading', { name: "This browser can't display the editor." }),
    ).toBeVisible()
  })

  test('explains the browser can’t display the editor, with no Open image', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: "This browser can't display the editor." }),
    ).toBeVisible()
    await expect(
      page.getByText('Try a current version of Chrome, Edge, Firefox or Safari.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open image' })).toHaveCount(0)
  })

  test('a dropped file opens nothing and never navigates', async ({ page }) => {
    const url = page.url()
    await dropGeneratedImage(page, { width: 100, height: 100 })

    await page.waitForTimeout(500)
    expect(page.url()).toBe(url)
    expect(await page.evaluate(() => window.__imglyTest?.work() ?? null)).toBeNull()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByText('Drop an image to open it')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: "This browser can't display the editor." }),
    ).toBeVisible()
  })
})

test.describe('graphics interruptions (AC-19, AC-19b)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'WEBGL_lose_context runs on Chromium')

  test.beforeEach(async ({ page }) => {
    await gotoReady(page)
    await dropGeneratedImage(page, { width: 4000, height: 3000 })
    await waitForWork(page, 4000, 3000)
    await page.getByRole('button', { name: 'Zoom in' }).click()
  })

  test('a context restored in time comes back at the same View (AC-19)', async ({ page }) => {
    const before = {
      view: await view(page),
      work: await page.evaluate(() => window.__imglyTest!.work()),
    }
    const level = await page.getByTestId('zoom-level').textContent()

    await loseContext(page, 1000)
    await expect(page.getByTestId('restoring')).toBeVisible()
    await expect(page.getByTestId('restoring')).toHaveCount(0, { timeout: 4000 })

    expect(await view(page)).toEqual(before.view)
    expect(await page.evaluate(() => window.__imglyTest!.work())).toEqual(before.work)
    await expect(page.getByTestId('zoom-level')).toHaveText(level!)
    await expect(page.getByRole('heading', { name: "The display couldn't recover." })).toHaveCount(
      0,
    )
  })

  test('a context not restored shows SCR-05 after 5000 ms, focus on Reload page (AC-19b)', async ({
    page,
  }) => {
    await loseContext(page)
    await expect(page.getByTestId('restoring')).toBeVisible()
    await page.waitForTimeout(4000)
    await expect(page.getByRole('heading', { name: "The display couldn't recover." })).toHaveCount(
      0,
    )

    await expect(page.getByRole('heading', { name: "The display couldn't recover." })).toBeVisible({
      timeout: 3000,
    })
    await expect(
      page.getByText('The open image and any edits will be lost.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload page' })).toBeFocused()
    await expect(page.getByTestId('editor-status-bar')).toHaveCount(0)
  })
})
