/**
 * The replace gate, unavailable storage, the leave warning, two pages and offline use, through the
 * real UI on each engine (gallery spec AC-12, AC-16 to AC-18, AC-20, AC-21; §6 "Works offline").
 * Stored state is read back through the test hooks, and every message is the text written here, not
 * taken from the catalog. A "save that is running" is made by holding back the thumbnail encode
 * (`holdNextEncode`), so that it commits when let go.
 */
import type { Page } from '@playwright/test'
import { openFile } from '../export/helpers'
import { dropGeneratedImage } from '../open-and-view/helpers'
import {
  ALL_SEVEN,
  NUMBERED,
  applyAdjustments,
  chooseEntry,
  dismissNotices,
  entries,
  entry,
  exportPixels,
  expect,
  expectReopened,
  gotoReady,
  holdNextEncode,
  instrumentEncodes,
  notice,
  numberedImage,
  numberedName,
  openGallery,
  openNumbered,
  overlay,
  previewPixels,
  rawAdjustments,
  releaseEncodes,
  replaceDialog,
  start,
  stored,
  test,
  waitForCommittedSave,
  waitForStored,
  work,
} from './helpers'

const SAVE_FAILED = "This Work couldn't be saved to the Gallery. Export it to keep a copy."
const NEWER_VERSION =
  'A newer version of the editor is open in another tab. Reload this page to keep saving to the Gallery.'
const UNAVAILABLE_TITLE = 'The Gallery is unavailable in this window.'
const REFUSED_BODY =
  "This browser isn't letting the editor keep anything for this site, for example because site data is blocked. You can still open, edit and export images, but nothing is kept after this page closes."
const NOT_SAVED = "Your latest edits aren't saved in the Gallery and will be lost."

const EDIT_A = { ...ALL_SEVEN }
const EDIT_B = { ...ALL_SEVEN, brightness: -20, contrast: 10 }
const EDIT_C = { ...ALL_SEVEN, sepia: 5, tint: 12 }

/** Chooses numbered image `n` through "Open image" (Ctrl+O) without waiting for the result. */
async function chooseFile(page: Page, n: number) {
  await openFile(page, `${numberedName(n)}.png`, await numberedImage(page, n), 'image/png')
}

/** Waits for the open Work to be image `name`. */
const expectOpen = (page: Page, name: string) =>
  expect.poll(async () => (await work(page))?.sourceName, { timeout: 15_000 }).toBe(name)

/** The stored record of a Work, by id, or undefined. */
async function record(page: Page, id: string) {
  return (await stored(page)).works.find((w) => w.id === id)
}

test.describe('AC-12: storage that cannot be opened', () => {
  test('the Gallery says it is unavailable; open, edit, export work; nothing is stored; a replace asks', async ({
    page,
    browserName,
  }) => {
    test.setTimeout(90_000)
    // Playwright cannot refuse site data per context on every engine, so the hook makes the next
    // database open refuse and the page reloads into it: the same state as blocked site data.
    await gotoReady(page)
    await page.evaluate(() => window.__imglyTest!.galleryFailOpen())
    await page.reload()
    await expect(start(page)).toBeVisible()
    await expect(start(page)).toContainText(UNAVAILABLE_TITLE)
    await expect(start(page)).toContainText(REFUSED_BODY)
    await expect(entries(page)).toHaveCount(0)

    // Opening, editing and exporting work as before.
    await chooseFile(page, 1)
    await expectOpen(page, numberedName(1))
    await applyAdjustments(page, EDIT_A)
    expect((await work(page))!.adjustments).toEqual(EDIT_A)
    const exported = await exportPixels(page, browserName)
    expect([exported.width, exported.height]).toEqual([NUMBERED.width, NUMBERED.height])
    const preview = await previewPixels(page)
    const original = await page.evaluate(() => window.__imglyTest!.originalPixel(10, 10))
    const at = (10 * exported.width + 10) * 4
    const out = exported.data.slice(at, at + 4)
    expect(out, 'the Export carries the edit').not.toEqual(original)
    expect(out.map((v, i) => Math.abs(v - preview.data[at + i]!)).every((d) => d <= 2)).toBe(true)

    // The overlay says the same; nothing was stored or asked of the browser.
    await openGallery(page)
    await expect(overlay(page)).toContainText(UNAVAILABLE_TITLE)
    await expect(overlay(page)).toContainText(REFUSED_BODY)
    await page.keyboard.press('Escape')
    await expect(overlay(page)).toBeHidden()
    const after = await stored(page)
    expect(after.works).toEqual([])
    expect(after.originals).toEqual([])
    expect(await page.evaluate(() => window.__imglyTest!.galleryPersistCalls())).toBe(0)
    await expect(notice(page, SAVE_FAILED)).toHaveCount(0)

    // An Export leaves a Work with no Unsaved edits, so a further edit is the unsaved one that
    // nothing holds: replacing asks (open-and-view AC-15).
    await applyAdjustments(page, EDIT_B)
    const open = (await work(page))!
    expect(open.hasUnsavedEdits).toBe(true)
    await chooseFile(page, 2)
    await expect(replaceDialog(page)).toBeVisible()
    await expect(replaceDialog(page)).toContainText(NOT_SAVED)
    await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(replaceDialog(page)).toBeHidden()
    expect(await work(page)).toEqual(open)
    await chooseFile(page, 2)
    await replaceDialog(page).getByRole('button', { name: 'Replace' }).click()
    await expectOpen(page, numberedName(2))
    expect((await work(page))!.revision).toBe(0)

    // Without Unsaved edits it replaces without asking.
    await chooseFile(page, 3)
    await expectOpen(page, numberedName(3))
    await expect(replaceDialog(page)).toHaveCount(0)
    expect((await stored(page)).works).toEqual([])
  })
})

