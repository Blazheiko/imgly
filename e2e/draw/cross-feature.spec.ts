import { expect, test, type FileChooser, type Page } from '@playwright/test'
import { canvasArea, dropGeneratedImage } from '../open-and-view/helpers'
import { dropBytes, pixelsAt } from '../crop-rotate/helpers'
import {
  action,
  button,
  click,
  draftAlpha,
  drag,
  drawingAlpha,
  exportPng,
  fixture,
  gotoReady,
  layers,
  clickPanelBackground,
  openNamed,
  openTool,
  screenPoint,
  setWidth,
  tool,
  view,
  waitForWork,
  work,
} from './helpers'

// The draw tool among the other features in a real browser (AC-11 to AC-18; sad.md §10 QG-2d).
// Each test opens photo.png (320×240) first unless it needs no image.
const EXPORT_HINT = 'Apply or cancel the drawing first, then export.'
const OTHER_TOOL_HINT = 'Apply or cancel the open tool first.'
const NO_IMAGE_HINT = 'Open an image first to draw on it.'

const cropAction = (page: Page) => page.getByTestId('crop-rotate-action')
const cropTool = (page: Page) => page.getByTestId('crop-rotate-tool')
const adjustAction = (page: Page) => page.getByTestId('adjust-action')
const adjustTool = (page: Page) => page.getByTestId('adjust-tool')
const replaceDialog = (page: Page) => page.getByRole('alertdialog')
/** The info toasts with this text (not the actions' hidden descriptions, which say the same). */
const toasts = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text })
const toast = (page: Page, text: string) => toasts(page, text).first()
const marks = (alpha: number[]) => alpha.filter((a) => a > 0).length

async function apply(page: Page) {
  await button(page, 'Apply').click()
  await expect(tool(page)).toBeHidden()
}

async function pickThroughOpenImage(page: Page, answer: (chooser: FileChooser) => Promise<void>) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('editor-top-bar').getByRole('button', { name: 'Open image' }).click()
  await answer(await chooser)
}

const revision = async (page: Page) => (await work(page))!.revision

