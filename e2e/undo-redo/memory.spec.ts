/**
 * The Edit history's memory (spec §6, AC-04, AC-10, AC-11) on Chromium: the 512 MB budget, the
 * Steps kept, and the bitmap ledger after each way Steps leave the history. The whole-page row is
 * @perf, as export's (PERF=1 pnpm test:e2e e2e/undo-redo/memory.spec.ts --project chromium).
 */
import { expect, test } from '../harness'
import { NO_GALLERY } from '../open-and-view/helpers'
import { settledKiB } from '../perf-memory'
import {
  REFERENCE_LAYER_BYTES,
  countUndos,
  drawSteps,
  historyStats,
  layers,
  openGenerated,
  openReference,
  redoButton,
  undoButton,
  undoByKey,
  waitForWork,
  work,
} from './helpers'

test.skip(({ browserName }) => browserName !== 'chromium', 'The memory checks measure Chrome')

/** Layers the ledger retains beyond the kept Steps' and the Work's own. */
async function strayLayers(page: import('@playwright/test').Page) {
  const { heldBytes } = await historyStats(page)
  const shown = (await page.evaluate(() => window.__imglyTest!.drawingAlpha().length)) > 0 ? 1 : 0
  return (await layers(page)).retained - heldBytes / REFERENCE_LAYER_BYTES - shown
}

test('100 whole-image drawing Applies stay within 512 000 000 B and keep ≥ 10 Undos (AC-11)', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await openReference(page)
  const withinBudget = async () =>
    expect((await historyStats(page)).heldBytes).toBeLessThanOrEqual(512_000_000)
  await drawSteps(page, 100, withinBudget) // after every Apply (spec §6)

  const stats = await historyStats(page)
  expect(stats.steps).toBeGreaterThanOrEqual(10)
  expect(await strayLayers(page)).toBe(0)
  // Undo moves the Work off the newest layer, so the budget must hold at every position too.
  expect(await countUndos(page, withinBudget)).toBe(stats.steps)
  expect(await undoByKey(page)).toBe(false) // past the oldest kept Step (AC-05)
})

test('Undo back to the opened image, which shows no layer, stays within 512 000 000 B (AC-11)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await openReference(page)
  await drawSteps(page, 11)
  // Every Undo moves the Work off a layer; at the opened state all kept layers are the history's.
  const undos = await countUndos(page, async () =>
    expect((await historyStats(page)).heldBytes).toBeLessThanOrEqual(512_000_000),
  )
  expect(undos).toBeGreaterThanOrEqual(10)
  expect(await strayLayers(page)).toBe(0)
})

test.describe('0 retained layers once Steps leave the Edit history (spec §6)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000)
    await openReference(page, { gallery: !test.info().tags.includes(NO_GALLERY) })
    await drawSteps(page, 10)
    expect((await historyStats(page)).steps).toBe(10)
  })

  // Gallery unavailable: replacing always asks for Unsaved edits (gallery AC-12, AC-17)
  test('after replacing the Work (AC-10)', { tag: NO_GALLERY }, async ({ page }) => {
    await openGenerated(page, { width: 800, height: 600 }, 'next.jpg')
    await page.getByRole('button', { name: 'Replace' }).click()
    await waitForWork(page, 800, 600)
    await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(undoButton(page)).toHaveAttribute('title', 'Nothing to undo')
    await expect(redoButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(redoButton(page)).toHaveAttribute('title', 'Nothing to redo')
    expect(await historyStats(page)).toEqual({ heldBytes: 0, steps: 0 })
    expect((await layers(page)).retained).toBe(0)
  })

  // Gallery unavailable: replacing always asks for Unsaved edits (gallery AC-12, AC-17)
  test(
    'a cancelled replace keeps the Work, its history and its layers (AC-10)',
    { tag: NO_GALLERY },
    async ({ page }) => {
      const before = { stats: await historyStats(page), layers: await layers(page) }
      await openGenerated(page, { width: 800, height: 600 }, 'next.jpg')
      await page.getByRole('button', { name: 'Cancel' }).click()
      expect((await work(page))!.width).toBe(4096)
      expect(await historyStats(page)).toEqual(before.stats)
      expect(await layers(page)).toEqual(before.layers)
    },
  )

  test('after a new Step discards the redoable Steps (AC-04)', async ({ page }) => {
    expect(await countUndos(page)).toBe(10) // back to the opened image: every layer is redoable
    await expect(redoButton(page)).not.toHaveAttribute('aria-disabled', 'true')

    await page.getByTestId('adjust-action').click()
    const brightness = page.getByRole('textbox', { name: 'Brightness', exact: true })
    await brightness.fill('10')
    await brightness.press('Enter')
    await page.getByRole('button', { name: 'Apply' }).click()

    await expect.poll(async () => (await historyStats(page)).steps).toBe(1)
    await expect(redoButton(page)).toHaveAttribute('aria-disabled', 'true')
    await expect(redoButton(page)).toHaveAttribute('title', 'Nothing to redo')
    expect((await layers(page)).retained).toBe(0)
    expect(await strayLayers(page)).toBe(0)
  })

  test('after the oldest Steps are dropped (AC-11)', async ({ page }) => {
    await drawSteps(page, 2) // 12 from open: the bound keeps the newest 10
    expect((await historyStats(page)).steps).toBe(10)
    expect((await layers(page)).retained).toBe(11)
    expect(await strayLayers(page)).toBe(0)
  })
})

test('@perf whole-page memory after 100 drawing Applies ≤ after the 10th + 10%', async ({
  page,
}) => {
  test.setTimeout(600_000)
  await openReference(page)
  await drawSteps(page, 10)
  const tenth = await settledKiB(page)
  await drawSteps(page, 90)
  const hundredth = await settledKiB(page)
  console.log(`undo-redo @perf memory: 100th = ${Math.round((hundredth / tenth) * 100)}% of 10th`)
  expect(hundredth / tenth).toBeLessThanOrEqual(1.1)
})
