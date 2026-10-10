/**
 * @perf — draw performance suite (spec §6 NFR rows, sad.md §10, §11 hot-path risk).
 *
 * Runs by hand on the reference machine (Apple M1 MacBook Air or equivalent, latest stable
 * Chrome) before release; CI excludes it. Run with:
 *
 *   PERF=1 pnpm test:e2e e2e/draw/perf.spec.ts --project chromium
 *
 * The Work is 4096×3072; each p95 is over 20 runs after 2 warm-ups, with the View at Fit and at
 * 100%. Scripted pointer moves arrive at 120 per second. A miss is reported with the measured
 * value, never met by changing a threshold.
 *
 * The hot-path spike (T9) paints scripted Strokes through `__imglyTest.paintStroke` — the painter,
 * the dirty rectangle and the Preview upload, without the tool UI.
 */
import { expect, test, type Page } from '@playwright/test'
import { p95 } from '../perf-memory'
import { gotoReady, waitForWork } from '../open-and-view/helpers'

const WARM_UP = 2
const RUNS = 20
const SIZE = { width: 4096, height: 3072 }
const MOVES = 240 // 2 s at 120 Hz
const results: Record<string, string> = {}

test.skip(({ browserName }) => browserName !== 'chromium', 'The @perf suite measures Chrome')
test.describe.configure({ mode: 'default' })

/** Opens a 4096×3072 JPEG Work by drop. */
async function prepare(page: Page) {
  await gotoReady(page)
  await page.evaluate(async ({ width, height }) => {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, width, height)
    g.addColorStop(0, '#203060')
    g.addColorStop(1, '#e0a040')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    const dt = new DataTransfer()
    dt.items.add(new File([blob], 'perf.jpg', { type: 'image/jpeg' }))
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    }
  }, SIZE)
  await waitForWork(page, SIZE.width, SIZE.height)
}

/**
 * A wavy Stroke of MOVES points across the middle of the image, in the Crop's frame. At 100% the
 * Preview shows about the canvas area around the image's top-left corner, so the Stroke stays
 * inside what is visible there too.
 */
function strokePoints(atActualSize: boolean, run: number) {
  const span = atActualSize
    ? { x: 100, y: 100, w: 900, h: 500 }
    : { x: 300, y: 300, w: 3500, h: 2400 }
  return Array.from({ length: MOVES }, (_, i) => {
    const t = i / (MOVES - 1)
    return {
      x: span.x + t * span.w,
      y: span.y + span.h / 2 + (span.h / 2) * Math.sin(t * Math.PI * 6 + run),
    }
  })
}

for (const zoom of ['Fit', '100%'] as const) {
  for (const width of [1, 200]) {
    test(`@perf spike: ${width} px Brush at ${zoom} — frame interval p95 ≤ 33 ms, latency p95 ≤ 50 ms`, async ({
      page,
    }) => {
      test.setTimeout(240_000)
      await prepare(page)
      // Shift+0 is 100%; a fresh open is at Fit.
      if (zoom === '100%') await page.keyboard.press('Shift+Digit0')
      const intervals: number[] = []
      const latencies: number[] = []
      for (let i = 0; i < WARM_UP + RUNS; i++) {
        const run = await page.evaluate(
          ({ points, width }) =>
            window.__imglyTest!.paintStroke(
              points,
              { mode: 'brush', colour: '#E53935', width },
              120,
            ),
          { points: strokePoints(zoom === '100%', i), width },
        )
        if (i >= WARM_UP) {
          intervals.push(...run.frameIntervals)
          latencies.push(...run.latencies)
        }
      }
      const frame = p95(intervals)
      const latency = p95(latencies)
      results[`${width} px at ${zoom}: frame interval p95`] =
        `${frame.toFixed(1)} ms (target ≤ 33 ms)`
      results[`${width} px at ${zoom}: move-to-frame p95`] =
        `${latency.toFixed(1)} ms (target ≤ 50 ms)`
      expect.soft(frame).toBeLessThanOrEqual(33)
      expect.soft(latency).toBeLessThanOrEqual(50)
    })
  }
}

test.afterAll(() => {
  console.log('\ndraw @perf results:')
  for (const [name, value] of Object.entries(results)) console.log(`  ${name}: ${value}`)
})
