import { expect, type Page } from '@playwright/test'
import { choose, panel } from '../export/helpers'
import {
  decodePng,
  diff,
  exportPng,
  fixture,
  gotoReady,
  openFile,
  openNamed,
  previewAt100,
  waitForWork,
  work,
} from '../adjust/helpers'

export { choose, decodePng, diff, exportPng, fixture, gotoReady, openFile, openNamed, panel }
export { previewAt100, waitForWork, work }

/** The draw tool, its action and its controls. */
export const tool = (page: Page) => page.getByTestId('draw-tool')
export const action = (page: Page) => page.getByTestId('draw-action')
export const overlay = (page: Page) => page.getByTestId('draw-overlay')
export const button = (page: Page, name: 'Clear' | 'Cancel' | 'Apply') =>
  tool(page).getByRole('button', { name, exact: true })
export const widthField = (page: Page) =>
  tool(page).getByRole('textbox', { name: 'Width', exact: true })

/** Opens the tool with its action and waits for the mode group to take focus on "Brush". */
export async function openTool(page: Page) {
  await action(page).click()
  await expect(tool(page)).toBeVisible()
  await expect(tool(page).getByRole('radio', { name: 'Brush' })).toBeFocused()
}

/** Types a width and commits it with Enter (AC-03). */
export async function setWidth(page: Page, width: number | string) {
  await widthField(page).fill(String(width))
  await widthField(page).press('Enter')
}

/** Applies the reference drawing directly, as the tool's Apply does (sad.md §8 Test hooks). */
export async function referenceDrawing(page: Page) {
  await page.evaluate(() => window.__imglyTest!.setReferenceDrawing())
  await expect
    .poll(() => page.evaluate(() => window.__imglyTest!.drawingAlpha().length))
    .toBeGreaterThan(0)
}

/** The CSS-pixel point on the page of an image pixel (x, y) of the Work as the View shows it. */
export async function screenPoint(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('preview-canvas').boundingBox())!
  const { zoom, panX, panY } = await page.evaluate(() => window.__imglyTest!.view())
  const dpr = await page.evaluate(() => devicePixelRatio)
  return {
    x: box.x + (Math.round(panX) + (x + 0.5) * zoom) / dpr,
    y: box.y + (Math.round(panY) + (y + 0.5) * zoom) / dpr,
  }
}

/** A drag through image pixels with the main button, one mouse move per point. */
export async function drag(page: Page, points: [number, number][]) {
  const first = await screenPoint(page, points[0]![0], points[0]![1])
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  for (const [x, y] of points.slice(1)) {
    const p = await screenPoint(page, x, y)
    await page.mouse.move(p.x, p.y)
  }
  await page.mouse.up()
}

/** A click without movement at an image pixel. */
export async function click(page: Page, x: number, y: number) {
  await drag(page, [[x, y]])
}

/** The Drawing-layer alpha mask, dilated by `by` pixels: true where a mark may lie. */
export function dilatedMask(alpha: number[], width: number, height: number, by: number) {
  const mask = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] === 0) continue
      for (let dy = -by; dy <= by; dy++) {
        for (let dx = -by; dx <= by; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) mask[ny * width + nx] = 1
        }
      }
    }
  }
  return mask
}

/** Pixels (straight RGBA) that differ between two images outside `mask`. */
export function changedOutside(a: ArrayLike<number>, b: ArrayLike<number>, mask: Uint8Array) {
  let changed = 0
  for (let p = 0; p < mask.length; p++) {
    if (mask[p]) continue
    for (let c = 0; c < 4; c++) if (a[p * 4 + c] !== b[p * 4 + c]) changed++
  }
  return changed
}

/** Opens the export panel on JPEG and waits for the format check. */
export async function jpegPanel(page: Page) {
  await choose(page)
  await expect(panel(page).getByRole('radio', { name: 'JPEG', exact: true })).toBeEnabled({
    timeout: 15_000,
  })
  await choose(page, { format: 'JPEG' })
}

export const TRANSPARENCY_HINT = 'JPEG has no transparency'

export { openPixels } from '../adjust/helpers'

export const drawingAlpha = (page: Page) => page.evaluate(() => window.__imglyTest!.drawingAlpha())
export const draftAlpha = (page: Page) => page.evaluate(() => window.__imglyTest!.draftAlpha())
export const layers = (page: Page) => page.evaluate(() => window.__imglyTest!.layers())
export const view = (page: Page) => page.evaluate(() => window.__imglyTest!.view())

/** Opens a plain white opaque image of the given size. */
export async function openWhite(page: Page, width: number, height: number) {
  const { openPixels } = await import('../adjust/helpers')
  await openPixels(page, width, height, () => [255, 255, 255, 255])
}

/** Moves focus off the control that has it, to the page itself. */
export const leaveField = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())

/** How many pixels of the Draft have some alpha, counted in the page. */
export const draftMarks = (page: Page) =>
  page.evaluate(() => window.__imglyTest!.draftAlpha().filter((v) => v > 0).length)
