import { expect, test } from '@playwright/test'
import {
  choose,
  compareWithPreview,
  confirmAndCapture,
  expectSaved,
  generateImage,
  gotoReady,
  headerOf,
  openFile,
  prepareCapture,
  view,
  waitForWork,
  work,
} from './helpers'

// AC-01, AC-03 and spec §6 Fidelity: a full-size PNG is within 2/255 of the Preview at 100%,
// whatever the View, and the View is unchanged afterwards.
test('a full-size PNG matches the Preview at 100% regardless of zoom and pan', async ({
  page,
  browserName,
}) => {
  await gotoReady(page)
  const image = await generateImage(page, { width: 200, height: 150, alpha: true })
  await openFile(page, 'fidelity.png', image, 'image/png')
  await waitForWork(page, 200, 150)
  await page.evaluate(() => window.__imglyTest!.applyEdit())
  expect((await work(page))!).toMatchObject({ revision: 1, hasUnsavedEdits: true })

  // Zoom in and pan, so the visible part is not the whole Work.
  await page.keyboard.press('Shift+0')
  await page.keyboard.press('+')
  const canvas = page.getByTestId('preview-canvas')
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 40)
  await page.mouse.up()
  const before = await view(page)
  expect(before.zoom).toBeGreaterThan(1)

  await prepareCapture(page, browserName)
  await choose(page, { format: 'PNG' })
  const file = await confirmAndCapture(page, browserName)
  await expectSaved(page)

  expect(headerOf(file.bytes)).toMatchObject({ format: 'png', width: 200, height: 150 })
  const diff = await compareWithPreview(page, file.bytes)
  expect(diff).toMatchObject({ width: 200, height: 150, samples: 200 * 150 })
  const worst = JSON.stringify(diff.worstPixel)
  expect(diff.alpha, worst).toBeLessThanOrEqual(2)
  expect(diff.black, worst).toBeLessThanOrEqual(2)
  expect(diff.white, worst).toBeLessThanOrEqual(2)

  expect(await view(page)).toEqual(before)
  // A finished export is a save point (AC-09): no Unsaved edits, so the next open replaces the
  // Work without asking.
  expect((await work(page))!).toMatchObject({ revision: 1, hasUnsavedEdits: false })
  const next = await generateImage(page, { width: 120, height: 90 })
  await openFile(page, 'next.png', next, 'image/png')
  await waitForWork(page, 120, 90)
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
})
