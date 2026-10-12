import { expect, type Page } from '@playwright/test'
import { gotoReady, waitForWork, work } from '../export/helpers'

export { gotoReady, waitForWork, work }

/** The reference Work (spec §6). */
export const REFERENCE = { width: 4096, height: 3072 }
/** One Drawing layer of the reference Work: width × height × 4 bytes. */
export const REFERENCE_LAYER_BYTES = REFERENCE.width * REFERENCE.height * 4

/** Opens a generated gradient JPEG of `size` by drop and waits for it to be the Work. */
export async function openGenerated(page: Page, size = REFERENCE, name = 'reference.jpg') {
  await page.evaluate(
    async ({ width, height, name }) => {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')!
      const g = ctx.createLinearGradient(0, 0, width, height)
      g.addColorStop(0, '#203060')
      g.addColorStop(1, '#e0a040')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
      const dt = new DataTransfer()
      dt.items.add(new File([blob], name, { type: 'image/jpeg' }))
      for (const type of ['dragenter', 'dragover', 'drop']) {
        document.body.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
      }
    },
    { ...size, name },
  )
}

/** Opens the reference Work into an empty editor. */
export async function openReference(page: Page) {
  await gotoReady(page)
  await openGenerated(page)
  await waitForWork(page, REFERENCE.width, REFERENCE.height)
}

/** Applies `count` new drawings over the whole image, each one a Step (spec §6). */
export async function drawSteps(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    const before = (await work(page))!.revision
    await page.evaluate(() => window.__imglyTest!.setFullDrawing())
    await expect.poll(async () => (await work(page))!.revision).toBeGreaterThan(before)
  }
}

export const historyStats = (page: Page) => page.evaluate(() => window.__imglyTest!.historyStats())

export const layers = (page: Page) => page.evaluate(() => window.__imglyTest!.layers())

export const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true })
export const redoButton = (page: Page) => page.getByRole('button', { name: 'Redo', exact: true })

/** Undo by its shortcut, waiting for the Work's revision to change; false when nothing moved. */
export async function undoByKey(page: Page, key = 'ControlOrMeta+z'): Promise<boolean> {
  const before = (await work(page))!.revision
  await page.locator('body').press(key)
  try {
    await expect.poll(async () => (await work(page))!.revision, { timeout: 2_000 }).not.toBe(before)
    return true
  } catch {
    return false
  }
}

/** How many Undos in a row succeed by the shortcut. */
export async function countUndos(page: Page) {
  let n = 0
  while (
    await undoButton(page)
      .getAttribute('aria-disabled')
      .then((v) => v !== 'true')
  ) {
    expect(await undoByKey(page)).toBe(true)
    n++
  }
  return n
}
