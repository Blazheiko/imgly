import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { crc32 } from 'node:zlib'
import { expect, test, type Page } from '@playwright/test'
import { canvasArea, dropGeneratedImage, gotoReady, view, waitForWork } from './helpers'

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)))

type FilePayload = { name: string; mimeType: string; buffer: Buffer }
const file = (name: string, mimeType = 'application/octet-stream'): FilePayload => ({
  name,
  mimeType,
  buffer: fixture(name),
})

/** A valid PNG header declaring 20000×20000 in a few dozen bytes: a decompression bomb. */
function bomb(): FilePayload {
  const be32 = (n: number) =>
    Buffer.from([(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255])
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
    return Buffer.concat([be32(data.length), body, be32(crc32(body))])
  }
  const ihdr = Buffer.concat([be32(20000), be32(20000), Buffer.from([8, 6, 0, 0, 0])])
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', Buffer.alloc(16)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return { name: 'bomb.png', mimeType: 'image/png', buffer }
}

/** A 1×1-screen GIF whose one frame is 30000×9000: the bomb hides in the frame descriptor. */
function frameBombGif(): FilePayload {
  const le16 = (n: number) => [n & 255, (n >> 8) & 255]
  const buffer = Buffer.from([
    ...Buffer.from('GIF89a', 'latin1'),
    ...le16(1),
    ...le16(1),
    0x80,
    0,
    0,
    ...Array<number>(6).fill(0), // 2-entry global colour table
    0x2c,
    ...le16(0),
    ...le16(0),
    ...le16(30000),
    ...le16(9000),
    0,
    2,
    3,
    0x4c,
    0x01,
    0x00,
    0,
    0x3b,
  ])
  return { name: 'frame-bomb.gif', mimeType: 'image/gif', buffer }
}

/** The frame bomb with a comment extension that pushes its frame past the 1 MiB header window. */
function paddedFrameBombGif(): FilePayload {
  const bomb = frameBombGif().buffer
  const block = Buffer.concat([Buffer.from([255]), Buffer.alloc(255, 0x20)])
  const blocks = Array.from({ length: 4200 }, () => block) // 4200 × 256 B > 1 MiB
  const comment = Buffer.concat([Buffer.from([0x21, 0xfe]), ...blocks, Buffer.from([0])])
  const buffer = Buffer.concat([bomb.subarray(0, 19), comment, bomb.subarray(19)])
  return { name: 'padded-frame-bomb.gif', mimeType: 'image/gif', buffer }
}

/** The 2-frame GIF with a comment extension after its first frame that pushes the second past 1 MiB. */
function lateFrameAnimatedGif(): FilePayload {
  const gif = fixture('animated.gif')
  const firstFrameEnd = 116 // after frame 1's data terminator: the second control extension follows
  if (gif[firstFrameEnd] !== 0x21 || gif[firstFrameEnd + 1] !== 0xf9) {
    throw new Error('animated.gif changed: update firstFrameEnd')
  }
  const block = Buffer.concat([Buffer.from([255]), Buffer.alloc(255, 0x20)])
  const blocks = Array.from({ length: 4200 }, () => block) // 4200 × 256 B > 1 MiB
  const comment = Buffer.concat([Buffer.from([0x21, 0xfe]), ...blocks, Buffer.from([0])])
  const buffer = Buffer.concat([
    gif.subarray(0, firstFrameEnd),
    comment,
    gif.subarray(firstFrameEnd),
  ])
  return { name: 'late-frame-animated.gif', mimeType: 'image/gif', buffer }
}

/** A valid JPEG with more than 1 MiB of APP2 metadata before its frame header (accepted risk). */
function bigMetadataJpeg(): FilePayload {
  const jpg = fixture('photo.jpg')
  const segment = Buffer.concat([Buffer.from([0xff, 0xe2, 0xff, 0xff]), Buffer.alloc(0xfffd)])
  const padding = Array.from({ length: 17 }, () => segment) // 17 × 64 KiB > 1 MiB
  const buffer = Buffer.concat([jpg.subarray(0, 2), ...padding, jpg.subarray(2)])
  return { name: 'metadata-heavy.jpg', mimeType: 'image/jpeg', buffer }
}

const NOT_READ = "This file couldn't be read as an image."
const unsupported = (format: string) =>
  `${format} files can't be opened here. Convert it to JPEG or PNG.`
const HEIC =
  "HEIC files can't be opened in this browser. Convert it to JPEG or PNG, or use a browser that opens HEIC."

type Outcome =
  | { opens: { width: number; height: number }; notice?: string }
  | { refused: string }
  | { heic: true }

