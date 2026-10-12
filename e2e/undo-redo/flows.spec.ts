/**
 * Undo and Redo through the real UI on each engine: the View rule (AC-12), the shortcuts and
 * keyboard reach (AC-14, sad §11 shortcut collisions), and a text field's own undo (AC-08).
 */
import { expect, test, type Page } from '@playwright/test'
import { dropGeneratedImage, view } from '../open-and-view/helpers'
import { exportAction, panel } from '../export/helpers'
import { gotoReady, redoButton, undoButton, waitForWork, work } from './helpers'

const SIZE = { width: 2000, height: 1500 }

async function revisionAfter(page: Page, act: () => Promise<unknown>) {
  const before = (await work(page))!.revision
  await act()
  await expect.poll(async () => (await work(page))!.revision).not.toBe(before)
  return (await work(page))!.revision
}

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
