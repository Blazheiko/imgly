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
    // Alpha ramps from 0 at x = 0 to 255 at x = 63.
    const source = await generateImage(page, { width: 64, height: 48, alpha: true })
    await openFile(page, 'clear.png', source, 'image/png')
    await waitForWork(page, 64, 48)
    await choose(page)
    const jpeg = panel(page).getByRole('radio', { name: 'JPEG', exact: true })
    await expect(jpeg).toBeEnabled({ timeout: 15_000 })
    await choose(page, { format: 'JPEG' })
    await expect(panel(page)).toContainText('JPEG has no transparency')

    const file = await confirmAndCapture(page, browserName)
    const result = await page.evaluate(
      async ({ jpegBase64, pngBase64 }) => {
        const pixels = async (base64: string, type: string) => {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
          const bitmap = await createImageBitmap(new Blob([bytes], { type }), {
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'none',
          })
          const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
          ctx.drawImage(bitmap, 0, 0)
          return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
        }
        const jpeg = await pixels(jpegBase64, 'image/jpeg')
        const png = await pixels(pngBase64, 'image/png')
        // Averages over 16×16 blocks aligned to the JPEG grid, so compression noise and chroma
        // subsampling cancel out; the expected side applies AC-15's rule to every source pixel.
        const block = (x0: number, y0: number) => {
          const actual = [0, 0, 0]
          const expected = [0, 0, 0]
          for (let y = y0; y < y0 + 16; y++) {
            for (let x = x0; x < x0 + 16; x++) {
              const i = (y * 64 + x) * 4
              const a = png[i + 3]! / 255
              for (let c = 0; c < 3; c++) {
                actual[c]! += jpeg[i + c]! / 256
                expected[c]! += (a * png[i + c]! + (1 - a) * 255) / 256
              }
            }
          }
          return { actual, expected }
        }
        const transparent = Array.from(jpeg.slice((24 * 64 + 0) * 4, (24 * 64 + 0) * 4 + 3))
        return { transparent, blocks: [block(16, 16), block(32, 16)] }
      },
      { jpegBase64: file.bytes.toString('base64'), pngBase64: source.toString('base64') },
    )
    // Column 0 is fully transparent: it must come out white (JPEG noise allowed).
    for (const channel of result.transparent) expect(channel).toBeGreaterThan(240)
    // Partly transparent pixels blend onto white: opacity × colour + (1 − opacity) × white.
    for (const { actual, expected } of result.blocks) {
      for (let c = 0; c < 3; c++) expect(Math.abs(actual[c]! - expected[c]!)).toBeLessThanOrEqual(6)
    }
  })
})
