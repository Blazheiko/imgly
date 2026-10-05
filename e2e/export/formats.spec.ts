import { expect, test } from '@playwright/test'
import {
  choose,
  confirmAndCapture,
  expectSaved,
  FORMAT_OF,
  generateImage,
  gotoReady,
  headerOf,
  openFile,
  panel,
  prepareCapture,
  waitForWork,
  type FormatLabel,
} from './helpers'

// AC-01, AC-02, AC-12: every produced file is the format its name claims, judged by content.
test.describe('format honesty', () => {
  test.beforeEach(async ({ page, browserName }) => {
    await gotoReady(page)
    await openFile(
      page,
      'scene.png',
      await generateImage(page, { width: 320, height: 240 }),
      'image/png',
    )
    await waitForWork(page, 320, 240)
    await prepareCapture(page, browserName)
  })

  for (const label of ['PNG', 'JPEG', 'WebP'] as FormatLabel[]) {
    test(`${label}: the file's content matches its extension and size`, async ({
      page,
      browserName,
    }) => {
      await choose(page)
      const option = panel(page).getByRole('radio', { name: label, exact: true })
      // The session check must have answered before a lossy format can be chosen.
      await expect
        .poll(
          async () =>
            (await option.isDisabled()) && (await panel(page).textContent())?.includes('Checking'),
          {
            timeout: 15_000,
          },
        )
        .toBe(false)

      if (await option.isDisabled()) {
        // Only a browser that can't produce it (WebP on WebKit) may refuse it, and says so.
        expect(label, `${label} unavailable on ${browserName}`).toBe('WebP')
        expect(browserName).toBe('webkit')
        await expect(panel(page)).toContainText("WebP isn't available in this browser.")
        return
      }

      await choose(page, { format: label })
      const file = await confirmAndCapture(page, browserName)
      await expectSaved(page)

      const ext = { PNG: '.png', JPEG: '.jpg', WebP: '.webp' }[label]
      expect(file.name).toBe(`scene-edited${ext}`)
      expect(headerOf(file.bytes)).toMatchObject({
        format: FORMAT_OF[label],
        width: 320,
        height: 240,
      })
      const notice =
        browserName === 'chromium'
          ? `Saved scene-edited${ext}.`
          : `scene-edited${ext} is in your browser's downloads.`
      await expect(page.getByRole('status').filter({ hasText: notice })).toBeVisible()
    })
  }

  test('the panel says where the file goes', async ({ page, browserName }) => {
    await choose(page)
    await expect(panel(page)).toContainText(
      browserName === 'chromium'
        ? "You'll choose where to save it."
        : "It goes to your browser's downloads.",
    )
  })

  test('a JPEG of a transparent Work is flattened onto white (AC-15)', async ({
    page,
    browserName,
  }) => {
    await openFile(
      page,
      'clear.png',
      await generateImage(page, { width: 64, height: 48, alpha: true }),
      'image/png',
    )
    await waitForWork(page, 64, 48)
    await choose(page)
    const jpeg = panel(page).getByRole('radio', { name: 'JPEG', exact: true })
    await expect(jpeg).toBeEnabled({ timeout: 15_000 })
    await choose(page, { format: 'JPEG' })
    await expect(panel(page)).toContainText('JPEG has no transparency')

    const file = await confirmAndCapture(page, browserName)
    // Column 0 is fully transparent: it must come out white (JPEG noise allowed).
    const firstColumn = await page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }))
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      return Array.from(ctx.getImageData(0, 24, 1, 1).data)
    }, file.bytes.toString('base64'))
    for (const channel of firstColumn.slice(0, 3)) expect(channel).toBeGreaterThan(240)
  })
})
