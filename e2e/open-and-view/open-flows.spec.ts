import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { canvasArea, dropGeneratedImage, gotoReady, view, waitForWork } from './helpers'

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)))

const work = (page: Page) => page.evaluate(() => window.__imglyTest!.work())

const NOT_READ = "This file couldn't be read as an image."

/** The one failure toast's message (its dismiss button is not part of the text). */
const alertText = (page: Page) => page.getByRole('alert').locator('p')

type DropSpec =
  | { name: string; type: string; base64: string }
  | { name: string; type: string; generate: { width: number; height: number } }

/** Drops several files in one real drag-and-drop, in the given browser order (AC-03). */
async function dropMany(page: Page, specs: DropSpec[]) {
  await page.evaluate(async (specs) => {
    const dt = new DataTransfer()
    for (const s of specs) {
      let blob: Blob
      if ('generate' in s) {
        const canvas = new OffscreenCanvas(s.generate.width, s.generate.height)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#4c8dff'
        ctx.fillRect(0, 0, s.generate.width, s.generate.height)
        blob = await canvas.convertToBlob({ type: s.type })
      } else {
        blob = new Blob([Uint8Array.from(atob(s.base64), (c) => c.charCodeAt(0))])
      }
      dt.items.add(new File([blob], s.name, { type: s.type }))
    }
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    }
  }, specs)
}

const bytes = (name: string, type: string, buffer: Buffer): DropSpec => ({
  name,
  type,
  base64: buffer.toString('base64'),
})
const textDoc = bytes('notes.txt', 'text/plain', Buffer.from('meeting notes'))
const truncated = bytes('truncated.jpg', 'image/jpeg', fixture('truncated.jpg'))
const corrupt = bytes('corrupt.png', 'image/png', fixture('corrupt.png'))

test.describe('multi-file drops through the UI (AC-03)', () => {
  test('a document, a damaged image and a valid image: the valid one opens', async ({ page }) => {
    await gotoReady(page)
    await dropMany(page, [
      textDoc,
      truncated,
      { name: 'valid.png', type: 'image/png', generate: { width: 300, height: 200 } },
    ])

    await waitForWork(page, 300, 200)
    await expect(
      page.getByText('The editor works with one image at a time. 2 other files were ignored.'),
    ).toBeVisible()
  })

  test('when none is readable, nothing is replaced and the first image file’s reason stays', async ({
    page,
  }) => {
    await gotoReady(page)
    await dropGeneratedImage(page, { width: 400, height: 300 })
    await waitForWork(page, 400, 300)
    const before = await work(page)

    await dropMany(page, [textDoc, truncated, corrupt])

    await expect(alertText(page)).toHaveText(NOT_READ)
    expect(await work(page)).toEqual(before)
    await page.waitForTimeout(6000) // past every info notice's lifetime
    await expect(alertText(page)).toHaveText(NOT_READ)
  })
})

test.describe('a file the app may not read (AC-10)', () => {
  test('is refused with the make-it-available hint, replacing nothing', async ({ page }, info) => {
    const path = info.outputPath('locked.png')
    writeFileSync(path, fixture('photo.png'))
    chmodSync(path, 0o000)
    try {
      await gotoReady(page)
      const chooser = page.waitForEvent('filechooser')
      await page.keyboard.press('Control+o')
      await (await chooser).setFiles(path)

      await expect(alertText(page)).toHaveText(
        "The app wasn't allowed to read this file. Make it available on this computer first, for example by downloading it from your cloud drive.",
      )
      expect(await work(page)).toBeNull()
      await expect(page.getByRole('button', { name: 'Open image' })).toBeVisible()
    } finally {
      chmodSync(path, 0o644)
    }
  })
})

