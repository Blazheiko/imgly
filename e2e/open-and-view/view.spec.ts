import { expect, test } from '@playwright/test'
import { canvasArea, dropGeneratedImage, view, waitForWork } from './helpers'

const fitOf = (iw: number, ih: number, a: { width: number; height: number }) =>
  Math.min(a.width / iw, a.height / ih, 1)

test.describe('SCR-02 — View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./')
  })

  test('opens a 12 MP image at Fit, never above 100% (AC-01)', async ({ page }) => {
    await dropGeneratedImage(page, { width: 4000, height: 3000 })
    await waitForWork(page, 4000, 3000)

    const area = await canvasArea(page)
    await expect.poll(async () => (await view(page)).zoom).toBeCloseTo(fitOf(4000, 3000, area), 5)
    expect((await view(page)).autoFit).toBe(true)
  })

  test('shows a small image centred at 100%, not enlarged (AC-01)', async ({ page }) => {
    await dropGeneratedImage(page, { width: 200, height: 100 })
    await waitForWork(page, 200, 100)

    const area = await canvasArea(page)
    const v = await view(page)
    expect(v.zoom).toBe(1)
    expect(v.panX).toBeCloseTo((area.width - 200) / 2)
    expect(v.panY).toBeCloseTo((area.height - 100) / 2)
  })

  test('Ctrl+wheel zooms toward the pointer and never zooms the page (AC-12)', async ({ page }) => {
    await dropGeneratedImage(page, { width: 4000, height: 3000 })
    await waitForWork(page, 4000, 3000)
    const area = await canvasArea(page)
    const before = await view(page)
    const layoutWidth = await page.evaluate(() => document.documentElement.clientWidth)

    // Near the centre, so the edge clamp of AC-13 can't move the anchor.
    const pointer = {
      x: area.left + area.width / area.dpr / 2 + 40,
      y: area.top + area.height / area.dpr / 2 + 30,
    }
    await page.mouse.move(pointer.x, pointer.y)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -200)
    await page.keyboard.up('Control')

    await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(before.zoom)
    const after = await view(page)
    const px = (pointer.x - area.left) * area.dpr
    const py = (pointer.y - area.top) * area.dpr
    // The image point under the pointer stays under it.
    expect((px - after.panX) / after.zoom).toBeCloseTo((px - before.panX) / before.zoom, 0)
    expect((py - after.panY) / after.zoom).toBeCloseTo((py - before.panY) / before.zoom, 0)
    expect(after.autoFit).toBe(false)
    expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(layoutWidth)
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1)
  })

  test('drag pans and stops at the image edge (AC-13)', async ({ page }) => {
    await dropGeneratedImage(page, { width: 4000, height: 3000 })
    await waitForWork(page, 4000, 3000)
    const area = await canvasArea(page)
    await page.mouse.move(area.left + 100, area.top + 100)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -600)
    await page.keyboard.up('Control')
    await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(0.5)

    // Several strokes inside the viewport, together far more than the image overflows.
    const cssW = area.width / area.dpr
    const cssH = area.height / area.dpr
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(area.left + 10, area.top + 10)
      await page.mouse.down()
      await page.mouse.move(area.left + cssW - 10, area.top + cssH - 10, { steps: 5 })
      await page.mouse.up()
    }

    const v = await view(page)
    expect(v.panX).toBe(0)
    expect(v.panY).toBe(0)
  })

  test('resize re-fits until a manual zoom, then keeps the zoom (AC-12b)', async ({ page }) => {
    await dropGeneratedImage(page, { width: 4000, height: 3000 })
    await waitForWork(page, 4000, 3000)

    const initial = await canvasArea(page)
    await page.setViewportSize({ width: 900, height: 700 })
    await expect.poll(async () => (await canvasArea(page)).width).toBeLessThan(initial.width)
    await expect
      .poll(async () => (await view(page)).zoom)
      .toBeCloseTo(fitOf(4000, 3000, await canvasArea(page)), 5)

    const area = await canvasArea(page)
    await page.mouse.move(area.left + 100, area.top + 100)
    await page.keyboard.down('Control')
    await page.mouse.wheel(0, -200)
    await page.keyboard.up('Control')
    await expect.poll(async () => (await view(page)).autoFit).toBe(false)
    const zoomed = (await view(page)).zoom

    await page.setViewportSize({ width: 1200, height: 800 })
    await expect.poll(async () => (await canvasArea(page)).width).toBeGreaterThan(area.width)
    expect((await view(page)).zoom).toBe(zoomed)
  })

  test('shows one image pixel per device pixel at 100% (Chromium)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'WebGL pixel checks stay on Chromium only')
    await dropGeneratedImage(page, { width: 64, height: 64, pattern: 'checker' })
    await waitForWork(page, 64, 64)
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
        width: 64 / area.dpr,
        height: 64 / area.dpr,
      },
      scale: 'device',
    })
    const mismatches = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const c = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = c.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0)
      const { data } = ctx.getImageData(0, 0, 64, 64)
      let bad = 0
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 64; x++) {
          const expected = (x + y) % 2 === 0 ? 0 : 255
          if (Math.abs(data[(y * 64 + x) * 4]! - expected) > 8) bad++
        }
      }
      return bad
    }, shot.toString('base64'))
    expect(mismatches).toBe(0)
  })
})
