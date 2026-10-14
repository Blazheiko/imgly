import type { BrowserContext, Locator, Page } from '@playwright/test'
import { NEUTRAL_ADJUSTMENTS } from '../../src/core/adjust'
import { identityGeometry, setStraighten, type Geometry } from '../../src/core/geometry'
import { exportPng } from '../adjust/helpers'
import { decodePng } from '../crop-rotate/helpers'
import { referenceDrawing } from '../draw/helpers'
import { gotoReady, openFile, waitForWork, work } from '../export/helpers'
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

/** The size of the numbered images (`numberedImage`), small so that 25 of them stay quick. */
export const NUMBERED = { width: 64, height: 48 } as const

/** The Source name of image `n`: `img-01` (the file is `img-01.png`). */
export const numberedName = (n: number) => `img-${String(n).padStart(2, '0')}`

/**
 * Builds image `n` in the page: a rectangle whose colour depends on `n`, with its number written
 * on it. `noise` instead fills `size` with random pixels, which a PNG cannot compress.
 */
export async function numberedImage(
  page: Page,
  n: number,
  noise?: { width: number; height: number },
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ n, size, noise }) => {
      const { width, height } = noise ?? size
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')!
      if (noise) {
        const img = ctx.createImageData(width, height)
        for (let i = 0; i < img.data.length; i += 4) {
          img.data[i] = Math.floor(Math.random() * 256)
          img.data[i + 1] = Math.floor(Math.random() * 256)
          img.data[i + 2] = Math.floor(Math.random() * 256)
          img.data[i + 3] = 255
        }
        ctx.putImageData(img, 0, 0)
      } else {
        ctx.fillStyle = `hsl(${(n * 47) % 360} 70% 45%)`
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(String(n), 8, 32)
      }
      const bytes = new Uint8Array(await (await canvas.convertToBlob()).arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    },
    { n, size: NUMBERED, noise },
  )
  return Buffer.from(base64, 'base64')
}

/**
 * Opens numbered image `n` through "Open image" and waits for it to be the open Work. Unless
 * `saved` is false, also waits for its record to be stored. Returns the Work's id.
 */
export async function openNumbered(
  page: Page,
  n: number,
  opts: { saved?: boolean; noise?: { width: number; height: number } } = {},
): Promise<string> {
  const name = numberedName(n)
  await openFile(page, `${name}.png`, await numberedImage(page, n, opts.noise), 'image/png')
  await expect.poll(async () => (await work(page))?.sourceName, { timeout: 15_000 }).toBe(name)
  const size = opts.noise ?? NUMBERED
  await waitForWork(page, size.width, size.height)
  const id = (await work(page))!.id
  if (opts.saved !== false) {
    await waitForStored(page, (works) => works.some((w) => w.id === id), `${name} was never stored`)
  }
  return id
}

/** Applies Adjustments and waits for the Work's revision to move, as an Apply does. */
export async function applyAdjustments(page: Page, adjustments: Record<string, number>) {
  const before = (await work(page))!.revision
  await page.evaluate((a) => window.__imglyTest!.setAdjustments(a as never), adjustments)
  await applied(page, before)
}

/** The notices (toasts) on screen; the texts are written in the specs, never taken from the catalog. */
export const toasts = (page: Page) => page.locator('.toast')

const escapeRegExp = (text: string) => text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')

/** The notices whose whole text is `text`. */
export const notice = (page: Page, text: string) =>
  page.locator('.toast', {
    has: page.locator('.toast__text', {
      hasText: new RegExp(`^${escapeRegExp(text)}$`),
    }),
  })

/** Dismisses every notice on screen. */
export async function dismissNotices(page: Page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss' })
  while ((await dismiss.count()) > 0) await dismiss.first().click()
}

/** The total bytes stored (thumbnails, Originals, layers), as the e2e byte budget counts them. */
export function storedBytes(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('imgly')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const all = (name: string) =>
        new Promise<{ png?: Blob; thumbnail?: Blob }[]>((resolve, reject) => {
          const request = db.transaction(name).objectStore(name).getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      const [works, originals, layers] = await Promise.all([
        all('works'),
        all('originals'),
        all('layers'),
      ])
      return (
        works.reduce((n, r) => n + r.thumbnail!.size, 0) +
        [...originals, ...layers].reduce((n, r) => n + r.png!.size, 0)
      )
    } finally {
      db.close()
    }
  })
}

