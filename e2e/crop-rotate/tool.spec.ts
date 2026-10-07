import { expect, test, type Locator, type Page } from '@playwright/test'
import { fixture, view } from '../export/helpers'
import { canvasArea, dropGeneratedImage } from '../open-and-view/helpers'
import {
  action,
  applyGeometry,
  dropBytes,
  frame,
  gotoReady,
  identityGeometry,
  openFixture,
  openTool,
  pixelOf,
  pixelsAt,
  statusSize,
  tool,
  waitForWork,
  work,
} from './helpers'

const size = { width: 400, height: 300 }

test.beforeEach(async ({ page }) => {
  await gotoReady(page)
  await openFixture(page, size.width, size.height)
})

test.describe('three-action paths (AC-20, KPI 2)', () => {
  test('rotate once and keep it, by mouse', async ({ page }) => {
    await action(page).click()
    await page.getByRole('button', { name: 'Rotate right' }).click()
    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!).toMatchObject({ width: 300, height: 400, hasUnsavedEdits: true })
    await expect(statusSize(page)).toHaveText('300 × 400 px, from 400 × 300 px')
  })

  test('rotate once and keep it, by keyboard', async ({ page }) => {
    await page.keyboard.press('c')
    await expect(frame(page)).toBeFocused()
    await page.getByRole('button', { name: 'Rotate right' }).press('Enter')
    await expect(tool(page)).toBeVisible() // Enter on a button only presses it
    await frame(page).press('Enter')
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!.geometry.rotation).toBe(90)
    await expect(action(page)).toBeFocused()
  })

  test('crop to a square', async ({ page }) => {
    await action(page).click()
    await page.getByRole('radio', { name: '1:1', exact: true }).click()
    await page.getByRole('button', { name: 'Apply' }).click()
    expect((await work(page))!).toMatchObject({ width: 300, height: 300 })
  })
})

test.describe('by keyboard alone (AC-20)', () => {
  /**
   * Presses Tab until `target` has focus, as a keyboard user would. WebKit, like Safari by
   * default, tabs only to text fields; Option+Tab reaches every control.
   */
  async function tabTo(page: Page, target: Locator) {
    const tab = test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab'
    for (let i = 0; i < 40; i++) {
      if (await target.evaluate((el) => el === document.activeElement)) return
      await page.keyboard.press(tab)
    }
    throw new Error('Tab never reached the control')
  }

  test('rotate once and keep it: C, Space on Rotate right, Space on Apply', async ({ page }) => {
    await page.keyboard.press('c')
    await expect(frame(page)).toBeFocused()
    await tabTo(page, page.getByRole('button', { name: 'Rotate right' }))
    await page.keyboard.press('Space')
    await expect(tool(page)).toBeVisible() // Space pressed the button, not space-pan
    await tabTo(page, page.getByRole('button', { name: 'Apply' }))
    await page.keyboard.press('Space')
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!).toMatchObject({ width: 300, height: 400 })
  })

  test('crop to a square: C, arrows to 1:1, Enter on the frame', async ({ page }) => {
    await page.keyboard.press('c')
    await tabTo(page, page.getByRole('radio', { name: 'Free', exact: true }))
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: '1:1', exact: true })).toBeChecked()
    await frame(page).focus()
    await page.keyboard.press('Enter')
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!).toMatchObject({ width: 300, height: 300 })
  })

  test('a focused handle resizes with arrows, and Escape there cancels', async ({ page }) => {
    await page.keyboard.press('c')
    // From the frame to its first handle (Option+Tab in WebKit, as tabTo explains).
    await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
    const handle = page.locator('.crop-overlay__handle:focus')
    await expect(handle).toHaveCount(1)
    await page.keyboard.press('Shift+ArrowLeft')
    await page.keyboard.press('Escape')
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!).toMatchObject({ width: 400, height: 300, revision: 0 })
  })

  test('Enter on the focused Straighten slider applies the tool', async ({ page }) => {
    await page.keyboard.press('c')
    await tabTo(page, page.getByRole('slider'))
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!.geometry.straighten).toBe(1)
  })
})

test('AC-01: drag an edge inwards and Apply', async ({ page }) => {
  await openTool(page)
  const handle = page.getByRole('button', { name: 'Right edge' })
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 4 })
  await expect(page.getByTestId('thirds-grid')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByTestId('thirds-grid')).toBeHidden()
  await page.getByRole('button', { name: 'Apply' }).click()

  const after = (await work(page))!
  expect(after.width).toBeLessThan(400)
  expect(after).toMatchObject({ height: 300, hasUnsavedEdits: true })
  await expect(statusSize(page)).toHaveText(`${after.width} × 300 px, from 400 × 300 px`)
})

test('AC-16: Export and Ctrl/Cmd+S only show the hint while the tool is open', async ({ page }) => {
  const hint = 'Apply or cancel the crop first, then export.'
  let downloads = 0
  page.on('download', () => downloads++)
  await openTool(page)
  const url = page.url()

  await page.keyboard.press('ControlOrMeta+s')
  await expect(page.getByText(hint).first()).toBeVisible()
  // aria-disabled, yet focusable and clickable by design: Playwright would wait for "enabled".
  await page
    .getByTestId('editor-top-bar')
    .getByRole('button', { name: /^Export/ })
    .click({ force: true })
  await expect(page.getByRole('dialog', { name: 'Export' })).toHaveCount(0)
  expect(downloads).toBe(0)
  expect(page.url()).toBe(url)
  await expect(tool(page)).toBeVisible()
})

