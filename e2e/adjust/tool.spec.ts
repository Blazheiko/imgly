import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { view } from '../export/helpers'
import {
  action,
  before,
  decodePng,
  field,
  gotoReady,
  openNamed,
  openPixels,
  openTool,
  slider,
  tabTo,
  tool,
  work,
} from './helpers'

// ux-flows F1–F5 in a real browser: what happy-dom can't show (the rendered Preview, real pointer
// drags and held keys, Auto on real sampled pixels). The logic itself is unit-tested (T12–T16).

/**
 * A 64×64 patch at the canvas centre, as the screen shows it (straight RGBA). The image sits at the
 * centre at Fit with the tool open or closed, and a small patch keeps decoding fast.
 */
async function shot(page: Page) {
  const box = (await page.getByTestId('preview-canvas').boundingBox())!
  const clip = {
    x: Math.round(box.x + box.width / 2 - 32),
    y: Math.round(box.y + box.height / 2 - 32),
    width: 64,
    height: 64,
  }
  return (await decodePng(page, await page.screenshot({ clip }))).data
}

const mean = (data: number[]) => {
  let sum = 0
  for (let i = 0; i < data.length; i += 4) sum += data[i]! + data[i + 1]! + data[i + 2]!
  return sum / ((data.length / 4) * 3)
}

/** The largest per-channel difference between two screenshots. */
const maxDiff = (a: number[], b: number[]) =>
  a.reduce((m, v, i) => Math.max(m, Math.abs(v - b[i]!)), 0)

/** The four values Auto sets, read from the fields. */
async function autoFields(page: Page) {
  const read = async (name: string) => Number(await field(page, name).inputValue())
  return {
    brightness: await read('Brightness'),
    contrast: await read('Contrast'),
    temperature: await read('Temperature'),
    tint: await read('Tint'),
  }
}

async function openPhoto(page: Page) {
  await gotoReady(page)
  await openNamed(page, 'photo.png', 320, 240)
}

test.describe('AC-01, AC-21 — three actions by mouse', () => {
  test('Adjust, drag brightness, Apply gives a lighter Work', async ({ page }) => {
    await openPhoto(page)
    const start = await shot(page)

    await action(page).click()
    await expect(tool(page)).toBeVisible()
    const box = (await slider(page, 'Brightness').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.66, box.y + box.height / 2, { steps: 8 })
    await page.mouse.up()
    const value = Number(await field(page, 'Brightness').inputValue())
    expect(value).toBeGreaterThan(0)
    const dragged = await shot(page)
    expect(mean(dragged)).toBeGreaterThan(mean(start) + 1) // the Preview follows the drag

    await page.getByRole('button', { name: 'Apply' }).click()
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!).toMatchObject({
      adjustments: { brightness: value },
      hasUnsavedEdits: true,
    })
    expect(maxDiff(await shot(page), dragged)).toBeLessThanOrEqual(1)
  })

  test('A, Auto, Apply gives an auto-adjusted Work, and Auto again changes nothing', async ({
    page,
  }) => {
    await openPhoto(page)
    await page.keyboard.press('a')
    await expect(tool(page)).toBeVisible()
    await page.getByRole('button', { name: 'Auto' }).click()
    const values = await autoFields(page)
    for (const v of Object.values(values)) {
      expect(Number.isInteger(v)).toBe(true)
      expect(Math.abs(v)).toBeLessThanOrEqual(50)
    }
    expect(Object.values(values).some((v) => v !== 0)).toBe(true)
    for (const name of ['Saturation', 'Grayscale', 'Sepia']) {
      await expect(field(page, name)).toHaveValue('0')
    }
    await page.getByRole('button', { name: 'Apply' }).click()
    expect((await work(page))!.adjustments).toMatchObject(values)

    // Replace, not add (AC-12): reopening shows the applied values, and Auto gives them again.
    await openTool(page)
    await page.getByRole('button', { name: 'Auto' }).click()
    expect(await autoFields(page)).toEqual(values)
  })
})

