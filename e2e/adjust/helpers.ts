import { expect, test, type Locator, type Page } from '@playwright/test'
import { NEUTRAL_ADJUSTMENTS, type Adjustments } from '../../src/core/adjust'
import {
  choose,
  confirmAndCapture,
  expectSaved,
  fixture,
  gotoReady,
  openFile,
  prepareCapture,
  waitForWork,
  work,
} from '../export/helpers'
import { decodePng } from '../crop-rotate/helpers'

export { decodePng, fixture, gotoReady, openFile, waitForWork, work }
export { NEUTRAL_ADJUSTMENTS, type Adjustments }

export const adjusted = (over: Partial<Adjustments>): Adjustments => ({
  ...NEUTRAL_ADJUSTMENTS,
  ...over,
})

/** Applies Adjustments directly, as the tool's Apply does (sad.md §8 Test hooks). */
export async function applyAdjustments(page: Page, a: Adjustments) {
  await page.evaluate((next) => window.__imglyTest!.setAdjustments(next), a)
  await expect.poll(() => page.evaluate(() => window.__imglyTest!.work()!.adjustments)).toEqual(a)
}

/** Opens a committed fixture through "Open image" and waits for it to be the Work. */
export async function openNamed(page: Page, name: string, width: number, height: number) {
  await openFile(page, name, fixture(name), 'image/png')
  await waitForWork(page, width, height)
}

/** Exports a PNG through the panel, at full size unless a preset is given, and returns its file. */
export async function exportPng(page: Page, browserName: string, preset = '100%') {
  await prepareCapture(page, browserName)
  await choose(page, { format: 'PNG', preset })
  const file = await confirmAndCapture(page, browserName)
  await expectSaved(page)
  return file.bytes
}

/** The Preview's own rendering at 100%, straight RGBA, with the Work's Adjustments. */
export const previewAt100 = (page: Page) => page.evaluate(() => window.__imglyTest!.previewAt100())

export interface Diff {
  /** The largest alpha difference over all pixels. */
  alpha: number
  /** The largest colour difference over pixels whose alpha is at least `minAlpha` in both. */
  colour: number
  where: string
}

/**
 * Two straight-RGBA images of one size compared pixel by pixel: alpha everywhere, colour only
 * where both alphas are at least `minAlpha` (below it the stored colour carries too few bits to
 * judge, test-plan §Decisions).
 */
export function diff(a: ArrayLike<number>, b: ArrayLike<number>, width: number, minAlpha = 1) {
  expect(a.length).toBe(b.length)
  const out: Diff = { alpha: 0, colour: 0, where: '' }
  for (let i = 0; i < a.length; i += 4) {
    out.alpha = Math.max(out.alpha, Math.abs(a[i + 3]! - b[i + 3]!))
    if (a[i + 3]! < minAlpha || b[i + 3]! < minAlpha) continue
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i + c]! - b[i + c]!)
      if (d > out.colour) {
        out.colour = d
        const p = i / 4
        out.where = `(${p % width},${Math.floor(p / width)}) ${Array.from({ length: 4 }, (_, k) => a[i + k])} vs ${Array.from({ length: 4 }, (_, k) => b[i + k])}`
      }
    }
  }
  return out
}

/** Export's per-engine colour limit for semi-transparent pixels (export ADR-0003). */
export const semiTransparentLimit = (browserName: string) =>
  browserName === 'webkit' && process.platform === 'linux' ? 3 : 2

/** The tool, its action and its controls. */
export const tool = (page: Page) => page.getByTestId('adjust-tool')
export const action = (page: Page) => page.getByTestId('adjust-action')
export const slider = (page: Page, name: string) => page.getByRole('slider', { name, exact: true })
export const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true })
export const before = (page: Page) => page.getByTestId('adjust-before')

/** Opens the tool with its action and waits for the brightness slider to take focus. */
export async function openTool(page: Page) {
  await action(page).click()
  await expect(tool(page)).toBeVisible()
  await expect(slider(page, 'Brightness')).toBeFocused()
}

/** Opens an image built in the page from straight RGBA rows, as a PNG. */
export async function openPixels(
  page: Page,
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number],
) {
  const base64 = await page.evaluate(
    async ({ width, height, src }) => {
      const pixel = new Function(`return ${src}`)() as (x: number, y: number) => number[]
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')!
      const img = ctx.createImageData(width, height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) img.data.set(pixel(x, y), (y * width + x) * 4)
      }
      ctx.putImageData(img, 0, 0)
      const bytes = new Uint8Array(
        await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer(),
      )
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    },
    { width, height, src: pixel.toString() },
  )
  await openFile(page, 'pixels.png', Buffer.from(base64, 'base64'), 'image/png')
  await waitForWork(page, width, height)
}

/**
 * Presses Tab until `target` has focus, as a keyboard user would. WebKit, like Safari by default,
 * tabs only to text fields; Option+Tab reaches every control (as crop-rotate's suite does).
 */
export async function tabTo(page: Page, target: Locator) {
  const tab = test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab'
  for (let i = 0; i < 40; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return
    await page.keyboard.press(tab)
  }
  throw new Error('Tab never reached the control')
}
