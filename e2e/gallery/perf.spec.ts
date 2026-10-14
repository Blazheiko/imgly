/**
 * @perf — gallery performance suite (spec §6 timing rows, sad.md §10 QG-3, §11 thumbnail row).
 *
 * Runs by hand on the reference machine (Apple M1 MacBook Air or equivalent, latest stable
 * Chrome) before release; CI excludes it (`@perf` runs only with PERF=1). Run with:
 *
 *   PERF=1 pnpm exec playwright test e2e/gallery/perf.spec.ts --workers=1
 *
 * One worker: parallel projects compete for the CPU (three at once doubled the first store and
 * produced a 534 ms long task). The reference Work is 4096×3072 with a Crop, a Straighten angle, all seven Adjustments away from
 * neutral and a drawing covering the whole image. Each p95 is over 20 runs after 2 warm-ups. A Work
 * is "stored" when its record is read back from IndexedDB (`galleryRecords`) with the new state, not
 * when a timer says so. A miss is reported with the measured value, never met by changing a target.
 *
 * Only the first store (spec §6 row 1) is measured on Firefox and WebKit, and reported there
 * without a gate (spec §8 question 2). Every other row is gated on Chromium.
 */
import { p95 } from '../perf-memory'
import { REFERENCE, openGenerated } from '../undo-redo/helpers'
import {
  ALL_SEVEN,
  applyAllSeven,
  applyReferenceGeometry,
  expect,
  gotoReady,
  openNumbered,
  referenceGeometry,
  test,
  waitForCommittedSave,
  waitForWork,
  work,
} from './helpers'
import type { Page } from '../harness'

const WARM_UP = 2
const RUNS = 20
const results: Record<string, string> = {}

// Headed at the reference machine's pixel ratio 2, as the other @perf suites: WebGL then runs on
// the GPU and not on SwiftShader. Playwright's Chromium, not `channel: 'chrome'`, because a
// project-wide `channel` is refused by Firefox and WebKit and this file runs all three.
test.use({ headless: false, deviceScaleFactor: 2 })
test.describe.configure({ mode: 'default' })

interface PerfWindow {
  __perf: {
    windows: [number, number][]
    tasks: { start: number; duration: number }[]
    file?: File
  }
}

/** Collects long tasks in the page, before it loads. */
async function traceLongTasks(page: Page) {
  await page.addInitScript(() => {
    const perf: PerfWindow['__perf'] = { windows: [], tasks: [] }
    ;(window as unknown as PerfWindow).__perf = perf
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          perf.tasks.push({ start: e.startTime, duration: e.duration })
      }).observe({ type: 'longtask' })
    } catch {
      // No long-task entries in this engine: the trace stays empty and is not asserted.
    }
  })
}

/** The longest task that overlapped any measured window (the rest of the setup is not counted). */
async function longestTask(page: Page): Promise<number> {
  await page.waitForTimeout(200) // a trailing long task is reported a moment late
  return page.evaluate(() => {
    const { windows, tasks } = (window as unknown as PerfWindow).__perf
    let longest = 0
    for (const t of tasks) {
      if (windows.some(([a, b]) => t.start < b && t.start + t.duration > a)) {
        longest = Math.max(longest, t.duration)
      }
    }
    return longest
  })
}

/** Builds the reference-sized JPEG once in the page, for repeated drops. */
async function cacheReferenceFile(page: Page) {
  await page.evaluate(async ({ width, height }) => {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, width, height)
    g.addColorStop(0, '#203060')
    g.addColorStop(1, '#e0a040')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    ;(window as unknown as PerfWindow).__perf.file = new File([blob], 'perf.jpg', {
      type: 'image/jpeg',
    })
  }, REFERENCE)
}

/** Drops the cached reference file; resolves when the drop has been dispatched. */
function dropCachedFile(page: Page) {
  return page.evaluate(() => {
    const dt = new DataTransfer()
    dt.items.add((window as unknown as PerfWindow).__perf.file!)
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    }
  })
}

