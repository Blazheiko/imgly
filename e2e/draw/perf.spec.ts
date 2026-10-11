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
 * the dirty rectangle and the Preview upload, without the tool UI. The overlay rows dispatch the
 * pointer events in the page, to the tool's own handlers. Brush and Eraser are both measured.
 */
import { expect, test, type Page } from '@playwright/test'
import { p95, settledKiB } from '../perf-memory'
import { gotoReady, waitForWork } from '../open-and-view/helpers'

const WARM_UP = 2
const RUNS = 20
const SIZE = { width: 4096, height: 3072 }
const MOVES = 240 // 2 s at 120 Hz
const results: Record<string, string> = {}

test.skip(({ browserName }) => browserName !== 'chromium', 'The @perf suite measures Chrome')
// Headless Chromium renders WebGL with SwiftShader, on the CPU: every frame then costs the
// software GL, not the GPU the reference machine draws with. Headed, it uses the GPU (Metal on
// a Mac); the suite opens a browser window while it runs. The pixel ratio is the reference
// machine's Retina 2: an emulated 1 would disagree with the device pixels the canvas sizes by.
// Stable Chrome, as the reference machine runs (spec §6), not Playwright's bundled Chromium.
test.use({ headless: false, deviceScaleFactor: 2, channel: 'chrome' })
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
  // The median frame interval when idle: 16.7 ms at the reference machine's 60 Hz. A 120 Hz
  // display halves what a missed frame costs and would hide it from the 33 ms rows, so the
  // suite refuses to measure there (review 2026-10-10, R2).
  const median = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const times: number[] = []
        const tick = (t: number) => {
          times.push(t)
          if (times.length < 121) requestAnimationFrame(tick)
          else {
            const gaps = times
              .slice(1)
              .map((v, i) => v - times[i]!)
              .sort((a, b) => a - b)
            resolve(gaps[gaps.length >> 1]!)
          }
        }
        requestAnimationFrame(tick)
      }),
  )
  results['display refresh'] =
    `${(1000 / median).toFixed(0)} Hz (median frame ${median.toFixed(1)} ms)`
  results['browser'] =
    `${page.context().browser()!.browserType().name()} ${page.context().browser()!.version()}`
  expect(
    median,
    'set the display to 60 Hz: the rows assume the reference refresh rate',
  ).toBeGreaterThan(15)
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

for (const mode of ['brush', 'eraser'] as const) {
  for (const zoom of ['Fit', '100%'] as const) {
    for (const width of [1, 200]) {
      const label = `${width} px ${mode === 'brush' ? 'Brush' : 'Eraser'} at ${zoom}`
      test(`@perf spike: ${label} — frame interval p95 ≤ 33 ms, latency p95 ≤ 50 ms`, async ({
        page,
      }) => {
        test.setTimeout(240_000)
        await prepare(page)
        // Shift+0 is 100%; a fresh open is at Fit.
        if (zoom === '100%') await page.keyboard.press('Shift+Digit0')
        const intervals: number[] = []
        const latencies: number[] = []
        for (let i = 0; i < WARM_UP + RUNS; i++) {
          // The Eraser works on a copy of a layer covered by marks, so every segment erases.
          const run = await page.evaluate(
            ({ points, width, mode }) =>
              window.__imglyTest!.paintStroke(
                points,
                { mode, colour: '#E53935', width },
                120,
                mode === 'eraser',
              ),
            { points: strokePoints(zoom === '100%', i), width, mode },
          )
          if (i >= WARM_UP) {
            intervals.push(...run.frameIntervals)
            latencies.push(...run.latencies)
          }
        }
        const frame = p95(intervals)
        const latency = p95(latencies)
        results[`spike ${label}: frame interval p95`] = `${frame.toFixed(1)} ms (target ≤ 33 ms)`
        results[`spike ${label}: move-to-frame p95`] = `${latency.toFixed(1)} ms (target ≤ 50 ms)`
        expect.soft(frame).toBeLessThanOrEqual(33)
        expect.soft(latency).toBeLessThanOrEqual(50)
      })
    }
  }
}

// --- T20: the spec §6 rows through the real tool ---

/**
 * Records the time of every draw the Preview renderer makes on its own canvas, and of every
 * pointer move the overlay receives. Added before the page loads.
 */
async function recordDraws(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __draws: number[]; __moves: number[]; __up: number }
    w.__draws = []
    w.__moves = []
    w.__up = Infinity
    const draw = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      const canvas = this.canvas
      if (canvas instanceof HTMLCanvasElement && canvas.dataset.testid === 'preview-canvas') {
        w.__draws.push(performance.now())
      }
      return draw.apply(this, args)
    }
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.buttons === 1) w.__moves.push(performance.now())
      },
      true,
    )
    window.addEventListener('pointerup', () => (w.__up = performance.now()), true)
  })
}

