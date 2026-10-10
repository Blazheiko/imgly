import { expect, test } from '@playwright/test'
import { dropGeneratedImage, waitForWork } from '../open-and-view/helpers'
import { pixelsAt, setStraighten, identityGeometry } from '../crop-rotate/helpers'
import { frameToOriginal } from '../../src/core/geometry'
import {
  action,
  button,
  click,
  decodePng,
  draftAlpha,
  draftMarks,
  drag,
  drawingAlpha,
  exportPng,
  gotoReady,
  layers,
  openTool,
  openWhite,
  screenPoint,
  setWidth,
  tool,
  widthField,
  view,
  work,
} from './helpers'

// spec AC-01, AC-02, AC-04, AC-05, AC-06, AC-09, AC-18, AC-19; sad.md §10 QG-3; spec §7 KPI.
const SIZE = { width: 200, height: 150 }
const at = (alpha: number[], x: number, y: number) => alpha[y * SIZE.width + x]!
const marked = (alpha: number[]) => alpha.filter((a) => a > 0).length

test.beforeEach(async ({ page }) => {
  await gotoReady(page)
  await openWhite(page, SIZE.width, SIZE.height)
  expect((await view(page)).zoom).toBe(1)
})

test.describe('AC-01 — the live line', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'path rules run on Chromium')

  test('passes through every position, and nothing painted changes after release', async ({
    page,
  }) => {
    await openTool(page)
    await setWidth(page, 3)
    const points: [number, number][] = [
      [20, 20],
      [60, 30],
      [90, 80],
      [120, 40],
      [170, 120],
    ]
    const first = await screenPoint(page, ...points[0]!)
    await page.mouse.move(first.x, first.y)
    await page.mouse.down()
    for (const p of points.slice(1)) {
      const s = await screenPoint(page, ...p)
      await page.mouse.move(s.x, s.y, { steps: 8 })
    }
    const during = await draftAlpha(page)
    await page.mouse.up()
    const after = await draftAlpha(page)
    // Release only paints the last segment: nothing painted loses alpha, and any change lies
    // within that segment near the release point (its antialiased joint overlaps the one before,
    // ADR-0002), so the line drawn so far does not move.
    const [lx, ly] = points.at(-1)!
    const [px, py] = points.at(-2)!
    // The last segment is one mouse step long (8 steps per run), plus the half width and its edge.
    const reach = Math.hypot(lx - px, ly - py) / 8 + 3 / 2 + 2
    for (let i = 0; i < during.length; i++) {
      expect(after[i]!, `pixel ${i}`).toBeGreaterThanOrEqual(during[i]!)
      if (after[i] === during[i]) continue
      const x = i % SIZE.width
      const y = Math.floor(i / SIZE.width)
      expect(Math.hypot(x - lx, y - ly), `changed pixel (${x}, ${y})`).toBeLessThanOrEqual(reach)
    }
    // The line passes through every pointer position, opaque at its centre.
    for (const [x, y] of points) expect(at(after, x, y), `(${x}, ${y})`).toBe(255)
    // No gaps: every step along the straight runs between positions is marked.
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]!
      const [bx, by] = points[i]!
      for (let t = 0; t <= 1; t += 1 / 64) {
        const x = Math.round(ax + (bx - ax) * t)
        const y = Math.round(ay + (by - ay) * t)
        const near = [-2, -1, 0, 1, 2].some((d) =>
          [-2, -1, 0, 1, 2].some((e) => at(after, x + d, y + e) > 0),
        )
        expect(near, `gap near (${x}, ${y})`).toBe(true)
      }
    }
  })
})

