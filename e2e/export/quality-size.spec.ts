import { expect, test } from '@playwright/test'
import {
  choose,
  confirmAndCapture,
  expectSaved,
  fixture,
  gotoReady,
  headerOf,
  openFile,
  panel,
  prepareCapture,
  waitForWork,
  type FormatLabel,
} from './helpers'

test.describe('quality and size', () => {
  test.beforeEach(async ({ page, browserName }) => {
    await gotoReady(page)
    // The reference photo: 720×540 noise, so quality changes the file size clearly.
    await openFile(page, 'reference.webp', fixture('large-lossless.webp'), 'image/webp')
    await waitForWork(page, 720, 540)
    await prepareCapture(page, browserName)
  })

  for (const label of ['JPEG', 'WebP'] as FormatLabel[]) {
    test(`${label}: quality 10 < 50 < 90 in bytes (AC-04)`, async ({ page, browserName }) => {
      await choose(page)
      const option = panel(page).getByRole('radio', { name: label, exact: true })
      await expect
        .poll(async () => (await panel(page).textContent())?.includes('Checking'), {
          timeout: 15_000,
        })
        .toBe(false)
      test.skip(await option.isDisabled(), `${label} is not available on ${browserName}`)

      const sizes: number[] = []
      for (const quality of [10, 50, 90]) {
        await choose(page, { format: label, quality })
        const file = await confirmAndCapture(page, browserName)
        await expectSaved(page)
        sizes.push(file.bytes.length)
      }
      expect(sizes[0]).toBeLessThan(sizes[1]!)
      expect(sizes[1]).toBeLessThan(sizes[2]!)
    })
  }

  test('a preset gives exactly the dimensions the panel shows (AC-05)', async ({
    page,
    browserName,
  }) => {
    await choose(page, { format: 'PNG', preset: '50%' })
    await expect(panel(page)).toContainText('360 × 270 px')
    const file = await confirmAndCapture(page, browserName)
    await expectSaved(page)
    expect(headerOf(file.bytes)).toMatchObject({ format: 'png', width: 360, height: 270 })
  })

  test('a typed long side gives exactly the dimensions the panel shows (AC-05, AC-06)', async ({
    page,
    browserName,
  }) => {
    await choose(page, { format: 'PNG', longSide: 5000 })
    await expect(panel(page)).toContainText('720 × 540 px')
    await choose(page, { longSide: 501 })
    // 501 × 540 / 720 = 375.75 → 376
    await expect(panel(page)).toContainText('501 × 376 px')
    const file = await confirmAndCapture(page, browserName)
    await expectSaved(page)
    expect(headerOf(file.bytes)).toMatchObject({ format: 'png', width: 501, height: 376 })
  })
})