test.describe('AC-16: switching images with stored edits asks nothing', () => {
  test('"Open image", a drop and choosing a Work each replace with no dialog', async ({ page }) => {
    test.setTimeout(120_000)
    await gotoReady(page)
    const first = await openNumbered(page, 1)
    await applyAdjustments(page, EDIT_A)
    await waitForCommittedSave(page)

    // "Open image".
    await chooseFile(page, 2)
    await expectOpen(page, numberedName(2))
    await expect(replaceDialog(page)).toHaveCount(0)
    expect((await record(page, first))!.adjustments).toEqual(EDIT_A)
    const second = (await work(page))!.id
    await waitForStored(page, (works) => works.some((w) => w.id === second))

    // A drop.
    await applyAdjustments(page, EDIT_B)
    await waitForCommittedSave(page)
    await dropGeneratedImage(page, { width: 80, height: 60 })
    await expectOpen(page, 'generated')
    await expect(replaceDialog(page)).toHaveCount(0)
    expect((await record(page, second))!.adjustments).toEqual(EDIT_B)
    const dropped = (await work(page))!.id

    // Choosing a Work in the Gallery.
    await applyAdjustments(page, EDIT_C)
    await waitForCommittedSave(page)
    await openGallery(page)
    await chooseEntry(page, numberedName(1))
    await expectReopened(page, numberedName(1), NUMBERED)
    await expect(replaceDialog(page)).toHaveCount(0)
    expect((await work(page))!.adjustments).toEqual(EDIT_A)
    expect((await record(page, dropped))!.adjustments).toEqual(EDIT_C)

    // The previous Works are listed.
    await openGallery(page)
    await expect(entry(page, numberedName(2))).toHaveCount(1)
    await expect(entry(page, 'generated')).toHaveCount(1)
  })

  test('a save still running is waited for; the replacement then asks nothing', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await instrumentEncodes(page)
    await gotoReady(page)
    const first = await openNumbered(page, 1)
    await applyAdjustments(page, EDIT_A)
    await waitForCommittedSave(page)

    const next = await numberedImage(page, 2)
    await holdNextEncode(page)
    await applyAdjustments(page, EDIT_B)
    await openFile(page, 'img-02.png', next, 'image/png')

    // The save is held, so the replacement waits: still the old Work, nothing stored, no dialog.
    await page.waitForTimeout(1500)
    expect((await work(page))!.id).toBe(first)
    expect((await record(page, first))!.adjustments, 'the held save has not stored').toEqual(EDIT_A)
    await expect(replaceDialog(page)).toHaveCount(0)

    await releaseEncodes(page)
    await expectOpen(page, numberedName(2))
    await expect(replaceDialog(page)).toHaveCount(0)
    expect((await record(page, first))!.adjustments, 'the replacement waited for the save').toEqual(
      EDIT_B,
    )
  })
})

