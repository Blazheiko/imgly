import { expect, test } from '@playwright/test'
import { compareWithPreview } from '../export/helpers'
import { identityGeometry, setStraighten, type Geometry } from '../crop-rotate/helpers'
import {
  button,
  changedOutside,
  click,
  decodePng,
  diff,
  dilatedMask,
  exportPng,
  gotoReady,
  jpegPanel,
  openNamed,
  openTool,
  panel,
  referenceDrawing,
  setWidth,
  tool,
  TRANSPARENCY_HINT,
  work,
} from './helpers'

// spec §6 Fidelity rows, AC-07, AC-08, AC-10; sad.md §10 QG-1, QG-2c. Every comparison stays
// within one engine (sad.md §11). A miss is a recorded engine deviation, never a looser tolerance.
const TOLERANCE = 2
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

const GEOMETRIES: [string, Geometry][] = [
  ['no Geometry', identityGeometry(PHOTO)],
  ['90°', { ...identityGeometry(PHOTO), rotation: 90 }],
  ['180°', { ...identityGeometry(PHOTO), rotation: 180 }],
  ['270°', { ...identityGeometry(PHOTO), rotation: 270 }],
  ['a Flip', { ...identityGeometry(PHOTO), flipH: true }],
  [
    'a Straighten angle and a Crop',
    (() => {
      const g = setStraighten(identityGeometry(PHOTO), 70, PHOTO)
      return { ...g, crop: { ...g.crop, x: g.crop.x + 20, width: g.crop.width - 60 } }
    })(),
  ],
]

const setGeometry = (page: import('@playwright/test').Page, g: Geometry) =>
  page.evaluate((next) => window.__imglyTest!.setGeometry(next), g)

test.describe('QG-1 — an Export with marks matches the Preview at 100% (AC-10)', () => {
  for (const [name, g] of GEOMETRIES) {
    for (const adjusted of [false, true]) {
      test(`${name}${adjusted ? ', all seven Adjustments' : ''}`, async ({ page, browserName }) => {
        test.setTimeout(90_000)
        await gotoReady(page)
        await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
        await referenceDrawing(page)
        await setGeometry(page, g)
        if (adjusted) {
          await page.evaluate((a) => window.__imglyTest!.setAdjustments(a), ALL_SEVEN)
        }
        const png = await exportPng(page, browserName)
        const result = await compareWithPreview(page, png)
        const worst = JSON.stringify(result.worstPixel)
        expect(result.black, worst).toBeLessThanOrEqual(TOLERANCE)
        expect(result.white, worst).toBeLessThanOrEqual(TOLERANCE)
      })
    }
  }
})

test('the Drawing layer is never adjusted: a mark keeps its colour at grayscale 100% (AC-10)', async ({
  page,
  browserName,
}) => {
  await gotoReady(page)
  await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
  await referenceDrawing(page)
  await page.evaluate(() =>
    window.__imglyTest!.setAdjustments({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      grayscale: 100,
      sepia: 0,
    }),
  )
  const out = await decodePng(page, await exportPng(page, browserName))
  // The reference drawing's last mark, nothing painted over it: the 12 px pink #D81B60 dot at
  // (0.95 W, 0.95 H).
  const at = (Math.round(0.95 * PHOTO.height) * out.width + Math.round(0.95 * PHOTO.width)) * 4
  expect(Array.from(out.data.slice(at, at + 4))).toEqual([216, 27, 96, 255])
})

test('an empty layer changes nothing: Clear and Apply give the Export from before (spec §6)', async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000)
  await gotoReady(page)
  await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
  const before = await decodePng(page, await exportPng(page, browserName))
  await referenceDrawing(page)
  await openTool(page)
  await button(page, 'Clear').click()
  await button(page, 'Apply').click()
  await expect(tool(page)).toBeHidden()
  expect((await work(page))!.hasUnsavedEdits).toBe(true)
  const after = await decodePng(page, await exportPng(page, browserName))
  const d = diff(after.data, before.data, after.width)
  expect(d.alpha).toBe(0)
  expect(d.colour, d.where).toBe(0)
})

