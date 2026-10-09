import { expect, test, type Page } from '@playwright/test'
import { dropGeneratedImage } from '../open-and-view/helpers'
import { dropBytes, pixelsAt } from '../crop-rotate/helpers'
import { choose, generateImage, openFile, panel, view } from '../export/helpers'
import {
  NEUTRAL_ADJUSTMENTS,
  action,
  adjusted,
  applyAdjustments,
  exportPng,
  field,
  fixture,
  gotoReady,
  openNamed,
  openTool,
  slider,
  tool,
  waitForWork,
  work,
} from './helpers'

// The adjust tool among the other features in a real browser (AC-11, AC-15 to AC-20). Each test
// opens photo.png (320×240) first unless it needs no image.
const EXPORT_HINT = 'Apply or cancel the adjustments first, then export.'
const OTHER_TOOL_HINT = 'Apply or cancel the open tool first.'
const NO_IMAGE_HINT = 'Open an image first to adjust it.'

const cropAction = (page: Page) => page.getByTestId('crop-rotate-action')
const cropTool = (page: Page) => page.getByTestId('crop-rotate-tool')
const replaceDialog = (page: Page) => page.getByRole('alertdialog')
/** The info toasts with this text (not the actions' hidden descriptions, which say the same). */
const toasts = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text })
const toast = (page: Page, text: string) => toasts(page, text).first()

async function setField(page: Page, name: string, value: string) {
  await field(page, name).fill(value)
  await field(page, name).press('Enter')
}

async function apply(page: Page) {
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(tool(page)).toBeHidden()
}

