/**
 * @perf — adjust performance suite (spec §6 NFR rows, sad.md §10 QG-3).
 *
 * Runs by hand on the reference machine (Apple M1 MacBook Air or equivalent, latest stable
 * Chrome) before release; CI excludes it. Run with:
 *
 *   PERF=1 pnpm test:e2e e2e/adjust/perf.spec.ts --project chromium
 *
 * The Work is 4096×3072; each p95 is over 20 runs after 2 warm-ups. A miss is reported with the
 * measured value, never met by changing a threshold. Export time with all seven values set is in
 * e2e/export/perf.spec.ts.
 */
import { expect, test, type Page } from '@playwright/test'
import { p95, settledKiB } from '../perf-memory'
import { adjusted, applyAdjustments, gotoReady, waitForWork } from './helpers'

const WARM_UP = 2
const RUNS = 20
const SIZE = { width: 4096, height: 3072 }
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

/** Clicks "Adjust" and resolves with the time to the tool-ready mark. */
function timedOpen(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        performance.clearMarks('imgly:adjust-tool-ready')
        const start = performance.now()
        new PerformanceObserver((list, observer) => {
          const mark = list.getEntriesByName('imgly:adjust-tool-ready')[0]
          if (!mark) return
          observer.disconnect()
          requestAnimationFrame(() => resolve(mark.startTime - start))
        }).observe({ type: 'mark' })
        ;(document.querySelector('[data-testid="adjust-action"]') as HTMLButtonElement).click()
      }),
  )
}

/** Moves a slider of the open tool to `value`, as a drag step does. */
function setSlider(page: Page, name: string, value: number) {
  return page.evaluate(
    ({ name, value }) => {
      const range = document.querySelector(
        `input[type="range"][aria-label="${name}"]`,
      ) as HTMLInputElement
      range.value = String(value)
      range.dispatchEvent(new Event('input', { bubbles: true }))
    },
    { name, value },
  )
}

/**
 * Runs `act` (a button click or a Compare release) in the page and resolves with the time until
 * the frame after the one in which the Preview redraws (two frames: the renderer draws on the first).
 */
function timed(page: Page, act: 'Apply' | 'Cancel' | 'Reset' | 'compare-release'): Promise<number> {
  return page.evaluate(
    (act) =>
      new Promise<number>((resolve) => {
        const button = (name: string) =>
          [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!
        let start: number
        if (act === 'compare-release') {
          const compare = button('Compare')
          compare.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
          start = performance.now()
          compare.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }))
        } else {
          start = performance.now()
          button(act).click()
        }
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)))
      }),
    act,
  )
}

/** Clicks Auto and resolves with the time to the Auto-shown mark. */
function timedAuto(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        performance.clearMarks('imgly:adjust-auto-shown')
        const start = performance.now()
        new PerformanceObserver((list, observer) => {
          const mark = list.getEntriesByName('imgly:adjust-auto-shown')[0]
          if (!mark) return
          observer.disconnect()
          resolve(mark.startTime - start)
        }).observe({ type: 'mark' })
        ;[...document.querySelectorAll('button')]
          .find((b) => b.textContent?.trim() === 'Auto')!
          .click()
      }),
  )
}

/** The seven sliders with their ranges (AC-01), for the drag scenario. */
const SLIDERS: [name: string, min: number, max: number][] = [
  ['Brightness', -100, 100],
  ['Contrast', -100, 100],
  ['Saturation', -100, 100],
  ['Temperature', -100, 100],
  ['Tint', -100, 100],
  ['Grayscale', 0, 100],
  ['Sepia', 0, 100],
]
const DRAG_FRAMES = 120 // 2 s at 60 Hz

/**
 * Records the time of every draw the Preview renderer makes on its own canvas, in
 * `window.__previewDraws`. Added before the page loads so the renderer's context is covered; the
 * export worker's context lives in another global and is not.
 */
async function recordPreviewDraws(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __previewDraws: number[] }
    w.__previewDraws = []
    const draw = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      const canvas = this.canvas
      if (canvas instanceof HTMLCanvasElement && canvas.dataset.testid === 'preview-canvas') {
        w.__previewDraws.push(performance.now())
      }
      return draw.apply(this, args)
    }
  })
}

/**
 * One 2 s drag of a slider, one value per display frame across its range, and the intervals (ms)
 * between the renderer's draws of the Preview meanwhile.
 */
