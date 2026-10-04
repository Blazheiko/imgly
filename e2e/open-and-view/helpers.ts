import { expect, type Page } from '@playwright/test'

/** Builds an image in the page (no binary fixtures) and drops it onto the window. */
export async function dropGeneratedImage(
  page: Page,
  spec: { width: number; height: number; pattern?: 'gradient' | 'checker'; type?: string },
) {
  await page.evaluate(async ({ width, height, pattern = 'gradient', type = 'image/png' }) => {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    if (pattern === 'checker') {
      const img = ctx.createImageData(width, height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const v = (x + y) % 2 === 0 ? 0 : 255
          img.data.set([v, v, v, 255], (y * width + x) * 4)
        }
      }
      ctx.putImageData(img, 0, 0)
    } else {
      const g = ctx.createLinearGradient(0, 0, width, height)
      g.addColorStop(0, '#203060')
      g.addColorStop(1, '#e0a040')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
    }
    const blob = await canvas.convertToBlob({ type })
    const dt = new DataTransfer()
    dt.items.add(new File([blob], `generated.${type.split('/')[1]}`, { type }))
    for (const event of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(event, { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    }
  }, spec)
}

export async function waitForWork(page: Page, width: number, height: number) {
  await expect
    .poll(() => page.evaluate(() => window.__imglyTest?.work()), { timeout: 15_000 })
    .toMatchObject({ width, height })
}

export const view = (page: Page) => page.evaluate(() => window.__imglyTest!.view())

/** The canvas area in device pixels, as the View maths sees it. */
export async function canvasArea(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="preview-canvas"]') as HTMLCanvasElement
    const r = canvas.getBoundingClientRect()
    return {
      left: r.left,
      top: r.top,
      width: canvas.width,
      height: canvas.height,
      dpr: devicePixelRatio,
    }
  })
}

/** Loads the app and waits until the start-up gate has shown SCR-01. */
export async function gotoReady(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('button', { name: 'Open image' })).toBeVisible()
}