test.describe('with an image', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page)
    await openNamed(page, 'photo.png', 320, 240)
  })

  test.describe('AC-11 — Unsaved edits follow the values from when the tool opened', () => {
    test('Apply with no change, or with a change made and undone, raises nothing', async ({
      page,
    }) => {
      await openTool(page)
      await apply(page)
      await openTool(page)
      await setField(page, 'Contrast', '40')
      await setField(page, 'Contrast', '0')
      await apply(page)
      expect((await work(page))!).toMatchObject({ revision: 0, hasUnsavedEdits: false })
    })

    test('an applied change asks before a replace; after an Export, changing back is an edit', async ({
      page,
      browserName,
    }) => {
      await openTool(page)
      await setField(page, 'Sepia', '50')
      await apply(page)
      expect((await work(page))!.hasUnsavedEdits).toBe(true)
      await dropGeneratedImage(page, { width: 120, height: 90 })
      await expect(replaceDialog(page)).toBeVisible()
      await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()

      await exportPng(page, browserName)
      expect((await work(page))!.hasUnsavedEdits).toBe(false)
      await openTool(page)
      await setField(page, 'Sepia', '0')
      await apply(page)
      expect((await work(page))!.hasUnsavedEdits).toBe(true)
    })
  })

  test('AC-16 — Export and Ctrl/Cmd+S only show the hint while the tool is open', async ({
    page,
  }) => {
    let downloads = 0
    page.on('download', () => downloads++)
    await openTool(page)
    const url = page.url()

    await page.keyboard.press('ControlOrMeta+s')
    await expect(toast(page, EXPORT_HINT)).toBeVisible()
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

  test.describe('AC-18 — one tool at a time, in both directions', () => {
    test('Crop and rotate and C say to apply or cancel Adjust first', async ({ page }) => {
      await openTool(page)
      await cropAction(page).click({ force: true })
      await expect(toast(page, OTHER_TOOL_HINT)).toBeVisible()
      await slider(page, 'Tint').focus()
      await page.keyboard.press('c')
      await expect(toasts(page, OTHER_TOOL_HINT)).toHaveCount(2)
      await field(page, 'Tint').focus()
      await page.keyboard.press('c') // typed into the field: no hint
      await expect(toasts(page, OTHER_TOOL_HINT)).toHaveCount(2)
      await expect(cropTool(page)).toHaveCount(0)
      await expect(tool(page)).toBeVisible()
    })

    test('Adjust and A say to apply or cancel Crop and rotate first', async ({ page }) => {
      await cropAction(page).click()
      await expect(cropTool(page)).toBeVisible()
      await action(page).click({ force: true })
      await expect(toast(page, OTHER_TOOL_HINT)).toBeVisible()
      await page.getByTestId('crop-frame').focus()
      await page.keyboard.press('a')
      await expect(toasts(page, OTHER_TOOL_HINT)).toHaveCount(2)
      await page.getByRole('textbox', { name: 'Width' }).focus()
      await page.keyboard.press('a')
      await expect(toasts(page, OTHER_TOOL_HINT)).toHaveCount(2)
      await expect(tool(page)).toHaveCount(0)
    })

    test('Crop and rotate shows the adjusted image and a Geometry keeps the Adjustments', async ({
      page,
      browserName,
    }) => {
      const applied = adjusted({ grayscale: 100, contrast: 20 })
      await applyAdjustments(page, applied)
      await page.evaluate(() =>
        window.__imglyTest!.setGeometry({
          flipH: false,
          flipV: false,
          rotation: 0,
          straighten: 0,
          crop: { x: 80, y: 60, width: 160, height: 120 },
        }),
      )
      await cropAction(page).click()
      await expect(cropTool(page)).toBeVisible()

      if (browserName === 'chromium') {
        // Pixel read on Chromium only, as crop-rotate does for the WebGL canvas: across the frame's
        // left edge, inside and outside it (skipping the frame's own border), the whole turned image
        // is grey (grayscale 100%).
        const frame = (await page.getByTestId('crop-frame').boundingBox())!
        const strip = await pixelsAt(page, {
          x: Math.round(frame.x - 30),
          y: Math.round(frame.y + frame.height / 2),
          width: 60,
          height: 1,
        })
        const coloured: string[] = []
        for (let i = 0; i < strip.data.length; i += 4) {
          if (Math.abs(i / 4 - 30) <= 8) continue // the frame's own border and handles
          const [r, g, b] = strip.data.slice(i, i + 3)
          if (Math.max(r!, g!, b!) - Math.min(r!, g!, b!) > 6)
            coloured.push(`${i / 4}: ${r},${g},${b}`)
        }
        expect(coloured).toEqual([])
      }

      await page.getByRole('button', { name: 'Rotate right' }).click()
      await page.getByRole('button', { name: 'Apply' }).click()
      await expect(cropTool(page)).toBeHidden()
      expect((await work(page))!).toMatchObject({
        geometry: { rotation: 90 },
        adjustments: applied,
      })
    })
  })

  test.describe('AC-17 — another image while the tool is open', () => {
    test('with no Unsaved edits the new image replaces the Work, neutral, and the tool closes', async ({
      page,
    }) => {
      await openTool(page)
      await setField(page, 'Brightness', '40')
      await dropGeneratedImage(page, { width: 120, height: 90 })
      await waitForWork(page, 120, 90)
      await expect(tool(page)).toBeHidden()
      expect((await work(page))!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
    })

    test('a file that cannot be read leaves the tool and its Draft as they were', async ({
      page,
    }) => {
      await openTool(page)
      await setField(page, 'Brightness', '40')
      await dropBytes(page, 'corrupt.png', fixture('corrupt.png'), 'image/png')
      await expect(page.getByRole('alert').first()).toBeVisible()
      await expect(tool(page)).toBeVisible()
      await expect(field(page, 'Brightness')).toHaveValue('40')
    })

    test('with Unsaved edits: declining keeps the Draft, confirming closes the tool', async ({
      page,
    }) => {
      await applyAdjustments(page, adjusted({ tint: 10 }))
      await openTool(page)
      await setField(page, 'Saturation', '-30')
      await dropGeneratedImage(page, { width: 120, height: 90 })
      await expect(replaceDialog(page)).toBeVisible()
      await expect(tool(page)).toBeVisible()
      await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()
      await expect(tool(page)).toBeVisible()
      await expect(field(page, 'Saturation')).toHaveValue('-30')

      await dropGeneratedImage(page, { width: 120, height: 90 })
      await replaceDialog(page).getByRole('button', { name: 'Replace' }).click()
      await waitForWork(page, 120, 90)
      await expect(tool(page)).toBeHidden()
      expect((await work(page))!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
    })
  })

  test('AC-20 — the View is kept on open, works inside, and stays after Apply and Cancel', async ({
    page,
  }) => {
    await page.keyboard.press('Shift+1') // 100%
    await page.keyboard.press('+')
    const zoomed = await view(page)
    expect(zoomed.zoom).toBeGreaterThan(1)

    await openTool(page)
    expect(await view(page)).toMatchObject({ zoom: zoomed.zoom })
    await setField(page, 'Contrast', '25')
    await slider(page, 'Contrast').focus()
    await page.keyboard.press('-')
    const inside = await view(page)
    expect(inside.zoom).toBeLessThan(zoomed.zoom)
    await expect(field(page, 'Contrast')).toHaveValue('25')
    expect((await work(page))!.hasUnsavedEdits).toBe(false)

    await page.keyboard.press('Escape')
    await expect(tool(page)).toBeHidden()
    expect((await view(page)).zoom).toBe(inside.zoom)

    await openTool(page)
    await apply(page)
    expect((await view(page)).zoom).toBe(inside.zoom)
    // The Preview shows the Crop only: the View's image is the Work's size.
    expect((await work(page))!).toMatchObject({ width: 320, height: 240 })
  })
})

test('AC-14 — a semi-transparent Crop shows the JPEG hint as it did without Adjustments', async ({
  page,
}) => {
  await gotoReady(page)
  // Alpha ramps from 0 at x = 0 to 255 at x = 63; the Crop keeps the semi-transparent left half.
  await openFile(
    page,
    'clear.png',
    await generateImage(page, { width: 64, height: 48, alpha: true }),
  )
  await waitForWork(page, 64, 48)
  await page.evaluate(() =>
    window.__imglyTest!.setGeometry({
      flipH: false,
      flipV: false,
      rotation: 0,
      straighten: 0,
      crop: { x: 0, y: 0, width: 32, height: 48 },
    }),
  )
  await waitForWork(page, 32, 48)
  const hint = panel(page).getByText('JPEG has no transparency')

  await choose(page)
  await expect(panel(page).getByRole('radio', { name: 'JPEG', exact: true })).toBeEnabled({
    timeout: 15_000,
  })
  await choose(page, { format: 'JPEG' })
  await expect(hint).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel(page)).toBeHidden()

  await applyAdjustments(page, adjusted({ brightness: 30, sepia: 60 }))
  await choose(page)
  await expect(panel(page).getByRole('radio', { name: 'JPEG', exact: true })).toBeChecked()
  await expect(hint).toBeVisible()
})

test('AC-19 — with no image, "Adjust" and A only show the hint', async ({ page }) => {
  await gotoReady(page)
  await action(page).click({ force: true })
  await expect(toast(page, NO_IMAGE_HINT)).toBeVisible()
  await page.keyboard.press('a')
  await expect(toasts(page, NO_IMAGE_HINT)).toHaveCount(2)
  await expect(tool(page)).toHaveCount(0)
})

// AC-15 (no open during an export) is narrowed on purpose (test-plan): an export in a real browser
// is too short to aim a key press at, so the store, shortcut and component tests hold it.