test.describe('animated images (AC-11, AC-11b)', () => {
  test('keeps the first frame’s pixels (Chromium)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGL pixel checks stay on Chromium only')
    await gotoReady(page)
    const chooser = page.waitForEvent('filechooser')
    await page.keyboard.press('Control+o')
    await (
      await chooser
    ).setFiles({ name: 'animated.gif', mimeType: 'image/gif', buffer: fixture('animated.gif') })
    await waitForWork(page, 64, 48)
    await expect(page.getByText('Animated image: only the first frame was kept.')).toBeVisible()

    const area = await canvasArea(page)
    const v = await view(page)
    await page.waitForTimeout(300) // longer than one 500 ms frame would need to start showing
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    const shot = await page.screenshot({
      clip: {
        x: area.left + (Math.round(v.panX) + 32 * v.zoom) / area.dpr,
        y: area.top + (Math.round(v.panY) + 24 * v.zoom) / area.dpr,
        width: 1,
        height: 1,
      },
      scale: 'device',
    })
    const rgb = await page.evaluate(async (b64) => {
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([data], { type: 'image/png' }))
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3))
    }, shot.toString('base64'))
    expect(rgb[0], `centre pixel ${rgb}`).toBeGreaterThan(200) // red: frame 1
    expect(rgb[2], `centre pixel ${rgb}`).toBeLessThan(60) // not blue: frame 2
  })

  test('an animated, oversize image dropped with another file shows three separate notices', async ({
    page,
  }) => {
    await gotoReady(page)
    await dropMany(page, [
      bytes('big-animated.gif', 'image/gif', fixture('big-animated.gif')),
      textDoc,
    ])
    await waitForWork(page, 4096, 2731)

    const toasts = page.getByTestId('toast-stack').getByRole('status')
    await expect(toasts).toHaveCount(3)
    await expect(toasts.nth(0)).toHaveText(/Reduced to the 4096 px limit: 6000×4000 → 4096×2731\./)
    await expect(toasts.nth(1)).toHaveText(/Animated image: only the first frame was kept\./)
    await expect(toasts.nth(2)).toHaveText(/1 other file was ignored\./)

    const boxes = await Promise.all(
      [0, 1, 2].map(async (i) => (await toasts.nth(i).boundingBox())!),
    )
    const viewport = page.viewportSize()!
    for (const [i, a] of boxes.entries()) {
      expect(a.y >= 0 && a.y + a.height <= viewport.height, `toast ${i} on screen`).toBe(true)
      for (const b of boxes.slice(i + 1)) {
        const overlap = a.y < b.y + b.height && b.y < a.y + a.height && a.x < b.x + b.width
        expect(overlap && b.x < a.x + a.width, `toasts overlap`).toBe(false)
      }
    }
    await expect(toasts).toHaveCount(0, { timeout: 15_000 }) // info notices leave by themselves
  })
})

test.describe('latest open wins (AC-16b)', () => {
  test('a file chosen while a large one is reading opens alone; the Work stays zoomable', async ({
    page,
  }) => {
    await gotoReady(page)
    await dropGeneratedImage(page, { width: 4000, height: 3000 })
    await waitForWork(page, 4000, 3000)
    const first = await work(page)
    const level = await page.getByTestId('zoom-level').textContent()

    // Hold the 48 MP result so "during the read" never races a fast decoder.
    await page.evaluate(() => window.__imglyTest!.holdNextOpen())
    await dropGeneratedImage(page, { width: 8064, height: 6048 })
    const reading = page.getByRole('status').filter({ hasText: 'Opening image' })
    await expect(reading).toBeVisible()

    await page.getByRole('button', { name: 'Zoom in' }).click()
    await expect(page.getByTestId('zoom-level')).not.toHaveText(level!)
    expect(await work(page)).toEqual(first) // still the current Work while reading

    await dropGeneratedImage(page, { width: 300, height: 200 })
    await waitForWork(page, 300, 200)
    await page.evaluate(() => window.__imglyTest!.releaseHeldOpen())
    await page.waitForTimeout(1000)
    expect(await work(page)).toMatchObject({ width: 300, height: 200 })
    await expect(reading).toHaveCount(0)
  })
})