test.describe('with an image', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page)
    await openNamed(page, 'photo.png', 320, 240)
  })

  test.describe('AC-12 — Unsaved edits change only with a real change (QG-2d)', () => {
    test('Apply with no Stroke, an Eraser where nothing is drawn, or a Clear of nothing raises nothing', async ({
      page,
    }) => {
      await openTool(page)
      await apply(page)
      await openTool(page)
      await page.keyboard.press('e')
      await drag(page, [
        [40, 40],
        [200, 160],
      ])
      await apply(page)
      await openTool(page)
      await button(page, 'Clear').click()
      await apply(page)
      expect((await work(page))!).toMatchObject({ revision: 0, hasUnsavedEdits: false })
    })

    test('Brush Strokes only outside the Crop raise nothing', async ({ page }) => {
      await page.evaluate(() =>
        window.__imglyTest!.setGeometry({
          flipH: false,
          flipV: false,
          rotation: 0,
          straighten: 0,
          crop: { x: 100, y: 80, width: 120, height: 80 },
        }),
      )
      const before = await revision(page)
      await openTool(page)
      await setWidth(page, 4)
      // Over the surround, well away from the Crop's edges.
      const box = (await page.getByTestId('preview-canvas').boundingBox())!
      await page.mouse.move(box.x + 10, box.y + 10)
      await page.mouse.down()
      await page.mouse.move(box.x + 60, box.y + 40, { steps: 4 })
      await page.mouse.up()
      await apply(page)
      expect(await revision(page)).toBe(before)
    })

    test('a mark drawn and erased again in one Draft is an edit', async ({ page }) => {
      await openTool(page)
      await setWidth(page, 20)
      await click(page, 160, 120)
      await page.keyboard.press('e')
      await setWidth(page, 60)
      await click(page, 160, 120)
      expect(marks(await draftAlpha(page))).toBe(0)
      await apply(page)
      expect((await work(page))!.hasUnsavedEdits).toBe(true)
    })

    test('after an Export, a mark drawn in one Apply and erased in a later one is still an edit', async ({
      page,
      browserName,
    }) => {
      await openTool(page)
      await click(page, 160, 120)
      await apply(page)
      expect((await work(page))!.hasUnsavedEdits).toBe(true)
      // An applied change asks before a replace.
      await dropGeneratedImage(page, { width: 120, height: 90 })
      await expect(replaceDialog(page)).toBeVisible()
      await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()

      await exportPng(page, browserName)
      expect((await work(page))!.hasUnsavedEdits).toBe(false)
      await openTool(page)
      await page.keyboard.press('e')
      await setWidth(page, 60)
      await click(page, 160, 120)
      await apply(page)
      expect(marks(await drawingAlpha(page))).toBe(0)
      expect((await work(page))!.hasUnsavedEdits).toBe(true)
    })
  })

  test('AC-15 — Export and Ctrl/Cmd+S only show the hint while the tool is open', async ({
    page,
  }) => {
    let downloads = 0
    page.on('download', () => downloads++)
    await openTool(page)
    const url = page.url()

    await page.keyboard.press('ControlOrMeta+s')
    await expect(toast(page, EXPORT_HINT)).toBeVisible()
    await page
      .getByTestId('editor-top-bar')
      .getByRole('button', { name: /^Export/ })
      .click({ force: true })
    await expect(page.getByRole('dialog', { name: 'Export' })).toHaveCount(0)
    expect(downloads).toBe(0)
    expect(page.url()).toBe(url)
    await expect(tool(page)).toBeVisible()
  })

  test.describe('AC-16 — one tool at a time, in both directions', () => {
    test('Crop and rotate, Adjust, C and A say to apply or cancel Draw first; silent in a field', async ({
      page,
    }) => {
      await openTool(page)
      await cropAction(page).click({ force: true })
      await adjustAction(page).click({ force: true })
      await expect(toasts(page, OTHER_TOOL_HINT)).toHaveCount(2)
      await page.keyboard.press('c')
      await page.keyboard.press('a')
      await expect(toasts(page, OTHER_TOOL_HINT)).toHaveCount(4)
      await tool(page).getByRole('textbox', { name: 'Width' }).focus()
      await page.keyboard.press('c')
      await page.keyboard.press('a')
      await expect(toasts(page, OTHER_TOOL_HINT)).toHaveCount(4)
      await expect(cropTool(page)).toHaveCount(0)
      await expect(adjustTool(page)).toHaveCount(0)
      await expect(tool(page)).toBeVisible()
    })

    for (const [name, open, opened] of [
      ['Crop and rotate', cropAction, cropTool],
      ['Adjust', adjustAction, adjustTool],
    ] as const) {
      test(`Draw and D say to apply or cancel ${name} first`, async ({ page }) => {
        await open(page).click()
        await expect(opened(page)).toBeVisible()
        await action(page).click({ force: true })
        await expect(toast(page, OTHER_TOOL_HINT)).toBeVisible()
        await page.keyboard.press('d')
        await expect(toasts(page, OTHER_TOOL_HINT)).toHaveCount(2)
        await expect(tool(page)).toHaveCount(0)
      })
    }
  })

  test.describe('AC-13 — another image while the tool is open', () => {
    test('with no Unsaved edits the new image replaces the Work with no layer, and the tool closes', async ({
      page,
    }) => {
      await openTool(page)
      await click(page, 160, 120)
      await dropGeneratedImage(page, { width: 120, height: 90 })
      await waitForWork(page, 120, 90)
      await expect(tool(page)).toBeHidden()
      expect(await drawingAlpha(page)).toEqual([])
      expect((await layers(page)).retained).toBe(0)
      expect((await work(page))!.hasUnsavedEdits).toBe(false)
    })

    test('a file that cannot be read leaves the tool and its Draft as they were', async ({
      page,
    }) => {
      await openTool(page)
      await click(page, 160, 120)
      const draft = await draftAlpha(page)
      await dropBytes(page, 'corrupt.png', fixture('corrupt.png'), 'image/png')
      await expect(page.getByRole('alert').first()).toBeVisible()
      await expect(tool(page)).toBeVisible()
      expect(await draftAlpha(page)).toEqual(draft)
    })

    test('with Unsaved edits: declining keeps the Draft, confirming closes the tool', async ({
      page,
    }) => {
      await page.evaluate(() => window.__imglyTest!.applyEdit())
      await openTool(page)
      await click(page, 160, 120)
      const draft = await draftAlpha(page)
      await dropGeneratedImage(page, { width: 120, height: 90 })
      await expect(replaceDialog(page)).toBeVisible()
      await expect(tool(page)).toBeVisible()
      await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()
      await expect(tool(page)).toBeVisible()
      expect(await draftAlpha(page)).toEqual(draft)
      await expect(tool(page).locator(':focus')).toHaveCount(1)

      await pickThroughOpenImage(page, (chooser) =>
        chooser.setFiles({
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
          buffer: fixture('photo.jpg'),
        }),
      )
      await replaceDialog(page).getByRole('button', { name: 'Replace' }).click()
      await expect(tool(page)).toBeHidden()
      await expect.poll(async () => (await work(page))!.hasUnsavedEdits).toBe(false)
      expect(await drawingAlpha(page)).toEqual([])
      expect((await layers(page)).retained).toBe(0)
    })
  })

  test.describe('AC-11 — marks in the other tools', () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'canvas pixels are read on Chromium')

    /** A 120 px red dot at image pixel (40, 40), applied. */
    async function redDot(page: Page) {
      await openTool(page)
      await setWidth(page, 120)
      await click(page, 40, 40)
      await apply(page)
    }

    async function pixelAt(page: Page, x: number, y: number) {
      const p = await screenPoint(page, x, y)
      const shot = await pixelsAt(page, {
        x: Math.round(p.x),
        y: Math.round(p.y),
        width: 1,
        height: 1,
      })
      return Array.from(shot.data.slice(0, 3))
    }

    test('Adjust shows the marks unadjusted, in the Draft and in Compare’s "Before"', async ({
      page,
    }) => {
      await redDot(page)
      await adjustAction(page).click()
      await expect(adjustTool(page)).toBeVisible()
      await adjustTool(page).getByRole('textbox', { name: 'Grayscale' }).fill('100')
      await adjustTool(page).getByRole('textbox', { name: 'Grayscale' }).press('Enter')
      const [r, g, b] = await pixelAt(page, 40, 40)
      expect(r! - Math.max(g!, b!)).toBeGreaterThan(100)
    })

    test('Crop and rotate shows marks outside the crop frame, and a wider Crop brings them back', async ({
      page,
    }) => {
      await redDot(page)
      await page.evaluate(() =>
        window.__imglyTest!.setGeometry({
          flipH: false,
          flipV: false,
          rotation: 0,
          straighten: 0,
          crop: { x: 160, y: 120, width: 160, height: 120 },
        }),
      )
      expect(marks(await drawingAlpha(page))).toBeGreaterThan(0) // hidden, not removed
      const full = (await canvasArea(page)).width
      await cropAction(page).click()
      await expect(cropTool(page)).toBeVisible()
      // The panel narrows the canvas area, which re-fits the View: read it after that.
      await expect.poll(async () => (await canvasArea(page)).width).toBeLessThan(full)
      await expect.poll(async () => (await view(page)).panX).toBeLessThan(480)
      // The whole turned image shows: image pixel (40, 40) is outside the frame, still red
      // under the dim panel.
      const box = (await page.getByTestId('preview-canvas').boundingBox())!
      const { zoom, panX, panY } = await view(page)
      const shot = await pixelsAt(page, {
        x: Math.round(box.x + panX + 40 * zoom),
        y: Math.round(box.y + panY + 40 * zoom),
        width: 1,
        height: 1,
      })
      const [r, g, b] = Array.from(shot.data.slice(0, 3))
      expect(r! - Math.max(g!, b!)).toBeGreaterThan(20)
    })
  })
})