test.describe('AC-17: edits that are not stored ask before they are lost', () => {
  test('a failed save, then an open, asks; Cancel keeps the Work; Replace replaces', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await gotoReady(page)
    await openNumbered(page, 1)
    await page.evaluate(() => window.__imglyTest!.galleryFailNextSave())
    await applyAdjustments(page, EDIT_A)
    await expect(notice(page, SAVE_FAILED)).toHaveCount(1)
    expect((await stored(page)).works[0]!.adjustments, 'the edit was not stored').not.toEqual(
      EDIT_A,
    )
    const before = await work(page)

    await chooseFile(page, 2)
    await expect(replaceDialog(page)).toBeVisible()
    await expect(replaceDialog(page)).toContainText('Replace the current image?')
    await expect(replaceDialog(page)).toContainText(NOT_SAVED)
    await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(replaceDialog(page)).toBeHidden()
    expect(await work(page), 'Cancel keeps the Work exactly').toEqual(before)
    expect((await stored(page)).works.map((w) => w.sourceName)).toEqual([numberedName(1)])

    await chooseFile(page, 2)
    await expect(replaceDialog(page)).toBeVisible()
    await replaceDialog(page).getByRole('button', { name: 'Replace' }).click()
    await expectOpen(page, numberedName(2))
    expect((await work(page))!.id).not.toBe(before!.id)
  })

  test('a save that fails while the replacement waits makes it ask', async ({ page }) => {
    test.setTimeout(90_000)
    await instrumentEncodes(page)
    await gotoReady(page)
    const first = await openNumbered(page, 1)
    const next = await numberedImage(page, 2)
    await page.evaluate(() => window.__imglyTest!.galleryFailNextSave())
    await holdNextEncode(page)
    await applyAdjustments(page, EDIT_A)
    await openFile(page, 'img-02.png', next, 'image/png')

    await page.waitForTimeout(1500)
    expect((await work(page))!.id).toBe(first)
    await expect(replaceDialog(page), 'it waits, it does not ask yet').toHaveCount(0)

    await releaseEncodes(page)
    await expect(replaceDialog(page)).toBeVisible()
    await expect(replaceDialog(page)).toContainText(NOT_SAVED)
    await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()
    expect((await work(page))!.id).toBe(first)
    expect((await work(page))!.adjustments).toEqual(EDIT_A)
  })
})

test("AC-18: a newer version in another page closes this one's connection; it keeps editing", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000)
  await gotoReady(page)
  await openNumbered(page, 1)
  const open = (await work(page))!.id

  const other = await context.newPage()
  await gotoReady(other)
  await other.evaluate(() => window.__imglyTest!.galleryOpenNextVersion())

  await expect(notice(page, NEWER_VERSION)).toHaveCount(1)
  // This page keeps editing; the edit is not stored any more.
  await applyAdjustments(page, EDIT_A)
  expect((await work(page))!.adjustments).toEqual(EDIT_A)
  await page.waitForTimeout(1000)
  expect(await rawAdjustments(other, open), 'nothing more is stored from here').not.toEqual(EDIT_A)
  await expect(replaceDialog(page)).toHaveCount(0)

  // The Work has Unsaved edits that nothing holds, so a replace asks.
  const before = await work(page)
  await chooseFile(page, 2)
  await expect(replaceDialog(page)).toBeVisible()
  await expect(replaceDialog(page)).toContainText(NOT_SAVED)
  await replaceDialog(page).getByRole('button', { name: 'Cancel' }).click()
  expect(await work(page)).toEqual(before)
  await chooseFile(page, 2)
  await replaceDialog(page).getByRole('button', { name: 'Replace' }).click()
  await expectOpen(page, numberedName(2))

  // The overlay explains it.
  await openGallery(page)
  await expect(overlay(page)).toContainText(UNAVAILABLE_TITLE)
  await expect(overlay(page)).toContainText(
    'A newer version of the editor is open in another tab. Reload this page to use the Gallery.',
  )
})

test.describe('AC-20: the leave warning', () => {
  test('a reload during a save warns; staying lets the save commit; afterwards there is no warning', async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await instrumentEncodes(page)
    const dialogs: string[] = []
    let answer: 'accept' | 'dismiss' = 'dismiss'
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.type())
      void (answer === 'dismiss' ? dialog.dismiss() : dialog.accept())
    })
    await gotoReady(page)
    const id = await openNumbered(page, 1)

    await holdNextEncode(page)
    await applyAdjustments(page, EDIT_A)
    // The save is held; the browser only warns after a user gesture on the page.
    await page.getByTestId('editor-top-bar').click({ position: { x: 1, y: 1 } })
    expect((await record(page, id))!.adjustments, 'the save has not committed').not.toEqual(EDIT_A)

    answer = 'dismiss'
    // An in-page reload: Playwright's own `page.reload()` wedges Chromium once a dialog cancels it.
    await page.evaluate(() => void setTimeout(() => location.reload(), 0))
    await expect
      .poll(() => dialogs, { message: 'the leave dialog showed' })
      .toEqual(['beforeunload'])
    expect((await work(page))!.id, 'staying keeps the page').toBe(id)
    expect((await work(page))!.adjustments).toEqual(EDIT_A)

    // Staying lets the save finish.
    await releaseEncodes(page)
    await waitForCommittedSave(page)
    expect((await record(page, id))!.adjustments).toEqual(EDIT_A)

    // The Work has Unsaved edits, but they are stored: no warning.
    expect((await work(page))!.hasUnsavedEdits).toBe(true)
    dialogs.length = 0
    answer = 'accept'
    await page.reload()
    await expect(start(page)).toBeVisible()
    expect(dialogs, 'no dialog once nothing is saving').toEqual([])
    expect((await stored(page)).works[0]!.adjustments).toEqual(EDIT_A)
  })
})