/** Drops the cached file; returns first Preview → the new Work's record read back (ms). */
function timedFirstStore(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const perf = (window as unknown as PerfWindow).__perf
    const hooks = window.__imglyTest!
    const known = new Set((await hooks.galleryRecords()).works.map((w) => w.id))
    performance.clearMarks('imgly:first-frame')
    const frame = new Promise<number>((resolve, reject) => {
      const giveUp = setTimeout(() => reject(new Error('no first frame within 60 s')), 60_000)
      new PerformanceObserver((list, observer) => {
        const mark = list.getEntriesByName('imgly:first-frame')[0]
        if (!mark) return
        observer.disconnect()
        clearTimeout(giveUp)
        resolve(mark.startTime)
      }).observe({ type: 'mark' })
    })
    const dt = new DataTransfer()
    dt.items.add(perf.file!)
    for (const type of ['dragenter', 'dragover', 'drop']) {
      document.body.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
    }
    const start = await frame
    const deadline = performance.now() + 60_000
    for (;;) {
      const { works } = await hooks.galleryRecords()
      if (works.some((w) => !known.has(w.id))) break
      if (performance.now() > deadline) throw new Error('the new Work was not stored in 60 s')
      await new Promise((r) => setTimeout(r, 0))
    }
    const end = performance.now()
    perf.windows.push([start, end])
    return end - start
  })
}

type Kind = 'crop' | 'adjust' | 'draw'
type Act = Kind | 'undo' | 'redo'

/**
 * Performs an Apply (or an Undo or Redo of a Step of `kind`) in the page and resolves with the time
 * until the stored record shows the change: a newer `touchedAt` with the Work's Geometry and
 * Adjustments, and for a drawing a different layer.
 */
function timedStore(page: Page, act: Act, kind: Kind, arg?: unknown): Promise<number> {
  return page.evaluate(
    async ({ act, kind, arg }) => {
      const perf = (window as unknown as PerfWindow).__perf
      const hooks = window.__imglyTest!
      const id = hooks.work()!.id
      const before = (await hooks.galleryRecords()).works.find((w) => w.id === id)!
      const start = performance.now()
      if (act === 'crop') hooks.setGeometry(arg as never)
      else if (act === 'adjust') hooks.setAdjustments(arg as never)
      else if (act === 'draw') hooks.setFullDrawing()
      else {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'z',
            ctrlKey: true,
            shiftKey: act === 'redo',
            bubbles: true,
            cancelable: true,
          }),
        )
      }
      const deadline = start + 60_000
      for (;;) {
        const now = hooks.work()!
        const record = (await hooks.galleryRecords()).works.find((w) => w.id === id)
        if (
          record &&
          record.touchedAt > before.touchedAt &&
          JSON.stringify(record.geometry) === JSON.stringify(now.geometry) &&
          JSON.stringify(record.adjustments) === JSON.stringify(now.adjustments) &&
          (kind !== 'draw' || record.layerId !== before.layerId)
        ) {
          break
        }
        if (performance.now() > deadline) throw new Error(`${act} of ${kind}: not stored in 60 s`)
        await new Promise((r) => setTimeout(r, 0))
      }
      const end = performance.now()
      perf.windows.push([start, end])
      return end - start
    },
    { act, kind, arg },
  )
}

/** Opens the reference Work with every edit applied, and waits for it to be stored with them. */
async function openReferenceWork(page: Page, n?: number) {
  const before = n === undefined ? null : ((await work(page))?.id ?? null)
  await dropCachedFile(page)
  await expect.poll(async () => (await work(page))?.id, { timeout: 60_000 }).not.toBe(before)
  await waitForWork(page, REFERENCE.width, REFERENCE.height)
  await applyReferenceGeometry(page, REFERENCE)
  await applyAllSeven(page)
  const revision = (await work(page))!.revision
  await page.evaluate(() => window.__imglyTest!.setFullDrawing())
  await expect.poll(async () => (await work(page))!.revision).toBeGreaterThan(revision)
  await waitForCommittedSave(page, { drawing: true })
}

