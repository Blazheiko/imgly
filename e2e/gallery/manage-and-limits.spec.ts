/**
 * Managing the Gallery and its limits through the real UI on each engine (gallery spec AC-06 to
 * AC-11, AC-13, AC-14). Stored state is read back through the test hooks, not through the code
 * under test, and every message is the text written here, not taken from the catalog.
 */
import type { Page } from '@playwright/test'
import {
  applyAdjustments,
  applyDrawing,
  chooseEntry,
  dismissNotices,
  entries,
  entry,
  entryNames,
  expect,
  gotoReady,
  notice,
  numberedName,
  openGallery,
  openNumbered,
  overlay,
  start,
  stored,
  storedBytes,
  test,
  toasts,
  waitForCommittedSave,
  waitForStored,
  work,
} from './helpers'

const OPEN_WORK_HINT = "The open Work can't be deleted. Open another image first."
const SAVE_FAILED = "This Work couldn't be saved to the Gallery. Export it to keep a copy."
const STORAGE_FULL =
  "This Work couldn't be saved to the Gallery because the browser's storage is full. Export it to keep a copy."
const LINE_PERSISTED = 'Works are kept in this browser. Export a Work to keep a copy elsewhere.'
const LINE_NOT_PERSISTED =
  'Works are saved in this browser only, and the browser may clear them when space runs low. Export to keep a copy.'
const removed = (n: number) => `“${numberedName(n)}” was removed from the Gallery to make room.`

const confirmDialog = (page: Page) => page.getByRole('alertdialog')
const deleteButton = (page: Page, n: number) =>
  page.getByRole('button', { name: `Delete “${numberedName(n)}”` })
const storedNames = async (page: Page) => (await stored(page)).works.map((w) => w.sourceName).sort()
const names = (...ns: number[]) => ns.map(numberedName).sort()

test.describe('AC-06: deleting a Work that is not open', () => {
  test('Cancel keeps it; Delete removes every stored part at once and after a reload', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await gotoReady(page)
    const a = await openNumbered(page, 1)
    await applyDrawing(page)
    await waitForCommittedSave(page, { drawing: true })
    const b = await openNumbered(page, 2)
    await openNumbered(page, 3)
    // The independent oracle: all three parts of the first Work are really stored.
    const before = await stored(page)
    expect(before.works.map((w) => w.id)).toContain(a)
    expect(before.originals).toContain(a)
    expect(before.layers).toContain(a)

    await openGallery(page)
    await expect(page.getByTestId('gallery-count')).toHaveText('3 of 20 places used')
    await deleteButton(page, 1).click()
    await expect(confirmDialog(page)).toContainText('Delete “img-01”?')
    await expect(confirmDialog(page)).toContainText(
      "It can't be brought back. An Export is the only copy kept outside this browser.",
    )

    // Cancel: the Work is exactly as it was.
    await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(confirmDialog(page)).toBeHidden()
    expect(await entryNames(page)).toEqual(['img-03, Open', 'img-02, Just now', 'img-01, Just now'])
    await expect(page.getByTestId('gallery-count')).toHaveText('3 of 20 places used')
    expect(await stored(page)).toEqual(before)

    // Delete: gone at once, the count drops by one.
    await deleteButton(page, 1).click()
    await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(confirmDialog(page)).toBeHidden()
    await expect(entries(page)).toHaveCount(2)
    await expect(page.getByTestId('gallery-count')).toHaveText('2 of 20 places used')
    expect(await entryNames(page)).toEqual(['img-03, Open', 'img-02, Just now'])
    await expect
      .poll(async () => {
        const now = await stored(page)
        return [now.works, now.originals, now.layers].some((part) =>
          part.some((x) => (typeof x === 'string' ? x : x.id) === a),
        )
      })
      .toBe(false)

    await page.reload()
    await expect(start(page)).toBeVisible()
    await expect(entries(page)).toHaveCount(2)
    const after = await stored(page)
    expect(after.works.map((w) => w.id)).toContain(b)
    for (const part of [after.works.map((w) => w.id), after.originals, after.layers]) {
      expect(part, 'no stored part of the deleted Work').not.toContain(a)
    }
    expect(after.originals).toHaveLength(2)
  })
})

