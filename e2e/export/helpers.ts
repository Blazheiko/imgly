import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'
import { sniffImageHeader } from '../../src/core/image-header'

export { gotoReady, view, waitForWork } from '../open-and-view/helpers'

export type FormatLabel = 'PNG' | 'JPEG' | 'WebP'
export const FORMAT_OF: Record<FormatLabel, 'png' | 'jpeg' | 'webp'> = {
  PNG: 'png',
  JPEG: 'jpeg',
  WebP: 'webp',
}

export const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)))

export const work = (page: Page) => page.evaluate(() => window.__imglyTest!.work())

/** Opens a file through "Open image" (Ctrl+O and the file chooser), under any name. */
export async function openFile(page: Page, name: string, buffer: Buffer, mimeType = '') {
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Control+o')
  await (await chooser).setFiles({ name, mimeType, buffer })
}

/**
 * Builds an image in the page: an opaque diagonal gradient, or (`alpha`) one whose opacity also
 * runs from 0 to 255, including fully transparent and fully opaque pixels.
 */
export async function generateImage(
  page: Page,
  spec: { width: number; height: number; alpha?: boolean; type?: string },
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ width, height, alpha = false, type = 'image/png' }) => {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')!
      const img = ctx.createImageData(width, height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const a = alpha ? Math.round((255 * x) / (width - 1)) : 255
          img.data.set(
            [(x * 7 + y * 3) % 256, (y * 11) % 256, (x * 5 + 128) % 256, a],
            (y * width + x) * 4,
          )
        }
      }
      ctx.putImageData(img, 0, 0)
      const blob = await canvas.convertToBlob({ type })
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let binary = ''
      for (const byte of bytes) binary += String.fromCharCode(byte)
      return btoa(binary)
    },
    spec,
  )
  return Buffer.from(base64, 'base64')
}

/**
 * Replaces the "Save as…" dialog (Chromium) with a stub that returns `returnName` (default: the
 * suggested name) and keeps the written bytes in the page. The native dialog itself is covered by
 * the manual pass (sad.md §7).
 */
export async function stubSaveFilePicker(page: Page, opts: { returnName?: string } = {}) {
  await page.evaluate((returnName) => {
    type Saved = { name: string; base64: string; options: unknown }
    const w = window as unknown as {
      showSaveFilePicker: (options: { suggestedName: string }) => Promise<unknown>
      __saved?: Saved
      __pickerOptions?: unknown
    }
    w.showSaveFilePicker = async (options) => {
      w.__pickerOptions = options
      const name = returnName ?? options.suggestedName
      const chunks: Blob[] = []
      return {
        name,
        createWritable: async () => ({
          write: async (data: Blob) => void chunks.push(data),
          abort: async () => {},
          close: async () => {
            const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
            let binary = ''
            for (const byte of bytes) binary += String.fromCharCode(byte)
            w.__saved = { name, base64: btoa(binary), options }
          },
        }),
        remove: async () => {},
      }
    }
    delete w.__saved
  }, opts.returnName)
}

/** The export panel and its controls. */
export const panel = (page: Page) => page.getByRole('dialog', { name: 'Export' })
export const exportAction = (page: Page) =>
  page.getByTestId('editor-top-bar').getByRole('button', { name: /^Export/ })

/** Opens the panel and sets the given choices, without confirming. */
export async function choose(
  page: Page,
  opts: { format?: FormatLabel; quality?: number; preset?: string; longSide?: number } = {},
) {
  if (!(await panel(page).isVisible())) await exportAction(page).click()
  await expect(panel(page)).toBeVisible()
  const p = panel(page)
  if (opts.format) await p.getByRole('radio', { name: opts.format, exact: true }).click()
  if (opts.quality !== undefined) {
    await p.getByRole('textbox', { name: 'Quality' }).fill(String(opts.quality))
    await p.getByRole('textbox', { name: 'Quality' }).press('Enter')
  }
  if (opts.preset) await p.getByRole('radio', { name: opts.preset, exact: true }).click()
  if (opts.longSide !== undefined) {
    await p.getByRole('textbox', { name: 'Long side' }).fill(String(opts.longSide))
    await p.getByRole('textbox', { name: 'Long side' }).press('Enter')
  }
}

export interface ExportedFile {
  name: string
  bytes: Buffer
}

