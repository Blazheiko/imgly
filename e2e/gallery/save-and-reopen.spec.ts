/**
 * Autosave and exact reopen through the real UI on each engine (gallery spec AC-01 to AC-05, AC-18;
 * QG-2). Every pixel comparison stays within one engine, and its tolerance is 0: a Work that comes
 * back different fails the row, it is never loosened (test-plan §Decisions, exactness).
 */
import type { Page } from '@playwright/test'
import { openFile, fixture, choose, panel } from '../export/helpers'
import { openNamed, field, slider } from '../adjust/helpers'
import { clickAndWait, redoButton, undoButton } from '../undo-redo/helpers'
import {
  button as drawButton,
  drag,
  drawingAlpha,
  draftMarks,
  openTool as openDrawTool,
  setWidth,
  tool as drawTool,
} from '../draw/helpers'
import {
  action as cropAction,
  frame as cropFrame,
  statusSize,
  tool as cropTool,
} from '../crop-rotate/helpers'
import {
  ALL_SEVEN,
  expect,
  test,
  OPAQUE_SET,
  SEMI_TRANSPARENT_SET,
  applyAllSeven,
  applyDrawing,
  applyReferenceGeometry,
  chooseEntry,
  chooseEntryById,
  entryNames,
  expectNoLeakedBitmaps,
  expectReopened,
  exportPixels,
  gotoReady,
  interruptions,
  maxDifference,
  openGallery,
  overlay,
  previewPixels,
  readStoredPng,
  referenceGeometry,
  reloadToStart,
  start,
  stored,
  thumbnailPixels,
  waitForCommittedSave,
  waitForStored,
  work,
  type Pixels,
} from './helpers'

const PHOTO = OPAQUE_SET[0]
const marked = (alpha: number[]) => alpha.filter((a) => a > 0).length
const view = (page: Page) => page.evaluate(() => window.__imglyTest!.view())

/** The Crop and Straighten angle, all seven Adjustments and a drawing, stored. */
async function editAll(page: Page, size: { width: number; height: number }) {
  await applyReferenceGeometry(page, size)
  await applyAllSeven(page)
  await applyDrawing(page)
  await waitForCommittedSave(page, { drawing: true })
}

/** The reopened Work shows all three changes, with an empty Edit history (AC-01, AC-04). */
async function expectAllThree(page: Page, size: { width: number; height: number }) {
  const w = (await work(page))!
  expect(w.geometry).toEqual(referenceGeometry(size))
  expect(w.adjustments).toEqual(ALL_SEVEN)
  expect(marked(await drawingAlpha(page))).toBeGreaterThan(0)
  expect(w.hasUnsavedEdits).toBe(false)
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(redoButton(page)).toHaveAttribute('aria-disabled', 'true')
}

/**
 * The thumbnail is the Preview renderer's render of the same Work (AC-01), within one engine. Both
 * are rendered by the same shader chain; the thumbnail takes a PNG round trip on top.
 */
async function expectThumbnailMatches(thumbnail: Pixels, preview: Pixels) {
  expect([thumbnail.width, thumbnail.height]).toEqual([preview.width, preview.height])
  expect(maxDifference(thumbnail, preview)).toBeLessThanOrEqual(THUMBNAIL_TOLERANCE)
}
// The thumbnail is read back from the framebuffer of its own pass and takes a PNG round trip; the
// Preview's render is a different pass, so a single 8-bit rounding step is allowed (a missing Crop,
// Adjustment or drawing differs by far more). The Export comparisons below keep tolerance 0.
const THUMBNAIL_TOLERANCE = 2