// Dots run on every engine: a zero-length path segment is dropped by some canvas engines.
test.describe('AC-01, AC-04 — a press without movement', () => {
  /** A disc of radius 10 centred on (100, 75): about 314 pixels, with antialiased edges. */
  const isDisc = (alpha: number[]) => {
    expect(marked(alpha)).toBeGreaterThan(280)
    expect(marked(alpha)).toBeLessThan(380)
    expect(at(alpha, 100, 75 - 12)).toBe(0)
    expect(at(alpha, 100 + 12, 75)).toBe(0)
  }

  test('a click without moving paints one round dot of the width', async ({ page }) => {
    await openTool(page)
    await setWidth(page, 20)
    await click(page, 100, 75)
    const alpha = await draftAlpha(page)
    expect(at(alpha, 100, 75)).toBe(255)
    isDisc(alpha)
  })

  test('a move that stays on the press point still paints the dot', async ({ page }) => {
    await openTool(page)
    await setWidth(page, 20)
    const p = await screenPoint(page, 100, 75)
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    await page.mouse.move(p.x, p.y) // a pointermove at the same position
    await page.mouse.up()
    const alpha = await draftAlpha(page)
    expect(at(alpha, 100, 75)).toBe(255)
    isDisc(alpha)
  })

  test('an Eraser click removes a disc of the width', async ({ page }) => {
    await page.evaluate(() => window.__imglyTest!.setFullDrawing())
    await openTool(page)
    await page.keyboard.press('e')
    await setWidth(page, 20)
    await click(page, 100, 75)
    const alpha = await draftAlpha(page)
    expect(at(alpha, 100, 75)).toBe(0)
    const erased = alpha.filter((a) => a < 255).length
    expect(erased).toBeGreaterThan(280)
    expect(erased).toBeLessThan(380)
    expect(at(alpha, 100, 75 - 12)).toBe(255)
    expect(at(alpha, 100 + 12, 75)).toBe(255)
  })
})

