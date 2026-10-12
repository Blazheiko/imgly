/**
 * Undo and Redo through the real UI on each engine: the View rule (AC-12), the shortcuts and
 * keyboard reach (AC-14, sad §11 shortcut collisions), a text field's own undo (AC-08), what adds
 * no Step (AC-06), the refusals during an export and with Draw open (AC-07, AC-08), and the save
 * point (AC-09).
 */
import { expect, test, type Page } from '@playwright/test'
import { dropGeneratedImage, view } from '../open-and-view/helpers'
import { exportPng } from '../adjust/helpers'
import { choose, exportAction, expectSaved, panel, stubSaveFilePicker } from '../export/helpers'
import { drag, draftAlpha, drawingAlpha } from '../draw/helpers'
import { gotoReady, historyStats, redoButton, undoButton, waitForWork, work } from './helpers'

const SIZE = { width: 2000, height: 1500 }

async function revisionAfter(page: Page, act: () => Promise<unknown>) {
  const before = (await work(page))!.revision
  await act()
  await expect.poll(async () => (await work(page))!.revision).not.toBe(before)
  return (await work(page))!.revision
}

const INFO_TOOL_OPEN = 'Apply or cancel the open tool first.'
const INFO_EXPORTING = 'An export is in progress. Undo and Redo work again when it ends.'
/** The info toasts with this text (not the buttons' hidden hints, which say the same). */
const toast = (page: Page, text: string) =>
  page.getByRole('status').filter({ hasText: text }).first()
const body = (page: Page) => page.locator('body')

const adjust = (page: Page, brightness: number) =>
  revisionAfter(page, () =>
    page.evaluate(
      (b) =>
        window.__imglyTest!.setAdjustments({
          brightness: b,
          contrast: 0,
          saturation: 0,
          temperature: 0,
          tint: 0,
          grayscale: 0,
          sepia: 0,
        }),
      brightness,
    ),
  )

test.beforeEach(async ({ page }) => {
  await gotoReady(page)
  await dropGeneratedImage(page, SIZE)
  await waitForWork(page, SIZE.width, SIZE.height)
})

test.describe('the View (AC-12)', () => {
  test('an Undo of a size-changing Crop fits the View again', async ({ page }) => {
    const fitted = await view(page)
    await revisionAfter(page, () =>
      page.evaluate((g) => window.__imglyTest!.setGeometry(g), {
        flipH: false,
        flipV: false,
        rotation: 0 as const,
        straighten: 0,
        crop: { x: 0, y: 0, width: 1000, height: 750 },
      }),
    )
    await page.locator('body').press('Shift+Digit0') // 100%: zoomed in
    expect((await view(page)).autoFit).toBe(false)
    await revisionAfter(page, () => undoButton(page).click())
    await expect.poll(() => view(page)).toEqual(fitted)
  })

  test('an Undo or Redo that keeps the size keeps the View', async ({ page }) => {
    await adjust(page, 20)
    await page.locator('body').press('Shift+Digit0')
    const zoomed = await view(page)
    await revisionAfter(page, () => undoButton(page).click())
    expect(await view(page)).toEqual(zoomed)
    await revisionAfter(page, () => redoButton(page).click())
    expect(await view(page)).toEqual(zoomed)
  })
})

test.describe('shortcuts and keyboard (AC-14)', () => {
  for (const mod of ['Control', 'Meta']) {
    test(`${mod}+Z undoes, Shift+${mod}+Z redoes`, async ({ page }) => {
      const first = await adjust(page, 10)
      await adjust(page, 20)
      expect(await revisionAfter(page, () => page.locator('body').press(`${mod}+z`))).toBe(first)
      await expect(redoButton(page)).not.toHaveAttribute('aria-disabled', 'true')
      await expect(redoButton(page)).toHaveAttribute('title', 'Redo Adjust (Shift+Ctrl/Cmd+Z)')
      expect(await revisionAfter(page, () => page.locator('body').press(`Shift+${mod}+z`))).toBe(
        first + 1,
      )
    })
  }

  test('Ctrl+Y redoes; Cmd+Y never touches the Edit history', async ({ page }) => {
    const first = await adjust(page, 10)
    await revisionAfter(page, () => page.locator('body').press('Control+z'))
    await page.locator('body').press('Meta+y')
    await page.waitForTimeout(300)
    expect((await work(page))!.revision).toBe(0)
    expect(await revisionAfter(page, () => page.locator('body').press('Control+y'))).toBe(first)
  })

  test('Undo is reached by Tab after "Open image" and used with Enter', async ({ page }) => {
    await adjust(page, 10)
    await page.getByRole('button', { name: 'Open image' }).focus()
    // WebKit's Tab reaches buttons only with Alt (Safari's "Press Tab to highlight" off).
    await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
    await expect(undoButton(page)).toBeFocused()
    await revisionAfter(page, () => page.keyboard.press('Enter'))
    expect((await work(page))!.revision).toBe(0)
    await expect(undoButton(page)).toBeFocused()
    await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab')
    await expect(redoButton(page)).toBeFocused()
    await revisionAfter(page, () => page.keyboard.press('Space'))
    expect((await work(page))!.adjustments.brightness).toBe(10)
  })

  test('Ctrl/Cmd+Z on a freshly opened image changes nothing and shows no notice (AC-05)', async ({
    page,
  }) => {
    await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
    await body(page).press('ControlOrMeta+z')
    await page.waitForTimeout(300)
    expect((await work(page))!.revision).toBe(0)
    await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(undoButton(page)).toHaveAttribute('title', 'Nothing to undo')
    await expect(page.getByTestId('toast-stack').locator('[role]')).toHaveCount(0)
  })

  test('Ctrl/Cmd+Z in the export panel’s Long side field is the field’s own (AC-08)', async ({
    page,
  }) => {
    const revision = await adjust(page, 10)
    await exportAction(page).click()
    const field = panel(page).getByRole('textbox', { name: 'Long side' })
    await field.fill('1000')
    await field.press('ControlOrMeta+z')
    await page.waitForTimeout(300)
    expect((await work(page))!.revision).toBe(revision)
  })
})

