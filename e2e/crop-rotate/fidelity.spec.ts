import { expect, test } from '@playwright/test'
import { compareWithPreview } from '../export/helpers'
import {
  BAND,
  applyGeometry,
  decodePng,
  exportPng,
  gotoReady,
  identityGeometry,
  openFixture,
  pixelOf,
  setStraighten,
  sourceOf,
  type Geometry,
} from './helpers'

// spec §6 Fidelity and sad.md §10 QG-1/QG-2. Every fixture is opaque (test-plan tolerance
// decision): 2/255 on every engine, Crop edge pixels included; a miss is an engine deviation.
const TOLERANCE = 2
const original = { width: 24, height: 16 }
const FLIPS = [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
] as const

test.describe('QG-1a — Rotation × Flip × Crop are lossless (AC-03, AC-04, AC-14)', () => {
  for (const rotation of [0, 90, 180, 270] as const) {
    test(`rotation ${rotation}: every Flip, with and without a Crop`, async ({
      page,
      browserName,
    }) => {
      test.setTimeout(90_000)
      await gotoReady(page)
      await openFixture(page, original.width, original.height)
      const turned = rotation % 180 ? { width: 16, height: 24 } : { width: 24, height: 16 }
      const crops = [
        { x: 0, y: 0, ...turned },
        { x: 3, y: 2, width: turned.width - 7, height: turned.height - 5 },
        { x: turned.width - 1, y: 0, width: 1, height: turned.height }, // 1 px at the right edge
      ]
      for (const [flipH, flipV] of FLIPS) {
        for (const crop of crops) {
          const g: Geometry = { flipH, flipV, rotation, straighten: 0, crop }
          await applyGeometry(page, g)
          const out = await decodePng(page, await exportPng(page, browserName))
          expect(out, JSON.stringify(g)).toMatchObject({ width: crop.width, height: crop.height })
          let worst = 0
          let where = ''
          for (let j = 0; j < crop.height; j++) {
            for (let i = 0; i < crop.width; i++) {
              const [ox, oy] = sourceOf(crop.x + i, crop.y + j, g, original)
              const want = pixelOf(ox, oy)
              const at = (j * crop.width + i) * 4
              for (let c = 0; c < 3; c++) {
                const d = Math.abs(out.data[at + c]! - want[c]!)
                if (d > worst) [worst, where] = [d, `(${i},${j}) from (${ox},${oy})`]
              }
              expect(out.data[at + 3]).toBe(255)
            }
          }
          expect(worst, `${JSON.stringify(g)} worst at ${where}`).toBeLessThanOrEqual(TOLERANCE)
        }
      }
    })
  }
})

test.describe('QG-1b — a straightened Export matches the Preview and stays opaque (AC-06, AC-14)', () => {
  for (const tenths of [-450, -1, 10, 450]) {
    test(`${tenths / 10}°`, async ({ page, browserName }) => {
      await gotoReady(page)
      const size = { width: 60, height: 40 }
      await openFixture(page, size.width, size.height)
      const g = setStraighten(identityGeometry(size), tenths, size)
      await applyGeometry(page, g)
      const png = await exportPng(page, browserName)

      const diff = await compareWithPreview(page, png)
      expect(diff).toMatchObject({ width: g.crop.width, height: g.crop.height })
      const worst = JSON.stringify(diff.worstPixel)
      expect(diff.alpha, worst).toBeLessThanOrEqual(TOLERANCE)
      expect(diff.black, worst).toBeLessThanOrEqual(TOLERANCE)
      expect(diff.white, worst).toBeLessThanOrEqual(TOLERANCE)

      // Opaque stays opaque, in the Export and in the Preview (AC-06).
      const out = await decodePng(page, png)
      expect(out.data.filter((_, i) => i % 4 === 3 && out.data[i] !== 255)).toEqual([])
      const preview = await page.evaluate(() => window.__imglyTest!.previewAt100())
      expect(preview.filter((v, i) => i % 4 === 3 && v !== 255)).toEqual([])
    })
  }
})

test.describe('QG-1c — no pixel from outside the Crop (AC-09, AC-14)', () => {
  for (const tenths of [0, 100]) {
    test(`with a Straighten angle of ${tenths / 10}°`, async ({ page, browserName }) => {
      const size = { width: 64, height: 48 }
      await gotoReady(page)
      await openFixture(page, size.width, size.height, 8)
      const base: Geometry = {
        ...identityGeometry(size),
        crop: { x: 24, y: 12, width: 24, height: 24 },
      }
      const g = tenths === 0 ? base : setStraighten(base, tenths, size)
      await applyGeometry(page, g)
      const out = await decodePng(page, await exportPng(page, browserName))
      expect(out).toMatchObject({ width: g.crop.width, height: g.crop.height })
      const isBand = (i: number) =>
        Math.abs(out.data[i]! - BAND[0]) <= 40 &&
        out.data[i + 1]! <= 40 &&
        Math.abs(out.data[i + 2]! - BAND[2]) <= 40
      const band = out.data.flatMap((_, i) => (i % 4 === 0 && isBand(i) ? [i / 4] : []))
      expect(band).toEqual([])
    })
  }
})

test('QG-2 — Crop, then Reset and Apply, gives back the Export from before (AC-12, KPI 3)', async ({
  page,
  browserName,
}) => {
  const size = { width: 40, height: 30 }
  await gotoReady(page)
  await openFixture(page, size.width, size.height)
  const before = await decodePng(page, await exportPng(page, browserName))

  await applyGeometry(page, {
    ...identityGeometry(size),
    rotation: 90,
    flipH: true,
    crop: { x: 4, y: 5, width: 10, height: 12 },
  })
  await page.keyboard.press('c')
  await expect(page.getByTestId('crop-rotate-tool')).toBeVisible()
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByTestId('crop-rotate-tool')).toBeHidden()

  const after = await decodePng(page, await exportPng(page, browserName))
  expect(after).toMatchObject({ width: before.width, height: before.height })
  const worst = after.data.reduce((m, v, i) => Math.max(m, Math.abs(v - before.data[i]!)), 0)
  expect(worst).toBeLessThanOrEqual(TOLERANCE)
})
