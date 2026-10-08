/**
 * @perf — crop-rotate performance suite (spec §6 NFR rows, sad.md §10 QG-3).
 *
 * Runs by hand on the reference machine (Apple M1 MacBook Air or equivalent, latest stable
 * Chrome) before release; CI excludes it. Run with:
 *
 *   PERF=1 pnpm test:e2e e2e/crop-rotate/perf.spec.ts --project chromium
 *
 * The Work is 4096×3072; each p95 is over 20 runs after 2 warm-ups. A miss is reported with the
 * measured value, never met by changing a threshold.
 */
import { expect, test, type Page } from '@playwright/test'
import { p95, settledKiB } from '../perf-memory'
import {
  applyGeometry,
  gotoReady,
  identityGeometry,
  setStraighten,
  waitForWork,
  type Geometry,
} from './helpers'

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

/**
 * Clicks the button named `name` in the page and resolves with the time until the frame after the
 * one in which the Preview redraws (two animation frames: the renderer draws on the first).
 */
function timedClick(page: Page, name: string): Promise<number> {
  return page.evaluate(
    (name) =>
      new Promise<number>((resolve) => {
        const button = [...document.querySelectorAll('button')].find(
          (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
        )!
        const start = performance.now()
        button.click()
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)))
      }),
    name,
  )
}

/** Clicks "Crop and rotate" and resolves when the tool-ready mark is set. */
function timedOpen(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        performance.clearMarks('imgly:crop-tool-ready')
        const start = performance.now()
        new PerformanceObserver((list, observer) => {
          const mark = list.getEntriesByName('imgly:crop-tool-ready')[0]
          if (!mark) return
          observer.disconnect()
          requestAnimationFrame(() => resolve(mark.startTime - start))
        }).observe({ type: 'mark' })
        ;(document.querySelector('[data-testid="crop-rotate-action"]') as HTMLButtonElement).click()
      }),
  )
}

/** Frame intervals (ms) while `step(i)` changes something every animation frame for ~2 s. */
function frameIntervals(page: Page, kind: 'slider' | 'frame'): Promise<number[]> {
  return page.evaluate(
    (kind) =>
      new Promise<number[]>((resolve) => {
        const times: number[] = []
        const range = document.querySelector('input[type="range"]') as HTMLInputElement
        const frame = document.querySelector('[data-testid="crop-frame"]') as HTMLElement
        const box = frame.getBoundingClientRect()
        if (kind === 'frame') {
          frame.dispatchEvent(
            new PointerEvent('pointerdown', {
              bubbles: true,
              button: 0,
              pointerId: 7,
              clientX: box.left + box.width / 2,
              clientY: box.top + box.height / 2,
            }),
          )
        }
        let i = 0
        const tick = (t: number) => {
          times.push(t)
          i++
          if (kind === 'slider') {
            range.value = String(((i % 200) - 100) / 10)
            range.dispatchEvent(new Event('input', { bubbles: true }))
          } else {
            frame.dispatchEvent(
              new PointerEvent('pointermove', {
                bubbles: true,
                pointerId: 7,
                clientX: box.left + box.width / 2 + Math.sin(i / 10) * 40,
                clientY: box.top + box.height / 2,
              }),
            )
          }
          if (i < 120) requestAnimationFrame(tick)
          else {
            frame.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }))
            resolve(times.slice(1).map((t, k) => t - times[k]!))
          }
        }
        requestAnimationFrame(tick)
      }),
    kind,
  )
}

test('@perf tool ready after "Crop and rotate": p95 ≤ 150 ms', async ({ page }) => {
  test.setTimeout(120_000)
  await prepare(page)
  const runs: number[] = []
  for (let i = 0; i < WARM_UP + RUNS; i++) {
    runs.push(await timedOpen(page))
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('crop-rotate-tool')).toBeHidden()
  }
  const time = p95(runs.slice(WARM_UP))
  results['tool ready p95'] = `${Math.round(time)} ms (target ≤ 150 ms)`
  expect(time).toBeLessThanOrEqual(150)
})

for (const name of ['Rotate right', 'Flip horizontal', 'Reset', 'Apply', 'Cancel']) {
  test(`@perf "${name}" to the updated Preview: p95 ≤ 150 ms`, async ({ page }) => {
    test.setTimeout(120_000)
    await prepare(page)
    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) {
      if (!(await page.getByTestId('crop-rotate-tool').isVisible())) await timedOpen(page)
      if (name === 'Reset') await timedClick(page, 'Rotate right')
      runs.push(await timedClick(page, name))
    }
    const time = p95(runs.slice(WARM_UP))
    results[`${name} p95`] = `${Math.round(time)} ms (target ≤ 150 ms)`
    expect(time).toBeLessThanOrEqual(150)
  })
}

for (const kind of ['slider', 'frame'] as const) {
  test(`@perf dragging the ${kind}: p95 frame interval ≤ 33 ms`, async ({ page }) => {
    test.setTimeout(120_000)
    await prepare(page)
    await timedOpen(page)
    if (kind === 'frame') {
      // A frame with room to move.
      await page.getByRole('radio', { name: '1:1', exact: true }).click()
    }
    await frameIntervals(page, kind) // warm-up
    const time = p95(await frameIntervals(page, kind))
    results[`${kind} drag frame interval p95`] = `${time.toFixed(1)} ms (target ≤ 33 ms)`
    expect(time).toBeLessThanOrEqual(33)
  })
}

test('@perf memory after 50 applied Geometry changes is ≤ 110% of the first Apply', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await prepare(page)
  const id = identityGeometry(SIZE)
  const changes: Geometry[] = Array.from({ length: 50 }, (_, i) => {
    const rotation = ([0, 90, 180, 270] as const)[i % 4]
    const turned = rotation % 180 ? { width: 3072, height: 4096 } : SIZE
    const base: Geometry = {
      ...id,
      rotation,
      flipH: i % 2 === 1,
      flipV: i % 3 === 0,
      crop: { x: i, y: i, width: turned.width - 2 * i, height: turned.height - 2 * i },
    }
    return i % 5 === 0 ? setStraighten(base, ((i * 37) % 900) - 450, SIZE) : base
  })
  await applyGeometry(page, changes[0]!)
  const first = await settledKiB(page)
  for (const g of changes.slice(1)) await applyGeometry(page, g)
  const last = await settledKiB(page)
  const bitmaps = await page.evaluate(() => window.__imglyTest!.bitmaps())

  results['memory after 50 Applies'] = `${Math.round((last / first) * 100)}% of the first (≤ 110%)`
  expect(bitmaps.retained).toBe(1)
  expect(last / first).toBeLessThanOrEqual(1.1)
})

test.afterAll(() => {
  if (Object.keys(results).length === 0) return
  console.log(
    '\ncrop-rotate @perf results\n' +
      Object.entries(results)
        .map(([k, v]) => `  ${k.padEnd(32)} ${v}`)
        .join('\n'),
  )
})
