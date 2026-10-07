import { expect, type Page } from '@playwright/test'
import { identityGeometry, setStraighten, type Geometry } from '../../src/core/geometry'
import {
  choose,
  confirmAndCapture,
  expectSaved,
  gotoReady,
  openFile,
  prepareCapture,
  waitForWork,
  work,
} from '../export/helpers'

export { gotoReady, openFile, waitForWork, work }
export { identityGeometry, setStraighten, type Geometry }

/** A band colour far from anything the gradient below produces (its green is never below 64). */
export const BAND = [255, 0, 255] as const

/**
 * The opaque fixture every pixel test uses (test-plan "opaque fixtures only"): a known formula, so
 * the expected pixel is computed in the test, never read back through the shader. Columns below
 * `band` are painted BAND.
 */
export function pixelOf(x: number, y: number, band = 0): [number, number, number] {
  // Self-contained: it is also sent to the page as source text.
  if (x < band) return [255, 0, 255]
  return [(x * 7 + y * 3) % 256, 64 + ((y * 11 + x) % 192), (x * 5 + 128) % 256]
}

/** Builds the fixture in the page as a PNG and opens it as the Work. */
export async function openFixture(page: Page, width: number, height: number, band = 0) {
  const base64 = await page.evaluate(
    async ({ width, height, band, src }) => {
      const pixelOf = new Function(`return ${src}`)() as (
        x: number,
        y: number,
        band: number,
      ) => number[]
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')!
      const img = ctx.createImageData(width, height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++)
          img.data.set([...pixelOf(x, y, band), 255], (y * width + x) * 4)
      }
      ctx.putImageData(img, 0, 0)
      const bytes = new Uint8Array(
        await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer(),
      )
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    },
    { width, height, band, src: pixelOf.toString() },
  )
  await openFile(page, 'fixture.png', Buffer.from(base64, 'base64'), 'image/png')
  await waitForWork(page, width, height)
}

/**
 * Independent inverse mapping for whole-pixel Geometries (no Straighten angle): which Original
 * pixel the turned-image pixel (tx, ty) shows, by integer index arithmetic only.
 */
export function sourceOf(
  tx: number,
  ty: number,
  g: Pick<Geometry, 'rotation' | 'flipH' | 'flipV'>,
  original: { width: number; height: number },
): [number, number] {
  const { width: W, height: H } = original
  const [fx, fy] = {
    0: [tx, ty],
    90: [ty, H - 1 - tx],
    180: [W - 1 - tx, H - 1 - ty],
    270: [W - 1 - ty, tx],
  }[g.rotation] as [number, number]
  return [g.flipH ? W - 1 - fx : fx, g.flipV ? H - 1 - fy : fy]
}

export async function applyGeometry(page: Page, g: Geometry) {
  await page.evaluate((geometry) => window.__imglyTest!.setGeometry(geometry), g)
  await expect.poll(() => page.evaluate(() => window.__imglyTest!.work()!.geometry)).toEqual(g)
}

/** Exports a full-size PNG through the panel and returns its file. */
export async function exportPng(page: Page, browserName: string) {
  await prepareCapture(page, browserName)
  await choose(page, { format: 'PNG', preset: '100%' })
  const file = await confirmAndCapture(page, browserName)
  await expectSaved(page)
  return file.bytes
}

/** Decodes a PNG in the page, without colour conversion, as straight RGBA. */
export async function decodePng(page: Page, png: Buffer) {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const data = Array.from(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data)
    return { width: bitmap.width, height: bitmap.height, data }
  }, png.toString('base64'))
}