/**
 * Confirms the panel and captures the file: through the stubbed "Save as…" on Chromium, or the
 * browser's download on Firefox and WebKit (a missing download event fails the test).
 */
export async function confirmAndCapture(page: Page, browserName: string): Promise<ExportedFile> {
  const confirm = panel(page).getByRole('button', { name: 'Export', exact: true })
  if (browserName === 'chromium') {
    await confirm.click()
    const saved = await page.waitForFunction(
      () => (window as unknown as { __saved?: { name: string; base64: string } }).__saved,
      undefined,
      { timeout: 20_000 },
    )
    const { name, base64 } = (await saved.jsonValue()) as { name: string; base64: string }
    await page.evaluate(() => delete (window as unknown as { __saved?: unknown }).__saved)
    return { name, bytes: Buffer.from(base64, 'base64') }
  }
  const download = page.waitForEvent('download', { timeout: 20_000 })
  await confirm.click()
  const file = await download.catch(async (error: unknown) => {
    throw new Error(`No download. ${await exportDiagnosis(page)}`, { cause: error })
  })
  return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) }
}

/** Each step of the export worker's path, run again in a fresh worker, to say which one fails. */
async function exportDiagnosis(page: Page): Promise<string> {
  const steps = await page.evaluate(async () => {
    const src = `
      const steps = {}
      const run = async (name, fn) => {
        try { steps[name] = await fn() } catch (e) { steps[name] = 'throws ' + e }
      }
      ;(async () => {
        let gl, canvas
        await run('webgl2', () => {
          canvas = new OffscreenCanvas(4, 4)
          gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true })
          return gl ? gl.getParameter(gl.VERSION) : null
        })
        await run('draw', () => {
          gl.clearColor(1, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.finish()
          return !gl.isContextLost()
        })
        let copy
        await run('copyTo2d', () => {
          copy = new OffscreenCanvas(4, 4)
          const ctx = copy.getContext('2d')
          ctx.drawImage(canvas, 0, 0)
          return Array.from(ctx.getImageData(0, 0, 1, 1).data).join(',')
        })
        for (const type of ['image/png', 'image/jpeg']) {
          await run(type, async () => {
            const blob = await copy.convertToBlob({ type, quality: 0.9 })
            return blob.type + ' ' + blob.size
          })
        }
        await run('transferredBitmapTo2d', () => {
          const c = new OffscreenCanvas(2, 2)
          c.getContext('2d').fillRect(0, 0, 2, 2)
          const bitmap = c.transferToImageBitmap()
          const ctx = new OffscreenCanvas(2, 2).getContext('2d', { willReadFrequently: true })
          ctx.drawImage(bitmap, 0, 0)
          return Array.from(ctx.getImageData(0, 0, 1, 1).data).join(',')
        })
        self.postMessage(steps)
      })()`
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
    const worker = new Worker(url)
    return new Promise((resolve) => {
      setTimeout(() => resolve('timeout after 10 s'), 10_000)
      worker.onmessage = (e) => resolve(e.data)
      worker.onerror = (e) => resolve(`worker error: ${e.message}`)
    })
  })
  const alert = await page.getByRole('alert').allInnerTexts()
  return `Alerts: ${JSON.stringify(alert)}. Worker steps: ${JSON.stringify(steps)}`
}

/** Prepares the page for capturing exports in this engine. */
export async function prepareCapture(page: Page, browserName: string) {
  if (browserName === 'chromium') await stubSaveFilePicker(page)
}

/** The exported file's real format and size, judged by its content (AC-12). */
export function headerOf(bytes: Buffer) {
  const header = sniffImageHeader(new Uint8Array(bytes))
  expect(header.ok, 'the exported file is a recognised image').toBe(true)
  if (!header.ok) throw new Error('unreachable')
  return header.value
}

/** Waits for the export to end and the panel to close (success). */
export async function expectSaved(page: Page) {
  await expect(panel(page)).toBeHidden({ timeout: 20_000 })
  await expect.poll(() => page.evaluate(() => window.__imglyTest!.exportStatus())).toBe('idle')
}

/**
 * Compares a full-size exported PNG with the Preview's own rendering at 100%: the largest
 * per-channel difference on alpha, and on colour after compositing both onto black and onto white
 * (spec §6 Fidelity).
 */