test.describe('marks stay on the image through Geometry round trips (AC-08, spec §6)', () => {
  const trips: [string, Geometry[]][] = [
    [
      'four quarter turns',
      [90, 180, 270, 0].map((r) => ({
        ...identityGeometry(PHOTO),
        rotation: r as Geometry['rotation'],
      })),
    ],
    ['two Flips', [{ ...identityGeometry(PHOTO), flipV: true }, identityGeometry(PHOTO)]],
    [
      'a narrow Crop, then widened again',
      [
        { ...identityGeometry(PHOTO), crop: { x: 100, y: 80, width: 60, height: 40 } },
        identityGeometry(PHOTO),
      ],
    ],
  ]
  for (const [name, steps] of trips) {
    test(name, async ({ page, browserName }) => {
      test.setTimeout(60_000)
      await gotoReady(page)
      await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
      await referenceDrawing(page)
      const before = await decodePng(page, await exportPng(page, browserName))
      for (const g of steps) await setGeometry(page, g)
      const after = await decodePng(page, await exportPng(page, browserName))
      const d = diff(after.data, before.data, after.width)
      expect(d.alpha).toBe(0)
      expect(d.colour, d.where).toBe(0)
    })
  }
})

test('QG-2c — outside the marks the image keeps its exact pixels (AC-07)', async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000)
  await gotoReady(page)
  await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
  const base = await decodePng(page, await exportPng(page, browserName))
  await referenceDrawing(page)
  const drawn = await decodePng(page, await exportPng(page, browserName))
  const alpha = await page.evaluate(() => window.__imglyTest!.drawingAlpha())
  // The Eraser's 1 px fringe is excluded (sad.md §10 QG-2c).
  const mask = dilatedMask(alpha, PHOTO.width, PHOTO.height, 1)
  expect(changedOutside(drawn.data, base.data, mask)).toBe(0)
  // And the marks are really there.
  expect(changedOutside(drawn.data, base.data, new Uint8Array(mask.length))).toBeGreaterThan(0)
})

test('a smaller Export is the full-size one, marks included, reduced (AC-10)', async ({
  page,
  browserName,
}) => {
  test.setTimeout(60_000)
  await gotoReady(page)
  await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
  await referenceDrawing(page)
  const half = await decodePng(page, await exportPng(page, browserName, '50%'))
  expect([half.width, half.height]).toEqual([160, 120])
  // The 12 px pink dot at (0.95 W, 0.95 H) is 6 px at half size: its centre stays pink.
  const at = (Math.round(0.95 * 120) * half.width + Math.round(0.95 * 160)) * 4
  const pink = [216, 27, 96]
  for (let c = 0; c < 3; c++) {
    expect(Math.abs(half.data[at + c]! - pink[c]!)).toBeLessThanOrEqual(TOLERANCE)
  }
})

test.describe('the JPEG transparency hint follows the drawn result (AC-07, AC-10, QG-1d)', () => {
  const PATCHES = { width: 24, height: 16 }

  test('marks covering every transparent pixel remove the hint, and paint opaque', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60_000)
    await gotoReady(page)
    await openNamed(page, 'alpha-patches.png', PATCHES.width, PATCHES.height)
    await jpegPanel(page)
    await expect(panel(page)).toContainText(TRANSPARENCY_HINT)
    await page.keyboard.press('Escape')

    // One partial dot: transparent pixels remain, so the hint stays.
    await openTool(page)
    await setWidth(page, 1)
    await click(page, 0, 0)
    await button(page, 'Apply').click()
    await jpegPanel(page)
    await expect(panel(page)).toContainText(TRANSPARENCY_HINT)
    await page.keyboard.press('Escape')

    // A 200 px dot at the centre covers the whole image: no transparency is left.
    await openTool(page)
    await setWidth(page, 200)
    await click(page, 12, 8)
    await button(page, 'Apply').click()
    await jpegPanel(page)
    await expect(panel(page)).not.toContainText(TRANSPARENCY_HINT)
    await page.keyboard.press('Escape')

    const out = await decodePng(page, await exportPng(page, browserName))
    for (let i = 0; i < out.data.length; i += 4) {
      expect(Array.from(out.data.slice(i, i + 4))).toEqual([229, 57, 53, 255])
    }
  })

  test('elsewhere the image keeps exactly its own transparency (AC-07)', async ({
    page,
    browserName,
  }) => {
    await gotoReady(page)
    await openNamed(page, 'alpha-patches.png', PATCHES.width, PATCHES.height)
    const base = await decodePng(page, await exportPng(page, browserName))
    await openTool(page)
    await setWidth(page, 3)
    await click(page, 12, 8)
    await button(page, 'Apply').click()
    const drawn = await decodePng(page, await exportPng(page, browserName))
    const alpha = await page.evaluate(() => window.__imglyTest!.drawingAlpha())
    const mask = dilatedMask(alpha, PATCHES.width, PATCHES.height, 1)
    expect(changedOutside(drawn.data, base.data, mask)).toBe(0)
  })
})
