/**
 * @perf — export performance suite (spec §6 NFR rows, sad.md §10).
 *
 * Runs by hand on the reference machine (Apple M1 MacBook Air or equivalent, latest stable
 * Chrome) before release; CI excludes it. Run with:
 *
 *   PERF=1 pnpm test:e2e e2e/export/perf.spec.ts --project chromium
 *
 * Export time runs from confirm to the file being written; the stubbed "Save as…" dialog returns
 * at once, so no dialog time is counted. Numbers bind only to the reference machine.
 */
import { expect, test, type Page } from '@playwright/test'
import { p95, settledKiB } from '../perf-memory'
import {
  flipOnScreen,
  identityGeometry,
  rotateQuarter,
  setStraighten,
} from '../../src/core/geometry'
import { choose, gotoReady, panel, waitForWork } from './helpers'

const WARM_UP = 2
const RUNS = 20
const results: Record<string, string> = {}

test.skip(({ browserName }) => browserName !== 'chromium', 'The @perf suite measures Chrome')
test.describe.configure({ mode: 'default' })

/**
 * Opens a 4096×3072 JPEG Work and installs a "Save as…" stub that only records when the file was
 * written, plus a long-task observer.
 */
async function prepare(page: Page) {
  await gotoReady(page)
  await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(4096, 3072)
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 4096, 3072)
    g.addColorStop(0, '#203060')
    g.addColorStop(1, '#e0a040')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4096, 3072)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    const dt = new DataTransfer()
    dt.items.add(new File([blob], 'perf.jpg', { type: 'image/jpeg' }))
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    }
    const w = window as unknown as {
      __written?: number
      __longest: number
      showSaveFilePicker: (options: { suggestedName: string }) => Promise<unknown>
    }
    w.showSaveFilePicker = async (options) => ({
      name: options.suggestedName,
      createWritable: async () => ({
        write: async () => {},
        abort: async () => {},
        close: async () => void (w.__written = performance.now()),
      }),
    })
    w.__longest = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__longest = Math.max(w.__longest, entry.duration)
    }).observe({ type: 'longtask', buffered: false })
  })
  await waitForWork(page, 4096, 3072)
}

/** Confirms the open panel; returns confirm → written (ms) and the longest task meanwhile. */
async function timedExport(page: Page): Promise<{ ms: number; longest: number }> {
  await choose(page)
  await expect(panel(page)).toBeVisible()
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const w = window as unknown as { __written?: number; __longest: number }
        delete w.__written
        w.__longest = 0
        const confirm = [...document.querySelectorAll('[role=dialog] button')].find(
          (b) => b.textContent?.trim() === 'Export',
        ) as HTMLButtonElement
        const giveUp = setTimeout(() => reject(new Error('no file within 30 s')), 30_000)
        const start = performance.now()
        confirm.click()
        const poll = () => {
          if (w.__written === undefined) return void setTimeout(poll, 5)
          clearTimeout(giveUp)
          const ms = w.__written - start
          // Let a trailing long task, if any, be reported before reading the maximum.
          setTimeout(() => resolve({ ms, longest: w.__longest }), 100)
        }
        poll()
      }),
  )
}

for (const [label, format, target] of [
  ['JPEG q90', 'JPEG', 1000],
  ['PNG', 'PNG', 2000],
] as const) {
  test(`@perf export time, 4096×3072 ${label}: p95 ≤ ${target} ms, longest task ≤ 200 ms`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await prepare(page)
    await choose(page, format === 'JPEG' ? { format, quality: 90 } : { format })

    const runs: { ms: number; longest: number }[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) runs.push(await timedExport(page))
    const measured = runs.slice(WARM_UP)
    const time = p95(measured.map((r) => r.ms))
    const longest = Math.max(...measured.map((r) => r.longest))
    results[`export p95 ${label}`] = `${Math.round(time)} ms (target ≤ ${target} ms)`
    results[`longest task ${label}`] = `${Math.round(longest)} ms (target ≤ 200 ms)`

    expect(time, `p95 export time for ${label}`).toBeLessThanOrEqual(target)
    expect(longest, `longest main-thread task while exporting ${label}`).toBeLessThanOrEqual(200)
  })
}