test.describe('AC-01: Autosave keeps a Crop, an Adjustment and a drawing', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000)
    await gotoReady(page)
    await openNamed(page, PHOTO.name, PHOTO.width, PHOTO.height)
    await editAll(page, PHOTO)
  })

  test('survive a reload: the Work is listed first, reopens with all three, and its thumbnail matches the Preview', async ({
    page,
  }) => {
    await reloadToStart(page, 1)
    expect(await entryNames(page)).toEqual(['photo, Just now'])
    const thumbnail = await thumbnailPixels(page, PHOTO.name)
    await chooseEntry(page, PHOTO.name)
    await expectReopened(page, PHOTO.name, referenceGeometry(PHOTO).crop)
    await expectAllThree(page, PHOTO)
    await expectThumbnailMatches(thumbnail, await previewPixels(page))
    await expectNoLeakedBitmaps(page)
  })

  test('survive a closed page: a new page of the same browser lists it first and reopens it', async ({
    context,
    page,
  }) => {
    await page.close()
    const next = await context.newPage()
    await gotoReady(next)
    await expect(start(next)).toBeVisible()
    expect(await entryNames(next)).toEqual(['photo, Just now'])
    const thumbnail = await thumbnailPixels(next, PHOTO.name)
    await chooseEntry(next, PHOTO.name)
    await expectReopened(next, PHOTO.name, referenceGeometry(PHOTO).crop)
    await expectAllThree(next, PHOTO)
    await expectThumbnailMatches(thumbnail, await previewPixels(next))
    await expectNoLeakedBitmaps(next)
  })

  test('survive opening another image: the stored Work comes back with all three', async ({
    page,
  }) => {
    const id = (await work(page))!.id
    await openNamed(page, 'ref.png', 48, 32)
    await waitForStored(page, (works) => works.length === 2 && works.some((w) => w.id === id))
    // The newer image is listed first; the edited Work is second, with every applied change.
    await openGallery(page)
    expect(await entryNames(page)).toEqual(['ref, Open', 'photo, Just now'])
    const thumbnail = await thumbnailPixels(page, PHOTO.name)
    await chooseEntry(page, PHOTO.name)
    await expectReopened(page, PHOTO.name, referenceGeometry(PHOTO).crop)
    await expectAllThree(page, PHOTO)
    await expectThumbnailMatches(thumbnail, await previewPixels(page))
    await openGallery(page)
    expect(await entryNames(page)).toEqual(['photo, Open', 'ref, Just now'])
    await page.keyboard.press('Escape')
    await expectNoLeakedBitmaps(page)
  })
})

test('AC-01: a save in flight never interrupts editing: Undo, Redo and a tool stay usable, and nothing is shown', async ({
  page,
}) => {
  await gotoReady(page)
  await openNamed(page, 'ref.png', 48, 32)
  await waitForCommittedSave(page)
  // The next save holds its transaction open for good, so it is running for the whole test.
  await page.evaluate(() => window.__imglyTest!.galleryHoldSave('record'))
  await applyAllSeven(page)
  const read = await page.evaluate(() =>
    Promise.race([
      window.__imglyTest!.galleryRecords().then(() => 'read'),
      new Promise<string>((resolve) => setTimeout(() => resolve('blocked'), 1_000)),
    ]),
  )
  expect(read, 'the save is still running: its transaction blocks a read').toBe('blocked')

  await clickAndWait(page, undoButton(page))
  expect((await work(page))!.adjustments.brightness).toBe(0)
  await clickAndWait(page, redoButton(page))
  expect((await work(page))!.adjustments.brightness).toBe(ALL_SEVEN.brightness)
  await page.getByTestId('adjust-action').click()
  await expect(page.getByTestId('adjust-tool')).toBeVisible()
  await expect(slider(page, 'Brightness')).toBeFocused()
  await field(page, 'Brightness').fill('5')
  await field(page, 'Brightness').press('Enter')
  await expect(field(page, 'Brightness')).toHaveValue('5')
  expect(await interruptions(page)).toEqual({ dialogs: 0, spinners: 0, notices: 0 })
})

test('AC-02: an undone drawing, a zoom and an open Draft are all gone after a reload', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await gotoReady(page)
  await openNamed(page, PHOTO.name, PHOTO.width, PHOTO.height)
  await applyDrawing(page)
  await waitForCommittedSave(page, { drawing: true })
  expect(marked(await drawingAlpha(page)), 'the drawing is there before the Undo').toBeGreaterThan(
    0,
  )
  await clickAndWait(page, undoButton(page))
  // The Undo is stored like any Step: the record loses its layer.
  await waitForCommittedSave(page, { drawing: false })
  expect(marked(await drawingAlpha(page))).toBe(0)

  const box = (await page.getByTestId('preview-canvas').boundingBox())!
  const fitted = await view(page)
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20)
  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -200)
  await page.keyboard.up('Control')
  await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(fitted.zoom)
  expect((await view(page)).autoFit).toBe(false)

  await openDrawTool(page)
  await drag(page, [
    [150, 110],
    [180, 130],
  ])
  expect(await draftMarks(page), 'strokes that are not applied are in the Draft').toBeGreaterThan(0)

  await reloadToStart(page, 1)
  await chooseEntry(page, PHOTO.name)
  await expectReopened(page, PHOTO.name, PHOTO)
  expect(marked(await drawingAlpha(page)), 'no drawing').toBe(0)
  expect(await draftMarks(page), 'no Draft').toBe(0)
  expect((await view(page)).autoFit, 'fitted, not zoomed').toBe(true)
  expect((await view(page)).zoom).toBeCloseTo(fitted.zoom, 5)
  await expect(undoButton(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(redoButton(page)).toHaveAttribute('aria-disabled', 'true')
  await expectNoLeakedBitmaps(page)
})

