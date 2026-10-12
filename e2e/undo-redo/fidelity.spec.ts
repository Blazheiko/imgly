/**
 * Exactness of Undo and Redo (spec §6, AC-03, AC-13): a full-size PNG Export after an Undo or a
 * Redo differs by 0 per channel from the Export of that same state made before, on each engine.
 * Every comparison stays within one engine; there is no tolerance.
 */
import { expect, test, type Page } from '@playwright/test'
import { openNamed } from '../adjust/helpers'
import { identityGeometry, setStraighten, type Geometry } from '../crop-rotate/helpers'
import { button as drawButton, openTool as openDrawTool, referenceDrawing } from '../draw/helpers'
import {
  clickAndWait,
  exportPixels,
  gotoReady,
  maxDifference,
  redoButton,
  undoButton,
  work,
  type Pixels,
} from './helpers'

const PHOTO = { width: 320, height: 240 }

const ALL_SEVEN = {
  brightness: 20,
  contrast: 35,
  saturation: -30,
  temperature: 25,
  tint: -15,
  grayscale: 40,
  sepia: 30,
}

async function step(page: Page, apply: () => Promise<unknown>) {
  const before = (await work(page))!.revision
  await apply()
  await expect.poll(async () => (await work(page))!.revision).toBeGreaterThan(before)
}

const setGeometry = (page: Page, g: Geometry) =>
  step(page, () => page.evaluate((next) => window.__imglyTest!.setGeometry(next), g))

test.beforeEach(async ({ page }) => {
  await gotoReady(page)
  await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
})

test('three Undos and three Redos restore each state exactly: Straighten, all seven Adjustments, a drawing (AC-03)', async ({
  page,
  browserName,
}) => {
  test.setTimeout(180_000)
  const straightened = (() => {
    const g = setStraighten(identityGeometry(PHOTO), 70, PHOTO)
    return { ...g, crop: { ...g.crop, x: g.crop.x + 20, width: g.crop.width - 60 } }
  })()
  const before: Pixels[] = [await exportPixels(page, browserName)]
  await setGeometry(page, straightened)
  before.push(await exportPixels(page, browserName))
  await step(page, () => page.evaluate((a) => window.__imglyTest!.setAdjustments(a), ALL_SEVEN))
  before.push(await exportPixels(page, browserName))
  await step(page, () => referenceDrawing(page))
  before.push(await exportPixels(page, browserName))

  // Each Step changed the Export, so a match below can only be the restored state.
  for (let i = 1; i < before.length; i++) {
    const a = before[i - 1]!
    const b = before[i]!
    if (a.width === b.width && a.height === b.height) expect(maxDifference(a, b)).toBeGreaterThan(0)
  }

  for (const expected of [2, 1, 0]) {
    await clickAndWait(page, undoButton(page))
    expect(maxDifference(await exportPixels(page, browserName), before[expected]!)).toBe(0)
  }
  for (const expected of [1, 2, 3]) {
    await clickAndWait(page, redoButton(page))
    expect(maxDifference(await exportPixels(page, browserName), before[expected]!)).toBe(0)
  }
})

test('the Drawing layer returns with the Geometry it was applied under (AC-13)', async ({
  page,
  browserName,
}) => {
  test.setTimeout(180_000)
  await step(page, () => referenceDrawing(page))
  const cropped = {
    ...identityGeometry(PHOTO),
    crop: { x: 40, y: 20, width: 200, height: 160 },
  }
  await setGeometry(page, cropped)
  const afterCrop = await exportPixels(page, browserName)
  await setGeometry(page, {
    ...cropped,
    rotation: 90,
    crop: { x: 20, y: 40, width: 160, height: 200 },
  })
  const afterRotation = await exportPixels(page, browserName)

  // "Draw" again after Clear: a Step that empties the Drawing layer.
  await openDrawTool(page)
  await drawButton(page, 'Clear').click()
  await step(page, () => drawButton(page, 'Apply').click())
  expect(await page.evaluate(() => window.__imglyTest!.drawingAlpha().length)).toBe(0)

  await clickAndWait(page, undoButton(page))
  expect(maxDifference(await exportPixels(page, browserName), afterRotation)).toBe(0)
  await clickAndWait(page, undoButton(page))
  expect(maxDifference(await exportPixels(page, browserName), afterCrop)).toBe(0)
})