test('AC-07: the open Work cannot be deleted: a hint, no dialog, and it stays listed and open', async ({
  page,
}) => {
  await gotoReady(page)
  await openNumbered(page, 1)
  const open = await openNumbered(page, 2)
  await openGallery(page)
  const button = deleteButton(page, 2)
  await expect(button).toHaveAttribute('aria-disabled', 'true')
  await expect(entry(page, 'img-02')).toContainText(OPEN_WORK_HINT)
  // aria-disabled keeps the button clickable for the hint; Playwright treats it as disabled.
  await button.click({ force: true })
  await expect(notice(page, OPEN_WORK_HINT)).toHaveCount(1)
  await expect(confirmDialog(page)).toHaveCount(0)
  expect(await entryNames(page)).toEqual(['img-02, Open', 'img-01, Just now'])
  expect((await work(page))!.id).toBe(open)
  expect((await stored(page)).works.map((w) => w.id)).toContain(open)
})

test('AC-08: a thumbnail typed PNG whose bytes will not decode lists Damaged; the others list normally', async ({
  page,
}) => {
  await gotoReady(page)
  const a = await openNumbered(page, 1)
  await openNumbered(page, 2)
  await openNumbered(page, 3)
  await page.evaluate((id) => window.__imglyTest!.galleryDamage(id, 'thumbnail-bytes'), a)

  await openGallery(page)

  // Listing passes it (an image/png Blob); only the browser's image load finds it damaged.
  await expect
    .poll(() => entryNames(page))
    .toEqual(['img-03, Open', 'img-02, Just now', 'img-01, Damaged'])
  await expect(entry(page, 'img-01')).toContainText("Can't be read")
  await expect(entry(page, 'img-02').locator('img')).toHaveJSProperty('complete', true)
  expect(
    await entry(page, 'img-02')
      .locator('img')
      .evaluate((i: HTMLImageElement) => i.naturalWidth),
  ).toBeGreaterThan(0)
})

test('AC-08: damaged data is marked, named when chosen, deletable; every other Work opens', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await gotoReady(page)
  const a = await openNumbered(page, 1)
  const b = await openNumbered(page, 2)
  await openNumbered(page, 3)
  const open = await openNumbered(page, 4)
  await page.evaluate((id) => window.__imglyTest!.galleryDamage(id, 'original'), a)
  await page.evaluate((id) => window.__imglyTest!.galleryDamage(id, 'thumbnail'), b)

  await openGallery(page)
  // Listing checks only what an entry shows: the Work with a damaged Original lists normally.
  expect(await entryNames(page)).toEqual([
    'img-04, Open',
    'img-03, Just now',
    'img-02, Damaged',
    'img-01, Just now',
  ])
  await expect(page.getByTestId('gallery-count')).toHaveText('4 of 20 places used')

  // Choosing checks everything: the notice names the Work and offers to delete it.
  await chooseEntry(page, 'img-01')
  const damaged = notice(page, "“img-01” can't be opened: its stored data is damaged.")
  await expect(damaged).toHaveCount(1)
  await expect(entry(page, 'img-01')).toContainText('Damaged')
  expect((await work(page))!.id, 'the open Work stays exactly as it was').toBe(open)
  await expect(overlay(page)).toBeVisible()

  // "Delete…" from the notice asks for confirmation, then removes it.
  await damaged.getByRole('button', { name: 'Delete…' }).click()
  await expect(confirmDialog(page)).toContainText('Delete “img-01”?')
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(entries(page)).toHaveCount(3)
  // The damaged thumbnail deletes through its own entry.
  await deleteButton(page, 2).click()
  await confirmDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(entries(page)).toHaveCount(2)
  expect(await storedNames(page)).toEqual(names(3, 4))
  const after = await stored(page)
  expect(after.originals).not.toContain(a)
  expect(after.originals).not.toContain(b)

  // Every other Work opens normally.
  await chooseEntry(page, 'img-03')
  await expect.poll(async () => (await work(page))?.sourceName).toBe('img-03')
  await expect(overlay(page)).toBeHidden()
})