test('Undo after zoom, a cancelled tool, an empty Apply and an Export takes back the last change (AC-06)', async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000)
  await adjust(page, 20)
  await body(page).press('Shift+Digit0') // zoom to 100%
  await page.getByTestId('adjust-action').click()
  await page.getByRole('slider', { name: 'Brightness', exact: true }).fill('-60')
  await page.keyboard.press('Escape') // cancelled
  await expect(page.getByTestId('adjust-tool')).toBeHidden()
  await page.getByTestId('adjust-action').click()
  await page.getByRole('button', { name: 'Apply' }).click() // no change
  await expect(page.getByTestId('adjust-tool')).toBeHidden()
  await exportPng(page, browserName)
  expect((await historyStats(page)).steps).toBe(1)

  const left = await view(page)
  await revisionAfter(page, () => undoButton(page).click())
  expect((await work(page))!.adjustments.brightness).toBe(0)
  expect(await view(page)).toEqual(left)
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
})

test('Ctrl/Cmd+Z with Draw open keeps the strokes; after Apply one Undo takes them back (AC-08)', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.getByTestId('draw-action').click()
  await expect(page.getByTestId('draw-tool')).toBeVisible()
  await drag(page, [
    [200, 200],
    [800, 600],
  ])
  await drag(page, [
    [1200, 300],
    [1600, 1000],
  ])
  const strokes = await draftAlpha(page)
  expect(strokes.some((a) => a > 0)).toBe(true)

  await page.keyboard.press('ControlOrMeta+z')
  await expect(toast(page, INFO_TOOL_OPEN)).toBeVisible()
  expect(await draftAlpha(page)).toEqual(strokes)
  expect((await work(page))!.revision).toBe(0)

  await revisionAfter(page, () =>
    page.getByTestId('draw-tool').getByRole('button', { name: 'Apply', exact: true }).click(),
  )
  expect((await drawingAlpha(page)).some((a) => a > 0)).toBe(true)
  await revisionAfter(page, () => body(page).press('ControlOrMeta+z'))
  expect((await drawingAlpha(page)).some((a) => a > 0)).toBe(false)
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
})

test('opening another image at the save point skips the replace dialog (AC-09)', async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000)
  await adjust(page, 20)
  await exportPng(page, browserName)
  await adjust(page, 40)
  await revisionAfter(page, () => undoButton(page).click())
  expect((await work(page))!.hasUnsavedEdits).toBe(false)

  await dropGeneratedImage(page, { width: 800, height: 600 })
  await waitForWork(page, 800, 600)
  await expect(page.getByRole('alertdialog')).toBeHidden()
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
})

test('Ctrl/Cmd+Z during an export leaves the saved file as confirmed, then works again (AC-07)', async ({
  page,
  browserName,
}) => {
  // Only "Save as…" (Chromium) holds the export open long enough to press a key in it; the
  // downloads of Firefox and WebKit end the export as soon as the file is encoded.
  test.skip(browserName !== 'chromium', 'Needs the "Save as…" dialog to hold the export open')
  test.setTimeout(120_000)
  const revision = await adjust(page, 60)
  await stubSaveFilePicker(page)
  await page.evaluate(() => {
    const w = window as unknown as {
      showSaveFilePicker: (o: unknown) => Promise<unknown>
      __pickerOpen?: boolean
      __closePicker?: () => void
    }
    const stub = w.showSaveFilePicker
    w.showSaveFilePicker = (options) => {
      w.__pickerOpen = true
      return new Promise((resolve) => (w.__closePicker = () => resolve(stub(options))))
    }
  })
  await choose(page, { format: 'PNG', preset: '100%' })
  await panel(page).getByRole('button', { name: 'Export', exact: true }).click()
  await page.waitForFunction(() => (window as unknown as { __pickerOpen?: boolean }).__pickerOpen)

  await body(page).press('ControlOrMeta+z')
  await expect(toast(page, INFO_EXPORTING)).toBeVisible()
  await expect(undoButton(page)).toBeDisabled()
  expect((await work(page))!.revision).toBe(revision)

  await page.evaluate(() => (window as unknown as { __closePicker: () => void }).__closePicker())
  const saved = await page.waitForFunction(
    () => (window as unknown as { __saved?: { base64: string } }).__saved?.base64,
  )
  const confirmed = Buffer.from((await saved.jsonValue()) as string, 'base64')
  await expectSaved(page)

  // One engine encodes the same pixels to the same PNG bytes, so equal bytes are equal pixels.
  await revisionAfter(page, () => body(page).press('ControlOrMeta+z'))
  expect((await work(page))!.adjustments.brightness).toBe(0)
  expect((await exportPng(page, browserName)).equals(confirmed)).toBe(false) // Undo shows
  await revisionAfter(page, () => body(page).press('ControlOrMeta+Shift+z'))
  expect((await exportPng(page, browserName)).equals(confirmed)).toBe(true)
})
