import { expect, test, type Page } from '@playwright/test'
import { compareWithPreview } from '../export/helpers'
import { identityGeometry, openFixture, setStraighten, type Geometry } from '../crop-rotate/helpers'
import {
  NEUTRAL_ADJUSTMENTS,
  adjusted,
  applyAdjustments,
  decodePng,
  diff,
  exportPng,
  gotoReady,
  openNamed,
  openPixels,
  openTool,
  previewAt100,
  semiTransparentLimit,
  setField,
  slider,
  tool,
  work,
  type Adjustments,
} from './helpers'

// spec §6 Fidelity, Neutral values, Transparency; sad.md §10 QG-1a–d and QG-2; test-plan
// §Decisions. Opaque fixtures: 2/255 on every engine; a miss is a recorded engine deviation.
const TOLERANCE = 2
const size = { width: 24, height: 16 }

/** A Geometry with a Rotation, a Flip, a Straighten angle and a Crop. */
function geometryFor(s: { width: number; height: number }): Geometry {
  return setStraighten({ ...identityGeometry(s), rotation: 90, flipH: true }, 50, s)
}
const GEOMETRY = geometryFor(size)

type Reference = {
  name: string
  width: number
  height: number
  open: (page: Page) => Promise<void>
}

/** test-plan §Test data: the opaque reference set (`photo.png`, `ref.png`) and the synthetic gradient. */
const REFERENCES: Reference[] = [
  { name: 'gradient', ...size, open: (page) => openFixture(page, size.width, size.height) },
  {
    name: 'photo.png',
    width: 320,
    height: 240,
    open: (page) => openNamed(page, 'photo.png', 320, 240),
  },
  { name: 'ref.png', width: 48, height: 32, open: (page) => openNamed(page, 'ref.png', 48, 32) },
]

const SIGNED = ['brightness', 'contrast', 'saturation', 'temperature', 'tint'] as const
const PERCENT = ['grayscale', 'sepia'] as const
const SETTINGS: [string, Adjustments][] = [
  ...SIGNED.flatMap((key) =>
    [-100, -50, 50, 100].map(
      (v) => [`${key} ${v}`, adjusted({ [key]: v })] as [string, Adjustments],
    ),
  ),
  ...PERCENT.flatMap((key) =>
    [0, 50, 100].map((v) => [`${key} ${v}%`, adjusted({ [key]: v })] as [string, Adjustments]),
  ),
]
const COMBINED = adjusted({
  brightness: 20,
  contrast: 35,
  saturation: -30,
  temperature: 25,
  tint: -15,
  grayscale: 40,
  sepia: 30,
})

test.describe('QG-1a — an adjusted Export matches the Preview at 100% (AC-14)', () => {
  const groups: [string, [string, Adjustments][]][] = [
    ...[...SIGNED, ...PERCENT].map(
      (key) =>
        [key, SETTINGS.filter(([name]) => name.startsWith(`${key} `))] as [
          string,
          [string, Adjustments][],
        ],
    ),
    ['all seven combined', [['combined', COMBINED]]],
  ]
  for (const ref of REFERENCES) {
    for (const [group, settings] of groups) {
      for (const withGeometry of [false, true]) {
        test(`${ref.name}: ${group}, ${withGeometry ? 'with' : 'without'} a Geometry`, async ({
          page,
          browserName,
        }) => {
          test.setTimeout(90_000)
          await gotoReady(page)
          await ref.open(page)
          if (withGeometry) {
            await page.evaluate((g) => window.__imglyTest!.setGeometry(g), geometryFor(ref))
          }
          for (const [name, a] of settings) {
            await applyAdjustments(page, a)
            const png = await exportPng(page, browserName)
            const result = await compareWithPreview(page, png)
            const worst = `${name}: ${JSON.stringify(result.worstPixel)}`
            expect(result.black, worst).toBeLessThanOrEqual(TOLERANCE)
            expect(result.white, worst).toBeLessThanOrEqual(TOLERANCE)
            // The opaque fixture stays fully opaque (AC-06).
            const out = await decodePng(page, png)
            expect(
              out.data.filter((v, i) => i % 4 === 3 && v !== 255),
              name,
            ).toEqual([])
          }
        })
      }
    }
  }
})

for (const ref of REFERENCES) {
  test(`QG-1b — ${ref.name}: neutral values give the Export from before any Adjustment (AC-06)`, async ({
    page,
    browserName,
  }) => {
    await gotoReady(page)
    await ref.open(page)
    const before = await decodePng(page, await exportPng(page, browserName))

    await applyAdjustments(page, COMBINED)
    await applyAdjustments(page, NEUTRAL_ADJUSTMENTS)
    const after = await decodePng(page, await exportPng(page, browserName))
    const d = diff(after.data, before.data, after.width)
    expect(d.alpha).toBe(0)
    expect(d.colour, d.where).toBe(0)
  })
}