test('AC-03: the Gallery lists Works newest first, marks the open one, counts places and closes unchanged', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await gotoReady(page)
  const images = [
    { name: 'ref.png', width: 48, height: 32 },
    { name: 'alpha-patches.png', width: 24, height: 16 },
    { name: 'soft-edge.png', width: 40, height: 30 },
  ]
  for (const [i, image] of images.entries()) {
    await openNamed(page, image.name, image.width, image.height)
    await waitForStored(page, (works) => works.length === i + 1)
  }
  // Edit the first again: reopen it from the Gallery, then change it.
  await openGallery(page)
  await chooseEntry(page, 'ref.png')
  await expectReopened(page, 'ref.png', images[0]!)
  await applyAllSeven(page)
  await waitForCommittedSave(page)

  await openGallery(page)
  expect(await entryNames(page)).toEqual([
    'ref, Open',
    'soft-edge, Just now',
    'alpha-patches, Just now',
  ])
  await expect(page.getByTestId('gallery-count')).toHaveText('3 of 20 places used')
  for (const name of ['ref.png', 'soft-edge.png', 'alpha-patches.png']) {
    await expect(page.locator('.gallery-entry img').first()).toBeVisible()
    expect((await thumbnailPixels(page, name)).width).toBeGreaterThan(0)
  }
  await expect(page.locator('.gallery-entry--open')).toHaveCount(1)
  await expect(page.locator('.gallery-entry--open .gallery-entry__name')).toHaveText('ref')

  const before = { work: await work(page), view: await view(page) }
  await overlay(page).getByRole('button', { name: 'Close' }).click()
  await expect(overlay(page)).toBeHidden()
  expect({ work: await work(page), view: await view(page) }).toEqual(before)
  await expectNoLeakedBitmaps(page)
})