export async function compareWithPreview(page: Page, png: Buffer) {
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
    })
    const { width, height } = bitmap
    const ctx = new OffscreenCanvas(width, height).getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const exported = ctx.getImageData(0, 0, width, height).data
    const preview = window.__imglyTest!.previewAt100()
    let alpha = 0
    let black = 0
    let white = 0
    for (let i = 0; i < exported.length; i += 4) {
      const ea = exported[i + 3]!
      const pa = preview[i + 3]!
      alpha = Math.max(alpha, Math.abs(ea - pa))
      for (let c = 0; c < 3; c++) {
        const e = exported[i + c]!
        const p = preview[i + c]!
        black = Math.max(black, Math.abs((e * ea) / 255 - (p * pa) / 255))
        white = Math.max(white, Math.abs((e * ea) / 255 + 255 - ea - ((p * pa) / 255 + 255 - pa)))
      }
    }
    return { width, height, alpha, black, white, samples: preview.length / 4 }
  }, png.toString('base64'))
}

/** Block names that carry metadata in each container (AC-16). */
export function metadataBlocks(bytes: Buffer): string[] {
  const found: string[] = []
  if (bytes.subarray(1, 4).toString('latin1') === 'PNG') {
    for (let at = 8; at + 8 <= bytes.length;) {
      const length = bytes.readUInt32BE(at)
      const type = bytes.subarray(at + 4, at + 8).toString('latin1')
      if (['eXIf', 'tEXt', 'zTXt', 'iTXt', 'iCCP', 'tIME'].includes(type)) found.push(`PNG ${type}`)
      at += 12 + length
    }
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let at = 2; at + 4 <= bytes.length;) {
      if (bytes[at] !== 0xff) break
      const marker = bytes[at + 1]!
      if (marker === 0xda || marker === 0xd9) break
      const length = bytes.readUInt16BE(at + 2)
      const body = bytes.subarray(at + 4, at + 2 + length)
      if (marker === 0xe1) found.push(`JPEG APP1 ${body.subarray(0, 4).toString('latin1')}`)
      if (marker === 0xed) found.push('JPEG APP13 (IPTC)')
      if (marker === 0xfe) found.push('JPEG COM')
      if (marker === 0xe2 && body.subarray(0, 11).toString('latin1') === 'ICC_PROFILE') {
        if (!isSrgbProfile(body)) found.push('JPEG APP2 non-sRGB ICC')
      }
      at += 2 + length
    }
  } else if (bytes.subarray(0, 4).toString('latin1') === 'RIFF') {
    for (let at = 12; at + 8 <= bytes.length;) {
      const type = bytes.subarray(at, at + 4).toString('latin1')
      const length = bytes.readUInt32LE(at + 4)
      if (type === 'EXIF' || type === 'XMP ') found.push(`WebP ${type}`)
      if (type === 'ICCP' && !isSrgbProfile(bytes.subarray(at + 8, at + 8 + length))) {
        found.push('WebP non-sRGB ICCP')
      }
      at += 8 + length + (length % 2)
    }
  }
  return found
}

/** An ICC profile counts as sRGB when its `desc` tag names sRGB (the encoder's own marker). */
function isSrgbProfile(block: Buffer): boolean {
  // In a JPEG APP2 the profile follows "ICC_PROFILE\0" and two sequence bytes.
  const profile =
    block.subarray(0, 12).toString('latin1') === 'ICC_PROFILE\0' ? block.subarray(14) : block
  if (profile.length < 132) return false
  const count = profile.readUInt32BE(128)
  for (let i = 0; i < count; i++) {
    const entry = 132 + 12 * i
    if (profile.subarray(entry, entry + 4).toString('latin1') !== 'desc') continue
    const tag = profile
      .subarray(profile.readUInt32BE(entry + 4))
      .subarray(0, profile.readUInt32BE(entry + 8))
    const type = tag.subarray(0, 4).toString('latin1')
    if (type === 'desc')
      return /^sRGB/i.test(tag.subarray(12, 12 + tag.readUInt32BE(8)).toString('latin1'))
    if (type === 'mluc') {
      const length = tag.readUInt32BE(20)
      const offset = tag.readUInt32BE(24)
      const utf16 = tag.subarray(offset, offset + length)
      const text = String.fromCharCode(
        ...Array.from({ length: length / 2 }, (_, k) => utf16.readUInt16BE(2 * k)),
      )
      return /^sRGB/i.test(text)
    }
  }
  return false
}