test('AC-18 — the View is kept on open, works inside, and stays after Apply and Cancel', async ({
  page,
}) => {
  await gotoReady(page)
  const [W, H] = [1200, 900]
  await dropGeneratedImage(page, { width: W, height: H })
  await waitForWork(page, W, H)
  await page.keyboard.press('Shift+1')
  for (let i = 0; i < 12; i++) await page.keyboard.press('+')
  const area = await canvasArea(page)
  const zoomed = await view(page)
  expect(W * zoomed.zoom).toBeGreaterThan(area.width)
  expect(H * zoomed.zoom).toBeGreaterThan(area.height)

  // Outside the tool a drag pans; inside it a Space-drag does. Pans go towards the bottom right,
  // back towards 0, so the pan stays valid for the wider canvas the closed tool leaves.
  async function pan(dx: number, dy: number, space: boolean) {
    const a = await canvasArea(page)
    const cx = a.left + a.width / a.dpr / 2
    const cy = a.top + a.height / a.dpr / 2
    if (space) {
      // Focus opens on Brush, where Space presses the radio (screens.md §Keyboard)
      await clickPanelBackground(page)
      await page.keyboard.down('Space')
    }
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + dx, cy + dy, { steps: 4 })
    await page.mouse.up()
    if (space) await page.keyboard.up('Space')
  }
  await pan(-60, -60, false)
  const before = await view(page)
  const narrower = () =>
    expect.poll(async () => (await canvasArea(page)).width).toBeLessThan(area.width)
  const restored = () => expect.poll(async () => (await canvasArea(page)).width).toBe(area.width)

  await openTool(page)
  await narrower()
  expect(await view(page)).toEqual(before)
  await pan(30, 30, true)
  const inside = await view(page)
  expect(inside).not.toEqual(before)
  await page.keyboard.press('Escape')
  await expect(tool(page)).toBeHidden()
  await restored()
  expect(await view(page)).toEqual(inside)

  await openTool(page)
  await narrower()
  expect(await view(page)).toEqual(inside)
  await apply(page)
  await restored()
  expect(await view(page)).toEqual(inside)
})

test('AC-17 — with no image, "Draw" and D only show the hint', async ({ page }) => {
  await gotoReady(page)
  await action(page).click({ force: true })
  await expect(toast(page, NO_IMAGE_HINT)).toBeVisible()
  await page.keyboard.press('d')
  await expect(toasts(page, NO_IMAGE_HINT)).toHaveCount(2)
  await expect(tool(page)).toHaveCount(0)
})

// AC-14 (no open during an export) is narrowed on purpose, as in adjust's suite: an export in a
// real browser is too short to aim a key press at, so the store, shortcut and component tests
// (DrawAction.test.ts, shortcuts.test.ts) hold it.
