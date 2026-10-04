/**
 * @perf — open-and-view performance suite (sad.md §10 QG-1, spec §6 NFR rows).
 *
 * Runs by hand on the reference machine (Apple M1 MacBook Air or equivalent, latest stable
 * Chrome) before release; CI excludes it. Run with:
 *
 *   PERF=1 pnpm test:e2e --grep @perf --project chromium
 *
 * Numbers bind only to the reference machine; elsewhere read them as indicative.
 */
import { execFileSync } from 'node:child_process'
import { expect, test, type Page } from '@playwright/test'
import { gotoReady } from './helpers'

const RUNS = 20
const results: Record<string, string> = {}

test.skip(({ browserName }) => browserName !== 'chromium', 'The @perf suite measures Chrome')

/** Builds a JPEG once in the page and keeps it for repeated drops. */
async function prepareJpeg(page: Page, width: number, height: number) {
  await page.evaluate(
    async ({ width, height }) => {
      const canvas = new OffscreenCanvas(width, height)
      const ctx = canvas.getContext('2d')!
      const g = ctx.createLinearGradient(0, 0, width, height)
      g.addColorStop(0, '#203060')
      g.addColorStop(1, '#e0a040')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
      ;(window as unknown as { __perfFile: File }).__perfFile = new File([blob], 'perf.jpg', {
        type: 'image/jpeg',
      })
      const w = window as unknown as { __longest: number }
      w.__longest = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__longest = Math.max(w.__longest, entry.duration)
      }).observe({ type: 'longtask', buffered: false })
    },
    { width, height },
  )
}

/** Drops the prepared file; returns drop → first frame (ms) and the longest task in that open. */
async function timedOpen(page: Page): Promise<{ ttfp: number; longest: number }> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const w = window as unknown as { __perfFile: File; __longest: number }
        const giveUp = setTimeout(() => {
          const alerts = [...document.querySelectorAll('[role=alert]')].map((e) => e.textContent)
          reject(
            new Error(
              `no first frame within 30 s; work=${JSON.stringify(window.__imglyTest?.work())} alerts=${JSON.stringify(alerts)}`,
            ),
          )
        }, 30_000)
        performance.clearMarks('imgly:first-frame')
        w.__longest = 0
        const start = performance.now()
        new PerformanceObserver((list, observer) => {
          const mark = list.getEntriesByName('imgly:first-frame')[0]
          if (!mark) return
          observer.disconnect()
          clearTimeout(giveUp)
          // Let a trailing long task, if any, be reported before reading the maximum.
          setTimeout(() => resolve({ ttfp: mark.startTime - start, longest: w.__longest }), 100)
        }).observe({ type: 'mark' })
        const dt = new DataTransfer()
        dt.items.add(w.__perfFile)
        for (const type of ['dragenter', 'dragover', 'drop']) {
          document.body.dispatchEvent(
            new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
          )
        }
      }),
  )
}

const p95 = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!
}

for (const [label, width, height, target] of [
  ['12 MP', 4032, 3024, 1500],
  ['48 MP', 8064, 6048, 3000],
] as const) {
  test(`@perf time to first Preview, ${label} JPEG: p95 ≤ ${target} ms, longest task ≤ 200 ms`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await gotoReady(page)
    await prepareJpeg(page, width, height)

    const runs: { ttfp: number; longest: number }[] = []
    for (let i = 0; i < RUNS; i++) runs.push(await timedOpen(page))
    const ttfp = p95(runs.map((r) => r.ttfp))
    const longest = Math.max(...runs.map((r) => r.longest))
    results[`TTFP p95 ${label}`] = `${Math.round(ttfp)} ms (target ≤ ${target} ms)`
    results[`longest task ${label}`] = `${Math.round(longest)} ms (target ≤ 200 ms)`

    expect(ttfp, `p95 time to first Preview for the ${label} JPEG`).toBeLessThanOrEqual(target)
    expect(longest, `longest main-thread task while opening the ${label} JPEG`).toBeLessThanOrEqual(
      200,
    )
  })
}

test('@perf zoom and pan stay at ≥ 50 fps on a 4096 px Original', async ({ page }) => {
  test.setTimeout(120_000)
  await gotoReady(page)
  await prepareJpeg(page, 8064, 6048)
  await timedOpen(page)

  const canvas = page.getByTestId('preview-canvas')
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] }
    w.__frames = []
    const tick = (t: number) => {
      w.__frames.push(t)
      if (w.__frames.length < 100_000) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  // Scripted pinch / Ctrl+wheel zoom in and out, then drag pans.
  await page.keyboard.down('Control')
  for (let i = 0; i < 30; i++) await page.mouse.wheel(0, i < 15 ? -40 : 40)
  await page.keyboard.up('Control')
  await page.getByRole('button', { name: '100%' }).click()
  for (let i = 0; i < 4; i++) {
    await page.mouse.down()
    await page.mouse.move(box.x + 50, box.y + 50, { steps: 30 })
    await page.mouse.move(box.x + box.width - 50, box.y + box.height - 50, { steps: 30 })
    await page.mouse.up()
  }
  const fps = await page.evaluate(() => {
    const frames = (window as unknown as { __frames: number[] }).__frames
    return ((frames.length - 1) * 1000) / (frames.at(-1)! - frames[0]!)
  })
  results['zoom/pan frame rate'] = `${Math.round(fps)} fps (target ≥ 50 fps)`
  expect(fps).toBeGreaterThanOrEqual(50)
})

/** Resident memory (KiB) of Chrome's renderer and GPU processes, as the OS reports it. */
async function rendererAndGpuKiB(page: Page): Promise<number> {
  const session = await page.context().browser()!.newBrowserCDPSession()
  const { processInfo } = (await session.send('SystemInfo.getProcessInfo')) as {
    processInfo: { type: string; id: number }[]
  }
  await session.detach()
  const pids = processInfo.filter((p) => p.type === 'renderer' || p.type === 'GPU').map((p) => p.id)
  return pids.reduce((sum, pid) => {
    try {
      return (
        sum +
        Number(
          execFileSync('ps', ['-o', 'rss=', '-p', String(pid)])
            .toString()
            .trim(),
        )
      )
    } catch {
      return sum
    }
  }, 0)
}

async function collectGarbage(page: Page) {
  const session = await page.context().newCDPSession(page)
  await session.send('HeapProfiler.collectGarbage')
  await session.detach()
  await page.waitForTimeout(500)
}

test('@perf memory after 10 opens of the 48 MP JPEG is ≤ 110% of the first, one Original retained', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await gotoReady(page)
  await prepareJpeg(page, 8064, 6048)

  await timedOpen(page)
  await collectGarbage(page)
  const first = await rendererAndGpuKiB(page)
  for (let i = 1; i < 10; i++) await timedOpen(page)
  await page.waitForTimeout(200)
  await collectGarbage(page)
  const tenth = await rendererAndGpuKiB(page)
  const bitmaps = await page.evaluate(() => window.__imglyTest!.bitmaps())

  results['memory after 10 opens'] =
    `${Math.round((tenth / first) * 100)}% of the first open (target ≤ 110%)`
  results['bitmaps retained'] = `${bitmaps.retained} of ${bitmaps.received} received (target 1)`
  expect(bitmaps.retained).toBe(1)
  expect(tenth / first).toBeLessThanOrEqual(1.1)
})

test.afterAll(() => {
  if (Object.keys(results).length === 0) return
  console.log(
    '\nopen-and-view @perf results\n' +
      Object.entries(results)
        .map(([k, v]) => `  ${k.padEnd(24)} ${v}`)
        .join('\n'),
  )
})