/** The page-side state of the encode seam (see `instrumentEncodes`). */
interface EncodeSeam {
  encodes: number
  gate: Promise<void> | null
  release: (() => void) | null
}
type SeamWindow = Window & { __e2eEncodes?: EncodeSeam }

/**
 * Installs, before the app loads, a seam on the one place Autosave encodes a thumbnail
 * (`OffscreenCanvas.convertToBlob`): it counts finished encodes, and it can hold the next one back.
 * That makes "a save is running" observable and controllable without touching app code, and a held
 * encode ends in a save that commits, which `galleryHoldSave` never does. Call it before `gotoReady`.
 */
export async function instrumentEncodes(target: Page | BrowserContext) {
  await target.addInitScript(() => {
    const seam: EncodeSeam = { encodes: 0, gate: null, release: null }
    ;(window as SeamWindow).__e2eEncodes = seam
    const original = OffscreenCanvas.prototype.convertToBlob
    OffscreenCanvas.prototype.convertToBlob = async function (
      this: OffscreenCanvas,
      ...args: Parameters<OffscreenCanvas['convertToBlob']>
    ) {
      const gate = seam.gate
      if (gate) {
        seam.gate = null
        await gate
      }
      const blob = await original.apply(this, args)
      seam.encodes++
      return blob
    }
  })
}

/** Holds the next thumbnail encode, so the next save stays "running" until `releaseEncodes`. */
export const holdNextEncode = (page: Page) =>
  page.evaluate(() => {
    const seam = (window as SeamWindow).__e2eEncodes!
    seam.gate = new Promise<void>((resolve) => (seam.release = resolve))
  })

/** Lets a held encode go. */
export const releaseEncodes = (page: Page) =>
  page.evaluate(() => (window as SeamWindow).__e2eEncodes!.release?.())

/** How many thumbnails have been encoded in this page so far. */
export const encodeCount = (page: Page) =>
  page.evaluate(() => (window as SeamWindow).__e2eEncodes!.encodes)

/** Waits until a save has encoded its thumbnail, i.e. has reached `storeWork`. */
export async function waitForEncodeAfter(page: Page, before: number) {
  await expect.poll(() => encodeCount(page), { timeout: 15_000 }).toBeGreaterThan(before)
}

/** The replace confirmation (SCR-05) and its buttons. */
export const replaceDialog = (page: Page) => page.getByRole('alertdialog')

/**
 * The stored Adjustments of a Work, read with a version-less `indexedDB.open`, which still works
 * after another page has raised the database version (`galleryRecords` opens at the latest known
 * version and would fail with a VersionError then).
 */
export function rawAdjustments(page: Page, workId: string): Promise<Record<string, number> | null> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('imgly')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const found = await new Promise<{ adjustments: Record<string, number> } | undefined>(
        (resolve, reject) => {
          const request = db.transaction('works').objectStore('works').get(id)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        },
      )
      return found?.adjustments ?? null
    } finally {
      db.close()
    }
  }, workId)
}

/**
 * The parts of a stored Work, read with a version-less `indexedDB.open` (see `rawAdjustments`):
 * the record, whether the Original, the layer and the thumbnail exist, and their byte sizes.
 */
export interface RawParts {
  record: { adjustments: Record<string, number>; layerId: string | null } | null
  originalBytes: number | null
  layerBytes: number | null
  thumbnailBytes: number | null
}

export function rawParts(page: Page, workId: string): Promise<RawParts> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('imgly')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const get = <T>(store: string): Promise<T | undefined> =>
      new Promise((resolve, reject) => {
        const request = db.transaction(store).objectStore(store).get(id)
        request.onsuccess = () => resolve(request.result as T | undefined)
        request.onerror = () => reject(request.error)
      })
    try {
      const record = await get<{
        adjustments: Record<string, number>
        layerId: string | null
        thumbnail?: Blob
      }>('works')
      const original = await get<{ png: Blob }>('originals')
      const layer = await get<{ png: Blob }>('layers')
      return {
        record: record ? { adjustments: record.adjustments, layerId: record.layerId } : null,
        originalBytes: original?.png.size ?? null,
        layerBytes: layer?.png.size ?? null,
        thumbnailBytes: record?.thumbnail?.size ?? null,
      }
    } finally {
      db.close()
    }
  }, workId)
}
