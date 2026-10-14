/**
 * 50 forced reloads during Autosave leave no damaged or mixed Work (gallery spec AC-19, §6 NFR "No
 * half-stored Work after an interrupted save"). Chromium only (test-plan §CI placement).
 *
 * 40 of the reloads are made of every hold point (`evictions`, `record`, `original`, `layer`) x a
 * first save and a later save, repeated five times: the hook keeps the `storeWork` transaction open
 * at that point and the page is reloaded while it is. The other 10 reload at a random delay after
 * an Apply, with no hold, so some land before the commit and some after. A random reload alone
 * would mostly land before or after the transaction and prove nothing, which is why the held ones
 * are the bulk. After every reload each stored Work is compared with its last committed state.
 */
import type { Page } from '@playwright/test'
import { NEUTRAL_ADJUSTMENTS } from '../../src/core/adjust'
import { identityGeometry } from '../../src/core/geometry'
import { openFile } from '../export/helpers'
import type { SaveHoldPoint } from '../test-hooks'
import {
  ALL_SEVEN,
  NUMBERED,
  applyAdjustments,
  applyDrawing,
  chooseEntryById,
  encodeCount,
  entries,
  expect,
  expectReopened,
  gotoReady,
  instrumentEncodes,
  notice,
  numberedImage,
  numberedName,
  start,
  stored,
  test,
  waitForCommittedSave,
  waitForEncodeAfter,
  waitForStored,
  work,
} from './helpers'

test.skip(({ browserName }) => browserName !== 'chromium', 'The 50-reload row runs on Chromium')

const POINTS: SaveHoldPoint[] = ['evictions', 'record', 'original', 'layer']
const ROUNDS = 5
const RANDOM_RELOADS = 10
const CAP = 20

type Stored = Awaited<ReturnType<typeof stored>>
const sorted = (xs: string[]) => [...xs].sort()

/** Mulberry32: a seeded generator, so the "random" delays are the same in every run. */
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** No mixed Work: records, Originals and layers agree (a layer exactly when the record has one). */
function expectConsistent(s: Stored, what: string) {
  const ids = s.works.map((w) => w.id)
  expect(sorted(s.originals), `${what}: an Original for each record, and no other`).toEqual(
    sorted(ids),
  )
  expect(sorted(s.layers), `${what}: a layer for each record that names one, and no other`).toEqual(
    sorted(s.works.filter((w) => w.layerId !== null).map((w) => w.id)),
  )
  expect(s.works.length, `${what}: within the cap`).toBeLessThanOrEqual(CAP)
}

/** Fills the Gallery to its cap with older Works, written straight into IndexedDB. */
async function fillGallery(page: Page) {
  const png = Array.from(await numberedImage(page, 0))
  const hour = 60 * 60 * 1000
  for (let i = 1; i <= CAP; i++) {
    await page.evaluate((input) => window.__imglyTest!.galleryWriteStored(input), {
      sourceName: `pre-${String(i).padStart(2, '0')}`,
      sourceFormat: 'png',
      geometry: identityGeometry(NUMBERED),
      adjustments: { ...NEUTRAL_ADJUSTMENTS },
      touchedAt: Date.now() - hour + i * 1000,
      width: NUMBERED.width,
      height: NUMBERED.height,
      originalPng: png,
    })
  }
}

/** Answers the leave dialog by leaving, and counts the dialogs. */
function acceptLeaving(page: Page) {
  const seen: string[] = []
  page.on('dialog', (dialog) => {
    seen.push(dialog.type())
    void dialog.accept()
  })
  return seen
}

/** The reload that interrupts a save. A click first: Chromium only warns after a user gesture. */
async function reloadMidSave(page: Page) {
  await page.getByTestId('editor-top-bar').click({ position: { x: 1, y: 1 } })
  await page.reload()
  await expect(start(page)).toBeVisible()
}

