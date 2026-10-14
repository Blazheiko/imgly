import type { Locator, Page } from '@playwright/test'
import { NEUTRAL_ADJUSTMENTS } from '../../src/core/adjust'
import { identityGeometry, setStraighten, type Geometry } from '../../src/core/geometry'
import { exportPng } from '../adjust/helpers'
import { decodePng } from '../crop-rotate/helpers'
import { referenceDrawing } from '../draw/helpers'
import { gotoReady, waitForWork, work } from '../export/helpers'
import { expect, test } from '../harness'
import type { WorkRecordSummary } from '../test-hooks'

/** The shared e2e `test`: WebKit runs in a persistent context, where it stores Blobs (harness.ts). */
export { test }

export { expect, gotoReady, waitForWork, work }
export { exportPng, decodePng, referenceDrawing }

/** The four reference images (test-plan §Test data): the opaque set, then the semi-transparent set. */
export const OPAQUE_SET = [
  { name: 'photo.png', width: 320, height: 240 },
  { name: 'ref.png', width: 48, height: 32 },
] as const
export const SEMI_TRANSPARENT_SET = [
  { name: 'alpha-patches.png', width: 24, height: 16 },
  { name: 'soft-edge.png', width: 40, height: 30 },
] as const

/** All seven Adjustments away from neutral. */
export const ALL_SEVEN = {
  brightness: 20,
  contrast: 35,
  saturation: -30,
  temperature: 25,
  tint: -15,
  grayscale: 40,
  sepia: 30,
}
export { NEUTRAL_ADJUSTMENTS }

/** A decoded image: straight RGBA, row by row. */
export interface Pixels {
  width: number
  height: number
  data: number[]
}

/** The reference Crop and Straighten angle for an Original: a 7° turn, the frame pulled inwards. */
export function referenceGeometry(size: { width: number; height: number }): Geometry {
  const g = setStraighten(identityGeometry(size), 70, size)
  const dx = Math.floor(g.crop.width * 0.1)
  const dy = Math.floor(g.crop.height * 0.1)
  return {
    ...g,
    crop: {
      x: g.crop.x + dx,
      y: g.crop.y + dy,
      width: g.crop.width - 2 * dx,
      height: g.crop.height - 2 * dy,
    },
  }
}

/** Waits for the Work's revision to move past `before`, i.e. for an Apply to have landed. */
async function applied(page: Page, before: number) {
  await expect.poll(async () => (await work(page))!.revision).toBeGreaterThan(before)
}

/** Applies a Crop with a Straighten angle, as the tool's Apply does. */
export async function applyReferenceGeometry(page: Page, size: { width: number; height: number }) {
  const before = (await work(page))!.revision
  const g = referenceGeometry(size)
  await page.evaluate((next) => window.__imglyTest!.setGeometry(next), g)
  await applied(page, before)
  return g
}

/** Applies all seven Adjustments away from neutral. */
export async function applyAllSeven(page: Page) {
  const before = (await work(page))!.revision
  await page.evaluate((a) => window.__imglyTest!.setAdjustments(a), ALL_SEVEN)
  await applied(page, before)
}

/** Applies the draw reference drawing. */
export async function applyDrawing(page: Page) {
  const before = (await work(page))!.revision
  await referenceDrawing(page)
  await applied(page, before)
}

/** A full-size PNG Export through the real panel, decoded to straight RGBA. */
export async function exportPixels(page: Page, browserName: string): Promise<Pixels> {
  return decodePng(page, await exportPng(page, browserName))
}

/** The largest per-channel difference (alpha included) between two images; exactness needs 0. */
export function maxDifference(a: Pixels, b: Pixels): number {
  expect([a.width, a.height], 'same size').toEqual([b.width, b.height])
  let max = 0
  for (let i = 0; i < a.data.length; i++) max = Math.max(max, Math.abs(a.data[i]! - b.data[i]!))
  return max
}

/** What is stored, without Blob bytes, read through the hooks and not through the code under test. */
export const stored = (page: Page) => page.evaluate(() => window.__imglyTest!.galleryRecords())

/** Polls the stored Works until `ready` accepts them, instead of sleeping (a save is async). */
export async function waitForStored(
  page: Page,
  ready: (works: WorkRecordSummary[]) => boolean,
  message = 'the stored Works never reached the expected state',
) {
  await expect
    .poll(async () => ready((await stored(page)).works), { message, timeout: 15_000 })
    .toBe(true)
}

/**
 * Waits until the open Work's stored record equals its applied state (a committed save): the same
 * Geometry and Adjustments, and a layer exactly when the Work has a drawing.
 */
export async function waitForCommittedSave(page: Page, opts: { drawing?: boolean } = {}) {
  const open = (await work(page))!
  await waitForStored(
    page,
    (works) => {
      const record = works.find((w) => w.id === open.id)
      return (
        !!record &&
        JSON.stringify(record.geometry) === JSON.stringify(open.geometry) &&
        JSON.stringify(record.adjustments) === JSON.stringify(open.adjustments) &&
        (opts.drawing === undefined || (record.layerId !== null) === opts.drawing)
      )
    },
    `the save of ${open.sourceName} never committed`,
  )
}