test('AC-09: opening 25 images keeps 20 Works and names each evicted Work once', async ({
  page,
}) => {
  test.setTimeout(240_000)
  await gotoReady(page)
  for (let n = 1; n <= 25; n++) {
    await openNumbered(page, n)
    if (n <= 20) {
      await waitForStored(page, (works) => works.length === n)
      await expect(toasts(page)).toHaveCount(0)
      continue
    }
    // Image n replaced the open Work; the oldest of the others (n - 20) was evicted.
    await expect(notice(page, removed(n - 20))).toHaveCount(1)
    await expect(toasts(page), 'one notice, not one per Work').toHaveCount(1)
    expect(await storedNames(page)).toHaveLength(20)
    expect(await storedNames(page)).not.toContain(numberedName(n - 20))
    expect(await storedNames(page)).toContain(numberedName(n))
    await dismissNotices(page)
  }
  expect(await storedNames(page)).toEqual(names(...Array.from({ length: 20 }, (_, i) => i + 6)))
  await openGallery(page)
  await expect(page.getByTestId('gallery-count')).toHaveText('20 of 20 places used')
  await expect(entries(page)).toHaveCount(20)
  const listed = await entryNames(page)
  expect(listed[0]).toBe('img-25, Open')
  expect(listed.join('|')).not.toContain('img-05,')
})

test.describe('AC-10: a full storage', () => {
  test('a byte budget evicts the oldest, then refuses a Work that cannot fit, keeping what is stored', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await gotoReady(page)
    await openNumbered(page, 1)
    await openNumbered(page, 2)
    await openNumbered(page, 3)
    // A budget for three Works, with half a Work of room: the fourth cannot fit beside them.
    const used = await storedBytes(page)
    await page.evaluate(
      (bytes) => window.__imglyTest!.gallerySetByteBudget(bytes),
      Math.ceil(used * 1.15),
    )

    await openNumbered(page, 4)
    await expect(notice(page, removed(1))).toHaveCount(1)
    await expect(toasts(page)).toHaveCount(1)
    expect(await storedNames(page)).toEqual(names(2, 3, 4))
    await dismissNotices(page)

    // A Work larger than the whole budget: could-not-save, nothing evicted, still editable.
    const big = await openNumbered(page, 5, { saved: false, noise: { width: 160, height: 160 } })
    await expect(notice(page, STORAGE_FULL)).toHaveCount(1)
    await expect(toasts(page)).toHaveCount(1)
    expect(await storedNames(page), 'nothing evicted, the oversized Work not stored').toEqual(
      names(2, 3, 4),
    )
    expect((await stored(page)).works.map((w) => w.id)).not.toContain(big)
    expect((await work(page))!.id).toBe(big)
    await applyAdjustments(page, { ...NEUTRAL, brightness: 10 })
    expect((await work(page))!.adjustments.brightness).toBe(10)
    await expect(notice(page, STORAGE_FULL), 'the notice is not repeated').toHaveCount(1)
  })

  test('the browser quota error is recognised as a full storage', async ({
    page,
    context,
    browserName,
    baseURL,
  }) => {
    test.skip(browserName !== 'chromium', 'the DevTools protocol quota override is Chromium only')
    await gotoReady(page)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Storage.overrideQuotaForOrigin', {
      origin: new URL(baseURL!).origin,
      quotaSize: 1,
    })
    await openNumbered(page, 1, { saved: false })
    // The browser's own error ends in the eviction or the could-not-save notice, never the other.
    await expect(
      toasts(page).filter({ hasText: /storage is full|removed from the Gallery/ }),
    ).toHaveCount(1, { timeout: 15_000 })
    await expect(notice(page, SAVE_FAILED)).toHaveCount(0)
    expect((await stored(page)).works).toHaveLength(0)
  })
})