const report = (label: string, values: number[], target: number) => {
  const value = p95(values)
  results[label] = `${Math.round(value)} ms (target ≤ ${target} ms)`
  return value
}

/** Chrome's own rows are gated; they need a GPU, so they run headed in stable Chrome at DPR 2. */
function firstStoreTest(engine: 'chromium' | 'others') {
  test(`@perf first store, first Preview to stored: p95 ≤ 3 s (${engine === 'chromium' ? 'gated' : 'reported'})`, async ({
    page,
    browserName,
  }) => {
    test.skip((browserName === 'chromium') !== (engine === 'chromium'), 'the other describe')
    test.setTimeout(600_000)
    await traceLongTasks(page)
    await gotoReady(page)
    await cacheReferenceFile(page)
    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) {
      const ms = await timedFirstStore(page)
      if (i >= WARM_UP) runs.push(ms)
    }
    const value = p95(runs)
    results[`first store p95 on ${browserName}`] =
      `${Math.round(value)} ms (target ≤ 3000 ms${engine === 'chromium' ? '' : ', not gated'}; ` +
      `min ${Math.round(Math.min(...runs))}, max ${Math.round(Math.max(...runs))})`
    if (engine === 'chromium') {
      const longest = await longestTask(page)
      results['longest task, first store'] = `${Math.round(longest)} ms (target ≤ 200 ms)`
      expect.soft(longest, 'longest task while the first store runs').toBeLessThanOrEqual(200)
      expect(value).toBeLessThanOrEqual(3000)
    }
  })
}

