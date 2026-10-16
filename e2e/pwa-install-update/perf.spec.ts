/**
 * @perf — pwa-install-update performance (spec §6 NFR rows 2 and 5, sad.md §10).
 *
 * Runs by hand on the reference machine (Apple M1 MacBook Air or equivalent, latest stable
 * Chrome) before release; CI excludes it. Run with:
 *
 *   PERF=1 pnpm test:e2e e2e/pwa-install-update/perf.spec.ts --project chromium
 *
 * The reference Work is 4096×3072 with a Geometry, all seven Adjustments and a full drawing. The
 * p95 is over 20 runs after 2 warm-ups; each run publishes the other build, so the page switches
 * A → B → A …. A miss is reported with the measured value, never met by changing a threshold.
 */
import type { Page } from '@playwright/test'
import { p95 } from '../perf-memory'
import {
  ALL_SEVEN,
  applyAdjustments,
  applyAllSeven,
  applyReferenceGeometry,
  NEUTRAL_ADJUSTMENTS,
  waitForCommittedSave,
  waitForWork,
  work,
} from '../gallery/helpers'
import {
  buildOf,
  checkForUpdate,
  expect,
  gotoControlled,
  reloadButton,
  test,
  updateNotice,
  type Build,
} from './two-builds'

const WARM_UP = 2
const RUNS = 20
const REFERENCE = { width: 4096, height: 3072 }
const results: Record<string, string> = {}

interface PerfWindow {
  __perf: { tasks: { start: number; duration: number }[] }
}

test.skip(({ browserName }) => browserName !== 'chromium', 'The @perf suite measures Chrome')
test.describe.configure({ mode: 'default' })

test.afterAll(() => {
  console.log(`pwa-install-update @perf\n${JSON.stringify(results, null, 2)}`)
})

/** Drops a 4096×3072 JPEG and makes it the reference Work, stored. */
async function openReferenceWork(page: Page) {
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
  }, REFERENCE)
  await waitForWork(page, REFERENCE.width, REFERENCE.height)
  await applyReferenceGeometry(page, REFERENCE)
  await applyAllSeven(page)
  const revision = (await work(page))!.revision
  await page.evaluate(() => window.__imglyTest!.setFullDrawing())
  await expect.poll(async () => (await work(page))!.revision).toBeGreaterThan(revision)
  await waitForCommittedSave(page, { drawing: true })
}

/** Epoch ms of the new document's first Preview (the renderer's `imgly:first-frame` mark). */
function firstPreviewAt(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const giveUp = setTimeout(() => reject(new Error('no first Preview in 30 s')), 30_000)
        new PerformanceObserver((list, observer) => {
          const mark = list.getEntriesByName('imgly:first-frame')[0]
          if (!mark) return
          observer.disconnect()
          clearTimeout(giveUp)
          resolve(performance.timeOrigin + mark.startTime)
        }).observe({ type: 'mark', buffered: true })
      }),
  )
}

test('@perf "Reload" to the reopened reference Work\'s first Preview: p95 ≤ 3 s', async ({
  page,
  builds,
}) => {
  test.setTimeout(900_000)
  await gotoControlled(page)
  await openReferenceWork(page)
  let current: Build = 'A'
  const runs: number[] = []
  for (let i = 0; i < WARM_UP + RUNS; i++) {
    const next: Build = current === 'A' ? 'B' : 'A'
    builds.publish(next)
    await checkForUpdate(page)
    await expect(reloadButton(page)).toHaveText('Reload', { timeout: 30_000 })
    const start = await page.evaluate(() => performance.timeOrigin + performance.now())
    await Promise.all([page.waitForEvent('load', { timeout: 30_000 }), reloadButton(page).click()])
    const ms = (await firstPreviewAt(page)) - start
    await expect.poll(() => buildOf(page)).toBe(next)
    await expect.poll(async () => (await work(page))?.originalWidth).toBe(REFERENCE.width)
    if (i >= WARM_UP) runs.push(ms)
    current = next
  }
  const value = p95(runs)
  results['Reload → first Preview p95'] = `${Math.round(value)} ms (target ≤ 3000 ms)`
  expect(value).toBeLessThanOrEqual(3000)
})

test('@perf editing while the update downloads: longest task ≤ 200 ms', async ({
  page,
  builds,
}) => {
  test.setTimeout(300_000)
  await page.addInitScript(() => {
    const perf: PerfWindow['__perf'] = { tasks: [] }
    ;(window as unknown as PerfWindow).__perf = perf
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        perf.tasks.push({ start: e.startTime, duration: e.duration })
    }).observe({ type: 'longtask' })
  })
  await gotoControlled(page)
  await openReferenceWork(page)

  const from = await page.evaluate(() => performance.now())
  builds.publish('B')
  await checkForUpdate(page)
  // The Editor keeps editing while the browser downloads and installs build B.
  for (let i = 0; (await updateNotice(page).count()) === 0 && i < 40; i++) {
    await applyAdjustments(page, { ...NEUTRAL_ADJUSTMENTS, brightness: i % 2 ? 10 : -10 })
  }
  await expect(updateNotice(page)).toBeVisible({ timeout: 30_000 })
  await applyAdjustments(page, ALL_SEVEN)
  const to = await page.evaluate(() => performance.now())
  await page.waitForTimeout(200) // a trailing long task is reported a moment late

  const longest = await page.evaluate(
    ({ from, to }) =>
      Math.max(
        0,
        ...(window as unknown as PerfWindow).__perf.tasks
          .filter((t) => t.start < to && t.start + t.duration > from)
          .map((t) => t.duration),
      ),
    { from, to },
  )
  results['longest task while the update downloads'] = `${Math.round(longest)} ms (target ≤ 200 ms)`
  expect(await buildOf(page)).toBe('A')
  expect(longest).toBeLessThanOrEqual(200)
})
