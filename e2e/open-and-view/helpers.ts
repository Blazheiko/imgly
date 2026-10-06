import { expect, type Page } from '@playwright/test'

/**
 * Whether the app cancelled each drag event's default. A synthetic drop never navigates, so this —
 * not the URL — is what proves the page would stay put on a real drop (AC-02).
 */
export type DropPrevented = { dragover: boolean; drop: boolean }

/** Builds an image in the page (no binary fixtures) and drops it onto the window. */
export async function dropGeneratedImage(
  page: Page,
  spec: { width: number; height: number; pattern?: 'gradient' | 'checker'; type?: string },
): Promise<DropPrevented> {
  return page.evaluate(async ({ width, height, pattern = 'gradient', type = 'image/png' }) => {
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
    const prevented: Record<string, boolean> = {}
    for (const type of ['dragenter', 'dragover', 'drop']) {
      const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt })
      document.body.dispatchEvent(event)
      prevented[type] = event.defaultPrevented
    }
    return { dragover: prevented.dragover!, drop: prevented.drop! }
  }, spec)
}

export async function waitForWork(page: Page, width: number, height: number) {
  await expect
    .poll(() => page.evaluate(() => window.__imglyTest?.work()), { timeout: 15_000 })
    .toMatchObject({ width, height })
}

export const view = (page: Page) => page.evaluate(() => window.__imglyTest!.view())

/**
 * The leak check (test-plan cleanup boundary): every bitmap the worker sent has been closed except
 * the one Original the Work keeps (AC-05, AC-16b).
 */
export async function expectOneRetainedOriginal(page: Page) {
  await expect
    .poll(() => page.evaluate(() => window.__imglyTest!.bitmaps().retained), { timeout: 5_000 })
    .toBe(1)
}

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
  try {
    await expect(page.getByRole('button', { name: 'Open image' })).toBeVisible()
  } catch (error) {
    throw new Error(`SCR-01 never showed. ${await startupDiagnosis(page)}`, { cause: error })
  }
}

/** Why the start-up gate did not pass: what is on screen and each capability check run again. */
async function startupDiagnosis(page: Page): Promise<string> {
  const unsupported = await page
    .getByRole('heading', { name: "This browser can't display the editor." })
    .isVisible()
  const probe = await page.evaluate(async () => {
    const started = performance.now()
    const gl = document.createElement('canvas').getContext('webgl2')
    const info = gl?.getExtension('WEBGL_debug_renderer_info')
    const webgl2 = gl
      ? {
          maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
          renderer: info
            ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER),
        }
      : null
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    const webglMs = Math.round(performance.now() - started)
    const workerStarted = performance.now()
    const worker = await new Promise<string>((resolve) => {
      const src = `self.postMessage(typeof OffscreenCanvas === 'function' && !!new OffscreenCanvas(1, 1).getContext('2d'))`
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
      const w = new Worker(url)
      const timer = setTimeout(() => resolve('timeout after 10 s'), 10_000)
      w.onmessage = (e) => (clearTimeout(timer), w.terminate(), resolve(String(e.data)))
      w.onerror = (e) => (clearTimeout(timer), w.terminate(), resolve(`error: ${e.message}`))
    })
    return {
      webgl2,
      webglMs,
      createImageBitmap: typeof createImageBitmap === 'function',
      worker,
      workerMs: Math.round(performance.now() - workerStarted),
    }
  })
  return `Unsupported screen: ${unsupported}. Probe again: ${JSON.stringify(probe)}`
}