test.describe('Chromium rows', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Gated on Chromium')

  firstStoreTest('chromium')

  test('@perf store after a Step, and after an Undo and a Redo: p95 ≤ 300 ms / 1.5 s', async ({
    page,
  }) => {
    test.setTimeout(900_000)
    await traceLongTasks(page)
    await gotoReady(page)
    await openGenerated(page)
    await waitForWork(page, REFERENCE.width, REFERENCE.height)
    await applyReferenceGeometry(page, REFERENCE)
    await applyAllSeven(page)
    const revision = (await work(page))!.revision
    await page.evaluate(() => window.__imglyTest!.setFullDrawing())
    await expect.poll(async () => (await work(page))!.revision).toBeGreaterThan(revision)
    await waitForCommittedSave(page, { drawing: true })

    const base = referenceGeometry(REFERENCE)
    const stepArg = (kind: Kind, i: number) =>
      kind === 'crop'
        ? {
            ...base,
            crop: {
              x: base.crop.x + i,
              y: base.crop.y + i,
              width: base.crop.width - 2 * i,
              height: base.crop.height - 2 * i,
            },
          }
        : kind === 'adjust'
          ? { ...ALL_SEVEN, brightness: -50 + 2 * i }
          : undefined
    const targets: Record<Kind, number> = { crop: 300, adjust: 300, draw: 1500 }

    for (const kind of ['crop', 'adjust', 'draw'] as const) {
      const applies: number[] = []
      for (let i = 1; i <= WARM_UP + RUNS; i++) {
        const ms = await timedStore(page, kind, kind, stepArg(kind, i))
        if (i > WARM_UP) applies.push(ms)
      }
      const undos: number[] = []
      const redos: number[] = []
      // One Step undone and redone in turn: each Undo and Redo moves the stored Work.
      for (let i = 0; i < WARM_UP + RUNS; i++) {
        const undo = await timedStore(page, 'undo', kind)
        const redo = await timedStore(page, 'redo', kind)
        if (i >= WARM_UP) {
          undos.push(undo)
          redos.push(redo)
        }
      }
      const target = targets[kind]
      const found = [
        [report(`store after ${kind} Apply p95`, applies, target), 'Apply'],
        [report(`store after ${kind} Undo p95`, undos, target), 'Undo'],
        [report(`store after ${kind} Redo p95`, redos, target), 'Redo'],
      ] as const
      for (const [value, what] of found) {
        expect.soft(value, `${kind} ${what}, Apply/Undo/Redo to stored`).toBeLessThanOrEqual(target)
      }
    }

    const longest = await longestTask(page)
    results['longest task, Step stores'] = `${Math.round(longest)} ms (target ≤ 200 ms)`
    expect(longest, 'longest task while Steps are stored').toBeLessThanOrEqual(200)
  })

  test('@perf reopen, choice to first Preview: p95 ≤ 1.5 s', async ({ page }) => {
    test.setTimeout(600_000)
    await traceLongTasks(page)
    await gotoReady(page)
    await cacheReferenceFile(page)
    await openReferenceWork(page)
    const reference = (await work(page))!.id
    const other = await openNumbered(page, 1)
    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) {
      await page.getByTestId('gallery-action').click()
      await expect(page.getByTestId('gallery-overlay')).toBeVisible()
      const ms = await page.evaluate(async (id) => {
        const button = document.querySelector<HTMLElement>(
          `.gallery-entry__button[data-entry-id="${id}"]`,
        )!
        performance.clearMarks('imgly:first-frame')
        const frame = new Promise<number>((resolve, reject) => {
          const giveUp = setTimeout(() => reject(new Error('no first Preview in 30 s')), 30_000)
          new PerformanceObserver((list, observer) => {
            const mark = list.getEntriesByName('imgly:first-frame')[0]
            if (!mark) return
            observer.disconnect()
            clearTimeout(giveUp)
            resolve(mark.startTime)
          }).observe({ type: 'mark' })
        })
        const start = performance.now()
        button.click()
        return (await frame) - start
      }, reference)
      await expect.poll(async () => (await work(page))?.id).toBe(reference)
      await expect(page.getByTestId('gallery-overlay')).toBeHidden()
      if (i >= WARM_UP) runs.push(ms)
      // Back to the other Work, unmeasured, so that the next choice replaces an open Work.
      await page.getByTestId('gallery-action').click()
      await expect(page.getByTestId('gallery-overlay')).toBeVisible()
      await page.locator(`.gallery-entry__button[data-entry-id="${other}"]`).click()
      await expect.poll(async () => (await work(page))?.id).toBe(other)
      await expect(page.getByTestId('gallery-overlay')).toBeHidden()
    }
    const value = report('reopen p95', runs, 1500)
    expect(value).toBeLessThanOrEqual(1500)
  })

  test('@perf Gallery shows, choosing "Gallery" to every thumbnail painted: p95 ≤ 500 ms', async ({
    page,
  }) => {
    test.setTimeout(900_000)
    await traceLongTasks(page)
    await gotoReady(page)
    await cacheReferenceFile(page)
    for (let n = 0; n < 20; n++) await openReferenceWork(page, n)
    await expect
      .poll(
        async () => (await page.evaluate(() => window.__imglyTest!.galleryRecords())).works.length,
      )
      .toBe(20)
    const runs: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) {
      const ms = await page.evaluate(async () => {
        const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
        const start = performance.now()
        document.querySelector<HTMLElement>('[data-testid="gallery-action"]')!.click()
        for (;;) {
          const imgs = [
            ...document.querySelectorAll<HTMLImageElement>(
              '[data-testid="gallery-overlay"] .gallery-entry img',
            ),
          ]
          if (imgs.length === 20 && imgs.every((img) => img.complete && img.naturalWidth > 0)) break
          if (performance.now() - start > 30_000) throw new Error('thumbnails never painted')
          await raf()
        }
        await raf()
        await raf()
        return performance.now() - start
      })
      if (i >= WARM_UP) runs.push(ms)
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('gallery-overlay')).toBeHidden()
    }
    const value = report('Gallery shows p95', runs, 500)
    expect(value).toBeLessThanOrEqual(500)
  })
})

test.describe('Firefox and WebKit: first store, reported', () => {
  test.skip(({ browserName }) => browserName === 'chromium', 'Chromium has its own gated test')
  firstStoreTest('others')
})

test.afterAll(() => {
  console.log('\ngallery @perf results:')
  for (const [name, value] of Object.entries(results)) console.log(`  ${name}: ${value}`)
})
