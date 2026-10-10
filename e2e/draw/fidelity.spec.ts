import { expect, test } from '@playwright/test'
import { compareWithPreview } from '../export/helpers'
import {
  identityGeometry,
  openTool as openCropRotate,
  setStraighten,
  tool as cropRotateTool,
  type Geometry,
} from '../crop-rotate/helpers'
import { turnedSize } from '../../src/core/geometry'
import {
  button,
  changedOutside,
  click,
  decodePng,
  diff,
  dilatedMask,
  drawingAlpha,
  expectedMarkAlpha,
  expectedTurnedExport,
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

for (const [fixture, size] of [
  ['photo.png', PHOTO],
  ['alpha-patches.png', { width: 24, height: 16 }],
] as const) {
  test(`an empty layer changes nothing: Clear and Apply give the Export from before, ${fixture} (spec §6)`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60_000)
    await gotoReady(page)
    await openNamed(page, fixture, size.width, size.height)
    const before = await decodePng(page, await exportPng(page, browserName))
    await referenceDrawing(page)
    await openTool(page)
    await button(page, 'Clear').click()
    await button(page, 'Apply').click()
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!.hasUnsavedEdits).toBe(true)
    const after = await decodePng(page, await exportPng(page, browserName))
    // Every channel, transparent pixels included: alpha 0 must stay alpha 0.
    let worst = 0
    for (let i = 0; i < after.data.length; i++) {
      worst = Math.max(worst, Math.abs(after.data[i]! - before.data[i]!))
    }
    expect(worst).toBe(0)
  })
}

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