test.describe('AC-04: a reopened Work exports identically', () => {
  test.beforeEach(() => test.setTimeout(180_000))

  for (const image of OPAQUE_SET) {
    test(`${image.name} with a Crop, a Straighten angle, all seven Adjustments and a drawing, after a reload`, async ({
      page,
      browserName,
    }) => {
      await gotoReady(page)
      await openNamed(page, image.name, image.width, image.height)
      await editAll(page, image)
      const before = await exportPixels(page, browserName)
      expect([before.width, before.height]).toEqual([
        referenceGeometry(image).crop.width,
        referenceGeometry(image).crop.height,
      ])

      await reloadToStart(page, 1)
      await chooseEntry(page, image.name)
      await expectReopened(page, image.name, referenceGeometry(image).crop)
      await expectAllThree(page, image)
      const after = await exportPixels(page, browserName)
      expect(maxDifference(after, before), 'per channel, alpha included').toBe(0)
      await expectNoLeakedBitmaps(page)
    })
  }

  for (const image of SEMI_TRANSPARENT_SET) {
    test(`${image.name} with a drawing reopens exactly, alpha included`, async ({
      page,
      browserName,
    }) => {
      await gotoReady(page)
      await openNamed(page, image.name, image.width, image.height)
      await applyDrawing(page)
      await waitForCommittedSave(page, { drawing: true })
      const before = await exportPixels(page, browserName)
      expect(
        before.data.some((v, i) => i % 4 === 3 && v > 0 && v < 255),
        'the Export has semi-transparent pixels',
      ).toBe(true)

      await reloadToStart(page, 1)
      await chooseEntry(page, image.name)
      await expectReopened(page, image.name, image)
      const after = await exportPixels(page, browserName)
      expect(maxDifference(after, before), 'per channel, alpha included').toBe(0)
      await expectNoLeakedBitmaps(page)
    })
  }

  test('photo.png chosen with another Work open reopens exactly too', async ({
    page,
    browserName,
  }) => {
    await gotoReady(page)
    await openNamed(page, PHOTO.name, PHOTO.width, PHOTO.height)
    await editAll(page, PHOTO)
    const before = await exportPixels(page, browserName)
    await openNamed(page, 'ref.png', 48, 32)
    await waitForStored(page, (works) => works.length === 2)
    await openGallery(page)
    await chooseEntry(page, PHOTO.name)
    await expectReopened(page, PHOTO.name, referenceGeometry(PHOTO).crop)
    expect(maxDifference(await exportPixels(page, browserName), before)).toBe(0)
    await expectNoLeakedBitmaps(page)
  })

  test('each part stays editable after the reopen, and the Source name picks the Export', async ({
    page,
  }) => {
    await gotoReady(page)
    await openNamed(page, PHOTO.name, PHOTO.width, PHOTO.height)
    await editAll(page, PHOTO)
    await reloadToStart(page, 1)
    await chooseEntry(page, PHOTO.name)
    await expectReopened(page, PHOTO.name, referenceGeometry(PHOTO).crop)
    const revision = (await work(page))!.revision
    const crop = referenceGeometry(PHOTO).crop

    // "Crop and rotate": the whole image, with the stored frame and angle.
    await cropAction(page).click()
    await expect(cropTool(page)).toBeVisible()
    await expect(cropFrame(page)).toBeVisible()
    await expect(page.getByLabel('Width', { exact: true })).toHaveValue(String(crop.width))
    await expect(page.getByLabel('Height', { exact: true })).toHaveValue(String(crop.height))
    await expect(statusSize(page)).toContainText(`from ${PHOTO.width} × ${PHOTO.height} px`)
    await expect(page.getByRole('slider', { name: 'Straighten' })).toHaveValue(
      String(referenceGeometry(PHOTO).straighten / 10),
    )
    await page.keyboard.press('Escape')
    await expect(cropTool(page)).toBeHidden()

    // "Adjust": the stored slider values.
    await page.getByTestId('adjust-action').click()
    await expect(page.getByTestId('adjust-tool')).toBeVisible()
    const shown: Record<string, number> = {}
    for (const name of Object.keys(ALL_SEVEN)) {
      shown[name.toLowerCase()] = Number(
        await field(page, name[0]!.toUpperCase() + name.slice(1)).inputValue(),
      )
    }
    expect(shown).toEqual(ALL_SEVEN)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('adjust-tool')).toBeHidden()
    expect((await work(page))!.revision, 'looking changed nothing').toBe(revision)

    // "Draw": the Brush adds to the stored layer and the Eraser removes from it.
    const stock = marked(await drawingAlpha(page))
    expect(stock).toBeGreaterThan(0)
    await openDrawTool(page)
    await setWidth(page, 20)
    const middle = PHOTO.height / 2
    await drag(page, [
      [30, middle],
      [150, middle],
    ])
    await drawButton(page, 'Apply').click()
    const painted = marked(await drawingAlpha(page))
    expect(painted, 'the Brush painted on the stored layer').toBeGreaterThan(stock)
    await openDrawTool(page)
    await page.keyboard.press('e')
    await expect(drawTool(page).getByRole('radio', { name: 'Eraser' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await setWidth(page, 200)
    await drag(page, [
      [10, middle],
      [150, middle],
    ])
    await drawButton(page, 'Apply').click()
    expect(marked(await drawingAlpha(page)), 'the Eraser erased').toBeLessThan(painted)

    // The Export follows the Source name and format.
    await choose(page)
    await expect(panel(page)).toContainText('photo-edited.png')
    await expect(panel(page).getByRole('radio', { name: 'PNG', exact: true })).toBeChecked()
  })

  test('a JPEG Source reopens with a JPEG Export named after it', async ({ page }) => {
    await gotoReady(page)
    await openFile(page, 'photo.jpg', fixture('photo.jpg'), 'image/jpeg')
    await expect.poll(() => work(page).then((w) => w?.sourceName)).toBe('photo')
    const size = (await work(page))!
    await applyDrawing(page)
    await waitForCommittedSave(page, { drawing: true })
    await openNamed(page, 'ref.png', 48, 32)
    await waitForStored(page, (works) => works.length === 2)
    await reloadToStart(page, 2)

    // The default format needs the browser's format check (export AC-19), which runs the first time
    // a panel opens: do that on the PNG Work, then reopen the JPEG one.
    await chooseEntry(page, 'ref.png')
    await expectReopened(page, 'ref.png', { width: 48, height: 32 })
    await choose(page)
    await expect(panel(page).getByRole('radio', { name: 'JPEG', exact: true })).toBeEnabled({
      timeout: 15_000,
    })
    await expect(panel(page)).toContainText('ref-edited.png')
    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()

    await openGallery(page)
    await chooseEntry(page, 'photo.jpg')
    await expectReopened(page, 'photo.jpg', { width: size.width, height: size.height })
    expect((await work(page))!.sourceFormat).toBe('jpeg')
    await choose(page)
    await expect(panel(page)).toContainText('photo-edited.jpg')
    await expect(panel(page).getByRole('radio', { name: 'JPEG', exact: true })).toBeChecked()
    await page.keyboard.press('Escape')
    await expectNoLeakedBitmaps(page)
  })
})

test('AC-05: a first visit shows the empty state; after an edit and a reload one choice reopens the Work', async ({
  page,
}) => {
  await gotoReady(page)
  await expect(start(page)).toBeVisible()
  await expect(page.getByTestId('gallery-empty')).toContainText('Works you open will appear here.')
  await expect(page.getByTestId('gallery-open-image')).toHaveText('Open image')
  await expect(page.getByTestId('gallery-storage-line')).toBeVisible()
  await expect(page.locator('.gallery-entry')).toHaveCount(0)

  await openNamed(page, 'ref.png', 48, 32)
  await applyAllSeven(page)
  await waitForCommittedSave(page)

  await reloadToStart(page, 1)
  expect(await work(page), 'nothing reopens on its own').toBeNull()
  await expect(page.getByTestId('preview-canvas')).toHaveCount(0)
  await expect(page.getByTestId('gallery-empty')).toHaveCount(0)
  expect(await entryNames(page)).toEqual(['ref, Just now'])

  await chooseEntry(page, 'ref.png') // the one action
  await expectReopened(page, 'ref.png', { width: 48, height: 32 })
  expect((await work(page))!.adjustments).toEqual(ALL_SEVEN)
  await expectNoLeakedBitmaps(page)
})

test('AC-18: a Work stored in the earlier shape reopens exactly, and the Gallery loses nothing', async ({
  page,
  browserName,
}) => {
  test.setTimeout(120_000)
  await gotoReady(page)
  await openNamed(page, 'ref.png', 48, 32)
  const size = { width: 48, height: 32 }
  await editAll(page, size)
  const open = (await work(page))!
  const alphaBefore = await drawingAlpha(page)
  const before = await exportPixels(page, browserName)
  const layerPng = await readStoredPng(page, 'layers', open.id)

  // The same Work, written by a hook in the `formatVersion: 1` layout: the Original from the
  // fixture file, the layer as the app encoded it.
  const v1Id = await page.evaluate((input) => window.__imglyTest!.galleryWriteStored(input), {
    sourceName: 'ref-v1',
    sourceFormat: 'png',
    geometry: open.geometry,
    adjustments: open.adjustments,
    touchedAt: 1_000,
    width: size.width,
    height: size.height,
    originalPng: Array.from(fixture('ref.png')),
    layerPng,
  })
  const written = (await stored(page)).works.find((w) => w.id === v1Id)!
  expect(written.formatVersion).toBe(1)

  await reloadToStart(page, 2)
  const ids = (await stored(page)).works.map((w) => w.id)
  expect(ids).toEqual(expect.arrayContaining([open.id, v1Id]))
  await chooseEntryById(page, v1Id)
  await expectReopened(page, 'ref-v1', referenceGeometry(size).crop)
  const reopened = (await work(page))!
  expect(reopened).toMatchObject({
    sourceFormat: 'png',
    geometry: open.geometry,
    adjustments: open.adjustments,
    originalWidth: 48,
    originalHeight: 32,
  })
  expect(await drawingAlpha(page)).toEqual(alphaBefore)
  expect(maxDifference(await exportPixels(page, browserName), before)).toBe(0)
  expect((await stored(page)).works.map((w) => w.id).sort()).toEqual([open.id, v1Id].sort())
  await expectNoLeakedBitmaps(page)
})