test.describe('AC-17: opening another image while the tool is open', () => {
  test('with no Unsaved edits the new image replaces the Work and the tool closes', async ({
    page,
  }) => {
    await openTool(page)
    await page.getByRole('button', { name: 'Flip horizontal' }).click()
    await dropGeneratedImage(page, { width: 120, height: 90 })
    await waitForWork(page, 120, 90)
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!.geometry).toEqual(identityGeometry({ width: 120, height: 90 }))
  })

  test('a file that cannot be read leaves the tool as it was', async ({ page }) => {
    await openTool(page)
    await page.getByRole('button', { name: 'Rotate right' }).click()
    await dropBytes(page, 'corrupt.png', fixture('corrupt.png'), 'image/png')
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(tool(page)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue('300')
  })

  test('with Unsaved edits: declining keeps the tool, confirming closes it', async ({ page }) => {
    await applyGeometry(page, { ...identityGeometry(size), flipV: true })
    await openTool(page)
    await page.getByRole('button', { name: 'Rotate right' }).click()

    await dropGeneratedImage(page, { width: 120, height: 90 })
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    await expect(tool(page)).toBeVisible()
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(tool(page)).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Width' })).toHaveValue('300') // Draft kept

    await dropGeneratedImage(page, { width: 120, height: 90 })
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click()
    await waitForWork(page, 120, 90)
    await expect(tool(page)).toBeHidden()
  })
})

test('AC-19: the View fits the turned image on open and the Work after Apply or Cancel', async ({
  page,
}) => {
  const fitted = await view(page)
  await openTool(page)
  // The panel narrows the canvas area: the View fits the whole turned image in what is left.
  const area = await canvasArea(page)
  const opened = await view(page)
  expect(opened.autoFit).toBe(true)
  expect(opened.zoom).toBeCloseTo(Math.min(area.width / 400, area.height / 300, 1), 9)

  await page.keyboard.press('+')
  expect((await view(page)).zoom).toBeGreaterThan(opened.zoom)
  await page.keyboard.press('Escape')
  await expect(tool(page)).toBeHidden()
  await expect
    .poll(() => view(page))
    .toMatchObject({
      zoom: fitted.zoom,
      panX: fitted.panX,
      panY: fitted.panY,
    })
  expect((await work(page))!.revision).toBe(0) // zoom never counts as an edit
})

test('AC-19: the wheel zooms over the crop frame, and a space-drag over it pans', async ({
  page,
}) => {
  await openTool(page)
  const opened = await view(page)
  const box = (await frame(page).boundingBox())!
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  await page.mouse.move(centre.x, centre.y)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -200)
  await page.keyboard.up('Control')
  await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(opened.zoom)

  await frame(page).focus()
  for (let i = 0; i < 4; i++) await page.keyboard.press('+') // the image now overflows, so it pans
  const zoomed = await view(page)
  await page.keyboard.down('Space')
  await page.mouse.move(centre.x, centre.y)
  await page.mouse.down()
  await page.mouse.move(centre.x + 40, centre.y + 30, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  const panned = await view(page)
  expect(panned.panX).not.toBe(zoomed.panX)
  expect(panned.zoom).toBe(zoomed.zoom)
  // Neither gesture touched the Draft: Apply keeps the whole image as the Crop.
  await frame(page).press('Enter')
  await expect(tool(page)).toBeHidden()
  expect((await work(page))!.geometry.crop).toEqual({ x: 0, y: 0, ...size })
})

test.describe('the frame sits on the pixels the Preview draws (ADR-0005)', () => {
  for (const [label, keys] of [
    ['100%', ['Shift+0']],
    ['800%', ['Shift+0', '+', '+', '+', '+', '+', '+', '+']],
  ] as const) {
    test(`at ${label}`, async ({ page }) => {
      await openTool(page)
      for (const key of keys) await page.keyboard.press(key)
      await frame(page).focus()
      const area = await canvasArea(page)
      const v = await view(page)
      const box = (await frame(page).boundingBox())!
      const expectedLeft = area.left + Math.round(v.panX) / area.dpr
      const expectedTop = area.top + Math.round(v.panY) / area.dpr
      // The frame is drawn where core's maths puts the image's top-left corner (if on screen).
      if (expectedLeft >= area.left) expect(box.x).toBeCloseTo(expectedLeft, 1)
      if (expectedTop >= area.top) expect(box.y).toBeCloseTo(expectedTop, 1)

      // A point inside the frame and the canvas shows exactly the image pixel core's maths puts
      // there (identity Geometry, so the Crop's frame is the image): Preview and overlay agree.
      const px = Math.max(box.x, area.left) + 20
      const py = Math.max(box.y, area.top) + 20
      const ix = Math.floor(((px - area.left) * area.dpr - Math.round(v.panX)) / v.zoom)
      const iy = Math.floor(((py - area.top) * area.dpr - Math.round(v.panY)) / v.zoom)
      const shown = await pixelsAt(page, { x: px, y: py, width: 1, height: 1 })
      const want = pixelOf(ix, iy)
      for (let c = 0; c < 3; c++) {
        expect(Math.abs(shown.data[c]! - want[c]!), `pixel (${ix},${iy})`).toBeLessThanOrEqual(3)
      }
    })
  }
})