test.describe('AC-13 — Auto agrees within 1 across engines', () => {
  const expectations = fileURLToPath(new URL('./auto-expected.json', import.meta.url))
  const expected = JSON.parse(readFileSync(expectations, 'utf8')) as Record<
    string,
    Record<string, number>
  >
  const FIXTURES: [string, number, number][] = [
    ['photo.png', 320, 240],
    ['ref.png', 48, 32],
  ]

  for (const [name, width, height] of FIXTURES) {
    test(name, async ({ page, browserName }) => {
      await gotoReady(page)
      await openNamed(page, name, width, height)
      await page.keyboard.press('a')
      await page.getByRole('button', { name: 'Auto' }).click()
      const values = await autoFields(page)
      test.info().annotations.push({ type: browserName, description: JSON.stringify(values) })
      // UPDATE_AUTO_EXPECTED=1 on Chromium rewrites the checked-in expectation.
      if (process.env.UPDATE_AUTO_EXPECTED && browserName === 'chromium') {
        const current = JSON.parse(readFileSync(expectations, 'utf8')) as typeof expected
        writeFileSync(expectations, JSON.stringify({ ...current, [name]: values }, null, 2) + '\n')
        return
      }
      for (const [key, want] of Object.entries(expected[name]!)) {
        expect(
          Math.abs(values[key as keyof typeof values] - want),
          `${name} ${key}`,
        ).toBeLessThanOrEqual(1)
      }
    })
  }

  test('a one-colour image says there is nothing to correct', async ({ page }) => {
    await gotoReady(page)
    await openPixels(page, 40, 30, () => [90, 140, 200, 255])
    await page.keyboard.press('a')
    await page.getByRole('button', { name: 'Auto' }).click()
    await expect(
      page.getByRole('status').filter({ hasText: 'Nothing to correct automatically.' }),
    ).toBeVisible()
    expect(await autoFields(page)).toEqual({ brightness: 0, contrast: 0, temperature: 0, tint: 0 })
  })
})