test.describe('QG-1c — transparency is kept exactly (AC-06)', () => {
  const patches = { width: 24, height: 16 }
  // Every setting of the fidelity row and the combined one (spec §6 Transparency).
  const settings: [string, Adjustments][] = [...SETTINGS, ['combined', COMBINED]]

  for (const withGeometry of [false, true]) {
    test(`every pixel keeps its alpha, and soft-edge colour matches the Preview, ${
      withGeometry ? 'with' : 'without'
    } a Geometry`, async ({ page, browserName }) => {
      test.setTimeout(240_000)
      await gotoReady(page)
      await openNamed(page, 'alpha-patches.png', patches.width, patches.height)
      if (withGeometry) {
        await page.evaluate((g) => window.__imglyTest!.setGeometry(g), GEOMETRY)
      }
      // The reference is the neutral Export with the same Geometry.
      const neutral = await decodePng(page, await exportPng(page, browserName))
      for (const [name, a] of settings) {
        await applyAdjustments(page, a)
        const out = await decodePng(page, await exportPng(page, browserName))
        const kept = diff(out.data, neutral.data, out.width)
        expect(kept.alpha, `${name}: alpha`).toBe(0)
        // Recorded deviation (adr/0005): on Firefox and WebKit the Export already differs from the
        // Preview by one premultiplied step below alpha 255 with neutral values, and Adjustments
        // scale it, so colour is checked on opaque pixels there; Chromium matches from alpha 64.
        const minAlpha = browserName === 'chromium' ? 64 : 255
        const vsPreview = diff(out.data, await previewAt100(page), out.width, minAlpha)
        expect(vsPreview.colour, `${name}: ${vsPreview.where}`).toBeLessThanOrEqual(
          semiTransparentLimit(browserName),
        )
      }
    })
  }
})

test.describe('QG-1d — the shader gives ADR-0003’s anchor table (AC-02, AC-03, AC-04)', () => {
  // Patches of anchors.png, left to right; each is read at its centre.
  const PATCHES = ['grey', 'black', 'white', 'red', 'green', 'blue', 'yellow'] as const
  type Patch = (typeof PATCHES)[number]
  const ROWS: [string, Partial<Adjustments>, Partial<Record<Patch, number[]>>][] = [
    [
      'brightness +100',
      { brightness: 100 },
      { grey: [181, 181, 181], black: [0, 0, 0], white: [255, 255, 255] },
    ],
    ['brightness +50', { brightness: 50 }, { grey: [157, 157, 157] }],
    ['brightness −50', { brightness: -50 }, { grey: [96, 96, 96] }],
    [
      'brightness −100',
      { brightness: -100 },
      { grey: [64, 64, 64], black: [0, 0, 0], white: [255, 255, 255] },
    ],
    [
      'contrast +100',
      { contrast: 100 },
      { grey: [128, 128, 128], black: [0, 0, 0], white: [255, 255, 255] },
    ],
    [
      'contrast −50',
      { contrast: -50 },
      { grey: [128, 128, 128], black: [64, 64, 64], white: [192, 192, 192] },
    ],
    [
      'contrast −100',
      { contrast: -100 },
      { grey: [128, 128, 128], black: [128, 128, 128], white: [128, 128, 128] },
    ],
    [
      'temperature +100',
      { temperature: 100 },
      { grey: [154, 128, 102], black: [0, 0, 0], white: [255, 255, 204] },
    ],
    ['temperature −100', { temperature: -100 }, { grey: [102, 128, 154], white: [204, 255, 255] }],
    [
      'tint +100',
      { tint: 100 },
      { grey: [128, 102, 128], black: [0, 0, 0], white: [255, 204, 255] },
    ],
    ['tint −100', { tint: -100 }, { grey: [128, 154, 128], white: [255, 255, 255] }],
    ['saturation −100', { saturation: -100 }, { grey: [128, 128, 128], red: [54, 54, 54] }],
    [
      'grayscale 100%',
      { grayscale: 100 },
      {
        grey: [128, 128, 128],
        red: [54, 54, 54],
        green: [182, 182, 182],
        blue: [18, 18, 18],
        yellow: [237, 237, 237],
      },
    ],
    [
      'sepia 100%',
      { sepia: 100 },
      { grey: [173, 154, 120], black: [0, 0, 0], white: [255, 255, 239] },
    ],
  ]

  test('each anchor within 2/255 on this engine', async ({ page }) => {
    await gotoReady(page)
    await openNamed(page, 'anchors.png', 56, 8)
    const misses: string[] = []
    for (const [name, a, want] of ROWS) {
      await applyAdjustments(page, adjusted(a))
      const pixels = await previewAt100(page)
      for (const [patch, rgb] of Object.entries(want) as [Patch, number[]][]) {
        const at = (4 * 56 + PATCHES.indexOf(patch) * 8 + 4) * 4
        const got = pixels.slice(at, at + 3)
        if (got.some((v, c) => Math.abs(v - rgb[c]!) > TOLERANCE)) {
          misses.push(`${name} ${patch}: got ${got}, want ${rgb}`)
        }
      }
    }
    expect(misses).toEqual([])
  })
})