/**
 * One Stroke through the real overlay: MOVES pointer events at 120 per second across the canvas
 * area, then the Preview draw intervals during it and each move's latency to the frame that shows
 * the Stroke reaching it. The segment ending at a move is painted when the next move arrives
 * (ADR-0002), or on release for the last one: the first draw after that.
 *
 * The events are dispatched in the page on a 120 Hz schedule, to the overlay's own handlers. Sent
 * through Playwright's mouse instead, each move waits on a CDP round trip: they reached the page
 * about 50 ms apart (p95), so the Preview's draws followed the input's pace, not the renderer's.
 */
async function overlayStroke(page: Page, run: number) {
  return page.evaluate(
    async ({ moves: count, run }) => {
      const w = window as unknown as { __draws: number[]; __moves: number[]; __up: number }
      w.__draws = []
      w.__moves = []
      w.__up = Infinity
      const overlay = document.querySelector('[data-testid="draw-overlay"]')!
      const box = overlay.getBoundingClientRect()
      const at = (i: number) => {
        const t = i / (count - 1)
        return {
          clientX: box.left + box.width * (0.1 + 0.8 * t),
          clientY: box.top + box.height * (0.5 + 0.35 * Math.sin(t * Math.PI * 6 + run)),
        }
      }
      const fire = (type: string, i: number, buttons: number) =>
        overlay.dispatchEvent(
          new PointerEvent(type, {
            ...at(i),
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            button: type === 'pointermove' ? -1 : 0,
            buttons,
          }),
        )
      fire('pointerdown', 0, 1)
      const start = performance.now()
      for (let i = 1; i < count; i++) {
        const due = start + (i * 1000) / 120
        await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())))
        fire('pointermove', i, 1)
      }
      fire('pointerup', count - 1, 0)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const { __draws: draws, __moves: moves, __up: up } = w
      const intervals = draws.slice(1).map((t, k) => t - draws[k]!)
      const inputs = moves.slice(1).map((t, k) => t - moves[k]!)
      const latencies = moves.flatMap((m, k) => {
        const painted = moves[k + 1] ?? up
        const next = draws.find((d) => d >= painted)
        return next === undefined ? [] : [next - m]
      })
      return { intervals, latencies, inputs }
    },
    { moves: MOVES, run },
  )
}

for (const mode of ['brush', 'eraser'] as const) {
  for (const zoom of ['Fit', '100%'] as const) {
    for (const width of [1, 200]) {
      const label = `${width} px ${mode === 'brush' ? 'Brush' : 'Eraser'} at ${zoom}`
      test(`@perf drawing through the overlay: ${label} — frame interval p95 ≤ 33 ms, latency p95 ≤ 50 ms`, async ({
        page,
      }) => {
        test.setTimeout(300_000)
        await recordDraws(page)
        await prepare(page)
        // The Eraser works on a copy of an applied layer covered by marks, so every segment erases.
        if (mode === 'eraser') await page.evaluate(() => window.__imglyTest!.setFullDrawing())
        if (zoom === '100%') await page.keyboard.press('Shift+Digit0')
        const tool = page.getByTestId('draw-tool')
        const open = async () => {
          await page.getByTestId('draw-action').click()
          if (mode === 'eraser') await tool.getByRole('radio', { name: 'Eraser' }).click()
          const field = tool.getByRole('textbox', { name: 'Width' })
          await field.fill(String(width))
          await field.press('Enter')
        }
        await open()
        const intervals: number[] = []
        const latencies: number[] = []
        const inputs: number[] = []
        for (let i = 0; i < WARM_UP + RUNS; i++) {
          const run = await overlayStroke(page, i)
          if (i >= WARM_UP) {
            intervals.push(...run.intervals)
            latencies.push(...run.latencies)
            inputs.push(...run.inputs)
          }
          if (i % 5 === 4) {
            // Between batches: the Brush's Draft is cleared before it fills up; the Eraser's
            // is cancelled and the tool reopened on a fresh copy of the full layer.
            if (mode === 'brush') await page.getByTestId('draw-clear').click()
            else {
              await page.getByTestId('draw-cancel').click()
              await open()
            }
          }
        }
        const frame = p95(intervals)
        const latency = p95(latencies)
        results[`overlay ${label}: frame interval p95`] = `${frame.toFixed(1)} ms (target ≤ 33 ms)`
        results[`overlay ${label}: move-to-frame p95`] = `${latency.toFixed(1)} ms (target ≤ 50 ms)`
        results[`overlay ${label}: pointer move interval p95`] =
          `${p95(inputs).toFixed(1)} ms (sent at 8.3 ms)`
        expect.soft(frame).toBeLessThanOrEqual(33)
        expect.soft(latency).toBeLessThanOrEqual(50)
      })
    }
  }
}