const NEUTRAL = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  grayscale: 0,
  sepia: 0,
}

test('AC-11: a failing save shows one notice; editing continues; the next save withdraws it', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await gotoReady(page)
  const id = await openNumbered(page, 1)
  await page.evaluate(() => window.__imglyTest!.galleryFailNextSave())
  await applyAdjustments(page, { ...NEUTRAL, brightness: 20 })
  await expect(notice(page, SAVE_FAILED)).toHaveCount(1)
  await expect(toasts(page)).toHaveCount(1)
  const record = (await stored(page)).works.find((w) => w.id === id)!
  expect(record.adjustments.brightness, 'the failed save stored nothing').toBe(0)

  // Editing continues, and the next Apply stores the Work and withdraws the notice.
  await applyAdjustments(page, { ...NEUTRAL, brightness: 30 })
  await expect(notice(page, SAVE_FAILED)).toHaveCount(0)
  await waitForStored(
    page,
    (works) => works.find((w) => w.id === id)?.adjustments.brightness === 30,
    'the next save never committed',
  )
  expect((await work(page))!.adjustments.brightness).toBe(30)

  // A later failure shows the notice again.
  await page.evaluate(() => window.__imglyTest!.galleryFailNextSave())
  await applyAdjustments(page, { ...NEUTRAL, brightness: 40 })
  await expect(notice(page, SAVE_FAILED)).toHaveCount(1)
})

test.describe('AC-13: the storage line follows the browser answer', () => {
  for (const persisted of [true, false]) {
    test(`persisted ${persisted}: start screen and overlay show the matching wording`, async ({
      page,
    }) => {
      await page.addInitScript((answer) => {
        const w = window as unknown as { __persisted: boolean }
        w.__persisted = answer
        StorageManager.prototype.persisted = async () => w.__persisted
      }, persisted)
      await gotoReady(page)
      const line = (where: ReturnType<typeof start>) => where.getByTestId('gallery-storage-line')
      const wording = persisted ? LINE_PERSISTED : LINE_NOT_PERSISTED
      const other = persisted ? LINE_NOT_PERSISTED : LINE_PERSISTED
      await expect(start(page)).toBeVisible()
      await expect(line(start(page))).toHaveText(wording)

      await openNumbered(page, 1)
      await openGallery(page)
      await expect(line(overlay(page))).toHaveText(wording)

      // The line follows the browser's current answer, not the one at load.
      await page.keyboard.press('Escape')
      await expect(overlay(page)).toBeHidden()
      await page.evaluate((answer) => {
        ;(window as unknown as { __persisted: boolean }).__persisted = !answer
      }, persisted)
      await openGallery(page)
      await expect(line(overlay(page))).toHaveText(other)
    })
  }
})

test('AC-14: persistence is requested once, at the first save, and never again', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const calls = () => page.evaluate(() => window.__imglyTest!.galleryPersistCalls())
  await gotoReady(page)
  expect(await calls(), 'nothing is asked at load').toBe(0)
  await openNumbered(page, 1, { saved: false })
  await waitForStored(page, (works) => works.length === 1)
  await expect.poll(calls, { message: 'asked once at the first save' }).toBe(1)
  expect((await stored(page)).meta).toContain('persistenceRequested')

  await applyAdjustments(page, { ...NEUTRAL, brightness: 10 })
  await waitForCommittedSave(page)
  await openNumbered(page, 2)
  await page.waitForTimeout(500)
  expect(await calls(), 'further saves do not ask again').toBe(1)

  await page.reload()
  await expect(start(page)).toBeVisible()
  expect(await calls(), 'nothing is asked after a reload').toBe(0)
  await chooseEntry(page, 'img-01')
  await expect.poll(async () => (await work(page))?.sourceName).toBe('img-01')
  await applyAdjustments(page, { ...NEUTRAL, brightness: 20 })
  await waitForCommittedSave(page)
  await page.waitForTimeout(500)
  expect(await calls(), 'saves after a reload do not ask again').toBe(0)
})