test.describe('AC-08 — Compare shows the Work before adjusting', () => {
  async function openAdjusted(page: Page) {
    await openPhoto(page)
    const plain = await shot(page)
    await openTool(page)
    await field(page, 'Contrast').fill('60')
    await field(page, 'Contrast').press('Enter')
    await field(page, 'Sepia').fill('80')
    await field(page, 'Sepia').press('Enter')
    const drafted = await shot(page)
    expect(maxDiff(drafted, plain)).toBeGreaterThan(10)
    return { plain, drafted }
  }

  async function expectHeld(page: Page, plain: number[]) {
    await expect(before(page)).toHaveText('Before')
    expect(maxDiff(await shot(page), plain)).toBeLessThanOrEqual(1)
  }

  async function expectReleased(page: Page, drafted: number[]) {
    await expect(before(page)).toBeHidden()
    expect(maxDiff(await shot(page), drafted)).toBeLessThanOrEqual(1)
  }

  test('by the mouse', async ({ page }) => {
    const { plain, drafted } = await openAdjusted(page)
    const compare = page.getByRole('button', { name: 'Compare' })
    const box = (await compare.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await expect(compare).toHaveAttribute('aria-pressed', 'true')
    await expectHeld(page, plain)
    await page.mouse.up()
    await expectReleased(page, drafted)
  })

  for (const key of ['Space', 'Enter']) {
    test(`by ${key} on the focused button, without applying the tool`, async ({ page }) => {
      const { plain, drafted } = await openAdjusted(page)
      await page.getByRole('button', { name: 'Compare' }).focus()
      await page.keyboard.down(key)
      await expectHeld(page, plain)
      await page.keyboard.up(key)
      await expectReleased(page, drafted)
      await expect(tool(page)).toBeVisible()
    })
  }

  test('by the held \\ key, and not while typing in a field', async ({ page }) => {
    const { plain, drafted } = await openAdjusted(page)
    await slider(page, 'Tint').focus()
    await page.keyboard.down('Backslash')
    await expectHeld(page, plain)
    await page.keyboard.up('Backslash')
    await expectReleased(page, drafted)

    await field(page, 'Tint').focus()
    await page.keyboard.down('Backslash')
    await expect(before(page)).toBeHidden()
    await page.keyboard.up('Backslash')
  })

  test('ends when the window loses focus, and never changes the Work', async ({ page }) => {
    const { drafted } = await openAdjusted(page)
    await slider(page, 'Tint').focus()
    await page.keyboard.down('Backslash')
    await expect(before(page)).toBeVisible()
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expectReleased(page, drafted)
    await page.keyboard.up('Backslash')
    expect((await work(page))!).toMatchObject({ revision: 0, hasUnsavedEdits: false })
  })
})

test.describe('AC-05, AC-09, AC-10 — fields, Cancel and resets', () => {
  test('Escape shows the Work as before and leaves no Unsaved edits', async ({ page }) => {
    await openPhoto(page)
    const plain = await shot(page)
    await openTool(page)
    await slider(page, 'Saturation').fill('-80')
    expect(maxDiff(await shot(page), plain)).toBeGreaterThan(5)
    await page.keyboard.press('Escape')
    await expect(tool(page)).toBeHidden()
    expect(maxDiff(await shot(page), plain)).toBeLessThanOrEqual(1)
    expect((await work(page))!.hasUnsavedEdits).toBe(false)
  })

  test('double-clicking a slider resets it and the Preview follows', async ({ page }) => {
    await openPhoto(page)
    const plain = await shot(page)
    await openTool(page)
    await field(page, 'Temperature').fill('70')
    await field(page, 'Temperature').press('Enter')
    await slider(page, 'Temperature').dblclick()
    await expect(field(page, 'Temperature')).toHaveValue('0')
    expect(maxDiff(await shot(page), plain)).toBeLessThanOrEqual(1)
  })

  test('typed values snap, round and revert by the AC-05 rule; Enter never applies', async ({
    page,
  }) => {
    await openPhoto(page)
    await openTool(page)
    await field(page, 'Contrast').fill('150')
    await field(page, 'Contrast').press('Tab')
    await expect(field(page, 'Contrast')).toHaveValue('100')
    await field(page, 'Sepia').fill('60%')
    await field(page, 'Sepia').press('Enter')
    await expect(field(page, 'Sepia')).toHaveValue('60')
    await field(page, 'Brightness').fill('-2.5')
    await field(page, 'Brightness').press('Enter')
    await expect(field(page, 'Brightness')).toHaveValue('-2')
    await field(page, 'Tint').fill('1e2')
    await field(page, 'Tint').press('Enter')
    await expect(field(page, 'Tint')).toHaveValue('0')
    await expect(tool(page)).toBeVisible()
  })
})

test.describe('AC-21 — keyboard alone', () => {
  test('A, arrows by one and by ten, Enter applies', async ({ page }) => {
    await openPhoto(page)
    await page.keyboard.press('a')
    await expect(slider(page, 'Brightness')).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Shift+ArrowRight')
    await expect(field(page, 'Brightness')).toHaveValue('13')
    await page.keyboard.press('Enter')
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!.adjustments.brightness).toBe(13)
    await expect(action(page)).toBeFocused()
  })

  test('Tab to Auto and Apply; Space presses them instead of panning', async ({ page }) => {
    await openPhoto(page)
    await action(page).focus()
    await page.keyboard.press('Enter')
    await expect(slider(page, 'Brightness')).toBeFocused()
    // Each slider and its field, then Compare, then Auto.
    await tabTo(page, page.getByRole('button', { name: 'Auto' }))
    const start = await view(page)
    await page.keyboard.press('Space')
    const values = await autoFields(page)
    expect(Object.values(values).some((v) => v !== 0)).toBe(true)
    expect(await view(page)).toEqual(start) // Space pressed Auto; it never started space-pan
    await tabTo(page, page.getByRole('button', { name: 'Apply' }))
    await page.keyboard.press('Space')
    await expect(tool(page)).toBeHidden()
    expect((await work(page))!.adjustments).toMatchObject(values)
  })
})