const REFERENCE_SET: [string, () => FilePayload, Outcome][] = [
  ['JPEG', () => file('photo.jpg', 'image/jpeg'), { opens: { width: 320, height: 240 } }],
  ['PNG', () => file('photo.png', 'image/png'), { opens: { width: 320, height: 240 } }],
  ['WebP', () => file('photo.webp', 'image/webp'), { opens: { width: 320, height: 240 } }],
  [
    'WebP over 1 MiB',
    () => file('large-lossless.webp', 'image/webp'),
    { opens: { width: 720, height: 540 } },
  ],
  ['AVIF', () => file('photo.avif', 'image/avif'), { opens: { width: 320, height: 240 } }],
  [
    'animated GIF',
    () => file('animated.gif', 'image/gif'),
    {
      opens: { width: 64, height: 48 },
      notice: 'Animated image: only the first frame was kept.',
    },
  ],
  [
    'animated GIF whose second frame is past 1 MiB',
    lateFrameAnimatedGif,
    {
      opens: { width: 64, height: 48 },
      notice: 'Animated image: only the first frame was kept.',
    },
  ],
  [
    'PNG named .jpg',
    () => file('png-named.jpg', 'image/jpeg'),
    { opens: { width: 320, height: 240 } },
  ],
  ['HEIC', () => file('photo.heic', 'image/heic'), { heic: true }],
  ['truncated JPEG', () => file('truncated.jpg', 'image/jpeg'), { refused: NOT_READ }],
  ['corrupt PNG', () => file('corrupt.png', 'image/png'), { refused: NOT_READ }],
  ['text named .png', () => file('text-named.png', 'image/png'), { refused: NOT_READ }],
  ['JPEG with > 1 MiB metadata', bigMetadataJpeg, { refused: NOT_READ }],
  ['SVG', () => file('drawing.svg', 'image/svg+xml'), { refused: unsupported('SVG') }],
  ['BMP', () => file('bitmap.bmp', 'image/bmp'), { refused: unsupported('BMP') }],
  ['TIFF', () => file('image.tiff', 'image/tiff'), { refused: unsupported('TIFF or camera RAW') }],
  ['PSD', () => file('image.psd', 'image/vnd.adobe.photoshop'), { refused: unsupported('PSD') }],
  [
    'decompression bomb',
    bomb,
    {
      refused:
        'This image is too large: 20000×20000 px (400 MP). The largest the editor opens is 100 MP.',
    },
  ],
  [
    'GIF frame larger than its screen',
    frameBombGif,
    {
      refused:
        'This image is too large: 30000×9000 px (270 MP). The largest the editor opens is 100 MP.',
    },
  ],
  ['GIF frame past the header window', paddedFrameBombGif, { refused: NOT_READ }],
]

const work = (page: Page) => page.evaluate(() => window.__imglyTest!.work())

async function openViaPicker(page: Page, payload: FilePayload) {
  const chooser = page.waitForEvent('filechooser')
  await page.keyboard.press('Control+o')
  await (await chooser).setFiles(payload)
}

/** Asserts the honest outcome: a correct Preview with its readout, or the exact catalog reason. */
async function expectOutcome(page: Page, outcome: Outcome, browserName: string) {
  if ('heic' in outcome) {
    // Chromium and Firefox never decode HEIC; WebKit may, where the OS ships the codec.
    const message = page.getByRole('alert').filter({ hasText: HEIC })
    if (browserName !== 'webkit') return expect(message).toBeVisible({ timeout: 15_000 })
    await expect
      .poll(async () => (await message.count()) > 0 || (await work(page))?.width === 320, {
        timeout: 15_000,
      })
      .toBe(true)
    return
  }
  if ('refused' in outcome) {
    await expect(page.getByRole('alert').filter({ hasText: outcome.refused })).toBeVisible({
      timeout: 15_000,
    })
    return
  }
  await waitForWork(page, outcome.opens.width, outcome.opens.height)
  await expect(page.getByTestId('preview-canvas')).toBeVisible()
  await expect(page.getByTestId('dimensions-readout')).toHaveText(
    `${outcome.opens.width} × ${outcome.opens.height} px`,
  )
  if (outcome.notice) await expect(page.getByText(outcome.notice)).toBeVisible()
}

test.describe('reference set — no Work open', () => {
  for (const [label, payload, outcome] of REFERENCE_SET) {
    test(`${label}: honest outcome`, async ({ page, browserName }) => {
      await gotoReady(page)
      await openViaPicker(page, payload())
      await expectOutcome(page, outcome, browserName)
    })
  }
})

