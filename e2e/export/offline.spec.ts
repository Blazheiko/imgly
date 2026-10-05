import { expect, test } from '@playwright/test'
import {
  choose,
  confirmAndCapture,
  expectSaved,
  generateImage,
  gotoReady,
  headerOf,
  openFile,
  prepareCapture,
  waitForWork,
} from './helpers'

// AC-18: after one load, an export works with no network — the export worker comes from the
// precache, like the decode worker (open-and-view QG-1b).
test('exports a file after going offline and reloading', async ({
  page,
  context,
  request,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot reload a page while offline')
  const sw = await (await request.get('sw.js')).text()
  expect(sw).toMatch(/assets\/export\.worker-[\w-]+\.js/)

  await gotoReady(page)
  // Generate the image while online: nothing about it needs the network.
  const image = await generateImage(page, { width: 320, height: 240 })
  await page.evaluate(async () => {
    const container = navigator.serviceWorker
    await container.ready
    await new Promise<void>((resolve) => {
      if (container.controller) resolve()
      else container.addEventListener('controllerchange', () => resolve(), { once: true })
    })
  })

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Open image' })).toBeVisible()

  await openFile(page, 'offline.png', image, 'image/png')
  await waitForWork(page, 320, 240)
  await prepareCapture(page, browserName)
  await choose(page, { format: 'PNG' })
  const file = await confirmAndCapture(page, browserName)
  await expectSaved(page)
  expect(file.name).toBe('offline-edited.png')
  expect(headerOf(file.bytes)).toMatchObject({ format: 'png', width: 320, height: 240 })
})
