/**
 * The Undo/Redo latency row of spec §6 (sad.md §10 QG-3), on the reference Work with a drawing over
 * the whole image: from the shortcut's keydown to the next presented Preview frame, p95 ≤ 150 ms
 * over 20 runs after 2 warm-ups, for a Step of each tool. Runs by hand on the reference machine:
 *   PERF=1 pnpm test:e2e e2e/undo-redo/perf.spec.ts --project chromium
 */
import { expect, test, type Page } from '../harness'
import { p95 } from '../perf-memory'
import { REFERENCE, openReference, work } from './helpers'

const WARM_UP = 2
const RUNS = 20
const results: Record<string, string> = {}

test.skip(({ browserName }) => browserName !== 'chromium', 'The @perf suite measures Chrome')
// As draw's @perf suite: headed stable Chrome at the reference machine's pixel ratio 2, so WebGL
// runs on the GPU rather than SwiftShader.
test.use({ headless: false, deviceScaleFactor: 2, channel: 'chrome' })
test.describe.configure({ mode: 'default' })

/** Presses an Undo or Redo shortcut in the page and resolves with the time to the second frame. */
function timedKey(page: Page, redo: boolean): Promise<number> {
  return page.evaluate(
    (redo) =>
      new Promise<number>((resolve) => {
        const start = performance.now()
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'z',
            ctrlKey: true,
            shiftKey: redo,
            bubbles: true,
            cancelable: true,
          }),
        )
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)))
      }),
    redo,
  )
}

const STEPS: Record<string, (page: Page) => Promise<unknown>> = {
  'Crop and rotate': (page) =>
    page.evaluate(
      (size) =>
        window.__imglyTest!.setGeometry({
          flipH: false,
          flipV: false,
          rotation: 90,
          straighten: 0,
          crop: { x: 0, y: 0, width: size.height / 2, height: size.width / 2 },
        }),
      REFERENCE,
    ),
  Adjust: (page) =>
    page.evaluate(() =>
      window.__imglyTest!.setAdjustments({
        brightness: 20,
        contrast: 35,
        saturation: -30,
        temperature: 25,
        tint: -15,
        grayscale: 40,
        sepia: 30,
      }),
    ),
  Draw: (page) => page.evaluate(() => window.__imglyTest!.setFullDrawing()),
}

for (const [tool, apply] of Object.entries(STEPS)) {
  test(`@perf Undo and Redo of the ${tool} Step with a full drawing: p95 ≤ 150 ms`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await openReference(page)
    await page.evaluate(() => window.__imglyTest!.setFullDrawing())
    const before = (await work(page))!.revision
    await apply(page)
    await expect.poll(async () => (await work(page))!.revision).toBeGreaterThan(before)
    const after = (await work(page))!.revision

    const undos: number[] = []
    const redos: number[] = []
    for (let i = 0; i < WARM_UP + RUNS; i++) {
      const undo = await timedKey(page, false)
      expect((await work(page))!.revision).toBe(before)
      const redo = await timedKey(page, true)
      expect((await work(page))!.revision).toBe(after)
      if (i >= WARM_UP) {
        undos.push(undo)
        redos.push(redo)
      }
    }
    const undo = p95(undos)
    const redo = p95(redos)
    results[`${tool} Undo p95`] = `${Math.round(undo)} ms (target ≤ 150 ms)`
    results[`${tool} Redo p95`] = `${Math.round(redo)} ms (target ≤ 150 ms)`
    expect.soft(undo).toBeLessThanOrEqual(150)
    expect.soft(redo).toBeLessThanOrEqual(150)
  })
}

test.afterAll(() => {
  if (Object.keys(results).length === 0) return
  console.log(
    '\nundo-redo @perf results\n' +
      Object.entries(results)
        .map(([k, v]) => `  ${k.padEnd(26)} ${v}`)
        .join('\n'),
  )
})
