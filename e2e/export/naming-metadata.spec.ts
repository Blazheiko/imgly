import { expect, test } from '@playwright/test'
import {
  choose,
  confirmAndCapture,
  expectSaved,
  fixture,
  gotoReady,
  headerOf,
  metadataBlocks,
  openFile,
  panel,
  prepareCapture,
  waitForWork,
  type FormatLabel,
} from './helpers'

test("the suggested name comes from the Source name, with the format's extension (AC-07)", async ({
  page,
}) => {
  await gotoReady(page)
  // PNG content under a HEIC name: the content opens it, the name names the export.
  await openFile(page, 'photo.heic', fixture('ref.png'))
  await waitForWork(page, 48, 32)
  await choose(page, { format: 'PNG' })
  await expect(panel(page)).toContainText('photo-edited.png')
})

test('the suggested name follows a replace (AC-08)', async ({ page }) => {
  await gotoReady(page)
  await openFile(page, 'first.png', fixture('ref.png'))
  await waitForWork(page, 48, 32)
  await openFile(page, 'second.png', fixture('photo.png'))
  await waitForWork(page, 320, 240)
  await choose(page, { format: 'PNG' })
  await expect(panel(page)).toContainText('second-edited.png')
})

test.describe('no metadata survives (AC-16)', () => {
  test.beforeEach(async ({ page, browserName }) => {
    await gotoReady(page)
    await openFile(page, 'orientation-6.jpg', fixture('orientation-6.jpg'), 'image/jpeg')
    await waitForWork(page, 48, 32)
    await prepareCapture(page, browserName)
  })

  test('the source really carries Exif', () => {
    expect(metadataBlocks(fixture('orientation-6.jpg'))).toContain('JPEG APP1 Exif')
  })

  for (const label of ['PNG', 'JPEG', 'WebP'] as FormatLabel[]) {
    test(`${label} carries no Exif, XMP, IPTC, text or non-sRGB profile`, async ({
      page,
      browserName,
    }) => {
      await choose(page)
      const option = panel(page).getByRole('radio', { name: label, exact: true })
      await expect
        .poll(async () => (await panel(page).textContent())?.includes('Checking'), {
          timeout: 15_000,
        })
        .toBe(false)
      test.skip(await option.isDisabled(), `${label} is not available on ${browserName}`)

      await choose(page, { format: label })
      const file = await confirmAndCapture(page, browserName)
      await expectSaved(page)
      expect(file.name).toBe(
        `orientation-6-edited.${{ PNG: 'png', JPEG: 'jpg', WebP: 'webp' }[label]}`,
      )
      headerOf(file.bytes)
      expect(metadataBlocks(file.bytes)).toEqual([])
    })
  }
})