test('AC-07 — two paths through the tool to the same values give the same pixels', async ({
  page,
  browserName,
}) => {
  await gotoReady(page)
  await openFixture(page, size.width, size.height)
  const target = adjusted({ brightness: 30, contrast: 40, sepia: 20 })
  const apply = async () => {
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(tool(page)).toBeHidden()
  }

  // Contrast first, its slider taken to the end and back, then brightness and sepia.
  await openTool(page)
  await slider(page, 'Contrast').focus()
  await page.keyboard.press('End')
  await setField(page, 'Contrast', '40')
  await setField(page, 'Brightness', '30')
  await setField(page, 'Sepia', '20')
  await apply()
  expect((await work(page))!.adjustments).toEqual(target)
  const first = { preview: await previewAt100(page), file: await exportPng(page, browserName) }

  // Back to a neutral Work, then sepia and brightness first, contrast last, through a Draft that
  // passes through other values on the way.
  await applyAdjustments(page, NEUTRAL_ADJUSTMENTS)
  await openTool(page)
  await setField(page, 'Sepia', '20')
  await setField(page, 'Brightness', '-100')
  await setField(page, 'Brightness', '30')
  await slider(page, 'Contrast').focus()
  await page.keyboard.press('Home')
  await setField(page, 'Contrast', '40')
  await apply()
  expect((await work(page))!.adjustments).toEqual(target)
  const second = { preview: await previewAt100(page), file: await exportPng(page, browserName) }

  expect(second.preview).toEqual(first.preview)
  const a = await decodePng(page, first.file)
  const b = await decodePng(page, second.file)
  expect(diff(a.data, b.data, a.width)).toMatchObject({ alpha: 0, colour: 0 })
})

// KPI 3 is "for 100% of reference images", so the round trip runs on every one of them.
for (const ref of REFERENCES) {
  test(`QG-2 — ${ref.name}: adjust, then Reset and Apply, gives back the Export from before (AC-10, KPI 3)`, async ({
    page,
    browserName,
  }) => {
    await gotoReady(page)
    await ref.open(page)
    const before = await decodePng(page, await exportPng(page, browserName))

    await applyAdjustments(page, COMBINED)
    await openTool(page)
    await page.getByRole('button', { name: 'Reset' }).click()
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(tool(page)).toBeHidden()

    const after = await decodePng(page, await exportPng(page, browserName))
    const d = diff(after.data, before.data, after.width)
    expect(d.alpha).toBe(0)
    expect(d.colour, d.where).toBe(0)
  })
}

test.describe('AC-14 — a smaller Export is reduced after the Adjustments', () => {
  test('1 px black and white stripes at brightness +100 stay mid-grey at 50%', async ({
    page,
    browserName,
  }) => {
    // Adjusting first keeps black and white, so the 50% reduction averages them to about 128.
    // Reducing first would give grey 128, which brightness +100 lifts to about 181.
    const stripes = { width: 32, height: 32 }
    await gotoReady(page)
    await openPixels(page, stripes.width, stripes.height, (x) =>
      x % 2 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255],
    )
    await applyAdjustments(page, adjusted({ brightness: 100 }))
    const full = await decodePng(page, await exportPng(page, browserName))
    const half = await decodePng(page, await exportPng(page, browserName, '50%'))
    expect(half).toMatchObject({ width: 16, height: 16 })

    // The full-size adjusted Export reduced by 2×2 averaging is the oracle.
    let worst = 0
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        for (let c = 0; c < 3; c++) {
          const at = (yy: number, xx: number) => full.data[(yy * 32 + xx) * 4 + c]!
          const box =
            (at(2 * y, 2 * x) +
              at(2 * y, 2 * x + 1) +
              at(2 * y + 1, 2 * x) +
              at(2 * y + 1, 2 * x + 1)) /
            4
          worst = Math.max(worst, Math.abs(half.data[(y * 16 + x) * 4 + c]! - box))
        }
      }
    }
    // Export has no pixel tolerance for smaller sizes yet (its open §8 question); the measured
    // difference is recorded here, and it must stay far from the reduce-first result (≈ 53).
    test.info().annotations.push({ type: 'measured', description: `max diff ${worst}/255` })
    expect(worst).toBeLessThanOrEqual(4)
  })
})