// crop-rotate spec §6: the same targets with an applied Geometry (90° Rotation, a Flip and a
// 10° Straighten angle), which renders through the one shader pass (crop-rotate ADR-0002).
for (const [label, format, target] of [
  ['JPEG q90', 'JPEG', 1000],
  ['PNG', 'PNG', 2000],
] as const) {
  test(`@perf export time with a Geometry, 4096×3072 ${label}: p95 ≤ ${target} ms`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await prepare(page)
    const size = { width: 4096, height: 3072 }
    const turned = flipOnScreen(
      rotateQuarter(identityGeometry(size), 'cw', size),
      'horizontal',
      size,
    )
    const geometry = setStraighten(turned, 100, size)
    await page.evaluate((g) => window.__imglyTest!.setGeometry(g), geometry)
    await choose(page, format === 'JPEG' ? { format, quality: 90 } : { format })

    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) runs.push((await timedExport(page)).ms)
    const time = p95(runs.slice(WARM_UP))
    results[`geometry export p95 ${label}`] = `${Math.round(time)} ms (target ≤ ${target} ms)`
    expect(time, `p95 export time with a Geometry for ${label}`).toBeLessThanOrEqual(target)
  })
}

// adjust spec §6: the same targets with all seven Adjustments away from neutral, which renders
// in the one shader pass at full size (adjust ADR-0002).
for (const [label, format, target] of [
  ['JPEG q90', 'JPEG', 1000],
  ['PNG', 'PNG', 2000],
] as const) {
  test(`@perf export time with all seven Adjustments, 4096×3072 ${label}: p95 ≤ ${target} ms`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await prepare(page)
    await page.evaluate(() =>
      window.__imglyTest!.setAdjustments({
        brightness: 20,
        contrast: 35,
        saturation: -30,
        temperature: 25,
        tint: -15,
        grayscale: 40,
        sepia: 30,
      }),
    )
    await choose(page, format === 'JPEG' ? { format, quality: 90 } : { format })

    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) runs.push((await timedExport(page)).ms)
    const time = p95(runs.slice(WARM_UP))
    results[`adjusted export p95 ${label}`] = `${Math.round(time)} ms (target ≤ ${target} ms)`
    expect(time, `p95 export time with all seven Adjustments for ${label}`).toBeLessThanOrEqual(
      target,
    )
  })
}

// draw spec §6: the same targets with marks over the whole image (a full Drawing layer), which
// the worker composites in the same pass at full size (draw ADR-0003).
for (const [label, format, target] of [
  ['JPEG q90', 'JPEG', 1000],
  ['PNG', 'PNG', 2000],
] as const) {
  test(`@perf export time with a full Drawing layer, 4096×3072 ${label}: p95 ≤ ${target} ms`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await prepare(page)
    await page.evaluate(() => window.__imglyTest!.setFullDrawing())
    await choose(page, format === 'JPEG' ? { format, quality: 90 } : { format })

    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) runs.push((await timedExport(page)).ms)
    const time = p95(runs.slice(WARM_UP))
    results[`drawn export p95 ${label}`] = `${Math.round(time)} ms (target ≤ ${target} ms)`
    expect(time, `p95 export time with a full Drawing layer for ${label}`).toBeLessThanOrEqual(
      target,
    )
  })
}

test('@perf memory after 10 PNG exports is ≤ 110% of the first, one Original retained', async ({
  page,
}) => {
  test.setTimeout(300_000)
  await prepare(page)
  await choose(page, { format: 'PNG' })

  await timedExport(page)
  const first = await settledKiB(page)
  for (let i = 1; i < 10; i++) await timedExport(page)
  const tenth = await settledKiB(page)
  const bitmaps = await page.evaluate(() => window.__imglyTest!.bitmaps())

  results['memory after 10 exports'] =
    `${Math.round((tenth / first) * 100)}% of the first export (target ≤ 110%)`
  results['bitmaps retained'] = `${bitmaps.retained} of ${bitmaps.received} received (target 1)`
  expect(bitmaps.retained).toBe(1)
  expect(tenth / first).toBeLessThanOrEqual(1.1)
})

test.afterAll(() => {
  if (Object.keys(results).length === 0) return
  console.log(
    '\nexport @perf results\n' +
      Object.entries(results)
        .map(([k, v]) => `  ${k.padEnd(26)} ${v}`)
        .join('\n'),
  )
})