test('opens on the Brush, Red, 12 px the first time, and circles in three actions (spec §7)', async ({
  page,
}) => {
  await action(page).click() // 1
  await expect(tool(page).getByRole('radio', { name: 'Brush' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(tool(page).getByRole('radio', { name: 'Red' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(tool(page).getByRole('textbox', { name: 'Width' })).toHaveValue('12')
  await drag(page, [
    [100, 40],
    [140, 75],
    [100, 110],
    [60, 75],
    [100, 40],
  ]) // 2
  await button(page, 'Apply').click() // 3
  await expect(tool(page)).toBeHidden()
  expect(marked(await drawingAlpha(page))).toBeGreaterThan(0)
  expect((await work(page))!.hasUnsavedEdits).toBe(true)
})

test('the Eraser removes marks along its path and nothing elsewhere (AC-04)', async ({ page }) => {
  await openTool(page)
  await setWidth(page, 20)
  await drag(page, [
    [20, 75],
    [180, 75],
  ])
  await button(page, 'Apply').click()
  await openTool(page)
  await page.keyboard.press('e')
  await expect(tool(page).getByRole('radio', { name: 'Eraser' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await drag(page, [
    [100, 40],
    [100, 110],
  ])
  await button(page, 'Apply').click()
  const alpha = await drawingAlpha(page)
  expect(at(alpha, 100, 75)).toBe(0)
  expect(at(alpha, 40, 75)).toBe(255)
  expect(at(alpha, 160, 75)).toBe(255)
})

test('Clear then Cancel brings back the applied marks; Clear then Apply empties them (AC-05, AC-06)', async ({
  page,
}) => {
  await openTool(page)
  await drag(page, [
    [20, 20],
    [180, 130],
  ])
  await button(page, 'Apply').click()
  const applied = await drawingAlpha(page)
  const revision = (await work(page))!.revision

  await openTool(page)
  await button(page, 'Clear').click()
  expect(marked(await draftAlpha(page))).toBe(0)
  await button(page, 'Cancel').click()
  expect(await drawingAlpha(page)).toEqual(applied)
  expect((await work(page))!.revision).toBe(revision)

  await openTool(page)
  await button(page, 'Clear').click()
  await button(page, 'Apply').click()
  expect(marked(await drawingAlpha(page))).toBe(0)
  expect((await work(page))!.revision).toBe(revision + 1)
})

test('Escape mid-Stroke cancels at once and keeps the layer from before (AC-06, AC-18)', async ({
  page,
}) => {
  await openTool(page)
  const a = await screenPoint(page, 30, 30)
  const b = await screenPoint(page, 150, 100)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 5 })
  await page.keyboard.press('Escape')
  await expect(tool(page)).toBeHidden()
  await page.mouse.up()
  expect(await drawingAlpha(page)).toEqual([])
  expect((await work(page))!.hasUnsavedEdits).toBe(false)
  expect((await layers(page)).retained).toBe(0)
})

test('a mode or width change mid-Stroke applies from the next Stroke (AC-18)', async ({ page }) => {
  await openTool(page)
  await setWidth(page, 10) // the press below leaves the field, so B, E, [ and ] reach the tool
  const a = await screenPoint(page, 20, 40)
  const b = await screenPoint(page, 180, 40)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, a.y, { steps: 4 })
  await page.keyboard.press('e')
  await page.keyboard.press('Shift+BracketRight')
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await page.mouse.up()
  const alpha = await draftAlpha(page)
  // Still the Brush at 10 px: the whole line is painted, and not 20 px wide.
  expect(at(alpha, 170, 40)).toBe(255)
  expect(at(alpha, 170, 40 + 8)).toBe(0)
  await expect(tool(page).getByRole('radio', { name: 'Eraser' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(tool(page).getByRole('textbox', { name: 'Width' })).toHaveValue('20')
})

test('a Stroke outside a narrow Crop leaves no mark when the Crop is widened (AC-09)', async ({
  page,
}) => {
  const crop = { x: 50, y: 40, width: 100, height: 70 }
  await page.evaluate(
    (c) =>
      window.__imglyTest!.setGeometry({
        flipH: false,
        flipV: false,
        rotation: 0,
        straighten: 0,
        crop: c,
      }),
    crop,
  )
  await openTool(page)
  await setWidth(page, 30)
  // Work pixels: the Crop's frame. Drag from outside the crop (on the surround) across it.
  const box = (await page.getByTestId('preview-canvas').boundingBox())!
  const inside = await screenPoint(page, 50, 35)
  await page.mouse.move(box.x + 5, inside.y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 5, inside.y, { steps: 10 })
  await page.mouse.up()
  await button(page, 'Apply').click()
  const alpha = await drawingAlpha(page)
  for (let y = 0; y < SIZE.height; y++) {
    for (let x = 0; x < SIZE.width; x++) {
      const outside =
        x < crop.x || x >= crop.x + crop.width || y < crop.y || y >= crop.y + crop.height
      if (outside) expect(at(alpha, x, y), `(${x}, ${y})`).toBe(0)
    }
  }
  expect(at(alpha, 100, 75)).toBe(255)
})

test('in the tool a drag draws, a Space-drag pans and Ctrl+wheel zooms (AC-18)', async ({
  page,
}) => {
  // Larger than the canvas area at 100%, at DPR 2 too, so it pans.
  await dropGeneratedImage(page, { width: 4000, height: 3000 })
  await waitForWork(page, 4000, 3000)
  await page.keyboard.press('Shift+Digit0') // 100%
  await openTool(page)
  // Opening narrows the canvas area and re-clamps the pan; the View-kept rule (AC-18) is the
  // cross-feature suite's, with an image large enough for the pan to survive that.
  const zoomed = await view(page)
  const box = (await page.getByTestId('preview-canvas').boundingBox())!
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const dragBy = async (dx: number, dy: number) => {
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()
    await page.mouse.move(c.x + dx, c.y + dy, { steps: 5 })
    await page.mouse.up()
  }

  await dragBy(40, 30)
  expect(await view(page)).toEqual(zoomed)
  const drawn = await draftMarks(page)
  expect(drawn).toBeGreaterThan(0)

  await page.keyboard.down('Space') // the drag above took focus off the panel
  await dragBy(-60, -40)
  await page.keyboard.up('Space')
  expect(await view(page)).not.toEqual(zoomed)
  expect(await draftMarks(page)).toBe(drawn)

  const before = (await view(page)).zoom
  await page.mouse.move(c.x, c.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -200)
  await page.keyboard.up('Control')
  await expect.poll(async () => (await view(page)).zoom).not.toBe(before)
  expect(await draftMarks(page)).toBe(drawn)
  expect((await work(page))!.hasUnsavedEdits).toBe(false)
})

test('keyboard path: D opens, B/E and [ ] change settings, Enter applies (AC-19)', async ({
  page,
}) => {
  await page.keyboard.press('d')
  await expect(tool(page)).toBeVisible()
  await page.keyboard.press('e')
  await expect(tool(page).getByRole('radio', { name: 'Eraser' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.keyboard.press('b')
  await expect(tool(page).getByRole('radio', { name: 'Brush' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.keyboard.press('BracketRight')
  await expect(tool(page).getByRole('textbox', { name: 'Width' })).toHaveValue('13')
  await page.keyboard.press('Shift+BracketLeft')
  await expect(tool(page).getByRole('textbox', { name: 'Width' })).toHaveValue('3')
  await drag(page, [
    [40, 40],
    [120, 90],
  ]) // the drag takes focus off the Brush radio, so Enter applies rather than pressing it
  await page.keyboard.press('Enter')
  await expect(tool(page)).toBeHidden()
  await expect(action(page)).toBeFocused()
  expect(marked(await drawingAlpha(page))).toBeGreaterThan(0)
})

test('the layer ledger keeps exactly one applied layer, or none (sad.md §7)', async ({ page }) => {
  expect((await layers(page)).retained).toBe(0)
  await openTool(page)
  await drag(page, [
    [20, 20],
    [100, 100],
  ])
  await button(page, 'Apply').click()
  expect((await layers(page)).retained).toBe(1)
  await openTool(page)
  await button(page, 'Cancel').click()
  expect((await layers(page)).retained).toBe(1)
  await openTool(page)
  await click(page, 150, 50)
  await button(page, 'Apply').click()
  expect((await layers(page)).retained).toBe(1)
  await openTool(page)
  await page.keyboard.press('Escape')
  expect((await layers(page)).retained).toBe(1)
})

test.describe('AC-02 — the width on the image and on screen', () => {
  /** Rows of a column whose colour is the red Brush (#E53935), opaque core and edge alike. */
  const redRun = (rgba: ArrayLike<number>, width: number, x: number, height: number) => {
    let n = 0
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4
      if (rgba[i]! - Math.max(rgba[i + 1]!, rgba[i + 2]!) > 100) n++
    }
    return n
  }

  test('a 20 px Stroke is 20 px wide in a full-size Export, and twice as wide on screen at 200%', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(60_000)
    await openTool(page)
    await setWidth(page, 20)
    await drag(page, [
      [20, 75],
      [180, 75],
    ])
    await button(page, 'Apply').click()
    const out = await decodePng(page, await exportPng(page, browserName))
    // The opaque core is 20 px; the antialiased edge adds at most 1 px each side.
    expect(redRun(out.data, out.width, 100, out.height)).toBeGreaterThanOrEqual(19)
    expect(redRun(out.data, out.width, 100, out.height)).toBeLessThanOrEqual(22)

    // WebKit on the Linux runner now and then leaves the WebGL canvas out of page screenshots (as
    // in adjust's tool.spec.ts), so the on-screen width is checked on the other engines only.
    if (browserName === 'webkit' && process.platform === 'linux') return
    const onScreen = async () => {
      const top = await screenPoint(page, 100, 40)
      const bottom = await screenPoint(page, 100, 110)
      const shot = await pixelsAt(page, {
        x: Math.round(top.x),
        y: Math.round(top.y),
        width: 1,
        height: Math.round(bottom.y - top.y),
      })
      return redRun(shot.data, 1, 0, shot.height)
    }
    const atActual = await onScreen()
    await page.keyboard.press('+')
    await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(1)
    while ((await view(page)).zoom < 2) await page.keyboard.press('+')
    expect((await view(page)).zoom).toBe(2)
    const zoomed = await onScreen()
    expect(Math.abs(zoomed - 2 * atActual)).toBeLessThanOrEqual(2)
  })
})

test('AC-03 — an invalid width typed in the field is corrected, and the tool stays open', async ({
  page,
}) => {
  await openTool(page)
  const field = widthField(page)
  await field.fill('250')
  await field.press('Enter')
  await expect(field).toHaveValue('200')
  await field.fill('2.5')
  await field.press('Tab')
  await expect(field).toHaveValue('3')
  await field.focus()
  await field.fill('1e2')
  await field.press('Tab')
  await expect(field).toHaveValue('3')
  await field.focus()
  await field.fill('20 PX')
  await field.press('Enter')
  await expect(field).toHaveValue('20')
  await expect(tool(page)).toBeVisible()
})

test('AC-04 — erasing where nothing is drawn changes no pixel and is no edit', async ({ page }) => {
  await openTool(page)
  await page.keyboard.press('e')
  await drag(page, [
    [20, 20],
    [180, 130],
  ])
  expect(await draftMarks(page)).toBe(0)
  await button(page, 'Apply').click()
  expect(await drawingAlpha(page)).toEqual([])
  expect((await work(page))!.hasUnsavedEdits).toBe(false)
})

test.describe('AC-09 — a Stroke at the Crop edge', () => {
  const crop = { x: 50, y: 40, width: 100, height: 70 }

  test.beforeEach(async ({ page }) => {
    await page.evaluate(
      (c) =>
        window.__imglyTest!.setGeometry({
          flipH: false,
          flipV: false,
          rotation: 0,
          straighten: 0,
          crop: c,
        }),
      crop,
    )
    await openTool(page)
  })

  const outsideCrop = (alpha: number[]) => {
    let n = 0
    for (let y = 0; y < SIZE.height; y++) {
      for (let x = 0; x < SIZE.width; x++) {
        const out =
          x < crop.x || x >= crop.x + crop.width || y < crop.y || y >= crop.y + crop.height
        if (out && at(alpha, x, y) > 0) n++
      }
    }
    return n
  }

  test('a wide Stroke whose pointer path runs just outside an edge paints its band inside', async ({
    page,
  }) => {
    await setWidth(page, 30)
    // In the Crop's frame: 5 px above its top edge, so 10 px of the 30 px band reach inside.
    await drag(page, [
      [10, -5],
      [90, -5],
    ])
    await button(page, 'Apply').click()
    const alpha = await drawingAlpha(page)
    expect(at(alpha, 100, crop.y + 4)).toBe(255)
    expect(at(alpha, 100, crop.y + 13)).toBe(0)
    expect(outsideCrop(alpha)).toBe(0)
  })

  test('a press just outside paints the inside part of its dot', async ({ page }) => {
    await setWidth(page, 20)
    await click(page, -5, 35) // Original (45, 75): 5 px left of the Crop
    await button(page, 'Apply').click()
    const alpha = await drawingAlpha(page)
    expect(at(alpha, crop.x + 2, 75)).toBe(255)
    expect(outsideCrop(alpha)).toBe(0)
  })
})

test('AC-09 — under a Straighten angle a Stroke across the Crop edge marks nothing beyond a 1 px fringe', async ({
  page,
}) => {
  const straight = setStraighten(identityGeometry(SIZE), 70, SIZE)
  const crop = { x: straight.crop.x + 40, y: straight.crop.y + 30, width: 80, height: 50 }
  const g = { ...straight, crop }
  await page.evaluate((next) => window.__imglyTest!.setGeometry(next), g)
  await openTool(page)
  await setWidth(page, 20)
  // In the Crop's frame: from 15 px outside the left edge to 15 px outside the right one.
  await drag(page, [
    [-15, 25],
    [crop.width + 15, 25],
  ])
  await button(page, 'Apply').click()
  const alpha = await drawingAlpha(page)
  // Each marked Original pixel's centre, mapped back into the turned frame, lies inside the Crop
  // or at most 1 px outside it (sad.md §11: the antialiased edge of the turned clip).
  const [a, b, c, d, e, f] = frameToOriginal(g, SIZE)
  const det = a * d - b * c
  let marked = 0
  let worst = 0
  for (let y = 0; y < SIZE.height; y++) {
    for (let x = 0; x < SIZE.width; x++) {
      if (at(alpha, x, y) === 0) continue
      marked++
      const px = x + 0.5 - e
      const py = y + 0.5 - f
      const fx = (d * px - c * py) / det
      const fy = (-b * px + a * py) / det
      const outside = Math.max(
        0,
        crop.x - fx,
        fx - (crop.x + crop.width),
        crop.y - fy,
        fy - (crop.y + crop.height),
      )
      worst = Math.max(worst, outside)
    }
  }
  expect(marked).toBeGreaterThan(crop.width * 15) // the Stroke is there, across the whole Crop
  expect(worst).toBeLessThanOrEqual(1)
})

test.describe('AC-19 — reaching and leaving the tool by keyboard', () => {
  for (const key of ['Enter', 'Space'] as const) {
    test(`Tab reaches "Draw" and ${key} opens it`, async ({ page }) => {
      await page.getByTestId('adjust-action').focus()
      // WebKit's Tab reaches buttons only with Alt (Safari's "Press Tab to highlight" off).
      await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
      await expect(action(page)).toBeFocused()
      await page.keyboard.press(key)
      await expect(tool(page)).toBeVisible()
    })
  }

  test('Space on the focused Apply applies the tool', async ({ page }) => {
    await openTool(page)
    await drag(page, [
      [40, 40],
      [120, 90],
    ])
    await button(page, 'Apply').focus()
    await page.keyboard.press('Space')
    await expect(tool(page)).toBeHidden()
    expect(marked(await drawingAlpha(page))).toBeGreaterThan(0)
  })
})