// QG-2b: the expected Export is computed from the identity Export through frameToOriginal, not
// through the shader, so a layer mapped differently from the image would fail it (spec §7 KPI).
test.describe('QG-2b — marks turn, flip and straighten with the image (AC-08, spec §7)', () => {
  /** A Geometry whose Crop is the whole turned image. */
  const whole = (g: Omit<Geometry, 'crop'>): Geometry => {
    const size = turnedSize(g, PHOTO)
    return { ...g, crop: { x: 0, y: 0, ...size } }
  }
  const plain = { flipH: false, flipV: false, rotation: 0 as const, straighten: 0 }
  const turns: [string, Geometry][] = [
    ['90°', whole({ ...plain, rotation: 90 })],
    ['180°', whole({ ...plain, rotation: 180 })],
    ['270°', whole({ ...plain, rotation: 270 })],
    ['a horizontal Flip', whole({ ...plain, flipH: true })],
    ['a vertical Flip', whole({ ...plain, flipV: true })],
    ['a Flip and 90°', whole({ ...plain, flipH: true, rotation: 90 })],
    [
      'a Crop after 270°',
      { ...whole({ ...plain, rotation: 270 }), crop: { x: 30, y: 50, width: 150, height: 200 } },
    ],
  ]
  test('with no Geometry, the marks land exactly where the layer holds them', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60_000)
    await gotoReady(page)
    await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
    const base = await decodePng(page, await exportPng(page, browserName))
    // One dot off every axis of symmetry, so a mirrored or turned layer would miss it.
    await openTool(page)
    await setWidth(page, 20)
    await click(page, 40, 30)
    await button(page, 'Apply').click()
    const drawn = await decodePng(page, await exportPng(page, browserName))
    const alpha = await drawingAlpha(page)
    expect(
      changedOutside(drawn.data, base.data, dilatedMask(alpha, PHOTO.width, PHOTO.height, 0)),
    ).toBe(0)
    let core = 0
    let coreChanged = 0
    for (let p = 0; p < alpha.length; p++) {
      if (alpha[p] !== 255) continue
      core++
      for (let c = 0; c < 3; c++) {
        if (Math.abs(drawn.data[p * 4 + c]! - base.data[p * 4 + c]!) > TOLERANCE) {
          coreChanged++
          break
        }
      }
    }
    expect(core).toBeGreaterThan(200)
    expect(coreChanged / core).toBeGreaterThan(0.99)
  })

  for (const [name, g] of turns) {
    test(name, async ({ page, browserName }) => {
      test.setTimeout(60_000)
      await gotoReady(page)
      await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
      await referenceDrawing(page)
      const identity = await decodePng(page, await exportPng(page, browserName))
      await setGeometry(page, g)
      const turned = await decodePng(page, await exportPng(page, browserName))
      const expected = expectedTurnedExport(identity, g)
      expect([turned.width, turned.height]).toEqual([expected.width, expected.height])
      const d = diff(turned.data, expected.data, turned.width)
      expect(d.alpha).toBeLessThanOrEqual(TOLERANCE)
      expect(d.colour, d.where).toBeLessThanOrEqual(TOLERANCE)
    })
  }

  test('through the real "Crop and rotate" Apply', async ({ page, browserName }) => {
    test.setTimeout(60_000)
    await gotoReady(page)
    await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
    await referenceDrawing(page)
    const identity = await decodePng(page, await exportPng(page, browserName))
    await openCropRotate(page)
    await cropRotateTool(page).getByRole('button', { name: 'Rotate right' }).click()
    await cropRotateTool(page).getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(cropRotateTool(page)).toBeHidden()
    const g = (await work(page))!.geometry as Geometry
    expect(g.rotation).toBe(90)
    const turned = await decodePng(page, await exportPng(page, browserName))
    const d = diff(turned.data, expectedTurnedExport(identity, g).data, turned.width)
    expect(d.alpha).toBeLessThanOrEqual(TOLERANCE)
    expect(d.colour, d.where).toBeLessThanOrEqual(TOLERANCE)
  })

  test('a Straighten angle: the marks land where the layer, turned with the image, puts them', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60_000)
    const g = setStraighten(identityGeometry(PHOTO), 70, PHOTO)
    await gotoReady(page)
    await openNamed(page, 'photo.png', PHOTO.width, PHOTO.height)
    await setGeometry(page, g)
    const unmarked = await decodePng(page, await exportPng(page, browserName))
    await referenceDrawing(page)
    const marked = await decodePng(page, await exportPng(page, browserName))
    const alpha = expectedMarkAlpha(await drawingAlpha(page), PHOTO, g)
    const { width, height } = g.crop
    const near = dilatedMask(
      Array.from(alpha, (a) => (a > 0 ? 255 : 0)),
      width,
      height,
      2,
    )
    let strayChanges = 0
    let inside = 0
    let insideChanged = 0
    for (let p = 0; p < width * height; p++) {
      let change = 0
      for (let c = 0; c < 4; c++) {
        change = Math.max(change, Math.abs(marked.data[p * 4 + c]! - unmarked.data[p * 4 + c]!))
      }
      const changed = change > TOLERANCE
      if (changed && !near[p]) strayChanges++
      if (alpha[p]! >= 250) {
        inside++
        if (changed) insideChanged++
      }
    }
    // No mark outside where the turned layer puts them, and the marks are there.
    expect(strayChanges).toBe(0)
    expect(inside).toBeGreaterThan(1000)
    expect(insideChanged / inside).toBeGreaterThan(0.99)
  })
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
  const full = await decodePng(page, await exportPng(page, browserName))
  const half = await decodePng(page, await exportPng(page, browserName, '50%'))
  expect([half.width, half.height]).toEqual([160, 120])
  // At exactly half size the reduction reads the full-size result's first mipmap level: each
  // pixel is the mean of the 2×2 block under it (the photo and the marks are opaque).
  const reduced = new Uint8ClampedArray(half.data.length)
  for (let y = 0; y < half.height; y++) {
    for (let x = 0; x < half.width; x++) {
      for (let c = 0; c < 4; c++) {
        let sum = 0
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ]) {
          sum += full.data[((2 * y + dy!) * full.width + 2 * x + dx!) * 4 + c]!
        }
        reduced[(y * half.width + x) * 4 + c] = Math.round(sum / 4)
      }
    }
  }
  const d = diff(half.data, reduced, half.width)
  expect(d.alpha).toBeLessThanOrEqual(TOLERANCE)
  expect(d.colour, d.where).toBeLessThanOrEqual(TOLERANCE)
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