/** The Gallery overlay and its parts (SCR-03), and the start-screen Gallery (SCR-01). */
export const galleryAction = (page: Page) => page.getByTestId('gallery-action')
export const overlay = (page: Page) => page.getByTestId('gallery-overlay')
export const start = (page: Page) => page.getByTestId('gallery-start')
export const entries = (page: Page) => page.locator('.gallery-entry')

/** Opens the overlay from the top bar and waits for it. */
export async function openGallery(page: Page) {
  await galleryAction(page).click()
  await expect(overlay(page)).toBeVisible()
}

/** The entries' accessible names, "{name}, {status}", in list order. */
export const entryNames = (page: Page) =>
  entries(page)
    .locator('.gallery-entry__button')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')!))

/** The Source name a file name gives: the name without its extension. */
export const stem = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

/** One entry by its Source name (or the file name it came from). */
export const entry = (page: Page, name: string): Locator =>
  entries(page).filter({
    has: page.locator('.gallery-entry__name', { hasText: new RegExp(`^${stem(name)}$`) }),
  })

/** Chooses a stored Work by Source name, on the start screen or in the overlay. */
export async function chooseEntry(page: Page, name: string) {
  await entry(page, name).locator('.gallery-entry__button').click()
}

/** Chooses a stored Work by its id, when several entries share a Source name. */
export async function chooseEntryById(page: Page, id: string) {
  await page.locator(`.gallery-entry__button[data-entry-id="${id}"]`).click()
}

/** The bytes of a stored Original or layer PNG, read straight from IndexedDB (test-only). */
export async function readStoredPng(
  page: Page,
  store: 'originals' | 'layers',
  workId: string,
): Promise<number[]> {
  return page.evaluate(
    async ({ store, workId }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('imgly')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        const record = await new Promise<{ png: Blob } | undefined>((resolve, reject) => {
          const request = db.transaction(store).objectStore(store).get(workId)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        return Array.from(new Uint8Array(await record!.png.arrayBuffer()))
      } finally {
        db.close()
      }
    },
    { store, workId },
  )
}

/** Reloads into the start screen and waits for the Gallery to list `count` Works. */
export async function reloadToStart(page: Page, count: number) {
  await page.reload()
  await expect(start(page)).toBeVisible()
  await expect(entries(page)).toHaveCount(count)
}

/** Waits for the Work to be the reopened one (name and size), with the Gallery gone. */
export async function expectReopened(
  page: Page,
  name: string,
  size: { width: number; height: number },
) {
  await expect
    .poll(async () => (await work(page))?.sourceName, { timeout: 15_000 })
    .toBe(stem(name))
  await expect(start(page)).toBeHidden()
  await expect(overlay(page)).toBeHidden()
  expect(await work(page)).toMatchObject({ width: size.width, height: size.height })
}

/** The stored thumbnail of an entry as shown, decoded to straight RGBA. */
export async function thumbnailPixels(page: Page, name: string): Promise<Pixels> {
  const src = await entry(page, name).locator('img').getAttribute('src')
  expect(src, `the thumbnail of ${name} is shown`).toBeTruthy()
  return page.evaluate(async (url) => {
    const blob = await (await fetch(url)).blob()
    const bitmap = await createImageBitmap(blob, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
    const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const data = Array.from(ctx.getImageData(0, 0, bitmap.width, bitmap.height).data)
    return { width: bitmap.width, height: bitmap.height, data }
  }, src!)
}

/** The Preview renderer's own render of the open Work at 100%, as `Pixels`. */
export async function previewPixels(page: Page): Promise<Pixels> {
  return page.evaluate(() => {
    const w = window.__imglyTest!.work()!
    return {
      width: w.width,
      height: w.height,
      data: window.__imglyTest!.previewAt100(),
    }
  })
}

/**
 * The bitmap ledger after a reopen: nothing the decode worker sent is still held. `retained` is
 * received − closed. A reopen decodes the stored PNGs on the main thread, and the ledger does not
 * count those as received (src/infra/image-decode/client.ts:96) though it counts their closes, so
 * the figure can go below 0 after a reopen. Positive is what a leak looks like.
 */
export async function expectNoLeakedBitmaps(page: Page) {
  await expect
    .poll(() => page.evaluate(() => window.__imglyTest!.bitmaps().retained), { timeout: 5_000 })
    .toBeLessThanOrEqual(0)
}

/** Whether anything blocks or announces: a dialog, a spinner or a notice (AC-01, nothing shown). */
export async function interruptions(page: Page) {
  return {
    dialogs: await page.getByRole('dialog').count(),
    spinners: await page.locator('.spinner').count(),
    notices: await page.locator('.toast').count(),
  }
}