function dragDrawIntervals(page: Page, name: string, min: number, max: number): Promise<number[]> {
  return page.evaluate(
    ({ name, min, max, frames }) =>
      new Promise<number[]>((resolve) => {
        const w = window as unknown as { __previewDraws: number[] }
        const range = document.querySelector(
          `input[type="range"][aria-label="${name}"]`,
        ) as HTMLInputElement
        const span = max - min
        let i = 0
        const move = () => {
          // A triangle wave over the whole range, three steps per frame: every frame is a change.
          const phase = (i * 3) % (2 * span)
          range.value = String(min + (phase <= span ? phase : 2 * span - phase))
          range.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const tick = () => {
          i++
          // As a pointer move: a task between frames, not inside this frame's callbacks, where the
          // renderer's own frame request would land a frame late.
          setTimeout(move, 0)
          if (i < frames) requestAnimationFrame(tick)
          // Two more frames: the renderer draws the last value in the frame after it.
          else
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const draws = w.__previewDraws
                resolve(draws.slice(1).map((t, k) => t - draws[k]!))
              }),
            )
        }
        w.__previewDraws = []
        requestAnimationFrame(tick)
      }),
    { name, min, max, frames: DRAG_FRAMES },
  )
}

test('@perf tool ready after "Adjust": p95 ≤ 150 ms', async ({ page }) => {
  test.setTimeout(120_000)
  await prepare(page)
  const runs: number[] = []
  for (let i = 0; i < WARM_UP + RUNS; i++) {
    runs.push(await timedOpen(page))
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('adjust-tool')).toBeHidden()
  }
  const time = p95(runs.slice(WARM_UP))
  results['tool ready p95'] = `${Math.round(time)} ms (target ≤ 150 ms)`
  expect(time).toBeLessThanOrEqual(150)
})

for (const act of ['Apply', 'Cancel', 'Reset', 'compare-release'] as const) {
  test(`@perf ${act} to the updated Preview: p95 ≤ 150 ms`, async ({ page }) => {
    test.setTimeout(120_000)
    await prepare(page)
    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) {
      if (!(await page.getByTestId('adjust-tool').isVisible())) await timedOpen(page)
      await setSlider(page, 'Contrast', (i % 2 === 0 ? 1 : -1) * (20 + i))
      runs.push(await timed(page, act))
    }
    const time = p95(runs.slice(WARM_UP))
    results[`${act} p95`] = `${Math.round(time)} ms (target ≤ 150 ms)`
    expect(time).toBeLessThanOrEqual(150)
  })
}

for (const [name, min, max] of SLIDERS) {
  test(`@perf dragging ${name}: p95 interval between Preview draws ≤ 33 ms`, async ({ page }) => {
    test.setTimeout(180_000)
    await recordPreviewDraws(page)
    await prepare(page)
    await timedOpen(page)
    const intervals: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) {
      const run = await dragDrawIntervals(page, name, min, max)
      // At least 30 updates per second, as §6 row 1 asks, or the p95 below means nothing.
      expect(run.length + 1, `draws in run ${i}`).toBeGreaterThanOrEqual(DRAG_FRAMES / 2)
      if (i >= WARM_UP) intervals.push(...run)
    }
    const time = p95(intervals)
    results[`${name} drag draw interval p95`] = `${time.toFixed(1)} ms (target ≤ 33 ms)`
    expect(time).toBeLessThanOrEqual(33)
  })
}

test('@perf Auto to the sliders and the Preview: p95 ≤ 300 ms', async ({ page }) => {
  test.setTimeout(120_000)
  await prepare(page)
  await timedOpen(page)
  const runs: number[] = []
  for (let i = 0; i < WARM_UP + RUNS; i++) {
    await setSlider(page, 'Brightness', 0) // a change before each Auto, so the Preview redraws
    runs.push(await timedAuto(page))
  }
  const time = p95(runs.slice(WARM_UP))
  results['Auto p95'] = `${Math.round(time)} ms (target ≤ 300 ms)`
  expect(time).toBeLessThanOrEqual(300)
})

test('@perf memory after 50 applied Adjustment changes is ≤ 110% of the first Apply', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await prepare(page)
  const changes = Array.from({ length: 50 }, (_, i) =>
    adjusted({
      brightness: ((i * 37) % 201) - 100,
      contrast: ((i * 53) % 201) - 100,
      saturation: ((i * 29) % 201) - 100,
      temperature: ((i * 17) % 201) - 100,
      tint: ((i * 11) % 201) - 100,
      grayscale: (i * 7) % 101,
      sepia: (i * 13) % 101,
    }),
  )
  await applyAdjustments(page, changes[0]!)
  const first = await settledKiB(page)
  for (const a of changes.slice(1)) await applyAdjustments(page, a)
  const last = await settledKiB(page)
  const bitmaps = await page.evaluate(() => window.__imglyTest!.bitmaps())

  results['memory after 50 Applies'] = `${Math.round((last / first) * 100)}% of the first (≤ 110%)`
  expect(bitmaps.retained).toBe(1)
  expect(last / first).toBeLessThanOrEqual(1.1)
})

test.afterAll(() => {
  if (Object.keys(results).length === 0) return
  console.log(
    '\nadjust @perf results\n' +
      Object.entries(results)
        .map(([k, v]) => `  ${k.padEnd(32)} ${v}`)
        .join('\n'),
  )
})