test('AC-21: the Work open here survives its eviction by another page', async ({
  page,
  context,
}) => {
  test.setTimeout(240_000)
  await gotoReady(page)
  const mine = await openNumbered(page, 1)

  // The other page fills the Gallery; its 20th image evicts the Work open in the first page.
  const other = await context.newPage()
  await gotoReady(other)
  await expect(entries(other)).toHaveCount(1)
  for (let n = 2; n <= 21; n++) await openNumbered(other, n)
  await waitForStored(page, (works) => works.length === 20 && !works.some((w) => w.id === mine))
  expect((await stored(page)).works.map((w) => w.sourceName)).not.toContain(numberedName(1))
  await expect(
    notice(other, `“${numberedName(1)}” was removed from the Gallery to make room.`),
  ).toHaveCount(1)
  await dismissNotices(page)

  // An Apply here writes it back as the newest, evicting the oldest Work not open here.
  await applyAdjustments(page, EDIT_A)
  await waitForStored(page, (works) => works.some((w) => w.id === mine))
  const after = await stored(page)
  expect(after.works).toHaveLength(20)
  const back = after.works.find((w) => w.id === mine)!
  expect(back.adjustments).toEqual(EDIT_A)
  expect(back.touchedAt).toBe(Math.max(...after.works.map((w) => w.touchedAt)))
  expect(after.originals).toContain(mine)
  expect(after.works.map((w) => w.sourceName)).not.toContain(numberedName(2))
  expect(after.works.map((w) => w.sourceName)).toContain(numberedName(3))
  await expect(
    notice(page, `“${numberedName(2)}” was removed from the Gallery to make room.`),
  ).toHaveCount(1)
})

test('offline after the first load: list, reopen, Autosave and delete all succeed', async ({
  page,
  context,
  browserName,
}) => {
  test.setTimeout(120_000)
  await gotoReady(page)
  const a = await openNumbered(page, 1)
  const b = await openNumbered(page, 2)
  await page.evaluate(async () => {
    const container = navigator.serviceWorker
    await container.ready
    await new Promise<void>((resolve) => {
      if (container.controller) resolve()
      else container.addEventListener('controllerchange', () => resolve(), { once: true })
    })
  })

  await context.setOffline(true)
  // Playwright's WebKit cannot reload a page while offline (as in export's offline test), and its
  // offline mode also fails the service-worker-served fetch of a precached worker script, so a
  // reopen, which starts the codec worker, cannot run there. The rest of the row still does.
  const canReopen = browserName !== 'webkit'
  if (canReopen) {
    await page.reload()
    await expect(start(page)).toBeVisible()
  } else {
    await openGallery(page)
  }
  await expect(entries(page)).toHaveCount(2)

  // Reopen img-01 (img-02 stays open on WebKit and takes its place below).
  const [kept, removed, keptName, removedName] = canReopen
    ? [a, b, numberedName(1), numberedName(2)]
    : [b, a, numberedName(2), numberedName(1)]
  if (canReopen) {
    await chooseEntry(page, numberedName(1))
    await expectReopened(page, numberedName(1), NUMBERED)
  } else {
    await page.keyboard.press('Escape')
    await expect(overlay(page)).toBeHidden()
  }
  expect((await work(page))?.id ?? kept).toBe(kept)

  await applyAdjustments(page, EDIT_A)
  await waitForCommittedSave(page)
  expect((await record(page, kept))!.adjustments).toEqual(EDIT_A)

  await openGallery(page)
  await page.getByRole('button', { name: `Delete “${removedName}”` }).click()
  await replaceDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(entries(page)).toHaveCount(1)
  await expect(entry(page, keptName)).toHaveCount(1)
  await expect.poll(async () => (await record(page, removed)) === undefined).toBe(true)
  expect((await stored(page)).originals).toEqual([kept])
})