test.describe('reference set — over a Work with Unsaved edits (AC-15, AC-16)', () => {
  for (const [label, payload, outcome] of REFERENCE_SET) {
    test(`${label}: never touches the Work unless replaced`, async ({ page, browserName }) => {
      await gotoReady(page)
      await openViaPicker(page, file('ref.png', 'image/png'))
      await waitForWork(page, 48, 32)
      await page.evaluate(() => window.__imglyTest!.applyEdit())
      const before = await work(page)

      await openViaPicker(page, payload())

      if ('refused' in outcome) {
        await expectOutcome(page, outcome, browserName)
        await expect(page.getByRole('alertdialog')).toHaveCount(0)
        expect(await work(page)).toEqual(before)
        return
      }
      const dialogOrRefusal = page
        .getByRole('alertdialog')
        .or(page.getByRole('alert').filter({ hasText: HEIC }))
      await expect(dialogOrRefusal).toBeVisible({ timeout: 15_000 })
      if (await page.getByRole('alertdialog').isVisible()) {
        await page.getByRole('button', { name: 'Replace' }).click()
        expect((await work(page))!.id).not.toBe(before!.id)
      } else {
        expect(await work(page)).toEqual(before)
      }
      await expectOutcome(page, outcome, browserName)
    })
  }
})

test.describe('large photos', () => {
  test('a 12 MP JPEG opens at Fit with its own size', async ({ page }) => {
    await gotoReady(page)
    await dropGeneratedImage(page, { width: 4032, height: 3024, type: 'image/jpeg' })
    await waitForWork(page, 4032, 3024)
    await expect(page.getByTestId('dimensions-readout')).toHaveText('4032 × 3024 px')
  })

  test('a 48 MP JPEG is reduced to the Downscale limit with a notice', async ({ page }) => {
    await gotoReady(page)
    await dropGeneratedImage(page, { width: 8064, height: 6048, type: 'image/jpeg' })
    await waitForWork(page, 4096, 3072)
    await expect(
      page.getByText('Reduced to the 4096 px limit: 8064×6048 → 4096×3072.'),
    ).toBeVisible()
  })
})

test.describe('EXIF orientation — 8 of 8 upright', () => {
  for (let o = 1; o <= 8; o++) {
    test(`orientation ${o} displays upright`, async ({ page, browserName }) => {
      await gotoReady(page)
      await openViaPicker(page, file(`orientation-${o}.jpg`, 'image/jpeg'))
      // Upright aspect on every engine: the reference is landscape 48×32.
      await waitForWork(page, 48, 32)
      await expect(page.getByTestId('dimensions-readout')).toHaveText('48 × 32 px')
      const near = (rgb: number[], want: number[]) =>
        rgb.every((c, i) => Math.abs(c - want[i]!) <= 40)

      // The Original's own pixels, read through a 2D canvas, so every engine checks the layout.
      const original = await page.evaluate(() => {
        const at = (x: number, y: number) => window.__imglyTest!.originalPixel(x, y)
        return { tl: at(6, 4), tr: at(41, 4), bl: at(6, 27), br: at(41, 27) }
      })
      expect(near(original.tl, [255, 0, 0]), `Original top-left ${original.tl}`).toBe(true)
      expect(near(original.tr, [0, 255, 0]), `Original top-right ${original.tr}`).toBe(true)
      expect(near(original.bl, [0, 0, 255]), `Original bottom-left ${original.bl}`).toBe(true)
      expect(near(original.br, [255, 255, 0]), `Original bottom-right ${original.br}`).toBe(true)

      if (browserName !== 'chromium') return // WebGL pixel checks of the Preview stay on Chromium
      const area = await canvasArea(page)
      const v = await view(page)
      expect(v.zoom).toBe(1)
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      )
      const shot = await page.screenshot({
        clip: {
          x: area.left + Math.round(v.panX) / area.dpr,
          y: area.top + Math.round(v.panY) / area.dpr,
          width: 48 / area.dpr,
          height: 32 / area.dpr,
        },
        scale: 'device',
      })
      const corners = await page.evaluate(async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
        ctx.drawImage(bitmap, 0, 0)
        const at = (x: number, y: number) =>
          Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3))
        return { tl: at(6, 4), tr: at(41, 4), bl: at(6, 27), br: at(41, 27) }
      }, shot.toString('base64'))
      expect(near(corners.tl, [255, 0, 0]), `top-left ${corners.tl}`).toBe(true)
      expect(near(corners.tr, [0, 255, 0]), `top-right ${corners.tr}`).toBe(true)
      expect(near(corners.bl, [0, 0, 255]), `bottom-left ${corners.bl}`).toBe(true)
      expect(near(corners.br, [255, 255, 0]), `bottom-right ${corners.br}`).toBe(true)
    })
  }
})