/** Clicks the Draw action and resolves with the time to the tool-ready mark. */
function timedOpen(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        performance.clearMarks('imgly:draw-tool-ready')
        const start = performance.now()
        new PerformanceObserver((list, observer) => {
          const mark = list.getEntriesByName('imgly:draw-tool-ready')[0]
          if (!mark) return
          observer.disconnect()
          requestAnimationFrame(() => resolve(mark.startTime - start))
        }).observe({ type: 'mark' })
        ;(document.querySelector('[data-testid="draw-action"]') as HTMLButtonElement).click()
      }),
  )
}

/** Clicks a button by its test id and resolves with the time to the second frame after it. */
function timedClick(page: Page, testid: string): Promise<number> {
  return page.evaluate(
    (testid) =>
      new Promise<number>((resolve) => {
        const start = performance.now()
        ;(document.querySelector(`[data-testid="${testid}"]`) as HTMLButtonElement).click()
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)))
      }),
    testid,
  )
}

test('@perf tool ready after "Draw": p95 ≤ 150 ms', async ({ page }) => {
  test.setTimeout(120_000)
  await prepare(page)
  await page.evaluate(() => window.__imglyTest!.setFullDrawing())
  const runs: number[] = []
  for (let i = 0; i < WARM_UP + RUNS; i++) {
    runs.push(await timedOpen(page))
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('draw-tool')).toBeHidden()
  }
  const time = p95(runs.slice(WARM_UP))
  results['tool ready p95'] = `${Math.round(time)} ms (target ≤ 150 ms)`
  expect(time).toBeLessThanOrEqual(150)
})

for (const act of ['apply', 'cancel', 'clear'] as const) {
  test(`@perf ${act} over a full layer to the updated Preview: p95 ≤ 150 ms`, async ({ page }) => {
    test.setTimeout(180_000)
    await prepare(page)
    await page.evaluate(() => window.__imglyTest!.setFullDrawing())
    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) {
      if (act === 'apply') await page.evaluate(() => window.__imglyTest!.setFullDrawing())
      await timedOpen(page)
      runs.push(await timedClick(page, `draw-${act}`))
      if (act === 'clear') await page.getByTestId('draw-cancel').click()
      await expect(page.getByTestId('draw-tool')).toBeHidden()
    }
    const time = p95(runs.slice(WARM_UP))
    results[`${act} p95`] = `${Math.round(time)} ms (target ≤ 150 ms)`
    expect(time).toBeLessThanOrEqual(150)
  })
}

test('@perf Apply in "Crop and rotate" with a full layer to the updated Preview: p95 ≤ 150 ms', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await prepare(page)
  await page.evaluate(() => window.__imglyTest!.setFullDrawing())
  const runs: number[] = []
  for (let i = 0; i < WARM_UP + RUNS; i++) {
    await page.getByTestId('crop-rotate-action').click()
    await page.getByRole('button', { name: 'Rotate right' }).click()
    runs.push(
      await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const apply = [...document.querySelectorAll('button')].find(
              (b) => b.textContent?.trim() === 'Apply',
            )!
            const start = performance.now()
            apply.click()
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(performance.now() - start)),
            )
          }),
      ),
    )
    await expect(page.getByTestId('crop-rotate-tool')).toBeHidden()
  }
  const time = p95(runs.slice(WARM_UP))
  results['crop-rotate Apply p95'] = `${Math.round(time)} ms (target ≤ 150 ms)`
  expect(time).toBeLessThanOrEqual(150)
})

test('@perf memory after 50 Applies, each a Stroke across the whole image, ≤ 110% of the first', async ({
  page,
}) => {
  test.setTimeout(600_000)
  await prepare(page)
  const box = (await page.getByTestId('preview-canvas').boundingBox())!
  async function strokeAndApply(i: number) {
    await page.getByTestId('draw-action').click()
    const field = page.getByTestId('draw-tool').getByRole('textbox', { name: 'Width' })
    await field.fill('200')
    await field.press('Enter')
    // From one edge of the shown image to the other, a different height each time.
    const y = box.y + box.height * (0.2 + (0.6 * ((i * 7) % 10)) / 10)
    await page.mouse.move(box.x + 2, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width - 2, y, { steps: 20 })
    await page.mouse.up()
    await page.getByTestId('draw-apply').click()
    await expect(page.getByTestId('draw-tool')).toBeHidden()
  }
  await strokeAndApply(0)
  const first = await settledKiB(page)
  for (let i = 1; i < 50; i++) await strokeAndApply(i)
  const last = await settledKiB(page)
  const ledger = await page.evaluate(() => window.__imglyTest!.layers())
  results['memory after 50 Applies'] = `${Math.round((last / first) * 100)}% of the first (≤ 110%)`
  results['layers retained'] = `${ledger.retained} (target 1)`
  expect(ledger.retained).toBe(1)
  expect(last / first).toBeLessThanOrEqual(1.1)
})

test.afterAll(() => {
  console.log('\ndraw @perf results:')
  for (const [name, value] of Object.entries(results)) console.log(`  ${name}: ${value}`)
})