/** Opens numbered image `n` and returns its id once its first save has committed. */
async function openAndCommit(page: Page, n: number): Promise<string> {
  const before = (await stored(page)).works.map((w) => w.sourceName)
  await openFile(page, `${numberedName(n)}.png`, await numberedImage(page, n), 'image/png')
  await expect
    .poll(async () => (await work(page))?.sourceName, { timeout: 15_000 })
    .toBe(numberedName(n))
  const id = (await work(page))!.id
  await waitForStored(page, (works) => works.some((w) => w.id === id), `image ${n} never stored`)
  await expectEvictionNotices(page, before)
  return id
}

/** A Work that left the Gallery to make room always carries its notice (AC-19, last clause). */
async function expectEvictionNotices(page: Page, namesBefore: string[]) {
  const now = (await stored(page)).works.map((w) => w.sourceName)
  for (const gone of namesBefore.filter((name) => !now.includes(name))) {
    await expect(
      notice(page, `“${gone}” was removed from the Gallery to make room.`),
      `${gone} left the Gallery without its notice`,
    ).toHaveCount(1)
  }
}

test('50 reloads during Autosave leave no damaged or mixed Work', async ({ page }) => {
  test.setTimeout(900_000)
  await instrumentEncodes(page)
  const leaveDialogs = acceptLeaving(page)
  await gotoReady(page)
  await fillGallery(page)
  await page.reload()
  await expect(start(page)).toBeVisible()
  await expect(entries(page)).toHaveCount(CAP)
  expectConsistent(await stored(page), 'the filled Gallery')

  let image = 1
  let reloads = 0
  let heldReloads = 0
  const arm = (point: SaveHoldPoint) =>
    page.evaluate((p) => window.__imglyTest!.galleryHoldSave(p), point)

  for (let round = 1; round <= ROUNDS; round++) {
    for (const point of POINTS) {
      // A first save, held at `point`: the Work must be absent afterwards, nothing evicted.
      {
        const what = `round ${round}, first save held at ${point}`
        const before = await stored(page)
        expect(before.works).toHaveLength(CAP)
        const n = image++
        const file = await numberedImage(page, n)
        await arm(point)
        const encoded = await encodeCount(page)
        await openFile(page, `${numberedName(n)}.png`, file, 'image/png')
        await expect
          .poll(async () => (await work(page))?.sourceName, { timeout: 15_000 })
          .toBe(numberedName(n))
        await waitForEncodeAfter(page, encoded)
        await page.waitForTimeout(250)
        const dialogs = leaveDialogs.length
        await reloadMidSave(page)
        reloads++
        heldReloads++
        expect(leaveDialogs.length, `${what}: the save was still running at the reload`).toBe(
          dialogs + 1,
        )
        const after = await stored(page)
        expect(after, `${what}: every Work is as last committed`).toEqual(before)
        expect(
          after.works.map((w) => w.sourceName),
          `${what}: the first save's Work is absent`,
        ).not.toContain(numberedName(n))
        expectConsistent(after, what)
        await expect(entries(page)).toHaveCount(CAP)
      }

      // A later save of a Work that is stored, held at `point`: it reopens as it was.
      {
        const what = `round ${round}, later save held at ${point}`
        const n = image++
        const id = await openAndCommit(page, n)
        await waitForCommittedSave(page, { drawing: false })
        const before = await stored(page)
        expect(before.layers, `${what}: no layer yet`).not.toContain(id)
        await arm(point)
        const encoded = await encodeCount(page)
        await applyDrawing(page) // the held save writes the layer, too
        await waitForEncodeAfter(page, encoded)
        await page.waitForTimeout(250)
        const dialogs = leaveDialogs.length
        await reloadMidSave(page)
        reloads++
        heldReloads++
        expect(leaveDialogs.length, `${what}: the save was still running at the reload`).toBe(
          dialogs + 1,
        )
        const after = await stored(page)
        expect(after, `${what}: every Work is as last committed`).toEqual(before)
        expect(after.layers, `${what}: no half-written layer`).not.toContain(id)
        expectConsistent(after, what)

        // It reopens in its previous stored state: no drawing.
        const touched = before.works.find((w) => w.id === id)!.touchedAt
        await chooseEntryById(page, id)
        await expectReopened(page, numberedName(n), NUMBERED)
        // A reopen counts as opening the Work and stores it as the newest; let that save finish
        // so that the next snapshot is a settled one.
        await waitForStored(
          page,
          (works) => works.find((w) => w.id === id)!.touchedAt > touched,
          `${what}: the reopen never touched the Work`,
        )
        const marks = await page.evaluate(
          () => window.__imglyTest!.drawingAlpha().filter((a) => a > 0).length,
        )
        expect(marks, `${what}: reopened without the interrupted drawing`).toBe(0)
        expect((await work(page))!.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
      }
    }
  }
  expect(heldReloads).toBe(POINTS.length * 2 * ROUNDS)

  // 10 reloads at a random delay after an Apply, with no hold: before, during or after the commit.
  const random = seeded(20261014)
  const outcomes = { kept: 0, committed: 0 }
  const delays: number[] = []
  for (let i = 1; i <= RANDOM_RELOADS; i++) {
    const what = `random reload ${i}`
    const n = image++
    const id = await openAndCommit(page, n)
    await waitForCommittedSave(page, { drawing: false })
    const before = await stored(page)
    const withDrawing = i % 2 === 0
    const delay = Math.floor(random() * 150)
    delays.push(delay)
    if (withDrawing) await applyDrawing(page)
    else await applyAdjustments(page, { ...ALL_SEVEN, brightness: i })
    await page.waitForTimeout(delay)
    await reloadMidSave(page)
    reloads++
    const after = await stored(page)
    expectConsistent(after, what)
    expect(sorted(after.works.map((w) => w.id)), `${what}: no Work lost`).toEqual(
      sorted(before.works.map((w) => w.id)),
    )
    for (const record of after.works) {
      const was = before.works.find((w) => w.id === record.id)!
      if (record.id !== id) {
        expect(record, `${what}: untouched Work unchanged`).toEqual(was)
        continue
      }
      // Either the last committed state or the new one, never a mix.
      if (withDrawing) {
        const committed = record.layerId !== null
        expect(after.layers.includes(id), `${what}: layer present exactly when named`).toBe(
          committed,
        )
        expect(record.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
        outcomes[committed ? 'committed' : 'kept']++
      } else {
        const committed = record.adjustments.brightness === i
        if (committed) expect(record.adjustments).toEqual({ ...ALL_SEVEN, brightness: i })
        else expect(record.adjustments).toEqual(was.adjustments)
        expect(record.layerId).toBeNull()
        outcomes[committed ? 'committed' : 'kept']++
      }
    }
  }
  test.info().annotations.push({
    type: 'random reloads',
    description: `delays ${delays.join(', ')} ms; kept ${outcomes.kept}, committed ${outcomes.committed}`,
  })

  expect(reloads).toBe(POINTS.length * 2 * ROUNDS + RANDOM_RELOADS)
  expect(reloads).toBe(50)
})

test('control: the same later save, not held, does change what is stored', async ({ page }) => {
  // This is what makes the equality checks above able to fail: without the hold and the reload,
  // the very same action leaves a different stored state.
  await instrumentEncodes(page)
  await gotoReady(page)
  const id = await openAndCommit(page, 1)
  await waitForCommittedSave(page, { drawing: false })
  const before = await stored(page)
  await applyDrawing(page)
  await waitForCommittedSave(page, { drawing: true })
  const after = await stored(page)
  expect(after).not.toEqual(before)
  expect(before.layers).not.toContain(id)
  expect(after.layers).toContain(id)
  expect(after.works.find((w) => w.id === id)!.layerId).not.toBeNull()
})
